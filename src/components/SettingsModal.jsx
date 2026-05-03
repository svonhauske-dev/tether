import { ChevronRight } from "lucide-react";
import { colors, spacing, typography, touch } from "../design-system";
import Button from "./Button";
import Label from "./Label";
import BottomSheet from "./BottomSheet";
import { useToast } from "./ToastContext";

export default function SettingsModal({ open, onClose, notifStatus, onEnableNotifications, onOpenManage, onSignOut }) {
  const { show: showToast } = useToast();

  const handleEnableNotifications = async () => {
    const result = await onEnableNotifications();
    if (result === "granted") showToast("Reminders on");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Settings">
      <Label style={{ marginBottom: spacing.xs }}>Supplements</Label>
      <div
        onClick={onOpenManage}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing.sm}px 0`,
          cursor: "pointer",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          minHeight: touch.min,
          marginBottom: spacing.xs,
        }}
      >
        <span style={{ fontSize: typography.body, color: colors.textPrimary }}>Manage supplements</span>
        <ChevronRight size={20} color={colors.textSecondary} />
      </div>

      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, margin: `${spacing.lg}px 0` }} />

      <Label style={{ marginBottom: spacing.sm }}>Notifications</Label>
      {notifStatus === "default" && (
        <Button variant="secondary" secondaryStyle="solid" fullWidth onClick={handleEnableNotifications}>Enable reminders</Button>
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
