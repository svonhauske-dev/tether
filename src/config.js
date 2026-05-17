// ── App-level constants shared across components ──────────────────────────────
// Product config (schedule defaults, slot definitions, copy) lives here.
// Design tokens (colors, spacing, etc.) live in design-system.js.

export const DEFAULT_CONFIG = {
  pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660,
  // IF v2 fields
  eating_window_start: "12:00", eating_window_duration_hours: 8, meal_count: 3,
  // Legacy IF fields (kept so old configs don't break on read)
  window_start: 0, window_length: 480, meals_per_day: 2,
  fixed_times: {
    pre_breakfast: "07:30", breakfast: "08:00", pre_lunch: "11:30", lunch: "12:00",
    pre_dinner: "17:30", dinner: "18:00", after_dinner: "20:00", injectable: null, topical: null,
  },
};

export const FIXED_SLOTS = [
  { key: "pre_breakfast", label: "Before Breakfast" },
  { key: "breakfast",     label: "Breakfast" },
  { key: "pre_lunch",     label: "Before Lunch" },
  { key: "lunch",         label: "Lunch" },
  { key: "pre_dinner",    label: "Before Dinner" },
  { key: "dinner",        label: "Dinner" },
  { key: "after_dinner",  label: "Evening" },
  { key: "injectable",    label: "Injectables" },
  { key: "topical",       label: "Topicals" },
];

export const ANCHOR_NOTES = {
  medication: "Your anchor is when you take your medication each morning.",
  fasting:    "Your anchor is when your eating window opens.",
  wakeup:     "Your anchor is when you wake up each morning.",
};

export const toHrMin = (totalMins) => {
  if (!totalMins && totalMins !== 0) return { h: 0, m: 0 };
  return { h: Math.floor(totalMins / 60), m: totalMins % 60 };
};

export const fromHrMin = (h, m) => (parseInt(h) || 0) * 60 + (parseInt(m) || 0);

export const MODES = [
  { id: "none",       title: "No Schedule",          desc: "Just a checklist — no times, no notifications" },
  { id: "medication", title: "Medication Anchor",    desc: "Your day cascades from when you take your medication" },
  { id: "wakeup",     title: "Wake Up Anchor",       desc: "Your day cascades from when you wake up" },
  { id: "fasting",    title: "Intermittent Fasting", desc: "Built around your eating window" },
  { id: "fixed",      title: "Fixed Times",          desc: "Same schedule every day, no anchor" },
];

// 4-card UI grouping: medication + wakeup collapsed under "Anchor".
// DB still stores 'medication' or 'wakeup' — this is presentation only.
export const DISPLAY_MODES = [
  { id: "none",    title: "No Schedule",          desc: "Just a checklist — no times, no notifications" },
  { id: "anchor",  title: "Anchor",               desc: "Cascade from when you take your medication or wake up" },
  { id: "fasting", title: "Intermittent Fasting", desc: "Built around your eating window" },
  { id: "fixed",   title: "Fixed Times",          desc: "Same schedule every day, no anchor" },
];

export const ANCHOR_SUB_MODES = [
  { id: "medication", label: "Medication" },
  { id: "wakeup",     label: "Wake Up" },
];

export function getSlotLabelForMode(slotId, mode) {
  if (slotId === "rx") {
    if (mode === "wakeup")   return "Empty Stomach";
    return "Anchor Medication";
  }
  return null;
}

// Slot IDs used on the home screen for adherence totals and slot ordering (non-IF modes).
export const CORE_SLOTS = ["rx", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

// All IF slot IDs in chronological display order.
export const IF_SLOT_IDS = ["fasted", "meal_1", "pre_meal_2", "meal_2", "pre_meal_3", "meal_3", "evening"];

/**
 * Compute absolute HH:MM times for each IF slot from the v2 config.
 * Returns a partial map — only slots that exist for the current meal_count.
 * The `evening` slot is not included here; it's handled via evening_mode like offset modes.
 */
export function computeIFSlotTimes(cfg) {
  const ws = cfg.eating_window_start;
  if (!ws) return {};
  const durationMins = (cfg.eating_window_duration_hours ?? 8) * 60;
  const mealCount    = cfg.meal_count ?? 3;
  const pmw          = cfg.pre_meal_window ?? 30;
  const [wh, wm]     = ws.split(":").map(Number);
  const wsMins       = wh * 60 + wm;

  const toHHMM = (mins) => {
    const t = ((mins % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  const result = {
    fasted: toHHMM(wsMins - pmw),
    meal_1: ws,
  };
  if (mealCount >= 2) {
    // Last meal (2-meal) or middle meal (3-meal).
    // Last meal fires at windowEnd - pmw so it coincides with window_closing warning.
    const meal2Mins = mealCount === 2 ? wsMins + durationMins - pmw : wsMins + durationMins / 2;
    result.pre_meal_2 = toHHMM(meal2Mins - pmw);
    result.meal_2     = toHHMM(meal2Mins);
  }
  if (mealCount >= 3) {
    // Last meal fires at windowEnd - pmw, coinciding with window_closing warning.
    const meal3Mins   = wsMins + durationMins - pmw;
    result.pre_meal_3 = toHHMM(meal3Mins - pmw);
    result.meal_3     = toHHMM(meal3Mins);
  }
  return result;
}

export function deriveOffsets(mode, cfg) {
  // IF is now absolute-time (like Fixed) — handled by computeIFSlotTimes, not offsets.
  if (mode === "none" || mode === "fixed" || mode === "fasting") return null;
  const pmw       = cfg.pre_meal_window ?? 30;
  const pre_bfast = (cfg.breakfast ?? 60) - pmw;
  return {
    pre_breakfast: pre_bfast,
    breakfast:     cfg.breakfast ?? 60,
    pre_lunch:     (cfg.lunch ?? 300) - pmw,
    lunch:         cfg.lunch ?? 300,
    pre_dinner:    (cfg.dinner ?? 540) - pmw,
    dinner:        cfg.dinner ?? 540,
    after_dinner:  cfg.after_dinner ?? 660,
    injectable:    null,
    topical:       null,
  };
}
