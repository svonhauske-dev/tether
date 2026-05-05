import { colors, spacing, radius, typography } from '../design-system';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import Card from './Card';

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
  pillTime, anchorBehavior, consistentTime,
  editPillTime, setEditPillTime, tmpTime, setTmpTime, setPillForDay,
  isFuture, flashGreen, startDay, viewDay,
}) {
  const isConsistent    = anchorBehavior === "consistent";
  const heroHasTime     = pillTime != null || isConsistent;
  const heroDisplayTime = pillTime || consistentTime;
  const r = 30, circ = 2 * Math.PI * r, dash = circ * (pct / 100);

  return (
    <Card style={{ borderRadius: radius.xl, border: `1px solid ${colors.borderBase}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: `${spacing.sm}px ${spacing.md}px`, marginBottom: spacing.md, background: flashGreen ? colors.accentDim : colors.bgCard, transition: "background 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <div style={{ flex: 1 }}>
          {scheduleMode === "none" ? (
            <div>
              <Label style={{ color: colors.textMuted, marginBottom: spacing.xxs }}>No schedule</Label>
              <div style={{ fontSize: typography.title, fontWeight: typography.bold, color: colors.textPrimary }}>{isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long" })}</div>
              <div style={{ fontSize: typography.caption, color: colors.textMuted, marginTop: spacing.xxxs }}>{shortDate}</div>
              {pct === 100 && coreTotal > 0 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>All done ✓</div>}
              {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
            </div>
          ) : scheduleMode === "fixed" ? (
            <div>
              <Label style={{ color: colors.textMuted, marginBottom: spacing.xxs }}>Fixed schedule</Label>
              <div style={{ fontSize: typography.title, fontWeight: typography.bold, color: colors.textPrimary }}>{DAYS[viewDay]}</div>
              {pct === 100 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
              {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
            </div>
          ) : heroHasTime ? (
            <div>
              <Label style={{ color: colors.textMuted, marginBottom: spacing.xxs }}>
                {pillTime ? "Started at" : "Scheduled"}
              </Label>
              {editPillTime && pillTime ? (
                <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                  <Input variant="time" value={tmpTime} onChange={e => setTmpTime(e.target.value)} style={{ flex: 1 }} />
                  <Button variant="secondary" size="compact" onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }}>Save</Button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                  <span style={{ fontSize: typography.display, fontWeight: typography.bold, letterSpacing: typography.displayLetterSpacing, color: colors.accent, fontFamily: typography.fontHeading }}>{heroDisplayTime}</span>
                  {pillTime && <button onClick={() => { setTmpTime(pillTime); setEditPillTime(true); }} style={{ fontSize: typography.caption, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>edit</button>}
                </div>
              )}
              {pct === 100 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
            </div>
          ) : (
            <div>
              <Button variant="startDay" isFuture={isFuture} fullWidth onClick={startDay}>
                {isFuture ? "Future day" : (START_LABELS[scheduleMode] || "Start my day")}
              </Button>
              {!isFuture && <div style={{ fontSize: typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" }}>{START_SUBTITLES[scheduleMode] || "sets your daily schedule"}</div>}
            </div>
          )}
        </div>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0, width: 72, height: 72, display: "block" }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke={colors.borderBase} strokeWidth="5" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={colors.accent} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
          <text x="36" y="36" textAnchor="middle" dominantBaseline="middle" fill={colors.textPrimary} fontSize={typography.caption} fontWeight={typography.bold} fontFamily={typography.fontHeading}>{pct}%</text>
        </svg>
      </div>
    </Card>
  );
}
