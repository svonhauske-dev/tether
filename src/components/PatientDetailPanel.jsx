import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { spacing, typography, layout } from '../design-system';
import { useTheme } from '../lib/theme';
import { dbGetSupps, dbGetProtocols, dbGetPatientLogs } from '../lib/api';
import { dateKey, startOfDay, TODAY, isActiveSupp, isSupplementActiveOn } from '../lib/time';
import WeekStrip from './WeekStrip';
import TodayPanel from './TodayPanel';
import Label from './Label';
import InlineLoader from './InlineLoader';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PatientDetailPanel({ isOpen, onBack, patient, token }) {
  const { theme } = useTheme();

  const todayDate = startOfDay(new Date());
  const todayKey  = dateKey(todayDate);

  const [loading, setLoading]             = useState(false);
  const [patientSupps, setPatientSupps]   = useState([]);
  const [patientProtos, setPatientProtos] = useState([]);
  const [weekLogs, setWeekLogs]           = useState([]);
  const [viewedWeekEnd, setViewedWeekEnd] = useState(todayDate);
  const [viewDate, setViewDate]           = useState(todayDate);

  // Load supplements + protocols on open
  useEffect(() => {
    if (!isOpen || !patient?.id) return;
    setPatientSupps([]);
    setPatientProtos([]);
    setWeekLogs([]);
    setViewDate(todayDate);
    setViewedWeekEnd(todayDate);
    setLoading(true);
    Promise.all([
      dbGetSupps(patient.id, token).catch(() => []),
      dbGetProtocols(patient.id, token).catch(() => []),
    ]).then(([supps, protos]) => {
      setPatientSupps(supps || []);
      setPatientProtos(protos || []);
    }).finally(() => setLoading(false));
  }, [isOpen, patient?.id]);

  // Reload week logs whenever the viewed week changes
  useEffect(() => {
    if (!isOpen || !patient?.id) return;
    const weekStart = new Date(viewedWeekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    dbGetPatientLogs(patient.id, dateKey(weekStart), dateKey(viewedWeekEnd), token)
      .then(rows => setWeekLogs(rows || []))
      .catch(() => setWeekLogs([]));
  }, [isOpen, patient?.id, viewedWeekEnd]);

  // Week navigation
  const weekStart = new Date(viewedWeekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return startOfDay(d);
  });
  const canNavigateNext = dateKey(viewedWeekEnd) < todayKey;
  const handlePrevWeek = () => setViewedWeekEnd(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return startOfDay(d); });
  const handleNextWeek = () => setViewedWeekEnd(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return startOfDay(d); });

  // Derive today panel data from patient's supplements + selected day's log
  const viewDay       = viewDate.getDay();
  const dk            = dateKey(viewDate);
  const viewDayLog    = weekLogs.find(l => l.log_date === dk) || null;

  const activeProtocolIds = new Set(patientProtos.filter(p => p.status === 'active').map(p => p.id));
  const homeSupps         = patientSupps.filter(s => isActiveSupp(s) && isSupplementActiveOn(s, viewDate) && (!s.protocol_id || activeProtocolIds.has(s.protocol_id)));
  const anytimeSupps      = homeSupps.filter(s => s.slots.length === 0 && s.days.includes(viewDay));
  const getSuppsForSlot   = (sid) => homeSupps.filter(s => s.slots.includes(sid) && s.days.includes(viewDay));
  const isChecked         = (slot, suppId) => {
    const k = slot === 'anytime' ? `${dk}_anytime_${suppId}` : `${dk}_${slot}_${suppId}`;
    return !!(viewDayLog?.checked?.[k]);
  };

  const activeProtos = patientProtos.filter(p => p.status === 'active');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-out',
      zIndex: 103,
      background: theme.surface.canvas,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: `${spacing.xs}px`, marginLeft: -spacing.xs,
          color: theme.text.primary, display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ChevronLeft size={24} />
        </button>
        <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginLeft: spacing.xs }}>
          {patient?.display_name || 'Patient'}
        </span>
        <span style={{ fontSize: typography.caption, color: theme.text.secondary, marginLeft: spacing.sm }}>
          · read only
        </span>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: layout.maxContentWidth, margin: '0 auto',
        padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: theme.text.secondary, fontSize: typography.body }}>
            <InlineLoader size="sm" /> Loading patient data…
          </div>
        ) : (<>

          {/* Active protocols */}
          {activeProtos.length > 0 && (
            <div style={{ marginBottom: spacing.xl }}>
              <Label style={{ marginBottom: spacing.sm }}>Active protocols</Label>
              <div style={{
                border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                borderRadius: theme.radius.surface, overflow: 'hidden',
              }}>
                {activeProtos.map((proto, i) => {
                  const count = patientSupps.filter(s => s.protocol_id === proto.id && s.status === 'active').length;
                  return (
                    <div key={proto.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      borderTop: i > 0 ? `${theme.borderWidth.default}px solid ${theme.border.subtle}` : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary }}>
                          {proto.name}
                        </div>
                        <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>
                          {count} {count === 1 ? 'supplement' : 'supplements'}
                          {proto.ends_at && ` · Ends ${formatDate(proto.ends_at)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week strip */}
          <div style={{ marginBottom: spacing.xl }}>
            <Label style={{ marginBottom: spacing.sm }}>Adherence</Label>
            <WeekStrip
              weekDates={weekDates}
              weekLogs={weekLogs}
              supplements={patientSupps}
              selectedDate={viewDate}
              onSelectDate={(d) => setViewDate(startOfDay(d))}
              onPrev={handlePrevWeek}
              onNext={handleNextWeek}
              canNavigateNext={canNavigateNext}
            />
          </div>

          {/* Today's supplements via TodayPanel */}
          <div>
            <Label style={{ marginBottom: spacing.sm }}>
              {dk === todayKey
                ? "Today's supplements"
                : viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Label>
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
              scheduleMode="none"
              pillTime={null}
              anchorBehavior={null}
              consistentTime={null}
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

        </>)}
      </div>
    </div>
  );
}
