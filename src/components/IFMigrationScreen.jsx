import { useState } from 'react';
import { spacing, typography, layout } from '../design-system';
import { useTheme } from '../lib/theme';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import Label from './Label';
import HelperText from './HelperText';

export default function IFMigrationScreen({ oldConfig = {}, consistentTime, hasLegacyEveningSupps = false, onComplete }) {
  const { theme } = useTheme();

  // Pre-fill from old config.
  // Old IF: anchor was _consistent_time; eating window started at anchor + window_start offset.
  // Since window_start defaulted to 0, _consistent_time IS the eating window start.
  const inferredStart = consistentTime || oldConfig._consistent_time || '';
  const inferredDuration = oldConfig.window_length ? oldConfig.window_length / 60 : 8;
  const inferredMealCount = oldConfig.meals_per_day ?? oldConfig.meal_count ?? 3;
  const inferredPreMeal = oldConfig.pre_meal_window ?? 30;
  // v1 fasting had after_dinner as a default slot, but no evening_mode setting.
  // If the user had any after_dinner supps, default to before_sleep so those
  // supps stay visible on the home screen post-migration. Otherwise default off.
  const inferredEveningMode = oldConfig.evening_mode ?? (hasLegacyEveningSupps ? 'before_sleep' : null);

  const [windowStart, setWindowStart] = useState(inferredStart);
  const [duration,    setDuration]    = useState(inferredDuration);
  const [mealCount,   setMealCount]   = useState(inferredMealCount);
  const [preMeal,     setPreMeal]     = useState(inferredPreMeal);
  const [eveningMode,        setEveningMode]        = useState(inferredEveningMode);
  const [eveningTime,        setEveningTime]        = useState(oldConfig.evening_time || '');
  const [sleepTime,          setSleepTime]          = useState(oldConfig.sleep_time || '22:00');
  const [eveningOffsetHours, setEveningOffsetHours] = useState(oldConfig.evening_offset_hours ?? 1);
  const [eveningOffsetMins,  setEveningOffsetMins]  = useState(oldConfig.evening_offset_minutes ?? 0);

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
      evening_mode:               eveningMode,
      evening_time:               eveningMode === 'fixed'        ? (eveningTime || null) : null,
      sleep_time:                 eveningMode === 'before_sleep' ? (sleepTime  || null) : null,
      evening_offset_hours:       eveningOffsetHours,
      evening_offset_minutes:     eveningOffsetMins,
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

        <div style={{ marginBottom: spacing.lg }}>
          <Label>Pre-meal window</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <Input
              variant="number"
              width={64}
              min="0" max="120"
              inputMode="numeric" pattern="[0-9]*"
              value={preMeal}
              onChange={e => setPreMeal(parseInt(e.target.value) || 0)}
            />
            <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min before each meal</span>
          </div>
        </div>

        <div style={{ marginBottom: spacing.xl }}>
          <Label>Evening</Label>
          <HelperText>
            {hasLegacyEveningSupps
              ? "You had end-of-day supplements before — pick when they should fire."
              : "A fixed slot at the end of your day."}
          </HelperText>
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.sm }}>
            {([
              [null,           'Off'],
              ['fixed',        'Fixed time'],
              ['before_sleep', 'Before sleep'],
            ]).map(([val, lbl]) => (
              <button key={String(val)} onClick={() => setEveningMode(val)} style={segBtnStyle(eveningMode === val)}>
                {lbl}
              </button>
            ))}
          </div>
          {eveningMode === 'fixed' && (
            <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Evening time</span>
              <Input variant="time" value={eveningTime} onChange={e => setEveningTime(e.target.value || '')} style={{ width: 'auto' }} />
            </Card>
          )}
          {eveningMode === 'before_sleep' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Bedtime</span>
                <Input variant="time" value={sleepTime} onChange={e => setSleepTime(e.target.value || '')} style={{ width: 'auto' }} />
              </Card>
              <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: theme.text.secondary }}>Before bedtime</span>
                <Input variant="number" width={52} min="0" max="23" inputMode="numeric" pattern="[0-9]*" value={eveningOffsetHours || ''} onChange={e => setEveningOffsetHours(parseInt(e.target.value) || 0)} placeholder="0" />
                <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>hr</span>
                <Input variant="number" width={52} min="0" max="59" inputMode="numeric" pattern="[0-9]*" value={eveningOffsetMins || ''} onChange={e => setEveningOffsetMins(parseInt(e.target.value) || 0)} placeholder="0" />
                <span style={{ fontSize: typography.caption, color: theme.text.secondary }}>min</span>
              </Card>
            </div>
          )}
        </div>

        <Button variant="primary" fullWidth disabled={!canConfirm} onClick={handleConfirm}>
          Confirm eating window
        </Button>
      </div>
    </div>
  );
}
