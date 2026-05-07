import { useState, useRef } from 'react';
import { spacing, typography, layout, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import { parseHHMM, fmtTime, addMins } from '../lib/time';
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, MODES, deriveOffsets, toHrMin, fromHrMin } from '../config';
import { SLOTS } from '../lib/notifications';
import Button from './Button';
import Card from './Card';
import HelperText from './HelperText';
import Input from './Input';
import Label from './Label';

export default function ScheduleTab({ scheduleMode, scheduleConfig, anchorBehavior, consistentTime, onSave }) {
  const { theme } = useTheme();

  const [localMode,     setLocalMode]     = useState(scheduleMode);
  const [localConfig,   setLocalConfig]   = useState({
    ...DEFAULT_CONFIG,
    ...scheduleConfig,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times, ...(scheduleConfig.fixed_times || {}) },
  });
  const [localBehavior, setLocalBehavior] = useState(anchorBehavior);
  const [localTime,     setLocalTime]     = useState(consistentTime);
  const [saveError,     setSaveError]     = useState(null);
  const debounceRef = useRef(null);

  const scheduleSave = (mode, config, behavior, time, delay = 500) => {
    setSaveError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await onSave(mode, config, behavior, time);
      if (ok === false) setSaveError("Couldn't save. Try again.");
    }, delay);
  };

  const updateConfig = (key, value) => {
    const next = { ...localConfig, [key]: value };
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  const updateFixed = (key, value) => {
    const next = { ...localConfig, fixed_times: { ...localConfig.fixed_times, [key]: value || null } };
    setLocalConfig(next);
    scheduleSave(localMode, next, localBehavior, localTime);
  };

  const handleModeChange = (mode) => {
    setLocalMode(mode);
    scheduleSave(mode, localConfig, localBehavior, localTime, 0);
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
    borderRadius: theme.radius.pill,
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
  const derived     = localMode !== 'fixed' ? deriveOffsets(localMode, localConfig) : null;

  const previewRows = localMode === 'fixed'
    ? FIXED_SLOTS
        .filter(fs => localConfig.fixed_times?.[fs.key])
        .map(fs => ({ label: fs.label, timeStr: localConfig.fixed_times[fs.key] }))
        .sort((a, b) => a.timeStr.localeCompare(b.timeStr))
    : [
        { label: MODES.find(m => m.id === localMode)?.title ?? 'Anchor', offset: 0 },
        ...Object.entries(derived || {})
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([sid, offset]) => ({ label: SLOTS.find(s => s.id === sid)?.label ?? sid, offset })),
      ].sort((a, b) => a.offset - b.offset);

  const mealRows = [
    { key: 'breakfast',    label: 'Breakfast' },
    { key: 'lunch',        label: 'Lunch' },
    { key: 'dinner',       label: 'Dinner' },
    { key: 'after_dinner', label: 'Evening' },
  ];

  const isOffsetMode = localMode === 'medication' || localMode === 'wakeup';

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
        {(localMode === 'medication' || localMode === 'wakeup') && (
          <HelperText>{ANCHOR_NOTES[localMode]}</HelperText>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xs }}>
          {MODES.map(m => {
            const on = localMode === m.id;
            return (
              <Card key={m.id} onClick={() => handleModeChange(m.id)} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: spacing.xxs, minHeight: layout.modeButtonHeight, background: on ? theme.accent.subtle : 'transparent', border: `${theme.borderWidth.default}px solid ${on ? theme.accent.default : theme.border.subtle}`, marginBottom: 0, ...(m.id === 'none' ? { gridColumn: '1 / -1' } : {}) }}>
                <span style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: on ? theme.accent.onSubtle : theme.text.primary }}>{m.title}</span>
                <span style={{ fontSize: typography.label, color: theme.text.muted, lineHeight: 1.4 }}>{m.desc}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Flexible / Consistent toggle */}
      {localMode !== 'fixed' && localMode !== 'none' && (
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

      {/* Medication / Wakeup: offset editor */}
      {isOffsetMode && (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meal schedule</Label>
            <HelperText>Times relative to your anchor</HelperText>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {mealRows.map(({ key, label }) => {
                const total   = localConfig[key];
                const isEmpty = total === null || total === undefined;
                const { h, m } = toHrMin(isEmpty ? 0 : total);
                return (
                  <Card key={key} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                    <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>{label}</span>
                    <Input
                      variant="number" width={52} min="0" max="23"
                      inputMode="numeric" pattern="[0-9]*"
                      value={isEmpty ? '' : h}
                      onChange={e => updateConfig(key, e.target.value === '' ? 0 : fromHrMin(e.target.value, isEmpty ? 0 : m))}
                      placeholder="0"
                    />
                    <span style={{ fontSize: typography.caption, color: theme.text.muted }}>hr</span>
                    <Input
                      variant="number" width={52} min="0" max="59"
                      inputMode="numeric" pattern="[0-9]*"
                      value={isEmpty ? '' : m}
                      onChange={e => updateConfig(key, e.target.value === '' ? 0 : fromHrMin(isEmpty ? 0 : h, e.target.value))}
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
            <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
              <Input
                variant="number" width={52} min="0" max="120"
                inputMode="numeric" pattern="[0-9]*"
                value={localConfig.pre_meal_window ?? 30}
                onChange={e => updateConfig('pre_meal_window', parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.caption, color: theme.text.muted }}>min</span>
            </Card>
          </div>
        </>
      )}

      {/* Fasting: segmented controls */}
      {localMode === 'fasting' && (
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Window length</Label>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {[[240, '4 hr'], [360, '6 hr'], [480, '8 hr']].map(([val, lbl]) => (
                <button key={val} onClick={() => updateConfig('window_length', val)} style={segBtnStyle((localConfig.window_length ?? 480) === val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meals per day</Label>
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {[[2, '2 meals'], [3, '3 meals']].map(([val, lbl]) => (
                <button key={val} onClick={() => updateConfig('meals_per_day', val)} style={segBtnStyle((localConfig.meals_per_day ?? 2) === val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <Label>Pre-meal window</Label>
          <HelperText>How early before each meal to schedule pre-meal items</HelperText>
          <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
            <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Pre-meal items</span>
            <Input variant="number" width={52} min="0" max="120" inputMode="numeric" pattern="[0-9]*" value={localConfig.pre_meal_window ?? 30} onChange={e => updateConfig('pre_meal_window', parseInt(e.target.value) || 0)} />
            <span style={{ fontSize: typography.caption, color: theme.text.muted }}>min</span>
          </Card>
        </div>
      )}

      {/* Fixed: time pickers */}
      {localMode === 'fixed' && (
        <div style={{ marginBottom: spacing.lg }}>
          <Label>Fixed times</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {FIXED_SLOTS.map(({ key, label }) => (
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
      )}

      {/* Live preview */}
      {localMode !== 'none' && (
        <div style={{ marginBottom: spacing.lg }}>
          <Label>{localMode === 'fixed' ? 'Schedule preview' : 'Preview — 7:00 am anchor'}</Label>
          <div style={{ borderRadius: theme.radius.surface, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, background: theme.surface.card, padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {previewRows.length === 0
              ? <span style={{ fontSize: typography.caption, color: theme.text.muted }}>No times configured yet</span>
              : previewRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.caption, fontVariantNumeric: 'tabular-nums', color: theme.accent.default, fontWeight: typography.semibold, minWidth: touch.min }}>
                      {row.timeStr ?? fmtTime(addMins(previewBase, row.offset))}
                    </span>
                    <span style={{ fontSize: typography.caption, color: theme.text.muted }}>—</span>
                    <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>{row.label}</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
