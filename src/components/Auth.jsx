import { useState } from 'react';
import { signInPassword, signUp } from '../lib/api';
import { colors, spacing, typography, layout, gradients } from '../design-system';
import Button from './Button';
import Input from './Input';
import Label from './Label';

export default function Auth({ onSignIn }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState("signin");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setMsg("");
    const user = mode === "signin"
      ? await signInPassword(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);
    if (user) onSignIn(user);
    else setMsg(mode === "signin" ? "Invalid email or password." : "Could not create account — try again.");
  };

  return (
    <div style={{ fontFamily: typography.fontBody, background: gradients.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: layout.signInWidth, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }}>💊</div>
        <div style={{ fontSize: typography.hero, fontWeight: typography.bold, color: colors.textPrimary, letterSpacing: typography.headingLetterSpacing, marginBottom: spacing.xs }}>Tether</div>
        <div style={{ fontSize: typography.caption, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 1.7 }}>Your supplement schedule,<br />built around your life.</div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="your@email.com" />
        </div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="password" />
        </div>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={loading}>
          {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
        </Button>
        <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setMsg(""); }} style={{ marginTop: spacing.md, background: "none", border: "none", color: colors.textMuted, fontSize: typography.caption, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        {msg && <div style={{ marginTop: spacing.md, fontSize: typography.caption, color: colors.danger }}>{msg}</div>}
      </div>
    </div>
  );
}
