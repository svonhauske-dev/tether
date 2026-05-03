// ── Protocol Tracker Design System ─────────────────────────────────────────────

export const colors = {
  // Brand
  accent:        "#2930FF",
  accentDim:     "rgba(41,48,255,0.12)",
  accentBorder:  "rgba(41,48,255,0.3)",

  // Backgrounds
  bgBase:        "#080b14",
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

  // Borders
  borderStrong:  "rgba(255,255,255,0.12)",
  borderBase:    "rgba(255,255,255,0.08)",
  borderSubtle:  "rgba(255,255,255,0.05)",

  // Semantic
  success:    "#4ade80",
  successDim: "rgba(74,222,128,0.12)",
  danger:     "#f87171",
  dangerDim:  "rgba(248,113,113,0.08)",
  info:       "#60a5fa",
  infoDim:    "rgba(96,165,250,0.08)",

  // Slot colors
  slotRx:          "#2930FF",
  slotFasted:      "#2930FF",
  slotPreBreakfast:"#67e8f9",
  slotBreakfast:   "#67e8f9",
  slotPreLunch:    "#c084fc",
  slotLunch:       "#c084fc",
  slotPreDinner:   "#fb923c",
  slotDinner:      "#fb923c",
  slotAfterDinner: "#818cf8",
  slotInjectable:  "#94a3b8",
};

export const spacing = {
  xxs:  4,
  xs:   8,
  sm:   12,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  px: (n) => `${n}px`,
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
  // Sizes
  label:   11,
  caption: 13,
  body:    15,
  title:   17,
  heading: 22,
  hero:    28,

  // Weights
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,

  // Letter spacing
  labelSpacing: "0.08em",
};

export const touch = {
  min: 44,
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
