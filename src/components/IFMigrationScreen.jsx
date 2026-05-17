import { useState } from 'react';
import { spacing, typography, layout } from '../design-system';
import { useTheme } from '../lib/theme';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import HelperText from './HelperText';

export default function IFMigrationScreen({ oldConfig = {}, consistentTime, onComplete }) {
  const { theme } = useTheme();

  // Pre-fill from old config.
  // Old IF: anchor was _consistent_time; eating window started at anchor + window_start offset.
  // Since window_start defaulted to 0, _consistent_time IS the eating window start.
  const inferredStart = consistentTime || oldConfig._consistent_time || '';
  const inferredDuration = oldConfig.window_length ? oldConfig.window_length / 60 : 8;
  const inferredMealCount = oldConfig.meals_per_day ?? oldConfig.meal_count ?? 3;
  const inferredPreMeal = oldConfig.pre_meal_window ?? 30;

  const [windowStart, setWindowStart] = useState(inferredStart);
  const [duration,    setDuration]    = useState(inferredDuration);
  const [mealCount,   setMealCount]   = useState(inferredMealCount);
  const [preMeal,     setPreMeal]     = useState(inferredPreMeal);

  const canConfirm = !!windowStart;

  const segBtnStyle = (on) => ({
    flex: 1,
    padding: `${spacing.sm}px`,
    cursor: 'pointer',
    fontSize: typography.caption,
    fontFamily: typography.fontBody,
    background: on ? theme.accent.subtle : 'transparent',
    color: on ? theme.accent.onSubtle : theme.text.secondary,
    border: `${theme.borderWidth.default}px solid ${on ? theme.accent.default : theme.border.subtle}`,
    fontWeight: on ? typography.semibold : typography.regular,
    minHeight: 36,
    WebkitTapHighlightColor: 'transparent',
  });

  const handleConfirm = () => {
    onComplete({
      eating_window_start:        windowStart,
      eating_window_duration_hours: duration,
      meal_count:                 mealCount,
      pre_meal_window:            preMeal,
      // carry forward existing evening config if present
      evening_mode:    oldConfig.evening_mode    ?? null,
      evening_time:    oldConfig.evening_time    ?? null,
      sleep_time:      oldConfig.sleep_time      ?? null,
      evening_offset_hours:   oldConfig.evening_offset_hours   ?? 1,
      evening_offset_minutes: oldConfig.evening_offset_minutes ?? 0,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.surface.canvas,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      display: 'flex', flexDirection: 'column',
      padding: `max(48px, env(safe-area-inset-top)) ${spacing.md}px max(32px, env(safe-area-inset-bottom))`,
      fontFamily: typography.fontBody,
    }}>
      <div style={{ maxWidth: layout.maxContentWidth, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{ fontSize: typography.title, fontWeight: typography.bold, color: theme.text.primary, fontFamily: typography.fontHeading, marginBottom: spacing.xs }}>
            Intermittent fasting updated
          </div>
          <div style={{ fontSize: typography.body, color: theme.text.secondary, lineHeight: 1.6 }}>
            Your eating window is now fixed — Origin will notify you at the same time every day. Confirm the details below.
          </div>
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <Label>Eating window start</Label>
          <HelperText>When your eating window opens each day</HelperText>
          <Input
            variant="time"
            value={windowStart}
            onChange={e => setWindowStart(e.target.value)}
            style={{ width: 'auto' }}
          />
          {!windowStart && (
            <div style={{ fontSize: typography.label, color: theme.status.danger, marginTop: spacing.xxxs }}>
              Required — enter the time your eating window opens
            </div>
          )}
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <Label>Window duration</Label>
          <div style={{ display: 'flex', gap: spacing.xs }}>
            {[[4,'4 hr'],[6,'6 hr'],[8,'8 hr'],[10,'10 hr'],[12,'12 hr']].map(([val, lbl]) => (
              <button key={val} onClick={() => setDuration(val)} style={segBtnStyle(duration === val)}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <Label>Meals</Label>
          <div style={{ display: 'flex', gap: spacing.xs }}>
            {[[2,'2 meals'],[3,'3 meals']].map(([val, lbl]) => (
              <button key={val} onClick={() => setMealCount(val)} style={segBtnStyle(mealCount === val)}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: spacing.xl }}>
          <Label>Pre-meal window</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <Input
              variant="number"
              width={52}
              min="0" max="120"
              inputMode="numeric" pattern="[0-9]*"
              value={preMeal}
              onChange={e => setPreMeal(parseInt(e.target.value) || 0)}
            />
            <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min before each meal</span>
          </div>
        </div>

        <Button variant="primary" fullWidth disabled={!canConfirm} onClick={handleConfirm}>
          Confirm eating window
        </Button>
      </div>
    </div>
  );
}
