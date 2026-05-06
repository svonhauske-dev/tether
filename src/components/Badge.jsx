import { spacing, radius, typography } from "../design-system";
import { useTheme } from "../lib/theme";

export default function Badge({ variant = "neutral", style, children }) {
  const { theme } = useTheme();

  const VARIANTS = {
    now:      { background: theme.status.nowBadgeBg,    color: theme.accent.default },
    missed:   { background: theme.status.warningSubtle,  color: theme.status.warning },
    category: { background: theme.accent.subtle,         color: theme.accent.default },
    neutral:  { background: theme.surface.cardHover,     color: theme.text.muted },
  };

  const base = {
    fontFamily: typography.fontBody,
    fontSize: typography.label,
    borderRadius: radius.full,
    padding: `${spacing.xxxs}px ${spacing.xs}px`,
    fontWeight: typography.semibold,
    letterSpacing: typography.labelSpacing,
    flexShrink: 0,
    display: "inline-block",
  };

  return <span style={{ ...base, ...(VARIANTS[variant] ?? {}), ...style }}>{children}</span>;
}
