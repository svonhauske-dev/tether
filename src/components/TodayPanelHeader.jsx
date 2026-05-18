import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { spacing, typography } from '../design-system';
import { useTheme } from '../lib/theme';
import Button from './Button';
import Input from './Input';

export default function TodayPanelHeader({
  viewDate, isToday, isPast,
  scheduleMode, pillTime, anchorBehavior, consistentTime, eatingWindowStart,
  isReadOnly, pastDayEditing, setPastDayEditing,
  startDay, editPillTime, setEditPillTime, tmpTime, setTmpTime, setPillForDay,
}) {
  const { theme } = useTheme();
  const [anchorHovered, setAnchorHovered] = useState(false);

  const isFasting = scheduleMode === 'fasting';
  const hasAnchor = scheduleMode !== 'none' && scheduleMode !== 'fixed' && !isFasting;
  const isConsistent = anchorBehavior === 'consistent';
  const heroHasTime = pillTime != null || isConsistent;
  const heroDisplayTime = pillTime || (isConsistent ? consistentTime : null);

  const dayLabel = isToday ? 'TODAY' : 'PAST DAY';
  const dateStr = viewDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: `${spacing.md}px ${spacing.lg}px`,
      borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      gap: spacing.md,
      minHeight: 56,
    }}>
      {/* Left: day label + anchor */}
      <div>
        <div style={{
          fontSize: typography.label,
          fontWeight: typography.semibold,
          color: theme.text.secondary,
          letterSpacing: typography.labelSpacingWide,
          textTransform: 'uppercase',
          fontFamily: typography.fontBody,
          marginBottom: hasAnchor && heroHasTime ? spacing.xxxs : 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {dayLabel} • {dateStr}
        </div>

        {isFasting && (
          <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontBody }}>
            Eating window: {eatingWindowStart || '--:--'}
          </div>
        )}

        {hasAnchor && heroHasTime && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: spacing.xxs }}
            onMouseEnter={() => setAnchorHovered(true)}
            onMouseLeave={() => setAnchorHovered(false)}
          >
            {editPillTime ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <Input
                  variant="time"
                  value={tmpTime}
                  onChange={e => setTmpTime(e.target.value)}
                  style={{ width: 120 }}
                />
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => setEditPillTime(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <span style={{
                  fontSize: typography.caption,
                  color: theme.text.secondary,
                  fontFamily: typography.fontBody,
                }}>
                  Anchor: {heroDisplayTime}
                </span>
                {!isReadOnly && anchorHovered && (
                  <button
                    onClick={() => { setTmpTime(heroDisplayTime || ''); setEditPillTime(true); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.text.secondary,
                      padding: `${spacing.xxxs}px`,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: theme.radius.surfaceInner,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: CTA · or a "View only" chip in read-only mode (patient view)
          so the clinician never wonders if a click did something. */}
      <div style={{ flexShrink: 0, paddingTop: spacing.xxxs }}>
        {isReadOnly ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: `${spacing.xxxs}px ${spacing.xs}px`,
            background: theme.surface.cardSubtle,
            border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
            borderRadius: theme.radius.pill,
            fontSize: typography.label,
            fontFamily: typography.fontBody,
            color: theme.text.secondary,
            letterSpacing: typography.labelSpacing,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            View only
          </span>
        ) : (
          <>
            {isToday && hasAnchor && !heroHasTime && (
              <Button variant="primary" size="compact" onClick={startDay}>
                Start my day
              </Button>
            )}
            {isPast && (
              <Button
                variant="secondary"
                size="compact"
                onClick={() => setPastDayEditing(!pastDayEditing)}
              >
                {pastDayEditing ? 'Done' : 'Edit'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
