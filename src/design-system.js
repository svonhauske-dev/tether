// ── Tether Design System ─────────────────────────────────────────────────────────

export const colors = {
  // Surfaces — softly warm paper feel, lifted white surfaces
  bgBase:          "#F4F6F8",   // cool off-white, subtle blue undertone
  bgGradientMid:   "#F2F4F6",   // gradient stop
  bgGradientEnd:   "#EEF1F4",   // gradient end — slightly cooler
  bgModal:         "#FFFFFF",   // pure white for modals/cards
  bgCard:          "#FFFFFF",   // slot cards
  bgCardSubtle:    "#F4F6F8",   // matches base for nested elements
  bgBackdrop:      "rgba(26,26,26,0.4)",
  bgInput:         "#FFFFFF",
  bgInputDisabled: "#F2F4F6",

  // Text — near-black ink, soft greys
  textPrimary:     "#1A1A1A",   // near-black, deep but not harsh
  textSecondary:   "#5A6168",   // cool charcoal
  textMuted:       "#8A929A",   // cool mid-grey
  textDisabled:    "#BFC4CA",
  textOnAccent:    "#FFFFFF",
  textOnDanger:    "#FFFFFF",

  // Accent — deep ink-blue, single confident color
  accent:          "#1A1A1A",   // near-black ink — action color
  accentHover:     "#000000",   // pure black on hover/press
  accentSubtle:    "#EEF1F4",   // cool pale grey for ghost-active states

  // Borders — hairline restraint
  borderSubtle:    "#E2E6EA",   // cool hairline
  borderStrong:    "#2C2C2C",   // when a border needs to assert (rare)
  borderFocus:     "#1A1A1A",   // matches accent, focus rings

  // Slot colors — all collapsed to single muted grey
  slotAnchor:       "#5C5C5C",
  slotPreBreakfast: "#5C5C5C",
  slotBreakfast:    "#5C5C5C",
  slotPreLunch:     "#5C5C5C",
  slotLunch:        "#5C5C5C",
  slotPreDinner:    "#5C5C5C",
  slotDinner:       "#5C5C5C",
  slotEvening:      "#5C5C5C",
  slotInjectable:   "#5C5C5C",
  slotTopical:      "#5C5C5C",

  // Status — restrained even in error states
  success:         "#3D6647",   // deep muted forest green
  danger:          "#8C3F3F",   // deep muted oxide red
  dangerSubtle:    "#F2E8E8",
  warning:         "#8C7240",   // deep muted ochre
  warningSubtle:   "#F2EDE5",

  // ── Backward-compat aliases — components reference these; do not remove ──────
  accentDim:              "#EEF1F4",             // → accentSubtle
  accentBorder:           "rgba(26,26,26,0.3)",  // derived from accent
  bgCardHover:            "#EEF1F4",             // subtle hover on white — cool grey
  borderBase:             "#E2E6EA",             // → borderSubtle
  textDone:               "#8C8C8C",             // → textMuted
  textFaint:              "rgba(26,26,26,0.3)",  // very faint (date sublabel)
  dangerBorder:           "rgba(140,63,63,0.3)", // derived from danger
  cardSubtle:             "#F4F6F8",             // → bgCardSubtle
  divider:                "#E2E6EA",             // → borderSubtle
  statusMissedBorder:     "rgba(140,63,63,0.35)",
  statusMissedBg:         "rgba(140,63,63,0.05)",
  statusMissedHover:      "rgba(140,63,63,0.08)",
  statusMissedBadgeBg:    "rgba(140,63,63,0.12)",
  statusMissedBadgeColor: "#8C3F3F",
  statusNowBorder:        "rgba(31,58,82,0.35)",
  statusNowBg:            "rgba(31,58,82,0.04)",
  statusNowHover:         "rgba(31,58,82,0.07)",
  statusNowBadgeBg:       "rgba(31,58,82,0.14)",
  slotRx:                 "#5C5C5C",             // → slotAnchor
  slotAfterDinner:        "#5C5C5C",             // → slotEvening
};

export const spacing = {
  xxxs: 2,
  xxs:  4,
  xs:   8,
  sm:   12,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const radius = {
  xs:   2,    // badges, tags
  sm:   4,    // inputs, small buttons
  md:   6,    // inner cards, rows
  lg:   8,    // buttons, cards
  xl:   12,   // modals, large cards
  full: 9999, // pill buttons, avatars
};

export const typography = {
  // Sizes — all multiples of 2
  caption2: 10,
  label:    12,
  caption:  14,
  body:     16,
  title:    18,
  heading:  22,
  display:  32,
  hero:     28,

  // Weights
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,

  // Letter spacing
  labelSpacingTight:    "0.04em",
  labelSpacing:         "0.08em",
  labelSpacingWide:     "0.1em",
  headingLetterSpacing: "-0.02em",
  displayLetterSpacing: "-0.04em",

  // Font families — single Geist system
  fontBody:    '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontHeading: '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
};

export const touch = {
  min: 44,
};

export const layout = {
  closeButton:      32,
  modeButtonHeight: 64,
  segHeight:        40,
  maxContentWidth:  480,
  signInWidth:      360,
  toastMaxWidth:    448,
};

export const gradients = {
  bg: `linear-gradient(180deg,${colors.bgBase} 0%,${colors.bgGradientMid} 50%,${colors.bgGradientEnd} 100%)`,
};

export const shadows = {
  card:    "0 1px 2px rgba(26,26,26,0.04)",
  modal:   "0 8px 32px rgba(26,26,26,0.08), 0 2px 8px rgba(26,26,26,0.04)",
  popover: "0 4px 16px rgba(26,26,26,0.06)",
  toast:   "0 4px 16px rgba(26,26,26,0.10)",
  focus:   "0 0 0 3px rgba(26,26,26,0.15)",
};

export const zIndex = {
  backdrop: 199,
  modal:    200,
  toast:    400,
};

export const effects = {
  backdropBlur: "blur(8px) saturate(1.2)",
};

// ── Reusable style objects ──────────────────────────────────────────────────────

export const segBtnStyle = (on) => ({
  flex: 1,
  padding: `${spacing.sm}px`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontSize: typography.caption,
  fontFamily: typography.fontBody,
  background: on ? colors.accentSubtle : "transparent",
  color: on ? colors.accent : colors.textSecondary,
  border: `1px solid ${on ? colors.accent : colors.borderSubtle}`,
  fontWeight: on ? typography.semibold : typography.regular,
  minHeight: layout.segHeight,
});
