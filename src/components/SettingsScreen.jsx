import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { spacing, typography, touch, layout } from '../design-system';
import { useTheme } from '../lib/theme';
import { useToast } from './ToastContext';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import HelperText from './HelperText';
import InlineLoader from './InlineLoader';
import {
  isPushSupported, needsHomeScreenInstall, getNotificationPermission,
  getCurrentSubscription, subscribeToPush, unsubscribeFromPush,
} from '../lib/notifications';
import { dbUpdateScheduleField, dbUpdateProfile, updateEmail, updatePassword } from '../lib/api';

const THEME_OPTIONS = [
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
  { value: 'system', label: 'System' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = [
  { label: '8+ characters',     test: p => p.length >= 8 },
  { label: 'Uppercase letter',  test: p => /[A-Z]/.test(p) },
  { label: 'Number',            test: p => /[0-9]/.test(p) },
  { label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

function PasswordRule({ met, label }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxs }}>
      <div style={{
        width: 16, height: 16, borderRadius: theme.radius.pill,
        background: met ? theme.accent.default : 'transparent',
        border: `${theme.borderWidth.default}px solid ${met ? theme.accent.default : theme.border.subtle}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 150ms, border-color 150ms',
      }}>
        {met && <Check size={10} color={theme.text.onAccent} strokeWidth={3} />}
      </div>
      <span style={{ fontSize: typography.label, color: met ? theme.text.primary : theme.text.muted, transition: 'color 150ms' }}>
        {label}
      </span>
    </div>
  );
}

export default function SettingsScreen({ isOpen, onBack, onSignOut, user, token, profile, onProfileUpdate, onNotificationsEnabled }) {
  const { theme, themePreference, setThemePreference } = useTheme();
  const { show: showToast } = useToast();

  // Notification state
  const [permission, setPermission]           = useState('default');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [needsInstall, setNeedsInstall]       = useState(false);
  const [pushSupported, setPushSupported]     = useState(true);
  const [toggling, setToggling]               = useState(false);
  const [showInstall, setShowInstall]         = useState(false);

  // Account — display name
  const [displayName, setDisplayName] = useState('');
  const [nameSaving, setNameSaving]   = useState(false);
  const debounceRef = useRef(null);

  // Account — email
  const [newEmail, setNewEmail]       = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg]       = useState('');

  // Account — password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [pwSaving, setPwSaving]       = useState(false);

  // Sync when screen opens
  useEffect(() => {
    if (!isOpen) return;
    setPermission(getNotificationPermission());
    setNeedsInstall(needsHomeScreenInstall());
    setPushSupported(isPushSupported());
    getCurrentSubscription().then(sub => setHasSubscription(!!sub));
    setDisplayName(profile?.display_name || '');
    setShowInstall(false);
  }, [isOpen]);

  // Keep displayName in sync if profile changes while screen is open
  useEffect(() => {
    setDisplayName(profile?.display_name || '');
  }, [profile?.display_name]);

  const handleDisplayNameChange = (e) => {
    const val = e.target.value;
    setDisplayName(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (val.trim() === (profile?.display_name || '')) return;
      setNameSaving(true);
      try {
        await dbUpdateProfile(user.id, { display_name: val.trim() || null, updated_at: new Date().toISOString() }, token);
        onProfileUpdate({ ...profile, display_name: val.trim() || null });
        showToast('Name updated');
      } catch {
        showToast("Couldn't save — try again");
      } finally {
        setNameSaving(false);
      }
    }, 600);
  };

  const handleSaveEmail = async () => {
    setEmailMsg('');
    if (!EMAIL_RE.test(newEmail.trim())) { setEmailMsg('Enter a valid email address'); return; }
    setEmailSaving(true);
    try {
      await updateEmail(newEmail.trim(), token);
      setNewEmail('');
      showToast('Check your inbox to confirm the new email');
    } catch {
      setEmailMsg("Couldn't update email — try again");
    } finally {
      setEmailSaving(false);
    }
  };

  const pwRulesOk = PASSWORD_RULES.every(r => r.test(newPassword));
  const pwMatch   = newPassword.length > 0 && confirmPw.length > 0 && newPassword === confirmPw;

  const handleSavePassword = async () => {
    if (!pwRulesOk || !pwMatch) return;
    setPwSaving(true);
    try {
      await updatePassword(newPassword, token);
      setNewPassword('');
      setConfirmPw('');
      showToast('Password updated');
    } catch {
      showToast("Couldn't update password — try again");
    } finally {
      setPwSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (hasSubscription) {
        await unsubscribeFromPush();
        await dbUpdateScheduleField('notifications_enabled', false, user.id, token);
        setHasSubscription(false);
        showToast('Reminders off');
      } else {
        if (needsInstall) { setToggling(false); setShowInstall(true); return; }
        await subscribeToPush();
        await dbUpdateScheduleField('notifications_enabled', true, user.id, token);
        setPermission('granted');
        setHasSubscription(true);
        showToast('Reminders on');
        if (onNotificationsEnabled) onNotificationsEnabled();
      }
    } catch (err) {
      if (err.message?.includes('denied')) {
        showToast('Permission denied — enable in device settings');
        setPermission('denied');
      } else if (err.message?.includes('PWA install')) {
        setShowInstall(true);
      } else if (err.message?.includes('VAPID')) {
        showToast('Reminders not configured yet');
      } else {
        showToast("Couldn't update reminders");
      }
    } finally {
      setToggling(false);
    }
  };

  const themeBtnStyle = (active) => ({
    flex: 1,
    padding: `${spacing.sm}px`,
    borderRadius: theme.radius.pill,
    cursor: 'pointer',
    fontSize: typography.caption,
    fontFamily: typography.fontBody,
    background: active ? theme.accent.subtle : 'transparent',
    color: active ? theme.accent.onSubtle : theme.text.secondary,
    border: `${theme.borderWidth.default}px solid ${active ? theme.accent.default : theme.border.subtle}`,
    fontWeight: active ? typography.semibold : typography.regular,
    minHeight: layout.segHeight,
    WebkitTapHighlightColor: 'transparent',
  });

  const divider = (
    <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-out',
        zIndex: 100,
        background: theme.surface.canvas,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Sticky screen header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <button
          onClick={showInstall ? () => setShowInstall(false) : onBack}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: `${spacing.xs}px`, marginLeft: -spacing.xs,
            color: theme.text.primary, display: 'flex', alignItems: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary }}>
          {showInstall ? 'Add to home screen' : 'Settings'}
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        maxWidth: layout.maxContentWidth,
        margin: '0 auto',
        padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>

        {showInstall ? (
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
        ) : (
          <>
            {/* ── Account ── */}
            <Label style={{ marginBottom: spacing.sm }}>Account</Label>

            <div style={{ marginBottom: spacing.md }}>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.muted }}>
                Full name
              </Label>
              <div style={{ position: 'relative' }}>
                <Input
                  type="text"
                  value={displayName}
                  onChange={handleDisplayNameChange}
                  placeholder="e.g. Sofia von Hauske"
                />
                {nameSaving && (
                  <div style={{ position: 'absolute', right: spacing.sm, top: '50%', transform: 'translateY(-50%)' }}>
                    <InlineLoader size="sm" />
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.muted }}>
                Email
              </Label>
              <div style={{ fontSize: typography.caption, color: theme.text.muted, marginBottom: spacing.xs }}>
                {user.email}
              </div>
              <Input
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailMsg(''); }}
                placeholder="New email address"
                style={{ marginBottom: spacing.xs }}
              />
              {emailMsg && (
                <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs }}>
                  {emailMsg}
                </div>
              )}
              <Button
                variant="secondary"
                fullWidth
                onClick={handleSaveEmail}
                disabled={emailSaving || !newEmail.trim()}
              >
                {emailSaving ? <InlineLoader size="sm" /> : 'Update email'}
              </Button>
            </div>

            <div>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.muted }}>
                Password
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                style={{ marginBottom: spacing.xs }}
              />
              <Input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                style={{ marginBottom: spacing.xs }}
              />
              {confirmPw && !pwMatch && (
                <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs }}>
                  Passwords don't match
                </div>
              )}
              <div style={{ marginBottom: spacing.xs }}>
                {PASSWORD_RULES.map(r => (
                  <PasswordRule key={r.label} label={r.label} met={r.test(newPassword)} />
                ))}
              </div>
              <Button
                variant="secondary"
                fullWidth
                onClick={handleSavePassword}
                disabled={pwSaving || !pwRulesOk || !pwMatch}
              >
                {pwSaving ? <InlineLoader size="sm" /> : 'Update password'}
              </Button>
            </div>

            {divider}

            {/* ── Theme ── */}
            <Label style={{ marginBottom: spacing.xxs }}>Theme</Label>
            <HelperText style={{ marginBottom: spacing.xs }}>Choose how Origin appears.</HelperText>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {THEME_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => setThemePreference(value)} style={themeBtnStyle(themePreference === value)}>
                  {label}
                </button>
              ))}
            </div>

            {divider}

            {/* ── Notifications ── */}
            <Label style={{ marginBottom: spacing.xs }}>Notifications</Label>
            {!pushSupported ? (
              <div style={{ fontSize: typography.caption, color: theme.text.muted }}>
                Notifications aren't supported in this browser.
              </div>
            ) : permission === 'denied' ? (
              <div style={{ fontSize: typography.caption, color: theme.status.danger }}>
                Permission blocked. Enable Origin in your device settings.
              </div>
            ) : needsInstall ? (
              <div
                onClick={() => setShowInstall(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                  minHeight: touch.min,
                }}
              >
                <span style={{ fontSize: typography.caption, color: theme.text.muted, flex: 1, paddingRight: spacing.sm }}>
                  Install Origin to your home screen to enable reminders.
                </span>
                <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: touch.min }}>
                <span style={{ fontSize: typography.body, color: theme.text.primary }}>Reminders</span>
                {toggling ? (
                  <div style={{ width: 44, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <InlineLoader size="sm" />
                  </div>
                ) : (
                  <button
                    onClick={handleToggleNotifications}
                    aria-label={hasSubscription ? 'Turn off reminders' : 'Turn on reminders'}
                    style={{
                      width: 44, height: 26, borderRadius: theme.radius.toggle,
                      background: hasSubscription ? theme.accent.default : theme.surface.toggleOff,
                      border: 'none', cursor: 'pointer', transition: 'background 200ms',
                      position: 'relative', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: hasSubscription ? 21 : 3,
                      width: 20, height: 20, borderRadius: theme.radius.pill,
                      background: hasSubscription ? theme.text.onAccent : theme.surface.knob,
                      transition: 'left 200ms', display: 'block',
                    }} />
                  </button>
                )}
              </div>
            )}

            {divider}

            {/* ── Sign out ── */}
            <Button variant="destructive" fullWidth onClick={onSignOut}>Sign out</Button>
          </>
        )}
      </div>
    </div>
  );
}
