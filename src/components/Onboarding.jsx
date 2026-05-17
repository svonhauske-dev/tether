import { useState } from "react";
import { spacing, typography, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import { DEFAULT_CONFIG, FIXED_SLOTS, DISPLAY_MODES, ANCHOR_SUB_MODES } from "../config";
import Button from "./Button";
import Card from "./Card";
import HelperText from "./HelperText";
import Input from "./Input";
import Label from "./Label";


const applyCascade = (cfg) => {
  const firstMeal = (cfg.first_meal_offset_hours ?? 1) * 60 + (cfg.first_meal_offset_minutes ?? 0);
  const interval  = (cfg.meal_interval_hours ?? 4) * 60 + (cfg.meal_interval_minutes ?? 0);
  return { ...cfg, breakfast: firstMeal, lunch: firstMeal + interval, dinner: firstMeal + 2 * interval };
};

const STEP2_SUBTITLES = {
  wakeup:     "Set your meal timing. You can change these anytime.",
  medication: "Set your meal timing. You can change these anytime.",
  fasting:    "Set your eating window. You can change these anytime.",
  fixed:      "Set your daily times. You can change these anytime.",
};

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
  const [selectedMode, setMode] = useState(null); // actual DB value: medication | wakeup | fasting | fixed | none
  const [selectedCard, setCard] = useState(null); // display card: anchor | fasting | fixed | none
  const [config, setConfig]     = useState(() => applyCascade({
    ...DEFAULT_CONFIG,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times },
    first_meal_offset_hours:   1,
    first_meal_offset_minutes: 0,
    meal_interval_hours:       4,
    meal_interval_minutes:     0,
    evening_mode:              null,
  }));
  const [behavior, setBehavior] = useState("flexible");
  const [cTime, setCTime]       = useState("07:00");
  const [saving, setSaving]     = useState(false);

  const updateConfig   = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const updateCascade  = (key, value) => setConfig(c => applyCascade({ ...c, [key]: value }));
  const updateEvening  = (updates)   => setConfig(c => ({ ...c, ...updates }));
  const updateFixed    = (key, value) => setConfig(c => ({ ...c, fixed_times: { ...c.fixed_times, [key]: value || null } }));

  const em = config.evening_mode;

  const handleCardClick = (cardId) => {
    setCard(cardId);
    if (cardId !== "anchor") {
      setMode(cardId);
    } else {
      // Reset sub-mode until user explicitly picks one
      setMode(null);
    }
  };

  const handleSubModeClick = (subModeId) => {
    setMode(subModeId);
  };

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
    borderRadius: theme.radius.button,
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
              {DISPLAY_MODES.map(m => {
                const on = selectedCard === m.id;
                return (
                  <Card
                    key={m.id}
                    variant={on ? "selected" : "default"}
                    onClick={() => handleCardClick(m.id)}
                    style={{ display: "flex", flexDirection: "column", gap: spacing.xxs, minHeight: layout.modeButtonHeight, marginBottom: 0 }}
                  >
                    <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: on ? theme.accent.onSubtle : theme.text.primary }}>{m.title}</span>
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.4 }}>{m.desc}</span>
                  </Card>
                );
              })}
            </div>

            {/* Anchor sub-selector — appears below grid when Anchor card is selected */}
            {selectedCard === "anchor" && (
              <div style={{ marginTop: spacing.sm }}>
                <Label>Anchor type</Label>
                <div style={{ display: "flex", gap: spacing.xs }}>
                  {ANCHOR_SUB_MODES.map(sub => (
                    <Button
                      key={sub.id}
                      variant="selector"
                      active={selectedMode === sub.id}
                      style={{ flex: 1 }}
                      onClick={() => handleSubModeClick(sub.id)}
                    >
                      {sub.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
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

        {/* Flexible / Consistent toggle — not for fixed or fasting (both fixed-schedule) */}
        {selectedMode !== "fixed" && selectedMode !== "fasting" && (
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

        {/* Medication / Wakeup: cascade rule editor + evening bucket */}
        {isOffsetMode && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Meal schedule</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                {[
                  { key_h: "first_meal_offset_hours", key_m: "first_meal_offset_minutes", label: "First meal",    caption: "hours after your anchor" },
                  { key_h: "meal_interval_hours",     key_m: "meal_interval_minutes",     label: "Meal interval", caption: "hours between meals" },
                ].map(({ key_h, key_m, label, caption }) => {
                  const h = config[key_h] ?? 0;
                  const m = config[key_m] ?? 0;
                  return (
                    <div key={key_h}>
                      <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                        <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                        <Input
                          variant="number" width={52} min="0" max="23"
                          inputMode="numeric" pattern="[0-9]*"
                          value={h === 0 ? "" : h}
                          onChange={e => updateCascade(key_h, parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                        <Input
                          variant="number" width={52} min="0" max="59"
                          inputMode="numeric" pattern="[0-9]*"
                          value={m === 0 ? "" : m}
                          onChange={e => updateCascade(key_m, parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
                      </Card>
                      <HelperText style={{ marginTop: spacing.xxxs }}>{caption}</HelperText>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: spacing.md }}>
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
                <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
              </Card>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <Label>Evening</Label>
              <HelperText>A fixed slot independent of your anchor</HelperText>
              <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.sm }}>
                {([
                  [null,           "Off"],
                  ["fixed",        "Fixed time"],
                  ["before_sleep", "Before sleep"],
                ]).map(([val, label]) => (
                  <button key={String(val)} onClick={() => updateEvening({ evening_mode: val })} style={segBtnStyle(em === val)}>
                    {label}
                  </button>
                ))}
              </div>

              {em === "fixed" && (
                <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Evening time</span>
                  <Input
                    variant="time"
                    value={config.evening_time || ""}
                    onChange={e => updateEvening({ evening_mode: "fixed", evening_time: e.target.value || null })}
                    style={{ width: "auto" }}
                  />
                </Card>
              )}

              {em === "before_sleep" && (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                  <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                    <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Bedtime</span>
                    <Input
                      variant="time"
                      value={config.sleep_time || ""}
                      onChange={e => updateEvening({ evening_mode: "before_sleep", sleep_time: e.target.value || null })}
                      style={{ width: "auto" }}
                    />
                  </Card>
                  <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                    <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Before bedtime</span>
                    <Input
                      variant="number" width={52} min="0" max="23"
                      inputMode="numeric" pattern="[0-9]*"
                      value={(config.evening_offset_hours ?? 1) || ""}
                      onChange={e => updateEvening({ evening_mode: "before_sleep", evening_offset_hours: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                    <Input
                      variant="number" width={52} min="0" max="59"
                      inputMode="numeric" pattern="[0-9]*"
                      value={(config.evening_offset_minutes ?? 0) || ""}
                      onChange={e => updateEvening({ evening_mode: "before_sleep", evening_offset_minutes: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
                  </Card>
                </div>
              )}
            </div>
          </>
        )}

        {/* Intermittent fasting: eating window config (v2 — fixed-schedule) */}
        {selectedMode === "fasting" && (
          <div style={{ marginBottom: spacing.lg }}>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Eating window start</Label>
              <HelperText>When your eating window opens each day</HelperText>
              <Input
                variant="time"
                value={config.eating_window_start || ""}
                onChange={e => updateConfig("eating_window_start", e.target.value || null)}
                style={{ width: "auto" }}
              />
            </div>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Window duration</Label>
              <div style={{ display: "flex", gap: spacing.xs }}>
                {[[4, "4 hr"], [6, "6 hr"], [8, "8 hr"], [10, "10 hr"], [12, "12 hr"]].map(([val, lbl]) => {
                  const on = (config.eating_window_duration_hours ?? 8) === val;
                  return <button key={val} onClick={() => updateConfig("eating_window_duration_hours", val)} style={segBtnStyle(on)}>{lbl}</button>;
                })}
              </div>
            </div>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Meals</Label>
              <div style={{ display: "flex", gap: spacing.xs }}>
                {[[2, "2 meals"], [3, "3 meals"]].map(([val, lbl]) => {
                  const on = (config.meal_count ?? 3) === val;
                  return <button key={val} onClick={() => updateConfig("meal_count", val)} style={segBtnStyle(on)}>{lbl}</button>;
                })}
              </div>
            </div>
            <Label>Pre-meal window</Label>
            <HelperText>How early before each meal to take pre-meal items</HelperText>
            <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input
                variant="number" width={52} min="0" max="120"
                inputMode="numeric" pattern="[0-9]*"
                value={config.pre_meal_window ?? 30}
                onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
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
          <Button variant="primary" style={{ flex: 2 }} onClick={handleGetStarted} disabled={saving || (selectedMode === "fasting" && !config.eating_window_start)}>
            {saving ? "Saving…" : "Get started"}
          </Button>
        </div>
      </div>
    </div>
  );
}
