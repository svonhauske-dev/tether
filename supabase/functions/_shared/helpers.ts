// supabase/functions/_shared/helpers.ts
// Server-side duplicates of the frontend helpers needed for notification computation.
// Intentionally minimal — only what recompute_notifications actually uses.

// ── Time utilities ─────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function addMins(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/** "YYYY-MM-DD" in the given IANA timezone, offset by dayOffset calendar days. */
export function getLocalDateStr(tz: string, dayOffset = 0): string {
  const d = new Date(Date.now() + dayOffset * 86_400_000);
  return d.toLocaleDateString("sv-SE", { timeZone: tz }); // sv-SE gives ISO date format
}

/**
 * Return the day-of-week (0=Sun … 6=Sat) for a YYYY-MM-DD date as seen in the
 * given timezone. Uses noon-UTC to avoid any timezone boundary issues.
 */
export function getLocalDayOfWeek(dateStr: string, tz: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const shortDay = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(shortDay);
}

/**
 * Parse "HH:MM" as a local time on the given date (YYYY-MM-DD) in the given
 * timezone, returning the equivalent UTC Date.
 *
 * Strategy: start with a UTC approximation treating local time as UTC, then
 * measure the actual local representation via Intl.formatToParts and correct.
 * Handles DST correctly for any offset shift ≤ 12 hours.
 */
export function parseLocalHHMM(dateStr: string, hhMM: string, tz: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = hhMM.split(":").map(Number);

  // Initial approximation: treat local time as if it were UTC
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const approx = new Date(utcMs);

  // Find what local time the UTC approximation maps to
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(approx);
  let localH = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const localM = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  if (localH === 24) localH = 0; // Intl can return 24 for midnight

  // Correct toward the target local time
  let diffMins = (hour * 60 + minute) - (localH * 60 + localM);
  if (diffMins > 720) diffMins -= 1440;
  if (diffMins < -720) diffMins += 1440;

  return new Date(utcMs + diffMins * 60_000);
}

// ── Slot definitions ───────────────────────────────────────────────────────────

/** Slot IDs that receive scheduled notifications (injectable/topical are variable-time). */
export const TIMED_SLOT_IDS = [
  "rx",
  "pre_breakfast",
  "breakfast",
  "pre_lunch",
  "lunch",
  "pre_dinner",
  "dinner",
  "after_dinner",
] as const;

/** IF v2 slot IDs that receive supplement-conditional notifications.
 *  fasted is excluded — it fires unconditionally (like window_open/window_closing). */
export const IF_TIMED_SLOT_IDS = [
  "pre_meal_2",
  "meal_2",
  "pre_meal_3",
  "meal_3",
  "evening",
] as const;

export const SLOT_LABELS: Record<string, string> = {
  rx:            "Anchor Medication",
  pre_breakfast: "Before Breakfast",
  breakfast:     "With Breakfast",
  pre_lunch:     "Before Lunch",
  lunch:         "With Lunch",
  pre_dinner:    "Before Dinner",
  dinner:        "With Dinner",
  after_dinner:  "Evening",
  fasted:        "Fasted",
  meal_1:        "Meal 1",
  pre_meal_2:    "Pre-Meal 2",
  meal_2:        "Meal 2",
  pre_meal_3:    "Pre-Meal 3",
  meal_3:        "Meal 3",
  evening:       "Evening",
};

/**
 * IF v2: compute absolute slot times from eating window config.
 * Mirrors computeIFSlotTimes in src/config.js.
 */
// deno-lint-ignore no-explicit-any
export function computeIFSlotTimesHHMM(cfg: Record<string, any>): Record<string, string> {
  const ws = cfg.eating_window_start as string | undefined;
  if (!ws) return {};
  const durationMins = ((cfg.eating_window_duration_hours as number) ?? 8) * 60;
  const mealCount    = (cfg.meal_count as number) ?? 3;
  const pmw          = (cfg.pre_meal_window as number) ?? 30;
  const [wh, wm]     = ws.split(":").map(Number);
  const wsMins       = wh * 60 + wm;
  const toHHMM = (mins: number): string => {
    const t = ((mins % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  const result: Record<string, string> = {
    fasted: toHHMM(wsMins - pmw),
    meal_1: ws,
  };
  if (mealCount >= 2) {
    const meal2Mins = mealCount === 2 ? wsMins + durationMins - pmw : wsMins + durationMins / 2;
    result.pre_meal_2 = toHHMM(meal2Mins - pmw);
    result.meal_2     = toHHMM(meal2Mins);
  }
  if (mealCount >= 3) {
    const meal3Mins   = wsMins + durationMins - pmw;
    result.pre_meal_3 = toHHMM(meal3Mins - pmw);
    result.meal_3     = toHHMM(meal3Mins);
  }
  return result;
}

/** Mode-aware label for a slot (mirrors getSlotLabelForMode in src/config.js). */
export function getModeSlotLabel(slotId: string, mode: string): string {
  if (slotId === "rx") {
    if (mode === "wakeup") return "Empty Stomach";
    return "Anchor Medication";
  }
  return SLOT_LABELS[slotId] ?? slotId;
}

/** Notification title for the anchor event, per schedule mode. */
export function getAnchorTitle(mode: string): string {
  if (mode === "medication") return "Time to take your medication";
  if (mode === "wakeup") return "Good morning — time to start your day";
  if (mode === "fasting") return "Your eating window is open";
  return "Time to start your day";
}

// ── Treatment-mode activity check (mirrors isSupplementActiveOn in src/lib/time.js) ──

function parseDateMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function convertToDays(value: number, unit: string): number {
  if (unit === "days")   return value;
  if (unit === "weeks")  return value * 7;
  if (unit === "months") return value * 30;
  return 0;
}

// deno-lint-ignore no-explicit-any
export function isSupplementActiveOn(supp: any, checkDateStr: string): boolean {
  const mode: string = supp.treatment_mode ?? "indefinite";
  if (mode === "indefinite") return true;

  const checkMs  = parseDateMs(checkDateStr);
  const startsMs = supp.starts_at ? parseDateMs(supp.starts_at) : null;
  const endsMs   = supp.ends_at   ? parseDateMs(supp.ends_at)   : null;

  if (startsMs !== null && checkMs < startsMs) return false;
  if (endsMs   !== null && checkMs >= endsMs)  return false;

  if (mode === "scheduled") return true;

  if (mode === "cycled") {
    if (startsMs === null || !supp.cycle_on_value || !supp.cycle_off_value) return false;
    const daysSinceStart = Math.floor((checkMs - startsMs) / 86_400_000);
    const onDays   = convertToDays(supp.cycle_on_value,  supp.cycle_on_unit  ?? "days");
    const offDays  = convertToDays(supp.cycle_off_value, supp.cycle_off_unit ?? "days");
    const cycleDays = onDays + offDays;
    if (cycleDays === 0) return false;
    return (daysSinceStart % cycleDays) < onDays;
  }

  return true;
}

// ── Schedule offset computation (mirrors deriveOffsets in src/config.js) ───────

// deno-lint-ignore no-explicit-any
export function deriveOffsets(mode: string, cfg: any): Record<string, number | null> | null {
  if (mode === "none" || mode === "fixed") return null;

  if (mode === "fasting") {
    const winStart: number = cfg.window_start ?? 0;
    const winLen: number = cfg.window_length ?? 480;
    const meals: number = cfg.meals_per_day ?? 2;
    const interval = Math.floor(winLen / (meals + 1));
    const pmw: number = cfg.pre_meal_window ?? 30;
    return {
      pre_breakfast: winStart + interval - pmw,
      breakfast:     winStart + interval,
      pre_lunch:     meals >= 2 ? winStart + interval * 2 - pmw : null,
      lunch:         meals >= 2 ? winStart + interval * 2 : null,
      pre_dinner:    meals >= 3 ? winStart + interval * 3 - pmw : null,
      dinner:        meals >= 3 ? winStart + interval * 3 : null,
      after_dinner:  winStart + winLen + 30,
    };
  }

  // medication / wakeup
  const pmw: number = cfg.pre_meal_window ?? 30;
  const bfast: number = cfg.breakfast ?? 60;
  return {
    pre_breakfast: bfast - pmw,
    breakfast:     bfast,
    pre_lunch:     (cfg.lunch ?? 300) - pmw,
    lunch:         cfg.lunch ?? 300,
    pre_dinner:    (cfg.dinner ?? 540) - pmw,
    dinner:        cfg.dinner ?? 540,
    after_dinner:  cfg.after_dinner ?? 660,
  };
}
