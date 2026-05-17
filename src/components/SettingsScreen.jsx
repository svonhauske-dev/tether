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
import ScheduleTab from './ScheduleTab';

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
      <span style={{ fontSize: typography.label, color: met ? theme.text.primary : theme.text.secondary, transition: 'color 150ms' }}>
        {label}
      </span>
    </div>
  );
}

const TITLES = { main: 'Settings', schedule: 'Schedule', account: 'Account', install: 'Add to home screen' };

export default function SettingsScreen({ isOpen, onBack, onSignOut, user, token, profile, onProfileUpdate, onNotificationsEnabled, scheduleMode, scheduleConfig, anchorBehavior, consistentTime, onSaveSchedule, supplements = [] }) {
  const { theme } = useTheme();
  const { show: showToast } = useToast();

  const [view, setView] = useState('main');

  // Notification state
  const [permission, setPermission]           = useState('default');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [needsInstall, setNeedsInstall]       = useState(false);
  const [pushSupported, setPushSupported]     = useState(true);
  const [toggling, setToggling]               = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;
    setView('main');
    setPermission(getNotificationPermission());
    setNeedsInstall(needsHomeScreenInstall());
    setPushSupported(isPushSupported());
    getCurrentSubscription().then(sub => setHasSubscription(!!sub));
    setDisplayName(profile?.display_name || '');
  }, [isOpen]);

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
  }, [profile?.display_name]);

  const handleBack = () => {
    if (view !== 'main') setView('main');
    else onBack();
  };

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
        if (needsInstall) { setToggling(false); setView('install'); return; }
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
        setView('install');
      } else if (err.message?.includes('VAPID')) {
        showToast('Reminders not configured yet');
      } else {
        showToast("Couldn't update reminders");
      }
    } finally {
      setToggling(false);
    }
  };

  const divider = (
    <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, margin: `${spacing.lg}px 0` }} />
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-out',
      zIndex: 100,
      background: theme.surface.canvas,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Sticky header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <button
          onClick={handleBack}
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
          {TITLES[view]}
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        maxWidth: layout.maxContentWidth,
        margin: '0 auto',
        padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>

        {/* ── Main view ── */}
        {view === 'main' && (
          <>
            <Label style={{ marginBottom: spacing.xs }}>Schedule</Label>
            <div
              onClick={() => setView('schedule')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: touch.min, cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: typography.body, color: theme.text.secondary }}>
                Edit schedule
              </span>
              <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
            </div>

            {divider}

            <Label style={{ marginBottom: spacing.xs }}>Account</Label>
            <div
              onClick={() => setView('account')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: touch.min, cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: typography.body, color: theme.text.secondary }}>
                Edit account
              </span>
              <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
            </div>

            {divider}

            {/* Notifications */}
            <Label style={{ marginBottom: spacing.xs }}>Notifications</Label>
            {!pushSupported ? (
              <HelperText>Notifications aren't supported in this browser.</HelperText>
            ) : needsInstall ? (
              <div
                onClick={() => setView('install')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                  minHeight: touch.min,
                }}
              >
                <span style={{ fontSize: typography.caption, color: theme.text.secondary, flex: 1, paddingRight: spacing.sm }}>
                  Install Origin to your home screen to enable reminders.
                </span>
                <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                  <Button variant="selector" active={hasSubscription}  disabled={toggling || permission === 'denied'} style={{ flex: 1 }} onClick={() => { if (!hasSubscription) handleToggleNotifications(); }}>On</Button>
                  <Button variant="selector" active={!hasSubscription} disabled={toggling} style={{ flex: 1 }} onClick={() => { if (hasSubscription) handleToggleNotifications(); }}>Off</Button>
                </div>
                {toggling && <HelperText style={{ marginTop: spacing.xxs }}>Updating…</HelperText>}
                {permission === 'denied' && <div style={{ fontSize: typography.caption, color: theme.status.danger, marginTop: spacing.xxs }}>Notifications blocked. Enable Origin in your device settings.</div>}
                {!hasSubscription && !toggling && permission === 'default' && <HelperText style={{ marginTop: spacing.xxs }}>You'll be asked to allow notifications.</HelperText>}
                {!hasSubscription && !toggling && permission === 'granted'  && <HelperText style={{ marginTop: spacing.xxs }}>Tap On to resume notifications.</HelperText>}
              </>
            )}

            {divider}

            <Button variant="destructive" fullWidth onClick={onSignOut}>Sign out</Button>
          </>
        )}

        {/* ── Schedule view ── */}
        {view === 'schedule' && (
          <ScheduleTab
            scheduleMode={scheduleMode}
            scheduleConfig={scheduleConfig}
            anchorBehavior={anchorBehavior}
            consistentTime={consistentTime}
            onSave={onSaveSchedule}
            supplements={supplements}
          />
        )}

        {/* ── Account view ── */}
        {view === 'account' && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.secondary }}>Full name</Label>
              <div style={{ position: 'relative' }}>
                <Input
                  type="text"
                  value={displayName}
                  onChange={handleDisplayNameChange}
                  placeholder="e.g. Sofia von Hauske"
                  autoComplete="name"
                />
                {nameSaving && (
                  <div style={{ position: 'absolute', right: spacing.sm, top: '50%', transform: 'translateY(-50%)' }}>
                    <InlineLoader size="sm" />
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleSaveEmail(); }} style={{ marginBottom: spacing.md }}>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.secondary }}>Email</Label>
              <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginBottom: spacing.xs }}>{user.email}</div>
              <Input
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailMsg(''); }}
                placeholder="New email address"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ marginBottom: spacing.xs }}
              />
              {emailMsg && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs }}>{emailMsg}</div>}
              <Button variant="secondary" fullWidth type="submit" disabled={emailSaving || !newEmail.trim()}>
                {emailSaving ? <InlineLoader size="sm" /> : 'Update email'}
              </Button>
            </form>

            <form onSubmit={e => { e.preventDefault(); handleSavePassword(); }}>
              <Label style={{ marginBottom: spacing.xxs, fontSize: typography.caption, color: theme.text.secondary }}>Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" autoComplete="new-password" style={{ marginBottom: spacing.xs }} />
              <Input type="password" value={confirmPw}   onChange={e => setConfirmPw(e.target.value)}   placeholder="Confirm new password" autoComplete="new-password" style={{ marginBottom: spacing.xs }} />
              {confirmPw && !pwMatch && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs }}>Passwords don't match</div>}
              <div style={{ marginBottom: spacing.xs }}>
                {PASSWORD_RULES.map(r => <PasswordRule key={r.label} label={r.label} met={r.test(newPassword)} />)}
              </div>
              <Button variant="secondary" fullWidth type="submit" disabled={pwSaving || !pwRulesOk || !pwMatch}>
                {pwSaving ? <InlineLoader size="sm" /> : 'Update password'}
              </Button>
            </form>
          </>
        )}

        {/* ── Install view ── */}
        {view === 'install' && (
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
        )}

      </div>
    </div>
  );
}
