import { useState } from "react";
import { colors, spacing, radius, typography, shadows } from "../design-system";

export default function Input({ variant = "text", width, style, type, onFocus, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  const resolvedType = type ?? (variant === "time" ? "time" : variant === "number" ? "number" : "text");

  const base = {
    background: colors.bgInput,
    color: colors.textPrimary,
    border: focused ? `1.5px solid ${colors.accent}` : `1px solid ${colors.borderSubtle}`,
    boxShadow: focused ? shadows.focus : "none",
    borderRadius: radius.md,
    fontSize: typography.body,
    fontFamily: typography.fontBody,
    outline: "none",
    WebkitAppearance: "none",
    boxSizing: "border-box",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
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
