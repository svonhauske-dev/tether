import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { spacing, typography, touch, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";
import HelperText from "./HelperText";
import Label from "./Label";
import Modal from "./Modal";
import ManageAccount from "./ManageAccount";
import { useToast } from "./ToastContext";
import InlineLoader from "./InlineLoader";
import {
  isPushSupported, needsHomeScreenInstall, getNotificationPermission,
  getCurrentSubscription, subscribeToPush, unsubscribeFromPush,
} from "../lib/notifications";
import { dbUpdateScheduleField } from "../lib/api";

const THEME_OPTIONS = [
  { value: "light",  label: "Light"  },
  { value: "dark",   label: "Dark"   },
  { value: "system", label: "System" },
];

export default function SettingsModal({ open, onClose, onOpenManage, onSignOut, user, token, profile, onProfileUpdate, onNotificationsEnabled }) {
  const { theme, themePreference, setThemePreference } = useTheme();
  const { show: showToast } = useToast();
  const [view, setView]                       = useState("main");
  const [permission, setPermission]           = useState("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [needsInstall, setNeedsInstall]       = useState(false);
  const [pushSupported, setPushSupported]     = useState(true);
  const [toggling, setToggling]               = useState(false);

  useEffect(() => {
    if (!open) { setView("main"); return; }
    setPermission(getNotificationPermission());
    setNeedsInstall(needsHomeScreenInstall());
    setPushSupported(isPushSupported());
    getCurrentSubscription().then(sub => setHasSubscription(!!sub));
  }, [open]);

  const handleToggleNotifications = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (hasSubscription) {
        await unsubscribeFromPush();
        await dbUpdateScheduleField("notifications_enabled", false, user.id, token);
        setHasSubscription(false);
        showToast("Reminders off");
      } else {
        if (needsInstall) {
          setView("install");
          return;
        }
        await subscribeToPush();
        await dbUpdateScheduleField("notifications_enabled", true, user.id, token);
        setPermission("granted");
        setHasSubscription(true);
        showToast("Reminders on");
        if (onNotificationsEnabled) onNotificationsEnabled();
      }
    } catch (err) {
      if (err.message?.includes("denied")) {
        showToast("Permission denied — enable in device settings");
        setPermission("denied");
      } else if (err.message?.includes("PWA install")) {
        setView("install");
      } else if (err.message?.includes("VAPID")) {
        showToast("Reminders not configured yet");
        console.error(err);
      } else {
        showToast("Couldn't update reminders");
        console.error(err);
      }
    } finally {
      setToggling(false);
    }
  };

  const themeBtnStyle = (active) => ({
    flex: 1,
    padding: `${spacing.sm}px`,
    borderRadius: theme.radius.button,
    cursor: "pointer",
    fontSize: typography.caption,
    fontFamily: typography.fontBody,
    background: active ? theme.accent.subtle : "transparent",
    color: active ? theme.accent.onSubtle : theme.text.secondary,
    border: `${theme.borderWidth.default}px solid ${active ? theme.accent.default : theme.border.subtle}`,
    fontWeight: active ? typography.semibold : typography.regular,
    minHeight: layout.segHeight,
    WebkitTapHighlightColor: "transparent",
  });

  if (view === "account") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Manage account"
        leftAction={
          <Button variant="icon" aria-label="Back" onClick={() => setView("main")}>
            <ChevronLeft size={18} />
          </Button>
        }
      >
        <ManageAccount
          user={user}
          token={token}
          profile={profile}
          onProfileUpdate={onProfileUpdate}
          onShowToast={showToast}
        />
      </Modal>
    );
  }

  if (view === "install") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Add to home screen"
        leftAction={
          <Button variant="icon" aria-label="Back" onClick={() => setView("main")}>
            <ChevronLeft size={18} />
          </Button>
        }
      >
        <div style={{ paddingTop: spacing.xs }}>
          <p style={{ fontSize: typography.body, color: theme.text.secondary, marginBottom: spacing.md, lineHeight: 1.6 }}>
            To enable reminders on iOS, Origin must be installed to your home screen.
          </p>
          <ol style={{ paddingLeft: spacing.lg, color: theme.text.secondary, lineHeight: 1.8, fontSize: typography.body }}>
            <li>Tap the Share button in Safari</li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Open Origin from your home screen</li>
            <li>Return to Settings and enable reminders</li>
          </ol>
        </div>
      </Modal>
    );
  }

  // Notification row content depending on state
  let notifContent;
  if (!pushSupported) {
    notifContent = (
      <HelperText>Notifications aren't supported in this browser.</HelperText>
    );
  } else if (needsInstall) {
    notifContent = (
      <div
        onClick={() => setView("install")}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent",
          minHeight: touch.min,
        }}
      >
        <span style={{ fontSize: typography.caption, color: theme.text.muted, flex: 1, paddingRight: spacing.sm }}>
          Install Origin to your home screen to enable reminders.
        </span>
        <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
      </div>
    );
  } else {
    notifContent = (
      <>
        <div style={{ display: "flex", gap: spacing.xs }}>
          <Button
            variant="selector"
            active={hasSubscription}
            disabled={toggling || permission === "denied"}
            style={{ flex: 1 }}
            onClick={() => { if (!hasSubscription) handleToggleNotifications(); }}
          >
            On
          </Button>
          <Button
            variant="selector"
            active={!hasSubscription}
            disabled={toggling}
            style={{ flex: 1 }}
            onClick={() => { if (hasSubscription) handleToggleNotifications(); }}
          >
            Off
          </Button>
        </div>
        {toggling && (
          <HelperText style={{ marginTop: spacing.xxs }}>Updating…</HelperText>
        )}
        {permission === "denied" && (
          <div style={{ fontSize: typography.caption, color: theme.status.danger, marginTop: spacing.xxs }}>
            Notifications blocked. Enable Origin in your device settings.
          </div>
        )}
        {!hasSubscription && !toggling && permission === "default" && (
          <HelperText style={{ marginTop: spacing.xxs }}>You'll be asked to allow notifications.</HelperText>
        )}
        {!hasSubscription && !toggling && permission === "granted" && (
          <HelperText style={{ marginTop: spacing.xxs }}>Tap On to resume notifications.</HelperText>
        )}
      </>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <Label style={{ marginBottom: spacing.xs }}>Protocol</Label>
      <div
        onClick={onOpenManage}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing.sm}px 0`, cursor: "pointer", userSelect: "none",
          WebkitTapHighlightColor: "transparent", minHeight: touch.min,
          marginBottom: spacing.xs,
        }}
      >
        <span style={{ fontSize: typography.body, color: theme.text.primary }}>Manage protocol</span>
        <ChevronRight size={20} color={theme.text.secondary} />
      </div>

      <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />

      <Label style={{ marginBottom: spacing.xs }}>Account</Label>
      <div
        onClick={() => setView("account")}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing.sm}px 0`, cursor: "pointer", userSelect: "none",
          WebkitTapHighlightColor: "transparent", minHeight: touch.min,
          marginBottom: spacing.xs,
        }}
      >
        <span style={{ fontSize: typography.body, color: theme.text.primary }}>Manage account</span>
        <ChevronRight size={20} color={theme.text.secondary} />
      </div>

      <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />

      <Label style={{ marginBottom: spacing.xxs }}>Theme</Label>
      <HelperText style={{ marginBottom: spacing.xs }}>Choose how Origin appears.</HelperText>
      <div style={{ display: "flex", gap: spacing.xs }}>
        {THEME_OPTIONS.map(({ value, label }) => (
          <button key={value} onClick={() => setThemePreference(value)} style={themeBtnStyle(themePreference === value)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />

      <Label style={{ marginBottom: spacing.xs }}>Notifications</Label>
      {notifContent}

      <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />

      <Button variant="destructive" fullWidth onClick={() => { onSignOut(); onClose(); }}>Sign out</Button>
    </Modal>
  );
}
