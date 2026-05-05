import { useState } from "react";
import { colors, spacing, typography, layout, touch, gradients } from "../design-system";
import Button from "./Button";
import Input from "./Input";
import Label from "./Label";

export default function PromptName({ onSave }) {
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(name.trim() || null);
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: typography.fontBody, background: gradients.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: layout.signInWidth, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }}>👋</div>
        <div style={{ fontSize: typography.display, fontWeight: typography.bold, color: colors.textPrimary, letterSpacing: typography.headingLetterSpacing, marginBottom: spacing.xs }}>
          What's your name?
        </div>
        <div style={{ fontSize: typography.caption, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 1.5 }}>
          We'll use it to personalize your experience.
        </div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Name</Label>
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Your name"
          />
        </div>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Continue"}
        </Button>
        <button
          onClick={() => onSave(null)}
          style={{ marginTop: spacing.md, background: "none", border: "none", color: colors.textMuted, fontSize: typography.caption, cursor: "pointer", WebkitTapHighlightColor: "transparent", minHeight: touch.min, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
