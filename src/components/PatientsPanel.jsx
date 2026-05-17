import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { spacing, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import { dbGetMyPatients, dbGetProtocols, dbGetPatientLogs } from '../lib/api';
import InlineLoader from './InlineLoader';
import PatientDetailPanel from './PatientDetailPanel';

function adherenceLabel(pct) {
  if (pct === null) return null;
  if (pct >= 80) return { text: 'High adherer',      color: null };
  if (pct >= 50) return { text: 'At risk',            color: 'warning' };
  return              { text: 'Low adherence',        color: 'danger' };
}

function PatientRow({ patient, onClick, theme }) {
  const initial = ((patient.display_name || '?').charAt(0)).toUpperCase();
  const { activeCount, adherence7d } = patient;
  const label = adherenceLabel(adherence7d);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        padding: `${spacing.sm}px 0`,
        minHeight: touch.min, textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: theme.surface.cardSubtle,
        border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: typography.body, fontWeight: typography.semibold,
        color: theme.text.primary, marginRight: spacing.sm,
      }}>
        {initial}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: 2 }}>
          {patient.display_name || 'Unnamed patient'}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>
          {activeCount != null ? `${activeCount} active ${activeCount === 1 ? 'protocol' : 'protocols'}` : '—'}
          {adherence7d != null && ` · ${adherence7d}% last 7 days`}
        </div>
      </div>

      {/* Status label */}
      {label && (
        <span style={{
          fontSize: typography.label,
          color: label.color === 'danger'  ? theme.status.danger
               : label.color === 'warning' ? theme.status.warning
               : theme.status.success,
          marginRight: spacing.xs,
          flexShrink: 0,
        }}>
          {label.text}
        </span>
      )}

      <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function PatientsPanel({ userId, token }) {
  const { theme } = useTheme();
  const [patients, setPatients]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    if (!userId || !token) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    dbGetMyPatients(userId, token)
      .then(async (profiles) => {
        const enriched = await Promise.all(
          (profiles || []).map(async (p) => {
            const [protos, logs] = await Promise.all([
              dbGetProtocols(p.id, token).catch(() => []),
              dbGetPatientLogs(p.id, sevenDaysAgo, today, token).catch(() => []),
            ]);
            const activeCount = (protos || []).filter(pr => pr.status === 'active').length;
            const daysWithActivity = (logs || []).filter(l => Object.keys(l.checked || {}).length > 0).length;
            const adherence7d = logs?.length > 0 ? Math.round((daysWithActivity / logs.length) * 100) : null;
            return { ...p, activeCount, adherence7d };
          })
        );
        setPatients(enriched);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [userId, token]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <h1 style={{
          fontSize: typography.heading, fontWeight: typography.semibold,
          color: theme.text.primary, fontFamily: 'var(--font-heading)',
          margin: 0,
        }}>
          Patients
        </h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: theme.text.secondary, fontSize: typography.body }}>
          <InlineLoader size="sm" /> Loading patients…
        </div>
      ) : patients.length === 0 ? (
        <div style={{ fontSize: typography.body, color: theme.text.secondary }}>
          No patients assigned to your account yet.
        </div>
      ) : (
        <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}` }}>
          {patients.map(p => (
            <PatientRow
              key={p.id}
              patient={p}
              theme={theme}
              onClick={() => setSelectedPatient(p)}
            />
          ))}
        </div>
      )}

      <PatientDetailPanel
        isOpen={!!selectedPatient}
        onBack={() => setSelectedPatient(null)}
        patient={selectedPatient}
        token={token}
      />
    </div>
  );
}
