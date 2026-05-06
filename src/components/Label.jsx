import { spacing, typography } from "../design-system";
import { useTheme } from "../lib/theme";

export default function Label({ htmlFor, style, children }) {
  const { theme } = useTheme();
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: typography.fontBody,
        fontSize: typography.label,
        color: theme.text.secondary,
        marginBottom: spacing.xs,
        display: "block",
        fontWeight: typography.semibold,
        letterSpacing: typography.labelSpacing,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </label>
  );
}
