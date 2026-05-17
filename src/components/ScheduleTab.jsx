import { useState, useRef, useEffect } from 'react';
import { spacing, typography, layout, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import { parseHHMM, fmtTime, addMins } from '../lib/time';
import { DEFAULT_CONFIG, ANCHOR_NOTES, MODES, DISPLAY_MODES, ANCHOR_SUB_MODES, deriveOffsets, computeIFSlotTimes } from '../config';
import { IF_SLOTS } from '../lib/notifications';
import { SLOTS } from '../lib/notifications';
import Button from './Button';
import Card from './Card';
import HelperText from './HelperText';
import Input from './Input';
import Label from './Label';
import Modal from './Modal';

// Recompute breakfast/lunch/dinner from cascade fields and merge back into config.
const applyCascade = (cfg) => {
  const firstMeal = (cfg.first_meal_offset_hours ?? 1) * 60 + (cfg.first_meal_offset_minutes ?? 0);
  const interval  = (cfg.meal_interval_hours ?? 4) * 60 + (cfg.meal_interval_minutes ?? 0);
  return { ...cfg, breakfast: firstMeal, lunch: firstMeal + interval, dinner: firstMeal + 2 * interval };
};

// For legacy configs (no first_meal_offset_hours), infer cascade fields from existing offsets.
const migrateConfig = (merged) => {
  if (merged.first_meal_offset_hours !== undefined) return merged;
  const bfast    = merged.breakfast ?? 60;
  const interval = Math.max(0, (merged.lunch ?? 300) - bfast);
  return {
    ...merged,
    first_meal_offset_hours:   Math.floor(bfast / 60),
    first_meal_offset_minutes: bfast % 60,
    meal_interval_hours:       Math.floor(interval / 60),
    meal_interval_minutes:     interval % 60,
    evening_mode:              null,
  };
};

// Ensure the config has the fields the target mode's editor expects. Switching
// IF → Anchor or Fixed → Anchor previously left cascade inputs blank because
// no migration happened on the mode change.
const seedConfigForMode = (cfg, mode) => {
  if (mode === 'medication' || mode === 'wakeup') {
    const withDefaults = {
      ...cfg,
      first_meal_offset_hours:   cfg.first_meal_offset_hours   ?? 1,
      first_meal_offset_minutes: cfg.first_meal_offset_minutes ?? 0,
      meal_interval_hours:       cfg.meal_interval_hours       ?? 4,
      meal_interval_minutes:     cfg.meal_interval_minutes     ?? 0,
      pre_meal_window:           cfg.pre_meal_window           ?? 30,
      evening_mode:              cfg.evening_mode              ?? null,
    };
    return applyCascade(withDefaults);
  }
  if (mode === 'fasting') {
    // Default eating_window_start to DEFAULT_CONFIG ("12:00") rather than null so a
    // mode-switch into fasting produces a usable schedule immediately. User can still
    // edit it inline; without this default the edge function would skip notifications
    // until a window start is set.
    return {
      ...cfg,
      eating_window_start:          cfg.eating_window_start          ?? DEFAULT_CONFIG.eating_window_start,
      eating_window_duration_hours: cfg.eating_window_duration_hours ?? 8,
      meal_count:                   cfg.meal_count                   ?? 3,
      pre_meal_window:              cfg.pre_meal_window              ?? 30,
      evening_mode:                 cfg.evening_mode                 ?? null,
      _if_v2_migrated:              true,
    };
  }
  if (mode === 'fixed') {
    return {
      ...cfg,
      fixed_times:                  { ...DEFAULT_CONFIG.fixed_times, ...(cfg.fixed_times || {}) },
      pre_meal_window:              cfg.pre_meal_window ?? 30,
      _fixed_premeal_migrated:      true,
    };
  }
  return cfg;
};

export default function ScheduleTab({ scheduleMode, scheduleConfig, anchorBehavior, consistentTime, onSave, supplements = [] }) {
  const { theme } = useTheme();
  // Cascade migration only applies to anchor/fasting modes, not fixed.
  const needsMigration     = useRef(scheduleMode !== 'fixed' && scheduleConfig.first_meal_offset_hours === undefined);
  const fixedNeedsMigration = useRef(scheduleMode === 'fixed' && !scheduleConfig._fixed_premeal_migrated);
  const debounceRef = useRef(null);

  const [localMode,     setLocalMode]     = useState(scheduleMode);
  // Which display card is visually selected (anchor = medication|wakeup grouped)
  const [selectedCard,  setSelectedCard]  = useState(
    scheduleMode === 'medication' || scheduleMode === 'wakeup' ? 'anchor' : scheduleMode
  );
  const [localConfig,   setLocalConfig]   = useState(() => {
    const merged = {
      ...DEFAULT_CONFIG,
      ...scheduleConfig,
      fixed_times: { ...DEFAULT_CONFIG.fixed_times, ...(scheduleConfig.fixed_times || {}) },
    };
    // Skip cascade field migration for fixed mode users.
    return scheduleMode === 'fixed' ? merged : migrateConfig(merged);
  });
  const [localBehavior, setLocalBehavior] = useState(anchorBehavior);
  const [localTime,     setLocalTime]     = useState(consistentTime);
  const [saveError,     setSaveError]     = useState(null);
  const [orphanConfirm, setOrphanConfirm] = useState(null); // pending meal_count to confirm

  const scheduleSave = (mode, config, behavior, time, delay = 500) => {
    setSaveError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await onSave(mode, config, behavior, time);
      if (ok === false) setSaveError("Couldn't save. Try again.");
    }, delay);
  };

  // Persist cascade-migrated config on first mount for anchor/fasting users.
  useEffect(() => {
    if (needsMigration.current) {
      scheduleSave(localMode, localConfig, localBehavior, localTime, 0);
      needsMigration.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time migration for Fixed Times users: infer global pre_meal_window from
  // existing per-slot pre-meal times, then drop those keys from fixed_times.
  useEffect(() => {
    if (!fixedNeedsMigration.current) return;
    fixedNeedsMigration.current = false;

    const ft = localConfig.fixed_times || {};
    const diffs = [];
    for (const [preKey, mealKey] of [['pre_breakfast','breakfast'],['pre_lunch','lunch'],['pre_dinner','dinner']]) {
      if (ft[preKey] && ft[mealKey]) {
        diffs.push((parseHHMM(ft[mealKey]).getTime() - parseHHMM(ft[preKey]).getTime()) / 60000);
      }
    }
    const inferredWindow = diffs.length > 0
      ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
      : (localConfig.pre_meal_window ?? 30);

    const newFixedTimes = { ...ft };
    delete newFixedTimes.pre_breakfast;
    delete newFixedTimes.pre_lunch;
    delete newFixedTimes.pre_dinner;

    const next = { ...localConfig, pre_meal_window: inferredWindow, fixed_times: newFixedTimes, _fixed_premeal_migrated: true };
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfig = (key, value) => {
    const next = { ...localConfig, [key]: value };
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  // Update a cascade input field and recompute breakfast/lunch/dinner.
  const updateCascade = (key, value) => {
    const next = applyCascade({ ...localConfig, [key]: value });
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  const updateEvening = (updates) => {
    // When a user first picks "Before sleep", default bedtime to 22:00 so the
    // evening notification has a real time to fire at. Without this, save
    // would write sleep_time:null and the edge function would skip evening
    // notifications until the user noticed and filled in the field.
    const next = { ...localConfig, ...updates };
    if (updates.evening_mode === 'before_sleep' && !next.sleep_time) {
      next.sleep_time = '22:00';
    }
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  // When meal_count decreases, check for supplements assigned to slots that would disappear.
  const tryUpdateMealCount = (newCount) => {
    const currentCount = localConfig.meal_count ?? 3;
    if (newCount >= currentCount) {
      updateConfig('meal_count', newCount);
      return;
    }
    const orphanSlots = [];
    if (newCount < 3) orphanSlots.push('meal_3', 'pre_meal_3');
    if (newCount < 2) orphanSlots.push('meal_2', 'pre_meal_2');
    const affected = supplements.filter(s => s.slots?.some(sl => orphanSlots.includes(sl)));
    if (affected.length > 0) {
      setOrphanConfirm(newCount);
    } else {
      updateConfig('meal_count', newCount);
    }
  };

  const updateFixed = (key, value) => {
    const next = { ...localConfig, fixed_times: { ...localConfig.fixed_times, [key]: value || null } };
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  const handleModeChange = (mode) => {
    const seeded = seedConfigForMode(localConfig, mode);
    setLocalMode(mode);
    setLocalConfig(seeded);
    scheduleSave(mode, seeded, localBehavior, localTime, 0);
  };

  const handleBehaviorChange = (behavior) => {
    setLocalBehavior(behavior);
    scheduleSave(localMode, localConfig, behavior, localTime, 0);
  };

  const handleTimeChange = (time) => {
    setLocalTime(time);
    scheduleSave(localMode, localConfig, localBehavior, time);
  };

  const segBtnStyle = (on) => ({
    flex: 1,
    padding: `${spacing.sm}px`,
    borderRadius: theme.radius.button,
    cursor: 'pointer',
    fontSize: typography.caption,
    fontFamily: typography.fontBody,
    background: on ? theme.accent.subtle : 'transparent',
    color: on ? theme.accent.onSubtle : theme.text.secondary,
    border: `${theme.borderWidth.default}px solid ${on ? theme.accent.default : theme.border.subtle}`,
    fontWeight: on ? typography.semibold : typography.regular,
    minHeight: layout.segHeight,
    WebkitTapHighlightColor: 'transparent',
  });

  const previewBase = parseHHMM('07:00');
  const derived     = (localMode !== 'fixed' && localMode !== 'fasting') ? deriveOffsets(localMode, localConfig) : null;

  const previewRows = (() => {
    if (localMode === 'fixed') {
      const ft  = localConfig.fixed_times ?? {};
      const pmw = localConfig.pre_meal_window ?? 0;
      const rows = [];
      for (const [key, label] of [['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['after_dinner','Evening']]) {
        if (ft[key]) { const d = parseHHMM(ft[key]); rows.push({ label, timeStr: fmtTime(d), sortKey: d.getTime() }); }
      }
      if (pmw > 0) {
        for (const [mealKey, label] of [['breakfast','Before Breakfast'],['lunch','Before Lunch'],['dinner','Before Dinner']]) {
          if (ft[mealKey]) { const d = addMins(parseHHMM(ft[mealKey]), -pmw); rows.push({ label, timeStr: fmtTime(d), sortKey: d.getTime() }); }
        }
      }
      return rows.sort((a, b) => a.sortKey - b.sortKey);
    }
    if (localMode === 'fasting') {
      const ifTimes = computeIFSlotTimes(localConfig);
      const rows = Object.entries(ifTimes)
        .map(([sid, hhMM]) => {
          const d = parseHHMM(hhMM);
          return { label: IF_SLOTS.find(s => s.id === sid)?.label ?? sid, timeStr: fmtTime(d), sortKey: d.getTime() };
        });
      const em = localConfig.evening_mode;
      if (em === 'fixed' && localConfig.evening_time) {
        const d = parseHHMM(localConfig.evening_time);
        rows.push({ label: 'Evening', timeStr: fmtTime(d), sortKey: d.getTime() });
      } else if (em === 'before_sleep' && localConfig.sleep_time) {
        const offsetMins = (localConfig.evening_offset_hours ?? 1) * 60 + (localConfig.evening_offset_minutes ?? 0);
        const d = addMins(parseHHMM(localConfig.sleep_time), -offsetMins);
        rows.push({ label: 'Evening', timeStr: fmtTime(d), sortKey: d.getTime() });
      }
      return rows.sort((a, b) => a.sortKey - b.sortKey);
    }
    const isOffset = localMode === 'medication' || localMode === 'wakeup';
    const rows = [
      { label: MODES.find(m => m.id === localMode)?.title ?? 'Anchor', offset: 0 },
      ...Object.entries(derived || {})
        .filter(([sid, v]) => v !== null && v !== undefined && !(isOffset && sid === 'after_dinner'))
        .map(([sid, offset]) => ({ label: SLOTS.find(s => s.id === sid)?.label ?? sid, offset })),
    ].sort((a, b) => a.offset - b.offset);
    if (isOffset) {
      const em = localConfig.evening_mode;
      if (em === 'fixed' && localConfig.evening_time) {
        rows.push({ label: 'Evening', timeStr: localConfig.evening_time });
      } else if (em === 'before_sleep' && localConfig.sleep_time) {
        const offsetMins = (localConfig.evening_offset_hours ?? 1) * 60 + (localConfig.evening_offset_minutes ?? 0);
        rows.push({ label: 'Evening', timeStr: fmtTime(addMins(parseHHMM(localConfig.sleep_time), -offsetMins)) });
      }
    }
    return rows;
  })();

  const isOffsetMode = localMode === 'medication' || localMode === 'wakeup';
  const em = localConfig.evening_mode; // null | "fixed" | "before_sleep"

  return (
    <div>
      {saveError && (
        <div style={{ fontSize: typography.caption, color: theme.status.danger, marginBottom: spacing.md }}>
          {saveError}
        </div>
      )}

      {/* Schedule type picker */}
      <div style={{ marginBottom: spacing.lg }}>
        <Label>Schedule type</Label>
        {localMode === 'none' && (
          <HelperText>Add items without a time slot to use a simple checklist.</HelperText>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
          {DISPLAY_MODES.map(m => {
            const on = selectedCard === m.id;
            return (
              <Card
                key={m.id}
                onClick={() => {
                  setSelectedCard(m.id);
                  if (m.id === 'anchor') {
                    // Auto-pick Medication when switching INTO Anchor from a non-anchor
                    // mode so the save fires immediately. Without this the user could
                    // tap Anchor (which highlights the card), force-close before picking
                    // a sub-mode, and lose their selection. User can still flip to
                    // Wake Up via the sub-selector.
                    if (localMode !== 'medication' && localMode !== 'wakeup') {
                      handleModeChange('medication');
                    }
                  } else {
                    handleModeChange(m.id);
                  }
                }}
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: spacing.xxs, minHeight: layout.modeButtonHeight, background: on ? theme.accent.subtle : 'transparent', border: `${theme.borderWidth.default}px solid ${on ? theme.accent.default : theme.border.subtle}`, marginBottom: 0 }}
              >
                <span style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: on ? theme.accent.onSubtle : theme.text.primary }}>{m.title}</span>
                <span style={{ fontSize: typography.label, color: theme.text.secondary, lineHeight: 1.4 }}>{m.desc}</span>
              </Card>
            );
          })}
        </div>

        {/* Anchor sub-selector — appears below grid when Anchor card is selected */}
        {selectedCard === 'anchor' && (
          <div style={{ marginTop: spacing.sm }}>
            <Label>Anchor type</Label>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {ANCHOR_SUB_MODES.map(sub => (
                <Button
                  key={sub.id}
                  variant="selector"
                  active={localMode === sub.id}
                  style={{ flex: 1 }}
                  onClick={() => handleModeChange(sub.id)}
                >
                  {sub.label}
                </Button>
              ))}
            </div>
            {(localMode === 'medication' || localMode === 'wakeup') && (
              <HelperText style={{ marginTop: spacing.xs }}>{ANCHOR_NOTES[localMode]}</HelperText>
            )}
          </div>
        )}
      </div>

      {/* Flexible / Consistent toggle — not applicable for IF (always fixed-schedule) */}
      {localMode !== 'fixed' && localMode !== 'none' && localMode !== 'fasting' && (
        <div style={{ marginBottom: spacing.md }}>
          <Label>Daily timing</Label>
          {localBehavior === 'flexible' && (
            <HelperText>Tap each morning to set your schedule for the day.</HelperText>
          )}
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.xs }}>
            {[['flexible', 'Flexible'], ['consistent', 'Consistent']].map(([val, label]) => (
              <button key={val} onClick={() => handleBehaviorChange(val)} style={segBtnStyle(localBehavior === val)}>{label}</button>
            ))}
          </div>
          {localBehavior === 'consistent' && (
            <div style={{ marginTop: spacing.sm }}>
              <Label>Start time</Label>
              <Input variant="time" value={localTime} onChange={e => handleTimeChange(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* Medication / Wakeup: cascade rule editor + evening bucket */}
      {isOffsetMode && (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meal schedule</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {[
                { key_h: 'first_meal_offset_hours', key_m: 'first_meal_offset_minutes', label: 'First meal',    caption: 'hours after your anchor' },
                { key_h: 'meal_interval_hours',     key_m: 'meal_interval_minutes',     label: 'Meal interval', caption: 'hours between meals' },
              ].map(({ key_h, key_m, label, caption }) => {
                const h = localConfig[key_h] ?? 0;
                const m = localConfig[key_m] ?? 0;
                return (
                  <div key={key_h}>
                    <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                      <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                      <Input
                        variant="number" width={52} min="0" max="23"
                        inputMode="numeric" pattern="[0-9]*"
                        value={h === 0 ? '' : h}
                        onChange={e => updateCascade(key_h, parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                      <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                      <Input
                        variant="number" width={52} min="0" max="59"
                        inputMode="numeric" pattern="[0-9]*"
                        value={m === 0 ? '' : m}
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
            <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input
                variant="number" width={52} min="0" max="120"
                inputMode="numeric" pattern="[0-9]*"
                value={localConfig.pre_meal_window ?? 30}
                onChange={e => updateConfig('pre_meal_window', parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
            </Card>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <Label>Evening</Label>
            <HelperText>A fixed slot independent of your anchor</HelperText>
            <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.sm }}>
              {([
                [null,           'Off'],
                ['fixed',        'Fixed time'],
                ['before_sleep', 'Before sleep'],
              ]).map(([val, label]) => (
                <button
                  key={String(val)}
                  onClick={() => updateEvening({ evening_mode: val })}
                  style={segBtnStyle(em === val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {em === 'fixed' && (
              <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Evening time</span>
                <Input
                  variant="time"
                  value={localConfig.evening_time || ''}
                  onChange={e => updateEvening({ evening_mode: 'fixed', evening_time: e.target.value || null })}
                  style={{ width: 'auto' }}
                />
              </Card>
            )}

            {em === 'before_sleep' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Bedtime</span>
                  <Input
                    variant="time"
                    value={localConfig.sleep_time || ''}
                    onChange={e => updateEvening({ evening_mode: 'before_sleep', sleep_time: e.target.value || null })}
                    style={{ width: 'auto' }}
                  />
                </Card>
                <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Before bedtime</span>
                  <Input
                    variant="number" width={52} min="0" max="23"
                    inputMode="numeric" pattern="[0-9]*"
                    value={(localConfig.evening_offset_hours ?? 1) || ''}
                    onChange={e => updateEvening({ evening_mode: 'before_sleep', evening_offset_hours: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                  <Input
                    variant="number" width={52} min="0" max="59"
                    inputMode="numeric" pattern="[0-9]*"
                    value={(localConfig.evening_offset_minutes ?? 0) || ''}
                    onChange={e => updateEvening({ evening_mode: 'before_sleep', evening_offset_minutes: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
                </Card>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fasting: fixed-schedule eating window config.
          Gated on selectedCard, not localMode — when the user clicks Anchor while previously
          on fasting, localMode stays 'fasting' until a sub-mode is picked, but the fasting
          form should immediately disappear. */}
      {selectedCard === 'fasting' && (
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Eating window start</Label>
            <HelperText>When your eating window opens each day</HelperText>
            <Input
              variant="time"
              value={localConfig.eating_window_start || ''}
              onChange={e => updateConfig('eating_window_start', e.target.value || null)}
              style={{ width: 'auto' }}
            />
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Window duration</Label>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {[[4,'4 hr'],[6,'6 hr'],[8,'8 hr'],[10,'10 hr'],[12,'12 hr']].map(([val, lbl]) => (
                <button key={val} onClick={() => updateConfig('eating_window_duration_hours', val)} style={segBtnStyle((localConfig.eating_window_duration_hours ?? 8) === val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meals</Label>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {[[2,'2 meals'],[3,'3 meals']].map(([val, lbl]) => (
                <button key={val} onClick={() => tryUpdateMealCount(val)} style={segBtnStyle((localConfig.meal_count ?? 3) === val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Pre-meal window</Label>
            <HelperText>How early before each meal to take pre-meal items</HelperText>
            <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input variant="number" width={52} min="0" max="120" inputMode="numeric" pattern="[0-9]*" value={localConfig.pre_meal_window ?? 30} onChange={e => updateConfig('pre_meal_window', parseInt(e.target.value) || 0)} />
              <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
            </Card>
          </div>
          <div style={{ marginBottom: spacing.lg }}>
            <Label>Evening</Label>
            <HelperText>A fixed slot at the end of your day</HelperText>
            <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.sm }}>
              {([
                [null,           'Off'],
                ['fixed',        'Fixed time'],
                ['before_sleep', 'Before sleep'],
              ]).map(([val, label]) => (
                <button key={String(val)} onClick={() => updateEvening({ evening_mode: val })} style={segBtnStyle(em === val)}>{label}</button>
              ))}
            </div>
            {em === 'fixed' && (
              <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Evening time</span>
                <Input variant="time" value={localConfig.evening_time || ''} onChange={e => updateEvening({ evening_mode: 'fixed', evening_time: e.target.value || null })} style={{ width: 'auto' }} />
              </Card>
            )}
            {em === 'before_sleep' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Bedtime</span>
                  <Input variant="time" value={localConfig.sleep_time || ''} onChange={e => updateEvening({ evening_mode: 'before_sleep', sleep_time: e.target.value || null })} style={{ width: 'auto' }} />
                </Card>
                <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Before bedtime</span>
                  <Input variant="number" width={52} min="0" max="23" inputMode="numeric" pattern="[0-9]*" value={(localConfig.evening_offset_hours ?? 1) || ''} onChange={e => updateEvening({ evening_mode: 'before_sleep', evening_offset_hours: parseInt(e.target.value) || 0 })} placeholder="0" />
                  <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                  <Input variant="number" width={52} min="0" max="59" inputMode="numeric" pattern="[0-9]*" value={(localConfig.evening_offset_minutes ?? 0) || ''} onChange={e => updateEvening({ evening_mode: 'before_sleep', evening_offset_minutes: parseInt(e.target.value) || 0 })} placeholder="0" />
                  <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed: meal time pickers + global pre-meal window. Gated on selectedCard for the same
          reason as the fasting block above. */}
      {selectedCard === 'fixed' && (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Fixed times</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {([['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['after_dinner','Evening']]).map(([key, label]) => (
                <Card key={key} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                  <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                  <Input
                    variant="time"
                    value={localConfig.fixed_times?.[key] || ''}
                    onChange={e => updateFixed(key, e.target.value)}
                    style={{ width: 'auto' }}
                  />
                </Card>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <Label>Pre-meal window</Label>
            <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input
                variant="number" width={52} min="0" max="120"
                inputMode="numeric" pattern="[0-9]*"
                value={localConfig.pre_meal_window ?? 30}
                onChange={e => updateConfig('pre_meal_window', parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
            </Card>
            <HelperText style={{ marginTop: spacing.xxxs }}>
              Pre-Breakfast, Pre-Lunch, and Pre-Dinner slots are scheduled this many minutes before their meal.
            </HelperText>
          </div>
        </>
      )}

      {/* Live preview — hidden until the visible form matches saved state (e.g. Anchor card
          picked but no sub-mode chosen yet). */}
      {localMode !== 'none' && (
        (selectedCard === 'anchor' && isOffsetMode) ||
        (selectedCard === 'fasting' && localMode === 'fasting') ||
        (selectedCard === 'fixed' && localMode === 'fixed')
      ) && (
        <div style={{ marginBottom: spacing.lg }}>
          <Label>{(localMode === 'fixed' || localMode === 'fasting') ? 'Schedule preview' : 'Preview — 7:00 am anchor'}</Label>
          <div style={{ borderRadius: theme.radius.surface, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, background: theme.surface.card, padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {previewRows.length === 0
              ? <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>No times configured yet</span>
              : previewRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.caption, fontVariantNumeric: 'tabular-nums', color: theme.accent.default, fontWeight: typography.semibold, minWidth: touch.min }}>
                      {row.timeStr ?? fmtTime(addMins(previewBase, row.offset))}
                    </span>
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>—</span>
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>{row.label}</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}
      <Modal
        open={orphanConfirm !== null}
        onClose={() => setOrphanConfirm(null)}
        title="Supplements will be hidden"
        footer={
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <Button variant="tertiary" fullWidth onClick={() => setOrphanConfirm(null)}>Cancel</Button>
            <Button variant="primary" fullWidth onClick={() => { updateConfig('meal_count', orphanConfirm); setOrphanConfirm(null); }}>Continue</Button>
          </div>
        }
      >
        <p style={{ fontSize: typography.body, color: theme.text.secondary, lineHeight: 1.6, margin: 0 }}>
          You have supplements assigned to slots that won't exist with fewer meals. They'll be hidden from your home screen until you reassign them.
        </p>
      </Modal>
    </div>
  );
}
