import { useState } from "react";
import { Check } from "lucide-react";
import { colors, spacing, typography, radius } from "../design-system";
import Button from "./Button";
import Input from "./Input";
import Label from "./Label";
import { dbUpdateProfile, updateEmail, updatePassword } from "../lib/api";
import HelperText from "./HelperText";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = [
  { label: "8+ characters",     test: p => p.length >= 8 },
  { label: "Uppercase letter",  test: p => /[A-Z]/.test(p) },
  { label: "Number",            test: p => /[0-9]/.test(p) },
  { label: "Special character", test: p => /[^A-Za-z0-9]/.test(p) },
];

function PasswordRule({ met, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xxs }}>
      <div style={{
        width: 16, height: 16, borderRadius: radius.full,
        background: met ? colors.accent : "transparent",
        border: `1px solid ${met ? colors.accent : colors.borderSubtle}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "background 150ms, border-color 150ms",
      }}>
        {met && <Check size={10} color={colors.textOnAccent} strokeWidth={3} />}
      </div>
      <span style={{ fontSize: typography.label, color: met ? colors.textPrimary : colors.textMuted, transition: "color 150ms" }}>{label}</span>
    </div>
  );
}

export default function ManageAccount({ user, token, profile, onProfileUpdate, onShowToast }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [nameSaving, setNameSaving]   = useState(false);

  const [newEmail, setNewEmail]       = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg]       = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving]       = useState(false);

  const nameChanged = displayName.trim() !== (profile?.display_name || "");
  const pwRulesOk   = PASSWORD_RULES.every(r => r.test(newPassword));

  const handleSaveName = async () => {
    setNameSaving(true);
    try {
      await dbUpdateProfile(user.id, { display_name: displayName.trim() || null, updated_at: new Date().toISOString() }, token);
      onProfileUpdate({ ...profile, display_name: displayName.trim() || null });
      onShowToast("Name updated");
    } catch {
      onShowToast("Couldn't save — try again");
    } finally {
      setNameSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailMsg("");
    if (!EMAIL_RE.test(newEmail.trim())) { setEmailMsg("Enter a valid email address."); return; }
    setEmailSaving(true);
    try {
      await updateEmail(newEmail.trim(), token);
      setNewEmail("");
      onShowToast("Check your inbox to confirm the new email");
    } catch {
      setEmailMsg("Couldn't update email — try again.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!pwRulesOk) return;
    setPwSaving(true);
    try {
      await updatePassword(newPassword, token);
      setNewPassword("");
      onShowToast("Password updated");
    } catch {
      onShowToast("Couldn't update password — try again");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div>
      <Label style={{ marginBottom: spacing.xs }}>Display name</Label>
      <Input
        type="text"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={{ marginBottom: spacing.xs }}
      />
      <Button
        variant="secondary"
        fullWidth
        onClick={handleSaveName}
        disabled={nameSaving || !nameChanged}
        style={{ marginBottom: spacing.lg }}
      >
        {nameSaving ? "Saving…" : "Save name"}
      </Button>

      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, marginBottom: spacing.lg }} />

      <Label style={{ marginBottom: spacing.xs }}>Email</Label>
      <HelperText style={{ marginBottom: spacing.xs }}>Changing your email will send a confirmation link.</HelperText>
      <div style={{ fontSize: typography.caption, color: colors.textMuted, marginBottom: spacing.xs }}>{user.email}</div>
      <Input
        type="email"
        value={newEmail}
        onChange={e => { setNewEmail(e.target.value); setEmailMsg(""); }}
        placeholder="New email address"
        style={{ marginBottom: spacing.xs }}
      />
      {emailMsg && <div style={{ fontSize: typography.label, color: colors.danger, marginBottom: spacing.xs }}>{emailMsg}</div>}
      <Button
        variant="secondary"
        fullWidth
        onClick={handleSaveEmail}
        disabled={emailSaving || !newEmail.trim()}
        style={{ marginBottom: spacing.lg }}
      >
        {emailSaving ? "Saving…" : "Update email"}
      </Button>

      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, marginBottom: spacing.lg }} />

      <Label style={{ marginBottom: spacing.xs }}>New password</Label>
      <Input
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        placeholder="New password"
        style={{ marginBottom: spacing.xs }}
      />
      <div style={{ marginBottom: spacing.xs }}>
        {PASSWORD_RULES.map(r => <PasswordRule key={r.label} label={r.label} met={r.test(newPassword)} />)}
      </div>
      <Button
        variant="secondary"
        fullWidth
        onClick={handleSavePassword}
        disabled={pwSaving || !pwRulesOk}
      >
        {pwSaving ? "Saving…" : "Update password"}
      </Button>
    </div>
  );
}
