import { colors, spacing, radius, typography } from "../design-system";

export default function Input({ variant = "text", width, style, type, ...rest }) {
  const resolvedType = type ?? (variant === "time" ? "time" : variant === "number" ? "number" : "text");

  const base = {
    background: colors.bgInput,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: radius.sm,
    fontSize: typography.body,
    fontFamily: "inherit",
    outline: "none",
    WebkitAppearance: "none",
    boxSizing: "border-box",
  };

  const v = variant === "number"
    ? { width: width ?? 52, textAlign: "right", padding: `${spacing.xs}px ${spacing.sm}px` }
    : { width: width ?? "100%", padding: `${spacing.sm}px ${spacing.md}px`, display: "block" };

  return <input type={resolvedType} style={{ ...base, ...v, ...style }} {...rest} />;
}
