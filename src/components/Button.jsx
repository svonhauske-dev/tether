import {
  spacing, typography, touch, layout,
} from "../design-system";
import { useTheme } from "../lib/theme";

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
  const { theme } = useTheme();

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
      background: theme.accent.default,
      color: theme.text.onAccent,
      border: "none",
      fontWeight: typography.semibold,
      borderRadius: theme.radius.button,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
    };
  } else if (variant === "startDay") {
    v = {
      background: isFuture ? theme.surface.cardHover : theme.accent.default,
      color: isFuture ? theme.text.muted : theme.text.onAccent,
      border: "none",
      fontWeight: typography.semibold,
      borderRadius: theme.radius.pill,
      minHeight: spacing.xxl,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
      cursor: isFuture ? "default" : "pointer",
    };
  } else if (variant === "secondary") {
    v = {
      background: "transparent",
      color: theme.text.primary,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      fontWeight: typography.medium,
      borderRadius: theme.radius.button,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.caption,
    };
  } else if (variant === "pill") {
    const pillBase = {
      borderRadius: theme.radius.pill,
      minHeight: touch.min,
      padding: `${spacing.xs}px ${spacing.sm}px`,
      fontSize: typography.caption,
    };
    if (active && solidActive) {
      v = { ...pillBase, background: theme.accent.default, color: theme.text.onAccent, border: `${theme.borderWidth.default}px solid ${theme.accent.default}`, fontWeight: typography.semibold };
    } else if (active) {
      v = { ...pillBase, background: theme.accent.subtle, color: theme.accent.onSubtle, border: `${theme.borderWidth.default}px solid ${theme.accent.default}`, fontWeight: typography.semibold };
    } else {
      v = { ...pillBase, background: "transparent", color: theme.text.secondary, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, fontWeight: typography.regular };
    }
  } else if (variant === "tertiary") {
    v = {
      background: "transparent",
      color: theme.text.secondary,
      border: `${theme.borderWidth.default}px solid ${theme.border.strong}`,
      fontWeight: typography.semibold,
      borderRadius: theme.radius.button,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.caption,
    };
  } else if (variant === "destructive") {
    v = {
      background: "transparent",
      color: theme.status.danger,
      border: `${theme.borderWidth.default}px solid ${theme.status.dangerBorder}`,
      fontWeight: typography.medium,
      borderRadius: theme.radius.button,
      minHeight: touch.min,
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.body,
    };
  } else if (variant === "icon") {
    v = {
      width: touch.min,
      height: touch.min,
      borderRadius: theme.radius.button,
      background: "transparent",
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      color: theme.text.secondary,
      fontSize: typography.caption,
      flexShrink: 0,
      padding: 0,
    };
  } else if (variant === "circle") {
    v = {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      fontSize: typography.label,
      flexShrink: 0,
      padding: 0,
      ...(active
        ? { background: theme.accent.subtle, color: theme.accent.onSubtle, border: `${theme.borderWidth.accent}px solid ${theme.accent.default}`, fontWeight: typography.semibold }
        : { background: "transparent", color: theme.text.primary, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, fontWeight: typography.regular }),
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
