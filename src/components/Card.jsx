import { colors, spacing, radius, typography } from "../design-system";

const VARIANTS = {
  default:  { background: colors.bgCard,     border: `1px solid ${colors.borderSubtle}` },
  selected: { background: colors.accentDim,  border: `1px solid ${colors.accent}` },
  accent:   { background: colors.accentDim,  border: `1px solid ${colors.accentBorder}` },
  subtle:   { background: colors.cardSubtle, border: `1px solid ${colors.borderSubtle}` },
};

export default function Card({ variant = "default", onClick, style, children }) {
  const base = {
    fontFamily: typography.fontBody,
    borderRadius: radius.md,
    padding: `${spacing.sm}px ${spacing.md}px`,
    marginBottom: spacing.xs,
    boxSizing: "border-box",
  };

  const interactive = onClick ? { cursor: "pointer", userSelect: "none" } : {};

  return (
    <div onClick={onClick} style={{ ...base, ...(VARIANTS[variant] ?? {}), ...interactive, ...style }}>
      {children}
    </div>
  );
}
