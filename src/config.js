// ── App-level constants shared across components ──────────────────────────────
// Product config (schedule defaults, slot definitions, copy) lives here.
// Design tokens (colors, spacing, etc.) live in design-system.js.

export const DEFAULT_CONFIG = {
  pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660,
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
  medication: "Anchor = when you take your medication each morning",
  fasting:    "Anchor = when your eating window opens",
  wakeup:     "Anchor = when you wake up each morning",
};

export const toHrMin = (totalMins) => {
  if (!totalMins && totalMins !== 0) return { h: 0, m: 0 };
  return { h: Math.floor(totalMins / 60), m: totalMins % 60 };
};

export const fromHrMin = (h, m) => (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
