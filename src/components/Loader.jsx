import { spacing, radius, typography } from '../design-system';
import { useTheme } from '../lib/theme';

export default function Loader({ text }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.gradients.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing.md, fontFamily: typography.fontBody }}>
      <style>{`@keyframes tetherPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.8); opacity: 0.5; } }`}</style>
      <div style={{ width: 32, height: 32, borderRadius: radius.full, background: theme.accent.default, animation: "tetherPulse 1.4s ease-in-out infinite" }} />
      <div style={{ fontSize: typography.caption, color: theme.text.muted, fontFamily: typography.fontBody, letterSpacing: typography.labelSpacingTight }}>{text}</div>
    </div>
  );
}
