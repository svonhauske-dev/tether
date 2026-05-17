// supabase/functions/recompute_notifications/index.ts
// On-demand recompute: clears the 48-hour notification window for a user and
// re-inserts fresh rows based on their current schedule + supplements.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  addMins,
  getLocalDateStr,
  getLocalDayOfWeek,
  parseLocalHHMM,
  deriveOffsets,
  getModeSlotLabel,
  getAnchorTitle,
  isSupplementActiveOn,
  computeIFSlotTimesHHMM,
  SLOT_LABELS,
  TIMED_SLOT_IDS,
  IF_TIMED_SLOT_IDS,
} from "../_shared/helpers.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── Authenticate ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const jwt = authHeader.slice(7);

  // ── Parse optional body ───────────────────────────────────────────────────────
  let tz = "UTC";
  try {
    const body = await req.json();
    if (typeof body?.timezone === "string" && body.timezone.length > 0) {
      tz = body.timezone;
    }
  } catch { /* empty body or non-JSON — fall back to UTC */ }

  // ── Supabase clients ──────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the user JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const userId = user.id;

  // Admin client for all DB writes (bypasses RLS)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Read user state in parallel ───────────────────────────────────────────────
  const localToday    = getLocalDateStr(tz, 0);
  const localTomorrow = getLocalDateStr(tz, 1);

  // Auto-stop supplements whose treatment window has ended
  await admin
    .from("supplements")
    .update({ status: "stopped", stopped_at: localToday })
    .eq("user_id", userId)
    .in("treatment_mode", ["scheduled", "cycled"])
    .eq("status", "active")
    .not("ends_at", "is", null)
    .lte("ends_at", localToday);

  const [schedResult, suppsResult, logResult, subResult] = await Promise.all([
    admin.from("user_schedule").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("supplements")
      .select("id, name, slots, days, treatment_mode, starts_at, ends_at, cycle_on_value, cycle_on_unit, cycle_off_value, cycle_off_unit")
      .eq("user_id", userId)
      .eq("status", "active"),
    admin.from("daily_logs")
      .select("pill_time")
      .eq("user_id", userId)
      .eq("log_date", localToday)
      .maybeSingle(),
    admin.from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const sched    = schedResult.data;
  // deno-lint-ignore no-explicit-any
  const supps: any[] = suppsResult.data ?? [];
  const pillTime: string | null = logResult.data?.pill_time?.slice(0, 5) ?? null;
  const hasSub   = (subResult.count ?? 0) > 0;

  // ── Early exits ───────────────────────────────────────────────────────────────
  const mode: string = sched?.schedule_type ?? "none";

  if (!hasSub || !sched?.notifications_enabled || mode === "none") {
    return new Response(
      JSON.stringify({ queued: 0, reason: "skip", hasSub, notifEnabled: sched?.notifications_enabled ?? false, mode }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // ── Extract schedule config ───────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const cfg: Record<string, any> = sched.offsets ?? {};
  const anchorBehavior: string = cfg._anchor_behavior ?? "flexible";
  const consistentTime: string | null = cfg._consistent_time ?? null;

  // ── Compute notifications for today + tomorrow ────────────────────────────────
  const now = new Date();
  const plus48 = new Date(now.getTime() + 48 * 3_600_000);

  type QueueRow = {
    user_id: string;
    fire_at: string;
    scheduled_for_date: string;
    title: string;
    body: string;
    slot_id: string;
    tag: string;
    fired: boolean;
  };

  const rows: QueueRow[] = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const dateStr   = getLocalDateStr(tz, dayOffset);
    const dayOfWeek = getLocalDayOfWeek(dateStr, tz);
    const isToday   = dayOffset === 0;

    // ── Fixed mode ──────────────────────────────────────────────────────────────
    if (mode === "fixed") {
      const fixedTimes: Record<string, string | null> = cfg.fixed_times ?? {};
      const preMealWindow: number = (cfg.pre_meal_window as number) ?? 0;

      for (const slotId of TIMED_SLOT_IDS) {
        if (slotId === "rx") continue; // no single anchor in fixed mode

        let fireAt: Date;
        // Pre-meal slots derive from their meal time minus the global window.
        if (slotId === "pre_breakfast" || slotId === "pre_lunch" || slotId === "pre_dinner") {
          const mealId = slotId.replace("pre_", "");
          const mealTime = fixedTimes[mealId];
          if (!mealTime) continue;
          fireAt = addMins(parseLocalHHMM(dateStr, mealTime, tz), -preMealWindow);
        } else {
          const fixedTime = fixedTimes[slotId];
          if (!fixedTime) continue;
          fireAt = parseLocalHHMM(dateStr, fixedTime, tz);
        }

        if (fireAt <= now) continue;

        const slotSupps = supps.filter(
          (s) => Array.isArray(s.slots) && s.slots.includes(slotId) &&
                 Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                 isSupplementActiveOn(s, dateStr),
        );
        if (!slotSupps.length) continue;

        rows.push({
          user_id:             userId,
          fire_at:             fireAt.toISOString(),
          scheduled_for_date:  fireAt.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:               `Time for ${SLOT_LABELS[slotId] ?? slotId}`,
          body:                slotSupps.map((s) => s.name).join(", "),
          slot_id:             slotId,
          tag:                 `${dateStr}_${slotId}`,
          fired:               false,
        });
      }
      continue; // done with this day for fixed mode
    }

    // ── IF v2 (fasting, migrated) ────────────────────────────────────────────────
    if (mode === "fasting" && cfg._if_v2_migrated) {
      const wsHHMM = cfg.eating_window_start as string | undefined;
      if (!wsHHMM) continue;

      const durationMins = ((cfg.eating_window_duration_hours as number) ?? 8) * 60;
      const slotTimes    = computeIFSlotTimesHHMM(cfg);

      // fasted — unconditional window-opening warning, body lists fasted supplements if any
      if (slotTimes.fasted) {
        const fastedAt = parseLocalHHMM(dateStr, slotTimes.fasted, tz);
        if (fastedAt > now) {
          const fastedSupps = supps.filter(
            (s) => Array.isArray(s.slots) && s.slots.includes("fasted") &&
                   Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                   isSupplementActiveOn(s, dateStr),
          );
          rows.push({
            user_id:            userId,
            fire_at:            fastedAt.toISOString(),
            scheduled_for_date: fastedAt.toLocaleDateString("sv-SE", { timeZone: tz }),
            title:              "Your eating window opens in 30 minutes",
            body:               fastedSupps.map((s) => s.name).join(", "),
            slot_id:            "fasted",
            tag:                `${dateStr}_fasted`,
            fired:              false,
          });
        }
      }

      // meal_1 / window open — unconditional state transition, lists meal_1 supplements
      const windowOpenAt = parseLocalHHMM(dateStr, wsHHMM, tz);
      if (windowOpenAt > now) {
        const meal1Supps = supps.filter(
          (s) => Array.isArray(s.slots) && s.slots.includes("meal_1") &&
                 Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                 isSupplementActiveOn(s, dateStr),
        );
        rows.push({
          user_id:            userId,
          fire_at:            windowOpenAt.toISOString(),
          scheduled_for_date: windowOpenAt.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:              "Your eating window is open",
          body:               meal1Supps.map((s) => s.name).join(", "),
          slot_id:            "meal_1",
          tag:                `${dateStr}_meal_1`,
          fired:              false,
        });
      }

      // window_closing — 30-min warning, unless a meal slot with supplements fires at the same minute
      // (e.g. with default pre_meal_window=30, the last meal fires at window_end - 30, which is identical
      // to the closing time — the meal notification covers the closing message, so skip the duplicate).
      const closingAt    = addMins(windowOpenAt, durationMins - 30);
      const closingTime  = closingAt.getTime();
      const closingCoveredByMeal = IF_TIMED_SLOT_IDS.some((slotId) => {
        if (slotId === "evening") return false;
        const hhmm = slotTimes[slotId as string];
        if (!hhmm) return false;
        const at = parseLocalHHMM(dateStr, hhmm, tz);
        if (Math.abs(at.getTime() - closingTime) >= 60_000) return false;
        return supps.some(
          (s) => Array.isArray(s.slots) && s.slots.includes(slotId) &&
                 Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                 isSupplementActiveOn(s, dateStr),
        );
      });
      if (closingAt > now && !closingCoveredByMeal) {
        rows.push({
          user_id:            userId,
          fire_at:            closingAt.toISOString(),
          scheduled_for_date: closingAt.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:              "Your eating window closes in 30 minutes",
          body:               "",
          slot_id:            "window_closing",
          tag:                `${dateStr}_window_closing`,
          fired:              false,
        });
      }

      // Meal slots conditional on supplements (pre_meal_2, meal_2, pre_meal_3, meal_3).
      // `fasted` and `meal_1` already fired unconditionally above; `evening` is handled below.
      for (const slotId of IF_TIMED_SLOT_IDS) {
        if (slotId === "evening") continue; // handled separately below
        const hhmm = slotTimes[slotId as string];
        if (!hhmm) continue;
        const fireAt = parseLocalHHMM(dateStr, hhmm, tz);
        if (fireAt <= now) continue;
        const slotSupps = supps.filter(
          (s) => Array.isArray(s.slots) && s.slots.includes(slotId) &&
                 Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                 isSupplementActiveOn(s, dateStr),
        );
        if (!slotSupps.length) continue;
        rows.push({
          user_id:            userId,
          fire_at:            fireAt.toISOString(),
          scheduled_for_date: fireAt.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:              `Time for ${SLOT_LABELS[slotId] ?? slotId}`,
          body:               slotSupps.map((s) => s.name).join(", "),
          slot_id:            slotId,
          tag:                `${dateStr}_${slotId}`,
          fired:              false,
        });
      }

      // evening — conditional on evening_mode and supplements
      {
        let eveningAt: Date | null = null;
        const em = cfg.evening_mode;
        if (em === "fixed" && cfg.evening_time) {
          eveningAt = parseLocalHHMM(dateStr, cfg.evening_time as string, tz);
        } else if (em === "before_sleep" && cfg.sleep_time) {
          const offsetMins = ((cfg.evening_offset_hours as number) ?? 1) * 60 + ((cfg.evening_offset_minutes as number) ?? 0);
          eveningAt = addMins(parseLocalHHMM(dateStr, cfg.sleep_time as string, tz), -offsetMins);
        }
        if (eveningAt && eveningAt > now) {
          const slotSupps = supps.filter(
            (s) => Array.isArray(s.slots) && s.slots.includes("evening") &&
                   Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                   isSupplementActiveOn(s, dateStr),
          );
          if (slotSupps.length) {
            rows.push({
              user_id:            userId,
              fire_at:            eveningAt.toISOString(),
              scheduled_for_date: eveningAt.toLocaleDateString("sv-SE", { timeZone: tz }),
              title:              "Time for Evening",
              body:               slotSupps.map((s) => s.name).join(", "),
              slot_id:            "evening",
              tag:                `${dateStr}_evening`,
              fired:              false,
            });
          }
        }
      }

      continue; // done with this day for IF v2
    }

    // ── Offset-based modes (medication / wakeup / fasting v1) ───────────────────

    // Determine anchor time for this day
    let anchorHHMM: string | null = null;

    if (anchorBehavior === "consistent" && consistentTime) {
      anchorHHMM = consistentTime;
    } else {
      // flexible — only today has a known anchor (user sets it each morning)
      if (!isToday || !pillTime) continue;
      anchorHHMM = pillTime;
    }

    const anchorDate = parseLocalHHMM(dateStr, anchorHHMM, tz);

    if (mode === "fasting") {
      // IF mode: window_open and window_closing fire unconditionally — they are
      // state transitions for the eating window, not supplement reminders.
      // rx slot has no meaning in IF mode.
      if (anchorDate > now) {
        rows.push({
          user_id:             userId,
          fire_at:             anchorDate.toISOString(),
          scheduled_for_date:  anchorDate.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:               "Your eating window is open",
          body:                "",
          slot_id:             "window_open",
          tag:                 `${dateStr}_window_open`,
          fired:               false,
        });
      }
      const windowLength: number = ((cfg.window_length as number) ?? 480);
      const closingAt = addMins(anchorDate, windowLength - 30);
      if (closingAt > now) {
        rows.push({
          user_id:             userId,
          fire_at:             closingAt.toISOString(),
          scheduled_for_date:  closingAt.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:               "Your eating window closes in 30 minutes",
          body:                "",
          slot_id:             "window_closing",
          tag:                 `${dateStr}_window_closing`,
          fired:               false,
        });
      }
    } else {
      // medication / wakeup: rx fires at anchor time, gated on supplements
      const rxSupps = supps.filter(
        (s) => Array.isArray(s.slots) && s.slots.includes("rx") &&
               Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
               isSupplementActiveOn(s, dateStr),
      );
      if (rxSupps.length > 0 && anchorDate > now) {
        rows.push({
          user_id:             userId,
          fire_at:             anchorDate.toISOString(),
          scheduled_for_date:  anchorDate.toLocaleDateString("sv-SE", { timeZone: tz }),
          title:               getAnchorTitle(mode),
          body:                rxSupps.map((s) => s.name).join(", "),
          slot_id:             "rx",
          tag:                 `${dateStr}_rx`,
          fired:               false,
        });
      }
    }

    // All other timed slots (anchor + offset)
    const offsets = deriveOffsets(mode, cfg);
    if (!offsets) continue;

    for (const slotId of TIMED_SLOT_IDS) {
      if (slotId === "rx") continue; // already handled above

      // Evening bucket: after_dinner is an absolute-time slot in medication/wakeup modes
      // when evening_mode is set. Intercept before using anchor-relative offsets.
      if (slotId === "after_dinner" && (mode === "medication" || mode === "wakeup") && cfg.evening_mode !== undefined) {
        let fireAt: Date | null = null;
        const em = cfg.evening_mode;
        if (em === "fixed" && cfg.evening_time) {
          fireAt = parseLocalHHMM(dateStr, cfg.evening_time as string, tz);
        } else if (em === "before_sleep" && cfg.sleep_time) {
          const offsetMins = ((cfg.evening_offset_hours as number) ?? 1) * 60 + ((cfg.evening_offset_minutes as number) ?? 0);
          fireAt = addMins(parseLocalHHMM(dateStr, cfg.sleep_time as string, tz), -offsetMins);
        }
        if (fireAt && fireAt > now) {
          const slotSupps = supps.filter(
            (s) => Array.isArray(s.slots) && s.slots.includes("after_dinner") &&
                   Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
                   isSupplementActiveOn(s, dateStr),
          );
          if (slotSupps.length) {
            rows.push({
              user_id:             userId,
              fire_at:             fireAt.toISOString(),
              scheduled_for_date:  fireAt.toLocaleDateString("sv-SE", { timeZone: tz }),
              title:               "Time for Evening",
              body:                slotSupps.map((s) => s.name).join(", "),
              slot_id:             "after_dinner",
              tag:                 `${dateStr}_after_dinner`,
              fired:               false,
            });
          }
        }
        continue; // skip anchor-relative path for this slot
      }

      const offset = offsets[slotId];
      if (offset === null || offset === undefined) continue;

      const fireAt = addMins(anchorDate, offset);
      if (fireAt <= now) continue;

      const slotSupps = supps.filter(
        (s) => Array.isArray(s.slots) && s.slots.includes(slotId) &&
               Array.isArray(s.days)  && s.days.includes(dayOfWeek) &&
               isSupplementActiveOn(s, dateStr),
      );
      if (!slotSupps.length) continue;

      rows.push({
        user_id:             userId,
        fire_at:             fireAt.toISOString(),
        scheduled_for_date:  fireAt.toLocaleDateString("sv-SE", { timeZone: tz }),
        title:               `Time for ${getModeSlotLabel(slotId, mode)}`,
        body:                slotSupps.map((s) => s.name).join(", "),
        slot_id:             slotId,
        tag:                 `${dateStr}_${slotId}`,
        fired:   false,
      });
    }
  }

  // ── End-of-treatment notifications (fires morning of last active day) ─────────
  for (const supp of supps) {
    if (supp.ends_at !== localTomorrow) continue; // ends_at is tomorrow → today is last active day
    const fireAt = parseLocalHHMM(localToday, "08:00", tz);
    if (fireAt <= now) continue;
    rows.push({
      user_id:            userId,
      fire_at:            fireAt.toISOString(),
      scheduled_for_date: localToday,
      title:              "Course ending today",
      body:               `Your ${supp.name} course is ending today. Continue or stop?`,
      slot_id:            "course_end",
      tag:                `${localToday}_course_end_${supp.id}`,
      fired:              false,
    });
  }

  // ── Delete stale pending rows in the 48-hour window ───────────────────────────
  const { error: delErr } = await admin
    .from("notifications_queue")
    .delete()
    .eq("user_id", userId)
    .eq("fired", false)
    .gte("fire_at", now.toISOString())
    .lt("fire_at", plus48.toISOString());

  if (delErr) {
    console.error("Delete failed:", delErr);
    return new Response(
      JSON.stringify({ error: "Delete failed", detail: delErr.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // ── Insert fresh rows ─────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const { error: insErr } = await admin.from("notifications_queue").insert(rows);
    if (insErr) {
      console.error("Insert failed:", insErr);
      return new Response(
        JSON.stringify({ error: "Insert failed", detail: insErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({ queued: rows.length, tz, mode, anchorBehavior }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
