// ── Tether Design System ─────────────────────────────────────────────────────────

export const colors = {
  // Surfaces — softly warm paper feel, lifted white surfaces
  bgBase:          "#F4F6F8",   // cool off-white, subtle blue undertone
  bgGradientMid:   "#F2F4F6",   // gradient stop
  bgGradientEnd:   "#EEF1F4",   // gradient end — slightly cooler
  bgModal:         "#FFFFFF",   // pure white for modals/cards
  bgCard:          "#FFFFFF",   // slot cards
  bgCardSubtle:    "#F4F6F8",   // matches base for nested elements
  bgBackdrop:      "rgba(26,26,26,0.55)",
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
  textDone:               "#8A929A",             // → textMuted
  textFaint:              "rgba(26,26,26,0.3)",  // very faint (date sublabel)
  dangerBorder:           "rgba(140,63,63,0.3)", // derived from danger
  cardSubtle:             "#F4F6F8",             // → bgCardSubtle
  divider:                "#E2E6EA",             // → borderSubtle
  statusMissedBorder:     "rgba(140,114,64,0.35)",
  statusMissedBg:         "rgba(140,114,64,0.05)",
  statusMissedHover:      "rgba(140,114,64,0.08)",
  statusMissedBadgeBg:    "#F2EDE5",               // → warningSubtle
  statusMissedBadgeColor: "#8C7240",               // → warning
  statusNowBorder:        "rgba(26,26,26,0.35)",
  statusNowBg:            "rgba(26,26,26,0.04)",
  statusNowHover:         "rgba(26,26,26,0.07)",
  statusNowBadgeBg:       "rgba(26,26,26,0.14)",
  slotRx:                 "#5C5C5C",             // → slotAnchor
  slotAfterDinner:        "#5C5C5C",             // → slotEvening
};

export const spacing = {
  xxxs: 2,
  xxs:  4,
  xs:   8,
  xs2:  6,
  sm:   12,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const radius = {
  xs:   2,    // badges, tags
  sm:   4,    // checkboxes, tight UI elements
  md:   12,   // cards, modals, inputs — canonical surface radius
  lg:   16,   // unused — reserved for larger surfaces
  xl:   20,   // unused — reserved for extra-large surfaces
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
  min: 44, // single-line touch target — buttons, icon buttons
  row: 52, // multi-line touch target — supplement rows with name + dose
};

export const layout = {
  closeButton:      44,
  modeButtonHeight: 64,
  segHeight:        40,
  maxContentWidth:  480,
  signInWidth:      360,
  toastMaxWidth:    448,
  labelColumn:      60, // fixed-width label column in meal schedule rows
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
  borderRadius: radius.full,
  cursor: "pointer",
  fontSize: typography.caption,
  fontFamily: typography.fontBody,
  background: on ? colors.accentSubtle : "transparent",
  color: on ? colors.accent : colors.textSecondary,
  border: `1px solid ${on ? colors.accent : colors.borderSubtle}`,
  fontWeight: on ? typography.semibold : typography.regular,
  minHeight: layout.segHeight,
});

// ── Theme tokens ───────────────────────────────────────────────────────────────

const SLOTS_LIGHT        = { default: "#5C5C5C" };
const SLOTS_DARK         = { default: "#9A9AA0" };
const SLOTS_BRUTAL_LIGHT = { default: "#000000" };
const SLOTS_BRUTAL_DARK  = { default: "#FFFFFF" };

export const themes = {
  light: {
    surface: {
      canvas:        "#F4F6F8",
      gradientMid:   "#F2F4F6",
      gradientEnd:   "#EEF1F4",
      modal:         "#FFFFFF",
      card:          "#FFFFFF",
      cardSubtle:    "#F4F6F8",
      backdrop:      "rgba(26,26,26,0.55)",
      input:         "#FFFFFF",
      inputDisabled: "#F2F4F6",
      cardHover:     "#EEF1F4",
      knob:          "#FFFFFF",
    },
    text: {
      primary:   "#1A1A1A",
      secondary: "#5A6168",
      muted:     "#8A929A",
      disabled:  "#BFC4CA",
      onAccent:  "#FFFFFF",
      onDanger:  "#FFFFFF",
      faint:     "rgba(26,26,26,0.3)",
    },
    accent: {
      default:   "#1A1A1A",
      hover:     "#000000",
      subtle:    "#EEF1F4",
      border:    "rgba(26,26,26,0.3)",
      onSubtle:  "#1A1A1A",
      track:     "rgba(26,26,26,0.1)",
    },
    border: {
      subtle: "#E2E6EA",
      strong: "#2C2C2C",
      focus:  "#1A1A1A",
    },
    slot: SLOTS_LIGHT,
    status: {
      success:          "#3D6647",
      danger:           "#A07076",
      dangerSubtle:     "rgba(160,112,118,0.10)",
      dangerBorder:     "rgba(160,112,118,0.3)",
      warning:          "#5A6E85",
      warningSubtle:    "rgba(122,143,168,0.15)",
      warningBorder:    "rgba(122,143,168,0.3)",
      missedBorder:     "rgba(90,110,133,0.35)",
      missedBg:         "rgba(90,110,133,0.05)",
      missedHover:      "rgba(90,110,133,0.08)",
      missedBadgeBg:    "rgba(122,143,168,0.15)",
      missedBadgeColor: "#5A6E85",
      nowBorder:        "rgba(26,26,26,0.35)",
      nowBg:            "rgba(26,26,26,0.04)",
      nowHover:         "rgba(26,26,26,0.07)",
      nowBadgeBg:       "rgba(26,26,26,0.14)",
    },
    gradients: {
      bg: "linear-gradient(180deg,#F4F6F8 0%,#F2F4F6 50%,#EEF1F4 100%)",
    },
    radius: { surface: 12, surfaceInner: 4, pill: 999, badge: 999, button: 12, iconButton: 999, toggle: 13 },
    borderWidth: { subtle: 0.5, default: 1, accent: 1.5 },
  },

  dark: {
    surface: {
      canvas:        "#04060A",
      gradientMid:   "#04060A",
      gradientEnd:   "#04060A",
      modal:         "#0A0D14",
      card:          "#06080D",
      cardSubtle:    "#030507",
      backdrop:      "rgba(0,0,0,0.7)",
      input:         "#06080D",
      inputDisabled: "#030507",
      cardHover:     "#0C0F16",
      knob:          "#F5F5F7",
    },
    text: {
      primary:   "#F5F5F7",
      secondary: "#A8A8AE",
      muted:     "#6E6E74",
      disabled:  "#3E3E44",
      onAccent:  "#04060A",
      onDanger:  "#FFFFFF",
      faint:     "rgba(245,245,247,0.3)",
    },
    accent: {
      default:  "#F5F5F7",
      hover:    "rgba(255,255,255,0.92)",
      subtle:   "rgba(255,255,255,0.08)",
      border:   "#FFFAF5",
      onSubtle: "#F5F5F7",
      track:    "rgba(245,245,247,0.1)",
    },
    border: {
      subtle: "rgba(255,250,245,0.10)",
      strong: "rgba(255,250,245,0.18)",
      focus:  "#FFFAF5",
    },
    slot: SLOTS_DARK,
    status: {
      success:          "#7FB89A",
      danger:           "#C49297",
      dangerSubtle:     "rgba(196,146,151,0.12)",
      dangerBorder:     "rgba(196,146,151,0.3)",
      warning:          "#A4B5C8",
      warningSubtle:    "rgba(164,181,200,0.15)",
      warningBorder:    "rgba(164,181,200,0.3)",
      missedBorder:     "rgba(164,181,200,0.35)",
      missedBg:         "rgba(164,181,200,0.06)",
      missedHover:      "rgba(164,181,200,0.10)",
      missedBadgeBg:    "rgba(164,181,200,0.15)",
      missedBadgeColor: "#A4B5C8",
      nowBorder:        "rgba(245,245,247,0.14)",
      nowBg:            "rgba(245,245,247,0.04)",
      nowHover:         "rgba(245,245,247,0.08)",
      nowBadgeBg:       "rgba(245,245,247,0.14)",
    },
    gradients: {
      bg: "#04060A",
    },
    radius: { surface: 12, surfaceInner: 4, pill: 999, badge: 999, button: 12, iconButton: 999, toggle: 13 },
    borderWidth: { subtle: 0.5, default: 1, accent: 1.5 },
  },

  brutalLight: {
    surface: {
      canvas:        "#FFFFFF",
      gradientMid:   "#FFFFFF",
      gradientEnd:   "#FFFFFF",
      modal:         "#FFFFFF",
      card:          "#FFFFFF",
      cardSubtle:    "#FFFFFF",
      backdrop:      "rgba(0,0,0,0.85)",
      input:         "#FFFFFF",
      inputDisabled: "#F5F5F5",
      cardHover:     "rgba(0,0,0,0.04)",
      knob:          "#FFFFFF",
    },
    text: {
      primary:   "#000000",
      secondary: "#000000",
      muted:     "#666666",
      disabled:  "#999999",
      onAccent:  "#FFFFFF",
      onDanger:  "#FFFFFF",
      faint:     "rgba(0,0,0,0.3)",
    },
    accent: {
      default:  "#000000",
      hover:    "#000000",
      subtle:   "rgba(0,0,0,0.92)",
      border:   "#000000",
      onSubtle: "#FFFFFF",
      track:    "rgba(0,0,0,0.15)",
    },
    border: {
      subtle: "#000000",
      strong: "#000000",
      focus:  "#000000",
    },
    slot: SLOTS_BRUTAL_LIGHT,
    status: {
      success:          "#000000",
      danger:           "#000000",
      dangerSubtle:     "rgba(0,0,0,0.06)",
      dangerBorder:     "#000000",
      warning:          "#000000",
      warningSubtle:    "rgba(0,0,0,0.08)",
      warningBorder:    "#000000",
      missedBorder:     "#000000",
      missedBg:         "rgba(0,0,0,0.04)",
      missedHover:      "rgba(0,0,0,0.08)",
      missedBadgeBg:    "rgba(0,0,0,0.08)",
      missedBadgeColor: "#000000",
      nowBorder:        "#000000",
      nowBg:            "rgba(0,0,0,0.04)",
      nowHover:         "rgba(0,0,0,0.08)",
      nowBadgeBg:       "#000000",
    },
    gradients: {
      bg: "#FFFFFF",
    },
    radius: { surface: 0, surfaceInner: 0, pill: 0, badge: 0, button: 0, iconButton: 0, toggle: 0 },
    borderWidth: { subtle: 2, default: 2, accent: 3 },
  },

  brutalDark: {
    surface: {
      canvas:        "#000000",
      gradientMid:   "#000000",
      gradientEnd:   "#000000",
      modal:         "#000000",
      card:          "#000000",
      cardSubtle:    "#000000",
      backdrop:      "rgba(255,255,255,0.85)",
      input:         "#000000",
      inputDisabled: "#111111",
      cardHover:     "rgba(255,255,255,0.06)",
      knob:          "#000000",
    },
    text: {
      primary:   "#FFFFFF",
      secondary: "#FFFFFF",
      muted:     "#999999",
      disabled:  "#666666",
      onAccent:  "#000000",
      onDanger:  "#000000",
      faint:     "rgba(255,255,255,0.3)",
    },
    accent: {
      default:  "#FFFFFF",
      hover:    "#FFFFFF",
      subtle:   "rgba(255,255,255,0.92)",
      border:   "#FFFFFF",
      onSubtle: "#000000",
      track:    "rgba(255,255,255,0.15)",
    },
    border: {
      subtle: "#FFFFFF",
      strong: "#FFFFFF",
      focus:  "#FFFFFF",
    },
    slot: SLOTS_BRUTAL_DARK,
    status: {
      success:          "#FFFFFF",
      danger:           "#FFFFFF",
      dangerSubtle:     "rgba(255,255,255,0.06)",
      dangerBorder:     "#FFFFFF",
      warning:          "#FFFFFF",
      warningSubtle:    "rgba(255,255,255,0.10)",
      warningBorder:    "#FFFFFF",
      missedBorder:     "#FFFFFF",
      missedBg:         "rgba(255,255,255,0.04)",
      missedHover:      "rgba(255,255,255,0.10)",
      missedBadgeBg:    "rgba(255,255,255,0.10)",
      missedBadgeColor: "#FFFFFF",
      nowBorder:        "#FFFFFF",
      nowBg:            "rgba(255,255,255,0.04)",
      nowHover:         "rgba(255,255,255,0.10)",
      nowBadgeBg:       "#FFFFFF",
    },
    gradients: {
      bg: "#000000",
    },
    radius: { surface: 0, surfaceInner: 0, pill: 0, badge: 0, button: 0, iconButton: 0, toggle: 0 },
    borderWidth: { subtle: 2, default: 2, accent: 3 },
  },
};
