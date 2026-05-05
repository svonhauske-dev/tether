import { useState } from "react";
import { colors, spacing, radius, typography, layout, gradients, segBtnStyle } from "../design-system";
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, toHrMin, fromHrMin } from "../config";
import Button from "./Button";
import Card from "./Card";
import Input from "./Input";
import Label from "./Label";

const ONBOARDING_MODES = [
  { id: "none",       title: "No Schedule",          desc: "Just a checklist. No times, no notifications." },
  { id: "wakeup",     title: "Wake Up Anchor",        desc: "Your day cascades from when you wake up." },
  { id: "medication", title: "Medication Anchor",     desc: "Your day cascades from when you take your medication." },
  { id: "fasting",    title: "Intermittent Fasting",  desc: "Built around your eating window." },
  { id: "fixed",      title: "Fixed Times",           desc: "Same schedule every day, no anchor." },
];

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
  return (
    <div style={{ display: "flex", gap: spacing.xs, justifyContent: "center", marginBottom: spacing.lg }}>
      {[1, 2].map(i => (
        <div key={i} style={{
          width: i === step ? 20 : 8,
          height: 8,
          borderRadius: radius.full,
          background: i === step ? colors.accent : colors.borderStrong,
          transition: "width 0.2s, background 0.2s",
        }} />
      ))}
    </div>
  );
}

export default function Onboarding({ onComplete }) {
  const [step, setStep]             = useState(1);
  const [selectedMode, setMode]     = useState(null);
  const [config, setConfig]         = useState({ ...DEFAULT_CONFIG, fixed_times: { ...DEFAULT_CONFIG.fixed_times } });
  const [behavior, setBehavior]     = useState("flexible");
  const [cTime, setCTime]           = useState("07:00");
  const [saving, setSaving]         = useState(false);

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

  const screenStyle = {
    fontFamily: typography.fontBody,
    background: gradients.bg,
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
            <div style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: colors.textPrimary, fontFamily: typography.fontHeading, marginBottom: spacing.xs }}>
              Set up your protocol
            </div>
            <div style={{ fontSize: typography.body, color: colors.textSecondary, lineHeight: 1.6 }}>
              Choose how Tether tracks your day.
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {ONBOARDING_MODES.map(m => {
              const on = selectedMode === m.id;
              return (
                <Card
                  key={m.id}
                  variant={on ? "selected" : "default"}
                  onClick={() => setMode(m.id)}
                  style={{ display: "flex", flexDirection: "column", gap: spacing.xxs }}
                >
                  <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: on ? colors.accent : colors.textPrimary }}>{m.title}</span>
                  <span style={{ fontSize: typography.caption, color: colors.textMuted, lineHeight: 1.4 }}>{m.desc}</span>
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
          <div style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: colors.textPrimary, fontFamily: typography.fontHeading, marginBottom: spacing.xs }}>
            Configure your schedule
          </div>
          <div style={{ fontSize: typography.body, color: colors.textSecondary, lineHeight: 1.6 }}>
            {STEP2_SUBTITLES[selectedMode]}
          </div>
        </div>

        {/* Anchor note */}
        {ANCHOR_NOTES[selectedMode] && (
          <Card variant="accent" style={{ padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.label, color: colors.accent, marginBottom: spacing.md }}>
            {ANCHOR_NOTES[selectedMode]}
          </Card>
        )}

        {/* Flexible / Consistent toggle — not for fixed */}
        {selectedMode !== "fixed" && (
          <div style={{ marginBottom: spacing.md }}>
            <Label>Daily timing</Label>
            <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.xs }}>
              {[["flexible", "Flexible"], ["consistent", "Consistent"]].map(([val, label]) => {
                const on = behavior === val;
                return (
                  <button key={val} onClick={() => setBehavior(val)} style={segBtnStyle(on)}>{label}</button>
                );
              })}
            </div>
            <div style={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.6 }}>
              {behavior === "flexible"
                ? "Tap each morning to set your schedule for the day."
                : "Your schedule runs automatically at the same time every day."}
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
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                {MEAL_ROWS.map(({ key, label }) => {
                  const total   = config[key];
                  const isEmpty = total === null || total === undefined;
                  const { h, m } = toHrMin(isEmpty ? 0 : total);
                  return (
                    <Card key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                      <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
                      <Input
                        variant="number" width={52} min="0" max="23"
                        value={isEmpty ? "" : h}
                        onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(e.target.value, isEmpty ? 0 : m))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: typography.label, color: colors.textMuted }}>hr</span>
                      <Input
                        variant="number" width={52} min="0" max="59"
                        value={isEmpty ? "" : m}
                        onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(isEmpty ? 0 : h, e.target.value))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>after anchor</span>
                    </Card>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: spacing.lg }}>
              <Label>Pre-meal window</Label>
              <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Take pre-meal supplements</span>
                <Input
                  variant="number" width={52} min="0" max="120"
                  value={config.pre_meal_window ?? 30}
                  onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: typography.label, color: colors.textMuted }}>min before eating</span>
              </Card>
              <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xs, paddingLeft: spacing.xs }}>applies to all meals</div>
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
            <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Pre-meal supplements</span>
              <Input
                variant="number" width={52} min="0" max="120"
                value={config.pre_meal_window ?? 30}
                onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>min before</span>
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
                  <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
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
