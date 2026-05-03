import { colors, spacing } from "../design-system";
import Button from "./Button";
import Label from "./Label";
import BottomSheet from "./BottomSheet";

export default function SettingsModal({ open, onClose, notifStatus, onEnableNotifications, onSignOut }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Settings">
      <Label style={{ marginBottom: spacing.sm }}>Notifications</Label>
      {notifStatus === "default" && (
        <Button variant="secondary" secondaryStyle="solid" fullWidth onClick={onEnableNotifications}>Enable reminders</Button>
      )}
      {notifStatus === "granted" && (
        <div style={{ fontSize: typography.body, color: colors.accent, fontWeight: typography.medium }}>Reminders are on</div>
      )}
      {notifStatus === "denied" && (
        <div style={{ fontSize: typography.caption, color: colors.danger }}>Reminders are blocked — enable them in your device settings</div>
      )}
      {notifStatus === "unsupported" && (
        <div style={{ fontSize: typography.caption, color: colors.textMuted }}>Add Protocol to your home screen to enable reminders</div>
      )}

      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, margin: `${spacing.lg}px 0` }} />

      <Button variant="destructive" fullWidth onClick={() => { onSignOut(); onClose(); }}>Sign out</Button>
    </BottomSheet>
  );
}
