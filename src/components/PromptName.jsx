import { useState } from "react";
import { spacing, typography, layout, touch } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";
import Input from "./Input";
import Label from "./Label";

export default function PromptName({ onSave }) {
  const { theme } = useTheme();
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(name.trim() || null);
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: typography.fontBody, background: theme.gradients.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: layout.signInWidth, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }}>👋</div>
        <div style={{ fontSize: typography.display, fontWeight: typography.bold, color: theme.text.primary, letterSpacing: typography.headingLetterSpacing, marginBottom: spacing.xs }}>
          What's your full name?
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginBottom: spacing.xl, lineHeight: 1.5 }}>
          We'll use it in your daily greeting.
        </div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Full name</Label>
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="e.g. Sofia von Hauske"
          />
        </div>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Continue"}
        </Button>
        <button
          onClick={() => onSave(null)}
          style={{ marginTop: spacing.md, background: "none", border: "none", color: theme.text.muted, fontSize: typography.caption, cursor: "pointer", WebkitTapHighlightColor: "transparent", minHeight: touch.min, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
