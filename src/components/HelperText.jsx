import { spacing, typography } from "../design-system";
import { useTheme } from "../lib/theme";

// Three-tier explanatory text convention:
//   T1 HelperText — section explanation, directly below a Label, above content
//   T2 — item description inside a card/pill (inline, no component needed)
//   T3 — unit label adjacent to an input (inline <span>, no component needed)
// Typography for all tiers: typography.caption (14px), colors.textSecondary (T1/T2) or colors.textMuted (T3)
export default function HelperText({ children, style }) {
  const { theme } = useTheme();
  return (
    <div style={{
      fontSize: typography.caption,
      color: theme.text.secondary,
      marginTop: spacing.xxs,
      marginBottom: spacing.md,
      lineHeight: 1.5,
      ...style,
    }}>
      {children}
    </div>
  );
}
