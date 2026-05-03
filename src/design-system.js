// ── Protocol Tracker Design System ─────────────────────────────────────────────

export const colors = {
  // Brand
  accent:        "#3D9A8F",
  accentDim:     "rgba(61,154,143,0.12)",
  accentBorder:  "rgba(61,154,143,0.3)",

  // Backgrounds
  bgBase:        "#080b14",
  bgGradientMid: "#0a0f1e",       // gradient middle stop
  bgGradientEnd: "#060a12",       // gradient end stop
  bgBackdrop:    "rgba(0,0,0,0.78)", // modal/overlay backdrop
  bgCard:        "rgba(255,255,255,0.03)",
  bgCardHover:   "rgba(255,255,255,0.05)",
  bgInner:       "#0d0f1a",
  bgInput:       "#0d0f1a",
  bgModal:       "#13151f",

  // Text
  textPrimary:   "#ffffff",
  textSecondary: "#8b90a0",
  textMuted:     "#4a5568",
  textDone:      "#4a5568",

  // Text (extended)
  textDisabled: "rgba(255,255,255,0.45)",
  textFaint:    "rgba(255,255,255,0.25)", // very faint text (date sublabel)

  // Borders
  borderStrong:  "rgba(255,255,255,0.12)",
  borderBase:    "rgba(255,255,255,0.08)",
  borderSubtle:  "rgba(255,255,255,0.05)",

  // Semantic
  danger:       "#f87171",
  dangerDim:    "rgba(248,113,113,0.08)",
  dangerBorder: "rgba(248,113,113,0.25)", // delete button border
  warn:         "#fb923c",
  warnDim:      "rgba(251,146,60,0.08)",
  warnBorder:   "rgba(251,146,60,0.18)",

  // Surfaces
  cardSubtle: "rgba(255,255,255,0.02)",
  divider:    "rgba(255,255,255,0.04)",

  // Slot status
  statusMissedBorder:     "rgba(249,115,22,0.35)",
  statusMissedBg:         "rgba(249,115,22,0.05)",
  statusMissedHover:      "rgba(249,115,22,0.07)",
  statusMissedBadgeBg:    "rgba(124,45,18,0.5)",
  statusMissedBadgeColor: "#fed7aa",
  statusNowBorder:        "rgba(61,154,143,0.45)",
  statusNowBg:            "rgba(61,154,143,0.04)",
  statusNowHover:         "rgba(61,154,143,0.07)",
  statusNowBadgeBg:       "rgba(61,154,143,0.18)",

  // Slot colors
  slotRx:          "#3D9A8F",
  slotPreBreakfast:"#67e8f9",
  slotBreakfast:   "#67e8f9",
  slotPreLunch:    "#c084fc",
  slotLunch:       "#c084fc",
  slotPreDinner:   "#fb923c",
  slotDinner:      "#fb923c",
  slotAfterDinner: "#818cf8",
  slotInjectable:  "#94a3b8",
  slotTopical:     "#f9a8d4",
};

export const spacing = {
  xxxs: 2,   // tighter than xxs, for 2px margins
  xxs:  4,
  xs:   8,
  sm:   12,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const radius = {
  xs:   4,    // badges, tags
  sm:   8,    // inputs, small buttons
  md:   12,   // inner cards, rows
  lg:   16,   // buttons, cards
  xl:   24,   // modals, large cards
  full: 9999, // pill buttons, avatars
};

export const typography = {
  // Sizes — all multiples of 2
  caption2: 10,   // very compact sublabels (unchanged)
  label:    12,   // was 11
  caption:  14,   // was 13
  body:     16,   // was 15
  title:    18,   // was 17
  heading:  22,   // new — section/modal headings
  display:  32,   // new — large display numbers (anchor time)
  hero:     28,   // preserved — app title, empty-state emoji

  // Weights
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,

  // Letter spacing
  labelSpacingTight: "0.04em",
  labelSpacing:      "0.08em",
  labelSpacingWide:  "0.1em",

  // Font families
  fontBody:    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontHeading: "'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
};

export const touch = {
  min: 44,
};

export const layout = {
  closeButton:      32, // close button (✕) width/height
  modeButtonHeight: 64, // schedule mode grid button height
  segHeight:        40, // segmented control height (intentionally below touch.min)
};

// ── Reusable style objects ──────────────────────────────────────────────────────

export const cardStyle = {
  borderRadius: radius.xl,
  border: `1px solid ${colors.borderBase}`,
  background: colors.bgCard,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  padding: spacing.md,
  marginBottom: spacing.md,
};

export const inputStyle = {
  width: "100%",
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.borderStrong}`,
  fontSize: typography.body,
  boxSizing: "border-box",
  background: colors.bgInput,
  color: colors.textPrimary,
  display: "block",
  WebkitAppearance: "none",
  outline: "none",
};

export const labelStyle = {
  fontSize: typography.label,
  color: colors.textSecondary,
  marginBottom: spacing.xs,
  display: "block",
  fontWeight: typography.semibold,
  letterSpacing: typography.labelSpacing,
  textTransform: "uppercase",
};

export const primaryButtonStyle = {
  width: "100%",
  padding: `${spacing.sm}px ${spacing.md}px`,
  background: colors.accent,
  color: colors.textPrimary,
  border: "none",
  borderRadius: radius.lg,
  fontSize: typography.body,
  fontWeight: typography.bold,
  cursor: "pointer",
  minHeight: touch.min,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  WebkitTapHighlightColor: "transparent",
};

export const ghostButtonStyle = {
  background: "transparent",
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: radius.lg,
  color: colors.textSecondary,
  cursor: "pointer",
  fontSize: typography.caption,
  fontWeight: typography.medium,
  minHeight: touch.min,
  padding: `${spacing.xs}px ${spacing.md}px`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  WebkitTapHighlightColor: "transparent",
};

export const badgeStyle = (bg, color) => ({
  fontSize: typography.label,
  background: bg,
  color,
  borderRadius: radius.xs,
  padding: `2px ${spacing.xs}px`,
  fontWeight: typography.semibold,
});
