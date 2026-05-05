import { colors, spacing, radius, typography, gradients } from '../design-system';

export default function Loader({ text }) {
  return (
    <div style={{ background: gradients.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing.md, fontFamily: typography.fontBody }}>
      <style>{`@keyframes tetherPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.8); opacity: 0.5; } }`}</style>
      <div style={{ width: 32, height: 32, borderRadius: radius.full, background: colors.accent, animation: "tetherPulse 1.4s ease-in-out infinite" }} />
      <div style={{ fontSize: typography.caption, color: colors.textMuted, fontFamily: typography.fontBody, letterSpacing: typography.labelSpacingTight }}>{text}</div>
    </div>
  );
}
