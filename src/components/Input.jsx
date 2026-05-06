import { useState } from "react";
import { spacing, radius, typography } from "../design-system";
import { useTheme } from "../lib/theme";

export default function Input({ variant = "text", width, style, type, onFocus, onBlur, ...rest }) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const resolvedType = type ?? (variant === "time" ? "time" : variant === "number" ? "number" : "text");

  const base = {
    background: theme.surface.input,
    color: theme.text.primary,
    border: focused ? `1.5px solid ${theme.accent.default}` : `1px solid ${theme.border.subtle}`,
    borderRadius: radius.md,
    fontSize: typography.body,
    fontFamily: typography.fontBody,
    outline: "none",
    WebkitAppearance: "none",
    boxSizing: "border-box",
    transition: "border-color 150ms ease",
  };

  const v = variant === "number"
    ? { width: width ?? 52, textAlign: "right", padding: `${spacing.xs}px ${spacing.sm}px` }
    : { width: width ?? "100%", padding: `${spacing.sm}px ${spacing.md}px`, display: "block" };

  return (
    <input
      type={resolvedType}
      style={{ ...base, ...v, ...style }}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      {...rest}
    />
  );
}
