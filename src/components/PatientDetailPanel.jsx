import { useState, useEffect, useMemo } from 'react';
import { spacing, typography } from '../design-system';
import { useTheme } from '../lib/theme';
import { dbGetPatientLogs } from '../lib/api';
import { dateKey, startOfDay, isActiveSupp, isSupplementActiveOn } from '../lib/time';
import { calculateAdherenceForDate } from '../lib/adherence';
import { SLOTS, IF_SLOTS } from '../lib/notifications';
import { DEFAULT_CONFIG } from '../config';
import WeekStrip from './WeekStrip';
import TodayPanel from './TodayPanel';
import InsightsPanel from './InsightsPanel';

// Clinician's read-only patient detail view. Shape mirrors the home cockpit
// (week strip + two-column TodayPanel/InsightsPanel) so the clinician can
// scan the patient's experience the same way the patient does.
//
// All patient data (`patientSupps`, `patientProtos`, `patientSched`,
// `patientTrendLogs`, `activeSlotIds`) is owned by App.jsx — both the cockpit
// and the right column (ProtocolLibrary in patient mode) read from the same
// shared state. Only the week-navigation log fetch is local since it follows
// the user's prev/next clicks.
export default function PatientDetailPanel({
  patient, token,
  patientSupps = [], patientProtos = [],
  patientSched = null, patientTrendLogs = [],
  activeSlotIds = null,
}) {
  const { theme } = useTheme();

  const todayDate = startOfDay(new Date());
  const todayKey  = dateKey(todayDate);

  const [weekLogs, setWeekLogs]           = useState([]);
  const [viewedWeekEnd, setViewedWeekEnd] = useState(todayDate);
  const [viewDate, setViewDate]           = useState(todayDate);

  useEffect(() => {
    setViewDate(todayDate);
    setViewedWeekEnd(todayDate);
    setWeekLogs([]);
  }, [patient?.id]);

  useEffect(() => {
    if (!patient?.id) return;
    const weekStart = new Date(viewedWeekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    dbGetPatientLogs(patient.id, dateKey(weekStart), dateKey(viewedWeekEnd), token)
      .then(rows => setWeekLogs(rows || []))
      .catch(() => setWeekLogs([]));
  }, [patient?.id, viewedWeekEnd]);

  // Week navigation
  const weekStart = new Date(viewedWeekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return startOfDay(d);
  });
  const canNavigateNext = dateKey(viewedWeekEnd) < todayKey;
  const handlePrevWeek  = () => setViewedWeekEnd(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return startOfDay(d); });
  const handleNextWeek  = () => setViewedWeekEnd(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return startOfDay(d); });

  // Patient's schedule mode + config drive which slot vocabulary to render.
  // Without this, IF v2 fasting users (slots like meal_1, pre_meal_2, fasted)
  // render under the standard slot list and their checks appear missing.
  const scheduleMode    = patientSched?.schedule_type || 'none';
  const scheduleConfig  = { ...DEFAULT_CONFIG, ...(patientSched?.offsets || {}) };
  const mealCount       = scheduleConfig.meal_count || 3;
  const activeSlotList  = scheduleMode === 'fasting'
    ? IF_SLOTS.filter(s => {
        if (s.id === 'pre_meal_2' || s.id === 'meal_2') return mealCount >= 2;
        if (s.id === 'pre_meal_3' || s.id === 'meal_3') return mealCount >= 3;
        if (s.id === 'evening')                          return !!scheduleConfig.evening_mode;
        return true;
      })
    : SLOTS;
  // App.jsx may pass activeSlotIds in via prop (Phase 2 lifted derivation up);
  // fall back to the locally-computed Set so this panel works standalone too.
  const slotIds = activeSlotIds || new Set(activeSlotList.map(s => s.id));

  // ── 30-day trend ────────────────────────────────────────────────────
  // Compute current 30-day adherence avg and prior 30-day avg from patientTrendLogs.
  // Renders as "76% over 30 days · ↓ 8 pts from last month" under the headline.
  // Requires ≥60 days of data to be meaningful; when the patient has less,
  // we show only the current 30 (no delta) and label it "building baseline".
  const trend30 = useMemo(() => {
    if (!patientSupps.length) return null;
    const logMap = {};
    for (const l of patientTrendLogs) logMap[l.log_date] = l;
    const computeAvg = (offsetStart, offsetEnd) => {
      const vals = [];
      for (let off = offsetStart; off <= offsetEnd; off++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - off);
        const k = dateKey(d);
        const log = logMap[k] || null;
        vals.push(calculateAdherenceForDate(d, patientSupps, log, slotIds));
      }
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const current = Math.round(computeAvg(0, 29));
    const prior   = Math.round(computeAvg(30, 59));
    const hasPrior = patientTrendLogs.some(l => {
      const d = new Date(l.log_date);
      const diffDays = Math.floor((todayDate - d) / 86400000);
      return diffDays >= 30 && diffDays < 60;
    });
    return { current, prior: hasPrior ? prior : null, delta: hasPrior ? current - prior : null };
  }, [patientTrendLogs, patientSupps, slotIds, todayDate]);

  // Derived supplement state for selected day
  const viewDay  = viewDate.getDay();
  const dk       = dateKey(viewDate);
  const viewDayLog = weekLogs.find(l => l.log_date === dk) || null;

  const activeProtocolIds = new Set(patientProtos.filter(p => p.status === 'active').map(p => p.id));
  const homeSupps         = patientSupps.filter(s => isActiveSupp(s) && isSupplementActiveOn(s, viewDate) && (!s.protocol_id || activeProtocolIds.has(s.protocol_id)));
  const anytimeSupps      = homeSupps.filter(s => s.slots.length === 0 && s.days.includes(viewDay));
  const getSuppsForSlot   = (sid) => homeSupps.filter(s => s.slots.includes(sid) && s.days.includes(viewDay));
  const isChecked         = (slot, suppId) => {
    const k = slot === 'anytime' ? `${dk}_anytime_${suppId}` : `${dk}_${slot}_${suppId}`;
    return !!(viewDayLog?.checked?.[k]);
  };

  return (
    <>
      <WeekStrip
        weekDates={weekDates}
        weekLogs={weekLogs}
        supplements={patientSupps}
        selectedDate={viewDate}
        onSelectDate={(d) => setViewDate(startOfDay(d))}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
        canNavigateNext={canNavigateNext}
        activeSlotIds={slotIds}
      />

      {/* 50/50 between TodayPanel and InsightsPanel — tried a 40/60 lean toward
          Insights, but at typical desktop widths the TodayPanel header crowds
          out the date. Analytic weight comes from PatientAnalyticsPanel
          stacked below instead. */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: spacing.xl,
        marginTop: spacing.xl,
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TodayPanel
            viewDate={viewDate}
            isToday={dk === todayKey}
            isPast={dk < todayKey}
            isFuture={dk > todayKey}
            homeSupps={homeSupps}
            anytimeSupps={anytimeSupps}
            getSuppsForSlot={getSuppsForSlot}
            isChecked={isChecked}
            toggleCheck={() => {}}
            slotTimeStr={() => null}
            slotStatus={() => null}
            scheduleMode={scheduleMode}
            pillTime={null}
            anchorBehavior={null}
            consistentTime={null}
            eatingWindowStart={scheduleConfig.eating_window_start || null}
            activeSlotList={activeSlotList}
            isReadOnly={true}
            pastDayEditing={false}
            setPastDayEditing={() => {}}
            startDay={() => {}}
            editPillTime={null}
            setEditPillTime={() => {}}
            tmpTime={{}}
            setTmpTime={() => {}}
            setPillForDay={() => {}}
            openEdit={() => {}}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InsightsPanel
            supplements={patientSupps}
            weekDates={weekDates}
            weekLogs={weekLogs}
            streak={0}
            scheduleMode={scheduleMode}
            anchorBehavior={scheduleConfig._anchor_behavior || null}
            consistentTime={scheduleConfig._consistent_time || null}
            activeSlotIds={slotIds}
            readOnly={true}
            trend30={trend30}
          />
        </div>
      </div>
    </>
  );
}
