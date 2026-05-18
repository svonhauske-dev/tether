import { useMemo } from 'react';
import { spacing, typography } from '../design-system';
import { useTheme } from '../lib/theme';
import { calculateAdherenceForDate, getUpcomingEndings } from '../lib/adherence';
import { dateKey, startOfDay } from '../lib/time';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatScheduleSummary(scheduleMode, anchorBehavior, consistentTime) {
  const modeLabel = {
    medication: 'Medication Anchor',
    wakeup:     'Wake Up Anchor',
    fasting:    'Intermittent Fasting',
    fixed:      'Fixed Times',
    none:       'No Schedule',
  }[scheduleMode] || scheduleMode;

  // Fasting is a fixed-schedule model (no flex/consistent toggle), so don't
  // append "· flexible" / "· consistent" — the suffix only applies to anchor
  // modes (medication, wakeup).
  if (scheduleMode === 'none' || scheduleMode === 'fixed' || scheduleMode === 'fasting') return modeLabel;
  if (anchorBehavior === 'consistent' && consistentTime) return `${modeLabel} · ${consistentTime} consistent`;
  return `${modeLabel} · flexible`;
}

function formatRelativeDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = startOfDay(new Date(y, m - 1, d));
  const today = startOfDay(new Date());
  const diffDays = Math.round((date - today) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const { theme } = useTheme();
  return (
    <div style={{
      fontSize: typography.label,
      fontWeight: typography.semibold,
      color: theme.text.secondary,
      letterSpacing: typography.labelSpacingWide,
      textTransform: 'uppercase',
      fontFamily: typography.fontBody,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <div style={{ height: 1, background: theme.border.subtle }} />;
}

function WeeklyAdherenceDisplay({ percentage, dailyValues }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
      <div style={{
        fontSize: typography.display,
        fontWeight: typography.bold,
        color: theme.text.primary,
        fontFamily: typography.fontData,
        lineHeight: 1,
      }}>
        {Math.round(percentage)}%
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
        {dailyValues.map((value, i) => {
          const isToday = i === dailyValues.length - 1;
          const isEmpty = value === null;
          return (
            <div
              key={i}
              style={{
                width: 8,
                height: isEmpty ? 4 : `${Math.max(4, (value / 100) * 40)}px`,
                background: isToday ? theme.status.nowBadgeText : theme.text.primary,
                opacity: isEmpty ? 0.2 : 1,
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InsightsPanel({
  supplements,
  weekDates,
  weekLogs,
  streak,
  scheduleMode,
  anchorBehavior,
  consistentTime,
  activeSlotIds,
  readOnly = false,
  trend30 = null,
}) {
  const { theme } = useTheme();

  const logMap = useMemo(() => {
    const m = {};
    for (const log of (weekLogs || [])) m[log.log_date] = log;
    return m;
  }, [weekLogs]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const dailyValues = useMemo(() =>
    (weekDates || []).map(date => {
      const d = startOfDay(new Date(date));
      if (d > today) return null;
      return calculateAdherenceForDate(date, supplements, logMap[dateKey(date)] || null, activeSlotIds);
    }),
    [weekDates, logMap, supplements, today, activeSlotIds]
  );

  const weekAvg = useMemo(() => {
    const valid = dailyValues.filter(v => v !== null);
    return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [dailyValues]);

  const upcoming = useMemo(() => getUpcomingEndings(supplements, 14), [supplements]);

  const scheduleSummary = formatScheduleSummary(scheduleMode, anchorBehavior, consistentTime);

  return (
    <div style={{
      background: theme.surface.card,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      borderRadius: theme.radius.surface,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      }}>
        <SectionLabel>Insights</SectionLabel>
      </div>

      <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <SectionLabel>7-day adherence</SectionLabel>
          <WeeklyAdherenceDisplay percentage={weekAvg} dailyValues={dailyValues} />
          {trend30 && (
            <div style={{
              fontSize: typography.caption,
              color: theme.text.secondary,
              fontFamily: typography.fontBody,
              marginTop: spacing.xxs,
            }}>
              <span style={{ fontFamily: typography.fontData, fontWeight: typography.medium, color: theme.text.primary }}>
                {trend30.current}%
              </span>
              {' over 30 days'}
              {trend30.delta === null ? (
                <span style={{ color: theme.text.muted }}> · building baseline</span>
              ) : trend30.delta === 0 ? (
                <span> · no change from last month</span>
              ) : (
                <span style={{ color: trend30.delta > 0 ? theme.status.success : theme.status.danger }}>
                  {' · '}{trend30.delta > 0 ? '↑' : '↓'} {Math.abs(trend30.delta)} pts from last month
                </span>
              )}
            </div>
          )}
        </div>

        {streak >= 2 && (
          <>
            <Divider />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <SectionLabel>Current streak</SectionLabel>
              <div style={{
                fontSize: typography.heading,
                fontWeight: typography.bold,
                color: theme.text.primary,
                fontFamily: typography.fontHeading,
              }}>
                {streak} days
              </div>
            </div>
          </>
        )}

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <SectionLabel>Your schedule</SectionLabel>
          <div style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontBody }}>
            {scheduleSummary}
          </div>
        </div>

        {upcoming.length > 0 && (
          <>
            <Divider />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <SectionLabel>Upcoming endings</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {upcoming.slice(0, 3).map(supp => (
                  <div key={supp.id} style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontBody }}>
                    <span style={{ color: theme.text.primary, fontWeight: typography.medium }}>{supp.name}</span>
                    {' '}ends {formatRelativeDate(supp.ends_at)}
                  </div>
                ))}
                {upcoming.length > 3 && (
                  <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontBody }}>
                    +{upcoming.length - 3} more
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
