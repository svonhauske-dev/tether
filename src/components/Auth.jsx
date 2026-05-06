import { useState } from 'react';
import { Check } from 'lucide-react';
import { signInPassword, signUp, dbCreateProfile } from '../lib/api';
import { spacing, typography, layout, touch, radius } from '../design-system';
import { useTheme } from '../lib/theme';
import Button from './Button';
import Input from './Input';
import Label from './Label';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = [
  { label: "8+ characters",     test: p => p.length >= 8 },
  { label: "Uppercase letter",  test: p => /[A-Z]/.test(p) },
  { label: "Number",            test: p => /[0-9]/.test(p) },
  { label: "Special character", test: p => /[^A-Za-z0-9]/.test(p) },
];

function PasswordRule({ met, label }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xxs }}>
      <div style={{
        width: 16, height: 16, borderRadius: radius.full,
        background: met ? theme.accent.default : "transparent",
        border: `1px solid ${met ? theme.accent.default : theme.border.subtle}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "background 150ms, border-color 150ms",
      }}>
        {met && <Check size={10} color={theme.text.onAccent} strokeWidth={3} />}
      </div>
      <span style={{ fontSize: typography.label, color: met ? theme.text.primary : theme.text.muted, transition: "color 150ms" }}>{label}</span>
    </div>
  );
}

export default function Auth({ onSignIn }) {
  const { theme } = useTheme();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [name, setName]             = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [mode, setMode]             = useState("signin");
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState("");

  const emailOk   = EMAIL_RE.test(email.trim());
  const rulesOk   = PASSWORD_RULES.every(r => r.test(password));
  const canSubmit = !loading && (mode === "signin"
    ? emailOk && password.length > 0
    : name.trim().length > 0 && emailOk && rulesOk);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMsg("");
    try {
      if (mode === "signin") {
        const { user } = await signInPassword(email.trim(), password);
        onSignIn(user);
      } else {
        const { user, session } = await signUp(email.trim(), password);
        try { await dbCreateProfile({ id: user.id, display_name: name.trim() || null }, session.access_token); } catch {}
        onSignIn(user);
      }
    } catch (err) {
      setLoading(false);
      if (err.message === "EMAIL_TAKEN") {
        setMsg("EMAIL_TAKEN");
      } else if (err instanceof TypeError || err.message?.includes("fetch") || err.message?.includes("Failed to fetch") || err.message?.includes("network")) {
        setMsg("Couldn't reach Origin. Check your connection.");
      } else if (mode === "signin") {
        setMsg("Email or password is incorrect.");
      } else {
        setMsg("Something went wrong. Try again.");
      }
    }
  };

  const switchMode = () => {
    setMode(m => m === "signin" ? "signup" : "signin");
    setMsg("");
    setPassword("");
  };

  return (
    <div style={{ fontFamily: typography.fontBody, background: theme.gradients.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: layout.signInWidth, textAlign: "center" }}>
        <div style={{
          // Decorative emoji — sized outside the typography system intentionally
          fontSize: 40,
          marginBottom: spacing.md,
        }}>💊</div>
        <div style={{ fontSize: typography.display, fontWeight: typography.bold, color: theme.text.primary, letterSpacing: typography.headingLetterSpacing, marginBottom: spacing.xs }}>
          {mode === "signin" ? "Welcome back" : "Hello"}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginBottom: spacing.xl, lineHeight: 1.5 }}>
          {mode === "signin" ? "Pick up where you left off" : "Let's set up your protocol"}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {mode === "signup" && (
            <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
              <Label htmlFor="auth-name">Full name</Label>
              <Input
                id="auth-name"
                type="text"
                name="name"
                autoComplete="name"
                autoCapitalize="words"
                value={name}
                onChange={e => { setName(e.target.value); setMsg(""); }}
                onBlur={() => setNameTouched(true)}
                placeholder="e.g. Sofia von Hauske"
              />
              {nameTouched && !name.trim() && (
                <div style={{ fontSize: typography.label, color: theme.status.danger, marginTop: spacing.xxxs }}>Full name is required</div>
              )}
            </div>
          )}

          <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={e => { setEmail(e.target.value); setMsg(""); }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom: mode === "signup" ? spacing.xs : spacing.md, textAlign: "left" }}>
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={e => { setPassword(e.target.value); setMsg(""); }}
              placeholder="password"
            />
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
              {PASSWORD_RULES.map(r => <PasswordRule key={r.label} label={r.label} met={r.test(password)} />)}
            </div>
          )}

          <Button variant="primary" fullWidth type="submit" disabled={!canSubmit}>
            {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
          </Button>

          {msg === "EMAIL_TAKEN" ? (
            <div style={{ marginTop: spacing.md, fontSize: typography.caption, color: theme.status.danger }}>
              That email is already registered.{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setMsg(""); }}
                style={{ background: "none", border: "none", color: theme.accent.default, fontSize: typography.caption, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Sign in instead?
              </button>
            </div>
          ) : msg ? (
            <div style={{ marginTop: spacing.md, fontSize: typography.caption, color: theme.status.danger }}>{msg}</div>
          ) : null}
        </form>

        <button
          type="button"
          onClick={switchMode}
          style={{ marginTop: spacing.md, background: "none", border: "none", color: theme.text.muted, fontSize: typography.caption, cursor: "pointer", WebkitTapHighlightColor: "transparent", minHeight: touch.min, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
        >
          {mode === "signin" ? "New to Origin? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
