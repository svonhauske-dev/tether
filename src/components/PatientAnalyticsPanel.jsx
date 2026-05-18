import { useMemo, useState, useEffect, useRef } from 'react';
import { spacing, typography } from '../design-system';
import { useTheme } from '../lib/theme';
import {
  calculateSupplementAdherence,
  calculateSlotAdherence,
  buildActivityLog,
} from '../lib/adherence';
import { SLOTS, IF_SLOTS } from '../lib/notifications';
import { isActiveSupp } from '../lib/time';

// Diagnostic-detail sections for the clinician's patient view (Phase 3).
// Three sections, vertically stacked, each in its own card:
//   1. By supplement — worst-first list, surfaces the friction point
//   2. By slot       — worst-first list, surfaces the bad time-of-day
//   3. Activity      — last N pause/stop/add/archive events
//
// Day-of-week breakdown is deferred (spec: "only worth showing if there's
// a meaningful pattern" — defer until we have a real signal-detection rule).
//
// All inputs are passed in — this component owns no fetching state and
// re-renders cheaply when patient context changes.

function SectionLabel({ children }) {
  const { theme } = useTheme();
  return (
    <div style={{
      fontSize: typography.label,
      color: theme.text.secondary,
      letterSpacing: typography.labelSpacingWide,
      textTransform: 'uppercase',
      fontWeight: typography.semibold,
      fontFamily: typography.fontHeading,
    }}>
      {children}
    </div>
  );
}

function PercentRow({ label, pct, sublabel }) {
  const { theme } = useTheme();
  // Color the number by severity. The spec frames this as a punch list:
  // worst-first scanning means the eye gravitates to the red.
  const color =
    pct >= 80 ? theme.status.success :
    pct >= 50 ? theme.text.primary :
                theme.status.danger;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs,
      borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: typography.body, color: theme.text.primary,
          fontWeight: typography.medium,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>
            {sublabel}
          </div>
        )}
      </div>
      <div style={{
        fontSize: typography.body,
        fontFamily: typography.fontData,
        fontWeight: typography.semibold,
        color,
        flexShrink: 0,
      }}>
        {pct}%
      </div>
    </div>
  );
}

function formatRelative(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours <= 0) return 'just now';
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7)   return `${diffDays} days ago`;
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function PatientAnalyticsPanel({
  supplements = [],
  protocols = [],
  trendLogs = [],
  activeSlotIds = null,
  scheduleMode = 'none',
  initialNotes = '',
  onSaveNotes = null,
}) {
  const { theme } = useTheme();

  // ── By supplement: rank active supps by 30-day adherence, worst first ──
  const suppRows = useMemo(() => {
    const rows = supplements
      .filter(s => isActiveSupp(s))
      .map(s => ({ supp: s, a: calculateSupplementAdherence(s, trendLogs, activeSlotIds, 30) }))
      .filter(r => r.a)
      .sort((a, b) => a.a.pct - b.a.pct);
    return rows;
  }, [supplements, trendLogs, activeSlotIds]);

  // ── By slot: only slots active in patient's mode, sorted worst-first ──
  const slotRows = useMemo(() => {
    const slotList = scheduleMode === 'fasting' ? IF_SLOTS : SLOTS;
    const candidates = activeSlotIds
      ? slotList.filter(s => activeSlotIds.has(s.id))
      : slotList;
    const rows = candidates
      .map(s => ({ slot: s, a: calculateSlotAdherence(s.id, supplements, trendLogs, 30) }))
      .filter(r => r.a)
      .sort((a, b) => a.a.pct - b.a.pct);
    return rows;
  }, [supplements, trendLogs, activeSlotIds, scheduleMode]);

  // ── Recent activity ─────────────────────────────────────────────────────
  const activity = useMemo(
    () => buildActivityLog(supplements, protocols, 30, 10),
    [supplements, protocols]
  );

  const cardStyle = {
    background: theme.surface.card,
    border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
    borderRadius: theme.radius.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  };

  const sectionHeader = { marginBottom: spacing.sm };

  // Notes textarea state. Re-syncs from `initialNotes` whenever the patient
  // changes (parent passes a different string). Saves on blur so we don't
  // hammer the API on every keystroke.
  const [notesDraft, setNotesDraft] = useState(initialNotes);
  const lastSavedRef = useRef(initialNotes);
  useEffect(() => {
    setNotesDraft(initialNotes);
    lastSavedRef.current = initialNotes;
  }, [initialNotes]);

  const handleNotesBlur = () => {
    if (!onSaveNotes) return;
    if (notesDraft === lastSavedRef.current) return;
    lastSavedRef.current = notesDraft;
    onSaveNotes(notesDraft);
  };

  const showNotes = !!onSaveNotes;

  // Suppress the panel only when no data AND no notes affordance — otherwise
  // notes always render so the clinician has somewhere to drop a quick note
  // even for a brand-new patient with no logs yet.
  if (!showNotes && suppRows.length === 0 && slotRows.length === 0 && activity.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: spacing.md }}>
      {suppRows.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionHeader}>
            <SectionLabel>By supplement</SectionLabel>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>
              30-day adherence · worst first
            </div>
          </div>
          {suppRows.slice(0, 8).map(({ supp, a }) => (
            <PercentRow
              key={supp.id}
              label={supp.name}
              pct={a.pct}
              sublabel={`${a.taken}/${a.expected} expected`}
            />
          ))}
        </div>
      )}

      {slotRows.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionHeader}>
            <SectionLabel>By time of day</SectionLabel>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>
              30-day adherence · worst first
            </div>
          </div>
          {slotRows.map(({ slot, a }) => (
            <PercentRow
              key={slot.id}
              label={slot.label}
              pct={a.pct}
              sublabel={`${a.taken}/${a.expected} expected`}
            />
          ))}
        </div>
      )}

      {activity.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionHeader}>
            <SectionLabel>Recent activity</SectionLabel>
          </div>
          {activity.map((e, i) => (
            <div
              key={`${e.kind}-${i}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                gap: spacing.sm,
                paddingTop: spacing.xs, paddingBottom: spacing.xs,
                borderBottom: i < activity.length - 1
                  ? `${theme.borderWidth.default}px solid ${theme.border.subtle}`
                  : 'none',
              }}
            >
              <div style={{
                fontSize: typography.body, color: theme.text.primary,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                flex: 1, minWidth: 0,
              }}>
                {e.text}
              </div>
              <div style={{
                fontSize: typography.caption, color: theme.text.secondary,
                flexShrink: 0,
              }}>
                {formatRelative(e.at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNotes && (
        <div style={cardStyle}>
          <div style={sectionHeader}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: spacing.xxxs }}>
              Private — only you can see this
            </div>
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Jot down what to watch for next check-in…"
            rows={5}
            style={{
              width: '100%',
              background: theme.surface.canvas,
              color: theme.text.primary,
              border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
              borderRadius: theme.radius.surface,
              padding: spacing.sm,
              fontSize: typography.body,
              fontFamily: typography.fontBody,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
