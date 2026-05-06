import { useState } from "react";
import { spacing, typography, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import { DEFAULT_CONFIG, FIXED_SLOTS, MODES, toHrMin, fromHrMin } from "../config";
import Button from "./Button";
import Card from "./Card";
import HelperText from "./HelperText";
import Input from "./Input";
import Label from "./Label";


const STEP2_SUBTITLES = {
  wakeup:     "Set your meal offsets. You can change these anytime.",
  medication: "Set your meal offsets. You can change these anytime.",
  fasting:    "Set your eating window. You can change these anytime.",
  fixed:      "Set your daily times. You can change these anytime.",
};

const MEAL_ROWS = [
  { key: "breakfast",    label: "Breakfast" },
  { key: "lunch",        label: "Lunch" },
  { key: "dinner",       label: "Dinner" },
  { key: "after_dinner", label: "Evening" },
];

function ProgressDots({ step }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", gap: spacing.xs, justifyContent: "center", marginBottom: spacing.lg }}>
      {[1, 2].map(i => (
        <div key={i} style={{
          width: i === step ? 20 : 8,
          height: 8,
          borderRadius: theme.radius.pill,
          background: i === step ? theme.accent.default : theme.border.strong,
          transition: "width 0.2s, background 0.2s",
        }} />
      ))}
    </div>
  );
}

export default function Onboarding({ onComplete }) {
  const { theme } = useTheme();
  const [step, setStep]         = useState(1);
  const [selectedMode, setMode] = useState(null);
  const [config, setConfig]     = useState({ ...DEFAULT_CONFIG, fixed_times: { ...DEFAULT_CONFIG.fixed_times } });
  const [behavior, setBehavior] = useState("flexible");
  const [cTime, setCTime]       = useState("07:00");
  const [saving, setSaving]     = useState(false);

  const updateConfig = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const updateFixed  = (key, value) => setConfig(c => ({ ...c, fixed_times: { ...c.fixed_times, [key]: value || null } }));

  const handleContinue = () => {
    if (!selectedMode) return;
    if (selectedMode === "none") {
      onComplete("none", {}, "flexible", "07:00");
      return;
    }
    setStep(2);
  };

  const handleGetStarted = async () => {
    setSaving(true);
    await onComplete(selectedMode, config, behavior, cTime);
    setSaving(false);
  };

  const isOffsetMode = selectedMode === "medication" || selectedMode === "wakeup";

  const segBtnStyle = (on) => ({
    flex: 1,
    padding: `${spacing.sm}px`,
    borderRadius: theme.radius.pill,
    cursor: "pointer",
    fontSize: typography.caption,
    fontFamily: typography.fontBody,
    background: on ? theme.accent.subtle : "transparent",
    color: on ? theme.accent.onSubtle : theme.text.secondary,
    border: `${theme.borderWidth.default}px solid ${on ? theme.accent.default : theme.border.subtle}`,
    fontWeight: on ? typography.semibold : typography.regular,
    minHeight: layout.segHeight,
  });

  const screenStyle = {
    fontFamily: typography.fontBody,
    background: theme.gradients.bg,
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: `max(${spacing.xl}px, env(safe-area-inset-top)) ${spacing.md}px max(${spacing.xl}px, env(safe-area-inset-bottom))`,
    WebkitFontSmoothing: "antialiased",
    overflowY: "auto",
  };

  // ── Step 1: pick a schedule type ────────────────────────────────────────────

  if (step === 1) {
    return (
      <div style={screenStyle}>
        <div style={{ width: "100%", maxWidth: layout.maxContentWidth, display: "flex", flexDirection: "column", flex: 1 }}>
          <ProgressDots step={1} />

          <div style={{ marginBottom: spacing.xl }}>
            <div style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading, marginBottom: spacing.xs }}>
              Set up your protocol
            </div>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5 }}>
              Choose how Origin tracks your day.
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {MODES.map(m => {
              const on = selectedMode === m.id;
              return (
                <Card
                  key={m.id}
                  variant={on ? "selected" : "default"}
                  onClick={() => setMode(m.id)}
                  style={{ display: "flex", flexDirection: "column", gap: spacing.xxs }}
                >
                  <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: on ? theme.accent.onSubtle : theme.text.primary }}>{m.title}</span>
                  <span style={{ fontSize: typography.caption, color: theme.text.muted, lineHeight: 1.4 }}>{m.desc}</span>
                </Card>
              );
            })}
          </div>

          <div style={{ paddingTop: spacing.lg }}>
            <Button variant="primary" fullWidth onClick={handleContinue} disabled={!selectedMode}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: configure the chosen mode ───────────────────────────────────────

  return (
    <div style={screenStyle}>
      <div style={{ width: "100%", maxWidth: layout.maxContentWidth }}>
        <ProgressDots step={2} />

        <div style={{ marginBottom: spacing.xl }}>
          <div style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading, marginBottom: spacing.xs }}>
            Configure your schedule
          </div>
          <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5 }}>
            {STEP2_SUBTITLES[selectedMode]}
          </div>
        </div>

        {/* Flexible / Consistent toggle — not for fixed */}
        {selectedMode !== "fixed" && (
          <div style={{ marginBottom: spacing.md }}>
            <Label>Daily timing</Label>
            {behavior === "flexible" && (
              <HelperText>Tap each morning to set your schedule for the day.</HelperText>
            )}
            <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.xs }}>
              {[["flexible", "Flexible"], ["consistent", "Consistent"]].map(([val, label]) => {
                const on = behavior === val;
                return (
                  <button key={val} onClick={() => setBehavior(val)} style={segBtnStyle(on)}>{label}</button>
                );
              })}
            </div>
            {behavior === "consistent" && (
              <div style={{ marginTop: spacing.sm }}>
                <Label>Start time</Label>
                <Input variant="time" value={cTime} onChange={e => setCTime(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Medication / Wakeup: meal offset editor */}
        {isOffsetMode && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Meal schedule</Label>
              <HelperText>Times relative to your anchor</HelperText>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                {MEAL_ROWS.map(({ key, label }) => {
                  const total   = config[key];
                  const isEmpty = total === null || total === undefined;
                  const { h, m } = toHrMin(isEmpty ? 0 : total);
                  return (
                    <Card key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                      <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                      <Input
                        variant="number" width={52} min="0" max="23"
                        inputMode="numeric" pattern="[0-9]*"
                        value={isEmpty ? "" : h}
                        onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(e.target.value, isEmpty ? 0 : m))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: typography.caption, color: theme.text.muted }}>hr</span>
                      <Input
                        variant="number" width={52} min="0" max="59"
                        inputMode="numeric" pattern="[0-9]*"
                        value={isEmpty ? "" : m}
                        onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(isEmpty ? 0 : h, e.target.value))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: typography.caption, color: theme.text.muted }}>min</span>
                    </Card>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: spacing.lg }}>
              <Label>Pre-meal window</Label>
              <HelperText>How early before each meal to schedule pre-meal items</HelperText>
              <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
                <Input
                  variant="number" width={52} min="0" max="120"
                  inputMode="numeric" pattern="[0-9]*"
                  value={config.pre_meal_window ?? 30}
                  onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: typography.caption, color: theme.text.muted }}>min</span>
              </Card>
            </div>
          </>
        )}

        {/* Intermittent fasting: window config */}
        {selectedMode === "fasting" && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Window length</Label>
              <div style={{ display: "flex", gap: spacing.xs }}>
                {[[240, "4 hr"], [360, "6 hr"], [480, "8 hr"]].map(([val, lbl]) => {
                  const on = (config.window_length ?? 480) === val;
                  return <button key={val} onClick={() => updateConfig("window_length", val)} style={segBtnStyle(on)}>{lbl}</button>;
                })}
              </div>
            </div>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Meals per day</Label>
              <div style={{ display: "flex", gap: spacing.xs }}>
                {[[2, "2 meals"], [3, "3 meals"]].map(([val, lbl]) => {
                  const on = (config.meals_per_day ?? 2) === val;
                  return <button key={val} onClick={() => updateConfig("meals_per_day", val)} style={segBtnStyle(on)}>{lbl}</button>;
                })}
              </div>
            </div>
            <Label>Pre-meal window</Label>
            <HelperText>How early before each meal to schedule pre-meal items</HelperText>
            <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input
                variant="number" width={52} min="0" max="120"
                inputMode="numeric" pattern="[0-9]*"
                value={config.pre_meal_window ?? 30}
                onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.caption, color: theme.text.muted }}>min</span>
            </Card>
          </div>
        )}

        {/* Fixed: time pickers */}
        {selectedMode === "fixed" && (
          <div style={{ marginBottom: spacing.lg }}>
            <Label>Fixed times</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              {FIXED_SLOTS.map(({ key, label }) => (
                <Card key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                  <Input
                    variant="time"
                    value={config.fixed_times?.[key] || ""}
                    onChange={e => updateFixed(key, e.target.value)}
                    style={{ width: "auto" }}
                  />
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer: Back + Get started */}
        <div style={{ display: "flex", gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
          <Button variant="tertiary" style={{ flex: 1 }} onClick={() => setStep(1)} disabled={saving}>Back</Button>
          <Button variant="primary" style={{ flex: 2 }} onClick={handleGetStarted} disabled={saving}>
            {saving ? "Saving…" : "Get started"}
          </Button>
        </div>
      </div>
    </div>
  );
}
