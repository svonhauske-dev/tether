import { colors, spacing, typography } from "../design-system";

export default function Label({ htmlFor, style, children }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: typography.fontBody,
        fontSize: typography.label,
        color: colors.textSecondary,
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
