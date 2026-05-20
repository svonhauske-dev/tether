import { useState, useMemo } from 'react';
import { Search, LayoutDashboard, FileText } from 'lucide-react';
import { spacing, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import Sparkline from './Sparkline';
import StatusDot from './StatusDot';

// Circular avatar with the user's first initial. When onClick is provided it
// renders as a button (used as the Settings entry point on mobile + desktop).
// Sizes: `small` → 28pt (tight inline contexts), default → 36pt (desktop),
// `size="touch"` → touch.min (44pt mobile target).
export function AccountAvatar({ displayName, small, size: sizeProp, onClick }) {
  const { theme } = useTheme();
  const size = sizeProp === 'touch' ? touch.min : small ? 28 : 36;
  const initial = ((displayName || '').charAt(0) || 'Y').toUpperCase();
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: theme.surface.cardSubtle,
    border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: typography.fontData,
    fontSize: small ? typography.label : typography.body,
    color: theme.text.primary,
    fontWeight: typography.medium,
    flexShrink: 0,
  };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Settings"
        style={{ ...baseStyle, cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}
      >
        {initial}
      </button>
    );
  }
  return <div style={baseStyle}>{initial}</div>;
}

// Triage severity for a percentage. ≥80 high, ≥50 at-risk, <50 low.
// `null` means "no data yet" — render no dot.
function severity(pct) {
  if (pct == null) return null;
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'danger';
}

// Compact patient row. Left-aligned stack — no right-aligned indicators:
//   [avatar]  Name
//             ● 72% · 3 protocols
//             /sparkline/
// Stats arrive asynchronously; when missing, the row degrades to name only.
function PatientRow({ patient, stats, isSelected, onClick, theme }) {
  const initial = ((patient.display_name || '?').charAt(0)).toUpperCase();
  const pct = stats?.adherence7;
  const sev = severity(pct);
  const activeCount = stats?.activeCount;

  // Meta line built from whichever bits have arrived.
  const metaBits = [];
  if (pct != null) metaBits.push(`${pct}%`);
  if (activeCount != null) metaBits.push(`${activeCount} ${activeCount === 1 ? 'protocol' : 'protocols'}`);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.xs,
        width: '100%',
        padding: `${spacing.xs}px ${spacing.sm}px`,
        background: isSelected ? theme.surface.cardSubtle : 'transparent',
        border: 'none',
        borderRadius: theme.radius.surface,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: typography.fontBody,
        color: theme.text.primary,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      {/* Avatar */}
      <div
        aria-hidden
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: theme.surface.cardSubtle,
          border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: typography.fontData,
          fontSize: typography.label,
          fontWeight: typography.medium,
          color: isSelected ? theme.text.primary : theme.text.secondary,
          marginTop: 2, // optical alignment with name baseline
        }}
      >
        {initial}
      </div>

      {/* Left-aligned stack: name → meta → sparkline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: typography.caption,
          fontWeight: isSelected ? typography.semibold : typography.medium,
          color: theme.text.primary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {patient.display_name || 'Unnamed'}
        </span>

        {metaBits.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.xxs,
            fontSize: typography.label,
            fontFamily: typography.fontData,
            color: theme.text.secondary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sev && <StatusDot status={sev} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {metaBits.join(' · ')}
            </span>
          </span>
        )}

        {stats?.sparkline && (
          <Sparkline values={stats.sparkline} width={80} height={10} />
        )}
      </div>
    </button>
  );
}

// Clinician-only sidebar. Brand wordmark + greeting + avatar live in the
// top bar (App.jsx) — this column is purely the patient working set.
// Layout: search · patient rows · (Archived label + rows) · My Origin footer.
export default function Sidebar({
  isClinician, activeNavItem = 'home', onNavChange,
  patients = [], archivedPatients = [], onUnarchivePatient,
  selectedPatient, onPatientSelect,
  patientStats = {},
}) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const myOriginActive = activeNavItem === 'home' && !selectedPatient;
  const overviewActive = activeNavItem === 'roster' && !selectedPatient;
  const templatesActive = activeNavItem === 'templates' && !selectedPatient;

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(p => (p.display_name || '').toLowerCase().includes(q));
  }, [patients, query]);

  // Count patients below the high-adherer threshold (<80%). Surfaced as a
  // small caption near the top of the list. Null stats (still loading) skip.
  const needsReview = useMemo(() => {
    let n = 0;
    for (const p of patients) {
      const pct = patientStats[p.id]?.adherence7;
      if (pct != null && pct < 80) n++;
    }
    return n;
  }, [patients, patientStats]);

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      overflowY: 'auto',
      background: theme.surface.card,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      borderRadius: theme.radius.surface,
      display: 'flex',
      flexDirection: 'column',
      padding: spacing.md,
      gap: spacing.sm,
      boxSizing: 'border-box',
    }}>

      {isClinician && (
        <>
          {/* Overview — explicit nav back to the patient roster from any
              patient detail view. Lives at the top of the sidebar so it's
              the first thing the clinician sees + a clear "home" anchor. */}
          <button
            onClick={() => { onPatientSelect?.(null); onNavChange?.('roster'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.sm}px ${spacing.sm}px`,
              background: overviewActive ? theme.surface.cardSubtle : 'transparent',
              border: 'none', borderRadius: theme.radius.surface,
              color: overviewActive ? theme.text.primary : theme.text.secondary,
              fontFamily: typography.fontBody, fontSize: typography.caption,
              fontWeight: overviewActive ? typography.semibold : typography.regular,
              textAlign: 'left', width: '100%',
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <LayoutDashboard size={14} />
            <span>Overview</span>
          </button>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            background: theme.surface.cardSubtle,
            border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
            borderRadius: theme.radius.surface,
          }}>
            <Search size={14} color={theme.text.secondary} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients"
              aria-label="Search patients"
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none', outline: 'none',
                color: theme.text.primary,
                fontFamily: typography.fontBody,
                fontSize: typography.caption,
                padding: 0,
              }}
            />
          </div>

          {/* "N need review" caption — appears below search when ≥1 patient is
              below the high-adherer threshold. Skipped when everyone is green
              or stats are still loading. */}
          {needsReview > 0 && (
            <div style={{
              padding: `0 ${spacing.sm}px`,
              fontSize: typography.label,
              color: theme.status.warning,
              fontFamily: typography.fontBody,
            }}>
              {needsReview} need{needsReview === 1 ? 's' : ''} review
            </div>
          )}

          {/* Active patients */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xxs }}>
            {filteredPatients.length === 0 ? (
              <div style={{
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontSize: typography.caption,
                color: theme.text.secondary,
              }}>
                {query ? 'No matches' : 'No patients yet'}
              </div>
            ) : filteredPatients.map(p => (
              <PatientRow
                key={p.id}
                patient={p}
                stats={patientStats[p.id]}
                isSelected={selectedPatient?.id === p.id}
                onClick={() => onPatientSelect?.(p)}
                theme={theme}
              />
            ))}
          </div>

          {/* Archived — static section (not collapsible). Only renders when
              the clinician has archived ≥1 patient. */}
          {archivedPatients.length > 0 && (
            <>
              <div style={{
                padding: `${spacing.sm}px ${spacing.sm}px ${spacing.xxs}px`,
                fontSize: typography.label,
                color: theme.text.muted,
                fontFamily: typography.fontBody,
                letterSpacing: typography.labelSpacingWide,
                textTransform: 'uppercase',
              }}>
                Archived · {archivedPatients.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {archivedPatients.map(p => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      fontFamily: typography.fontBody, fontSize: typography.caption,
                      color: theme.text.secondary,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.display_name || 'Unnamed'}
                    </span>
                    <button
                      onClick={() => onUnarchivePatient?.(p.id)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: theme.text.secondary,
                        fontSize: typography.label,
                        padding: `${spacing.xxs}px ${spacing.xs}px`,
                        textDecoration: 'underline',
                        flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Footer: divider + My Origin entry. Clinician's return to personal
          mode (their own supplements). For non-clinicians the sidebar isn't
          rendered, so this only ever appears in clinician context. */}
      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: theme.border.subtle }} />
      <button
        onClick={() => { onPatientSelect?.(null); onNavChange?.('home'); }}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          padding: `${spacing.sm}px ${spacing.sm}px`,
          background: myOriginActive ? theme.surface.cardSubtle : 'transparent',
          border: 'none', borderRadius: theme.radius.surface,
          color: myOriginActive ? theme.text.primary : theme.text.secondary,
          fontFamily: typography.fontBody, fontSize: typography.caption,
          fontWeight: myOriginActive ? typography.semibold : typography.regular,
          textAlign: 'left', width: '100%',
          cursor: 'pointer',
          transition: 'background 150ms ease, color 150ms ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        My Origin
      </button>

      {/* Templates — sibling surface to Protocol Library. Shareable protocol
          shells (is_template = true). Sent to patients or cloned into the
          clinician's own running protocols via "Use for myself". */}
      <button
        onClick={() => { onPatientSelect?.(null); onNavChange?.('templates'); }}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          padding: `${spacing.sm}px ${spacing.sm}px`,
          background: templatesActive ? theme.surface.cardSubtle : 'transparent',
          border: 'none', borderRadius: theme.radius.surface,
          color: templatesActive ? theme.text.primary : theme.text.secondary,
          fontFamily: typography.fontBody, fontSize: typography.caption,
          fontWeight: templatesActive ? typography.semibold : typography.regular,
          textAlign: 'left', width: '100%',
          cursor: 'pointer',
          transition: 'background 150ms ease, color 150ms ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <FileText size={14} />
        <span>Templates</span>
      </button>
    </aside>
  );
}
