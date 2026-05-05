import { colors, spacing, radius, typography } from "../design-system";

const VARIANTS = {
  now:      { background: colors.statusNowBadgeBg,    color: colors.accent },
  missed:   { background: colors.warningSubtle,        color: colors.warning },
  category: { background: colors.accentDim,            color: colors.accent },
  neutral:  { background: colors.bgCardHover,          color: colors.textMuted },
};

export default function Badge({ variant = "neutral", style, children }) {
  const base = {
    fontFamily: typography.fontBody,
    fontSize: typography.label,
    borderRadius: radius.xs,
    padding: `${spacing.xxxs}px ${spacing.xs}px`,
    fontWeight: typography.semibold,
    letterSpacing: typography.labelSpacing,
    flexShrink: 0,
    display: "inline-block",
  };

  return <span style={{ ...base, ...(VARIANTS[variant] ?? {}), ...style }}>{children}</span>;
}
