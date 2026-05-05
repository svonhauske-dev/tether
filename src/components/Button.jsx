import {
  colors, spacing, radius, typography, touch, layout,
} from "../design-system";

export default function Button({
  variant = "primary",
  size = "default",
  active,
  solidActive = false,
  isFuture = false,
  fullWidth,
  disabled,
  type = "button",
  style,
  children,
  ...rest
}) {
  const base = {
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    fontFamily: typography.fontBody,
    ...(disabled ? { opacity: 0.5 } : {}),
    ...(fullWidth ? { width: "100%" } : {}),
  };

  let v;

  if (variant === "primary") {
    v = {
      background: colors.accent,
      color: colors.textOnAccent,
      border: "none",
      fontWeight: typography.semibold,
      borderRadius: radius.full,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
    };
  } else if (variant === "startDay") {
    v = {
      background: isFuture ? colors.bgCardHover : colors.accent,
      color: isFuture ? colors.textMuted : colors.textOnAccent,
      border: "none",
      fontWeight: typography.semibold,
      borderRadius: radius.full,
      minHeight: spacing.xxl,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
      cursor: isFuture ? "default" : "pointer",
    };
  } else if (variant === "secondary") {
    v = {
      background: "transparent",
      color: colors.textPrimary,
      border: `1px solid ${colors.borderSubtle}`,
      fontWeight: typography.medium,
      borderRadius: radius.full,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.caption,
    };
  } else if (variant === "pill") {
    const pillBase = {
      borderRadius: radius.full,
      minHeight: touch.min,
      padding: `${spacing.xs}px ${spacing.sm}px`,
      fontSize: typography.caption,
    };
    if (active && solidActive) {
      v = { ...pillBase, background: colors.accent, color: colors.textOnAccent, border: `1px solid ${colors.accent}`, fontWeight: typography.semibold };
    } else if (active) {
      v = { ...pillBase, background: colors.accentDim, color: colors.accent, border: `1px solid ${colors.accent}`, fontWeight: typography.semibold };
    } else {
      v = { ...pillBase, background: "transparent", color: colors.textSecondary, border: `1px solid ${colors.borderSubtle}`, fontWeight: typography.regular };
    }
  } else if (variant === "tertiary") {
    v = {
      background: "transparent",
      color: colors.textSecondary,
      border: `1px solid ${colors.borderStrong}`,
      fontWeight: typography.semibold,
      borderRadius: radius.full,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.caption,
    };
  } else if (variant === "destructive") {
    v = {
      background: "transparent",
      color: colors.danger,
      border: `1px solid ${colors.dangerBorder}`,
      fontWeight: typography.medium,
      borderRadius: radius.full,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
    };
  } else if (variant === "icon") {
    v = {
      width: touch.min,
      height: touch.min,
      borderRadius: radius.full,
      background: "transparent",
      border: `1px solid ${colors.borderSubtle}`,
      color: colors.textSecondary,
      fontSize: typography.caption,
      flexShrink: 0,
      padding: 0,
    };
  } else if (variant === "circle") {
    v = {
      width: 36,
      height: 36,
      borderRadius: "50%",
      fontSize: typography.label,
      fontWeight: typography.semibold,
      flexShrink: 0,
      padding: 0,
      ...(active
        ? { background: colors.accentDim, color: colors.accent, border: `1px solid ${colors.accent}` }
        : { background: "transparent", color: colors.textSecondary, border: `1px solid ${colors.borderStrong}` }),
    };
  } else {
    v = {};
  }

  const compact = size === "compact" ? {
    padding: `${spacing.xs}px ${spacing.sm}px`,
    fontSize: typography.caption,
  } : {};

  return (
    <button type={type} disabled={disabled} style={{ ...base, ...v, ...compact, ...style }} {...rest}>
      {variant === "pill" && typeof children === "string"
        ? <span className="pill-label" data-text={children}>{children}</span>
        : children}
    </button>
  );
}
