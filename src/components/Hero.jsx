import { Pencil } from 'lucide-react';
import { spacing, typography, touch, effects } from '../design-system';
import { useTheme } from '../lib/theme';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import Card from './Card';
import AdherenceRing from './AdherenceRing';

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const START_LABELS = {
  medication: "I took my medication",
  fasting:    "Start eating window",
  wakeup:     "I woke up",
};

const START_SUBTITLES = {
  medication: "sets your daily schedule",
  fasting:    "activates your eating window",
  wakeup:     "sets your daily schedule",
};

export default function Hero({
  scheduleMode, isToday, viewDate, shortDate, pct, coreTotal, coreDone,
  pillTime, anchorBehavior, consistentTime, eatingWindowStart,
  editPillTime, setEditPillTime, tmpTime, setTmpTime, setPillForDay,
  isFuture, flashGreen, startDay, viewDay,
  isPast, isReadOnly, pastDayEditing, setPastDayEditing,
  nextFixedSlot,
}) {
  const { theme } = useTheme();
  const isConsistent    = anchorBehavior === "consistent";
  const heroHasTime     = pillTime != null || isConsistent;
  const heroDisplayTime = pillTime || consistentTime;

  const viewingLabel = isPast
    ? `Viewing ${viewDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
    : null;

  return (
    <Card style={{ border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, backdropFilter: effects.backdropBlur, WebkitBackdropFilter: effects.backdropBlur, padding: `${spacing.sm}px ${spacing.md}px`, marginBottom: spacing.md, background: flashGreen ? theme.status.successSubtle : theme.surface.card, transition: "background 0.4s ease" }}>

      {/* Past-day header: eyebrow label + Edit / Done button */}
      {isPast && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
          <Label style={{ color: theme.text.secondary, marginBottom: 0 }}>{viewingLabel}</Label>
          <Button
            variant="secondary"
            size="compact"
            onClick={() => setPastDayEditing(!pastDayEditing)}
            style={{ transition: "opacity 200ms" }}
          >
            {pastDayEditing
              ? "Done"
              : <span style={{ display: "flex", alignItems: "center", gap: spacing.xxs }}><Pencil size={14} />Edit</span>
            }
          </Button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <div style={{ flex: 1 }}>
          {scheduleMode === "none" ? (
            <div>
              {!isPast && <Label style={{ color: theme.text.secondary, marginBottom: spacing.xxs }}>No schedule</Label>}
              <div style={{ fontSize: typography.title, fontWeight: typography.bold, color: theme.text.primary }}>{isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long" })}</div>
              <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>{shortDate}</div>
              {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
              {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
            </div>
          ) : scheduleMode === "fixed" ? (
            <div>
              {!isPast && nextFixedSlot ? (
                <>
                  <Label style={{ color: theme.text.secondary, marginBottom: spacing.xxs }}>Next</Label>
                  <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                    <span style={{ fontSize: typography.display, fontWeight: typography.bold, letterSpacing: typography.displayLetterSpacing, color: theme.accent.default, fontFamily: typography.fontHeading }}>{nextFixedSlot.time}</span>
                  </div>
                  <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>{nextFixedSlot.label}</div>
                  {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
                </>
              ) : !isPast ? (
                <>
                  <Label style={{ color: theme.text.secondary, marginBottom: spacing.xxs }}>Fixed schedule</Label>
                  {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>All slots done</div>}
                  {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
                </>
              ) : (
                <>
                  {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
                  {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
                </>
              )}
            </div>
          ) : scheduleMode === "fasting" ? (
            // IF v2: eating window is fixed-schedule, no user-triggered CTA
            <div>
              {!isPast && <Label style={{ color: theme.text.secondary, marginBottom: spacing.xxs }}>Eating window</Label>}
              <div style={{ fontSize: typography.display, fontWeight: typography.bold, letterSpacing: typography.displayLetterSpacing, color: theme.accent.default, fontFamily: typography.fontHeading }}>
                {eatingWindowStart || "--:--"}
              </div>
              {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
              {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
            </div>
          ) : heroHasTime ? (
            <div>
              {!isPast && (
                <Label style={{ color: theme.text.secondary, marginBottom: spacing.xxs }}>
                  {pillTime ? "Started at" : "Scheduled"}
                </Label>
              )}
              {editPillTime && pillTime && !isReadOnly ? (
                <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                  <Input variant="time" value={tmpTime} onChange={e => setTmpTime(e.target.value)} style={{ flex: 1 }} />
                  <Button variant="secondary" size="compact" onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }}>Save</Button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                  <span style={{ fontSize: typography.display, fontWeight: typography.bold, letterSpacing: typography.displayLetterSpacing, color: theme.accent.default, fontFamily: typography.fontHeading }}>{heroDisplayTime}</span>
                  {pillTime && !isReadOnly && (
                    <button onClick={() => { setTmpTime(pillTime); setEditPillTime(true); }} style={{ fontSize: typography.caption, color: theme.text.secondary, background: "none", border: "none", cursor: "pointer", padding: `0 ${spacing.xs}px`, minHeight: touch.min, display: "inline-flex", alignItems: "center", lineHeight: 1 }}>edit</button>
                  )}
                </div>
              )}
              {pct === 100 && <div style={{ fontSize: typography.caption, color: theme.status.success, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
            </div>
          ) : isPast ? (
            // Past day with no anchor time — no CTA, neutral message
            <div>
              <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>No anchor time recorded</div>
              {pct > 0 && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
            </div>
          ) : (
            // Today / future: show the "start day" CTA
            <div>
              <Button variant="startDay" isFuture={isFuture} fullWidth onClick={startDay}>
                {isFuture ? "Future day" : (START_LABELS[scheduleMode] || "Start my day")}
              </Button>
              {!isFuture && <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xs, textAlign: "center" }}>{START_SUBTITLES[scheduleMode] || "sets your daily schedule"}</div>}
            </div>
          )}
        </div>
        <AdherenceRing percentage={pct} size={72} />
      </div>
    </Card>
  );
}
