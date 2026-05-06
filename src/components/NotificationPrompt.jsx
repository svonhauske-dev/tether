import { spacing, typography, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";

export default function NotificationPrompt({ onEnable, onSkip }) {
  const { theme } = useTheme();
  return (
    <div style={{
      fontFamily: typography.fontBody,
      background: theme.gradients.bg,
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: `max(${spacing.xl}px, env(safe-area-inset-top)) ${spacing.md}px max(${spacing.xl}px, env(safe-area-inset-bottom))`,
      WebkitFontSmoothing: "antialiased",
    }}>
      <div style={{ width: "100%", maxWidth: layout.maxContentWidth }}>
        <div style={{ fontSize: 40, marginBottom: spacing.lg, textAlign: "center" }}>🔔</div>
        <div style={{
          fontSize: typography.heading,
          fontWeight: typography.semibold,
          color: theme.text.primary,
          fontFamily: typography.fontHeading,
          marginBottom: spacing.xs,
        }}>
          Want reminders?
        </div>
        <div style={{
          fontSize: typography.caption,
          color: theme.text.secondary,
          marginBottom: spacing.xl,
          lineHeight: 1.5,
        }}>
          Origin can ping you when it's time to take your medication and supplements. You can change this any time in Settings.
        </div>
        <Button variant="primary" fullWidth onClick={onEnable} style={{ marginBottom: spacing.sm }}>
          Enable reminders
        </Button>
        <Button variant="tertiary" fullWidth onClick={onSkip}>
          Maybe later
        </Button>
      </div>
    </div>
  );
}
