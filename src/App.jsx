import { useState, useEffect, useRef } from "react";
import {
  spacing, typography, touch, layout,
  shadows, zIndex, breakpoints,
} from "./design-system";
import { ThemeProvider, useTheme } from './lib/theme';
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, toHrMin, fromHrMin, MODES, deriveOffsets, getSlotLabelForMode, computeIFSlotTimes, IF_SLOT_IDS } from "./config";
import { Trash2, ChevronLeft, ChevronRight, Pause, Play, Plus, Library, Pencil, MoreHorizontal } from "lucide-react";
import Button from "./components/Button";
import Input from "./components/Input";
import Card from "./components/Card";
import Badge from "./components/Badge";
import Label from "./components/Label";
import Modal from "./components/Modal";
import Popover, { PopoverItem, PopoverSection } from "./components/Popover";
import SidePanel from "./components/SidePanel";
import SettingsScreen from "./components/SettingsScreen";
import { NavigationProvider, useNavigation } from "./lib/navigation";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import ProtocolLibrary from "./components/ProtocolLibrary";
import ProtocolDetailScreen from "./components/ProtocolDetailScreen";
import PatientAnalyticsPanel from "./components/PatientAnalyticsPanel";
import Onboarding from "./components/Onboarding";
import Loader from "./components/Loader";
import InlineLoader from "./components/InlineLoader";
import Auth from "./components/Auth";
import PromptName from "./components/PromptName";
import SlotCard from "./components/SlotCard";
import EditForm from "./components/EditForm";
import Hero from "./components/Hero";
import Sidebar, { AccountAvatar } from "./components/Sidebar";
import PatientRoster from "./components/PatientRoster";
import PatientDetailPanel from "./components/PatientDetailPanel";
import WeekStrip from "./components/WeekStrip";
import InlineTip from "./components/InlineTip";
import LogAtSheet from "./components/LogAtSheet";
import TodayPanel from "./components/TodayPanel";
import InsightsPanel from "./components/InsightsPanel";
import {
  supa, getSession, signInPassword, signUp, signOut, refreshSession,
  dbGetProtocols, dbAddProtocol, dbUpdateProtocol, dbDeleteProtocol,
  dbArchiveProtocol, dbActivateProtocol,
  dbGetSupps, dbAddSupp, dbUpdateSupp, dbDeleteSupp, dbHardDeleteSupp,
  dbGetLog, dbUpsertLog,
  dbGetSchedule, dbSaveSchedule,
  dbUpdateScheduleField,
  dbGetProfile, dbCreateProfile,
  recomputeNotifications,
  dbGetSupplementHistory, dbAddSupplementHistory,
  dbGetDailyLogsRange,
  dbGetMyPatients,
  dbGetPatientLogs,
  dbSendProtocol, dbLookupUserByEmail, dbNotifyProtocolSent,
  dbGetReceivedProtocols,
  dbUpdateProtocolSend,
  dbGetClinicianNote,
  dbUpsertClinicianNote,
  dbGetClinicianNotes,
} from './lib/api';
import { fmtTime, addMins, parseHHMM, dateKey, startOfDay, TODAY, isSupplementActiveOn, isActiveSupp, isPausedSupp } from './lib/time';
import { calculateProtocolAdherence, calculateAdherenceForDate } from './lib/adherence';
import { SLOTS, IF_SLOTS, isPushSupported, needsHomeScreenInstall, getCurrentSubscription, registerServiceWorker, subscribeToPush } from './lib/notifications';
import NotificationPrompt from "./components/NotificationPrompt";
import IFMigrationScreen from "./components/IFMigrationScreen";
import DesignSystemPage from "./components/design-system-page/DesignSystemPage";

// ── Constants ─────────────────────────────────────────────────────────────────

// BG_GRADIENT is derived from theme inside ProtocolApp

// Non-IF core slot IDs. IF uses IF_SLOT_IDS from config.js (mode-aware, filtered by meal_count).
const CORE_SLOTS = ["rx", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

// Day-1 inline tip content keyed by schedule mode. Renders once per user in the
// home empty state then disappears after dismiss (or after the user adds their
// first item, since the empty state stops rendering). No tip for "none" mode —
// there's no scheduling concept to explain.
const DAY1_TIP = {
  medication: {
    label: "how anchors work",
    body: "Each morning, tap \"I took my meds\" to set today's anchor. Origin cascades pre-meal, meal, and evening items from there.",
  },
  wakeup: {
    label: "how anchors work",
    body: "Each morning, tap \"I woke up\" to set today's anchor. Origin cascades pre-meal, meal, and evening items from there.",
  },
  fasting: {
    label: "how your day works",
    body: "Items appear in slots based on your eating window. Origin schedules pre-meal items, meals, and evening items from the window you set.",
  },
  fixed: {
    label: "how your day works",
    body: "Items appear at the fixed times you set in your schedule. Edit them anytime from Settings.",
  },
};

// ANYTIME_SLOT color is set inside ProtocolApp after theme is available






// ── Shared desktop UI helpers ─────────────────────────────────────────────────

function PlaceholderSection({ title, style }) {
  const { theme } = useTheme();
  return (
    <div style={{
      ...style,
      minHeight: 200,
      background: theme.surface.cardSubtle,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      borderRadius: theme.radius.surface,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: typography.label,
      letterSpacing: typography.labelSpacingWide,
      textTransform: 'uppercase',
      color: theme.text.secondary,
      fontFamily: typography.fontBody,
    }}>
      {title}
    </div>
  );
}

// Identity strip rendered in the desktop header when a clinician has a
// patient selected. Externalizes context the clinician was previously
// holding in their head (joined when, how many protocols, last activity).
// Trailing controls (clinician avatar, patient overflow) live alongside in
// App's header row; this block only owns the leading identity stack.
function PatientIdentityBlock({ patient, activeCount, trendLogs, theme }) {
  // Most-recent log date that has any check recorded. log_date is date-only,
  // so the relative phrasing is at day granularity (today / yesterday / Nd ago).
  let lastLog = null;
  for (const l of (trendLogs || [])) {
    if (!l.checked || Object.keys(l.checked).length === 0) continue;
    if (!lastLog || l.log_date > lastLog) lastLog = l.log_date;
  }

  const formatLastLog = (logDate) => {
    if (!logDate) return 'no logs yet';
    const [y, m, d] = logDate.split('-').map(Number);
    const then = new Date(y, m - 1, d);
    then.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((today - then) / 86400000);
    if (days <= 0)  return 'logged today';
    if (days === 1) return 'logged yesterday';
    if (days < 7)   return `logged ${days} days ago`;
    if (days < 30)  return `logged ${Math.floor(days / 7)}w ago`;
    return `logged ${Math.floor(days / 30)}mo ago`;
  };

  const formatJoined = (createdAt) => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const days = Math.round((today - d) / 86400000);
    if (days < 7)  return 'joined this week';
    if (days < 30) return `joined ${Math.floor(days / 7)}w ago`;
    return `joined ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const metaBits = [
    formatJoined(patient.created_at),
    activeCount != null ? `${activeCount} ${activeCount === 1 ? 'protocol' : 'protocols'}` : null,
    formatLastLog(lastLog),
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
      <AccountAvatar displayName={patient.display_name} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
        <span style={{
          fontSize: typography.heading,
          fontWeight: typography.semibold,
          color: theme.text.primary,
          fontFamily: typography.fontHeading,
          letterSpacing: typography.headingLetterSpacing,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {patient.display_name || 'Unnamed patient'}
        </span>
        {metaBits.length > 0 && (
          <span style={{
            fontSize: typography.caption,
            color: theme.text.secondary,
            fontFamily: typography.fontBody,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {metaBits.join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  if (window.location.pathname === '/design') {
    window.location.replace('/design-system');
    return null;
  }

  if (window.location.pathname === '/design-system') {
    return (
      <ThemeProvider>
        <DesignSystemPage />
      </ThemeProvider>
    );
  }

  const loaderRenderTime = useRef(null);
  const [user, setUser]                         = useState(null);
  const [authLoading, setAuthLoading]           = useState(true);
  const [protocolLoading, setProtocolLoading]   = useState(false);
  const token = () => localStorage.getItem("sb_token") || "";

  const isLoading = authLoading || protocolLoading;

  const onLoaderMount = () => {
    if (loaderRenderTime.current === null) loaderRenderTime.current = Date.now();
  };

  const computeRemaining = () =>
    loaderRenderTime.current ? Math.max(0, 3000 - (Date.now() - loaderRenderTime.current)) : 3000;

  useEffect(() => {
    getSession().then(u => {
      if (u) {
        setUser(u);
        setProtocolLoading(true);
        setAuthLoading(false);
      } else {
        setTimeout(() => setAuthLoading(false), computeRemaining());
      }
    });
  }, []);

  const handleProtocolLoadEnd = () => {
    setTimeout(() => setProtocolLoading(false), computeRemaining());
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <NavigationProvider>
          {isLoading && <Loader onMount={onLoaderMount} />}
          {!authLoading && !user && <Auth onSignIn={u => { setUser(u); setProtocolLoading(true); }} />}
          {user && <ProtocolApp user={user} token={token()} onSignOut={() => { signOut(); setUser(null); }} onProtocolLoadEnd={handleProtocolLoadEnd} />}
          <Toast />
        </NavigationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// ── ProtocolApp ───────────────────────────────────────────────────────────────

function ProtocolApp({ user, token, onSignOut, onProtocolLoadEnd }) {
  const { theme, syncFromDB } = useTheme();
  const { screenStack, pushScreen, popScreen, resetStack } = useNavigation();

  // Sync theme from DB once on auth — DB wins over localStorage for cross-device consistency
  useEffect(() => { syncFromDB(user.id, token); }, []);

  // Reset nav stack to home on every sign-in (NavigationProvider survives sign-out,
  // so stale stack would otherwise persist and reopen the last screen)
  useEffect(() => { resetStack(); }, []);
  const ANYTIME_SLOT = { id: "anytime", label: "Anytime", sublabel: "No specific time", icon: "◦", color: theme.text.muted };
  const BG_GRADIENT = theme.gradients.bg;
  const [protocols, setProtocols]           = useState([]);
  // Pending received protocols (peer-to-peer sends not yet stacked/replaced/saved).
  // Drives the Library-icon badge in the mobile top bar.
  const [pendingReceivedCount, setPendingReceivedCount] = useState(0);
  const [supps, setSupps]                   = useState([]);
  const [pillTimes, setPillTimes]           = useState({});
  const [checked, setChecked]               = useState({});
  const [loading, setLoading]               = useState(true);
  const [viewDate, setViewDate]             = useState(TODAY);
  const [editPillTime, setEditPillTime]     = useState(false);
  const [tmpTime, setTmpTime]               = useState("");
  const [formOpen, setFormOpen]             = useState(false);
  const [editingId, setEditingId]           = useState(null);
  const [form, setForm]                     = useState({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", paused: false });
  const [streak, setStreak]                 = useState(0);
  const [flashGreen, setFlashGreen]         = useState(false);
  const [scheduleMode, setScheduleMode]     = useState("none");
  const [scheduleConfig, setScheduleConfig] = useState({
    ...DEFAULT_CONFIG,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times },
  });
  const [anchorBehavior, setAnchorBehavior] = useState("flexible");
  const [consistentTime, setConsistentTime] = useState("07:00");
  const [pendingDeletes, setPendingDeletes] = useState({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profile, setProfile]               = useState(null);
  const [needsNamePrompt, setNeedsNamePrompt] = useState(false);
  const [pastDayEditing, setPastDayEditing]         = useState(false);
  const [needsNotificationPrompt, setNeedsNotificationPrompt] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [submitError, setSubmitError]         = useState(null);
  const [supplementHistory, setSupplementHistory] = useState([]);
  const saveTimer = useRef(null);
  const lastDkRef = useRef(null);
  const pendingSaveRef = useRef(false);
  const lastTzRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Origin ships as a mobile-only personal app on all viewports. The desktop
  // branch below is preserved as dead code; the clinician dashboard work will
  // spin off into a separate product that connects to Origin. See
  // ORIGIN-HANDOFF.md "Parked: Clinician Dashboard". On desktop viewports a
  // CSS phone-frame in index.html constrains the mobile UI to a centered
  // ~440px column instead of stretching across the whole screen.
  const isDesktop = false;
  const [weekLogs, setWeekLogs] = useState([]);
  const [viewedWeekEnd, setViewedWeekEnd] = useState(() => startOfDay(TODAY));
  const [selectedProtocol, setSelectedProtocol]   = useState(null);
  // Log-at sheet target: { sid, suppId, name, dueTime, slotLabel } or null when closed.
  const [logAtTarget, setLogAtTarget]             = useState(null);
  // `activeNavItem` distinguishes the clinician's landing states:
  //   'roster' — default landing for clinicians: Patient Roster (Overview).
  //   'home'   — clicked "My Origin" in the sidebar footer: personal cockpit.
  // Non-clinicians never see the sidebar so this value is inert for them.
  const [activeNavItem, setActiveNavItem]         = useState('roster');
  const [patients, setPatients]                   = useState([]);
  // Per-patient summary stats for the sidebar: { [patientId]: { activeCount,
  // adherence7, adherence30, sparkline (30 daily values 0-100) } }. Fetched
  // lazily after the patients list resolves so the sidebar gains triage
  // signal without blocking initial render.
  const [patientStats, setPatientStats]           = useState({});
  const [selectedPatient, setSelectedPatient]     = useState(null);
  const [patientSupps, setPatientSupps]           = useState([]);
  const [patientProtos, setPatientProtos]         = useState([]);
  const [patientSched, setPatientSched]           = useState(null);
  // 60-day window of the patient's daily_logs — feeds both the 30-day
  // headline trend in PatientDetailPanel and the per-protocol adherence
  // map rendered in the right column. Fetched once in App.jsx so both
  // surfaces share the same source.
  const [patientTrendLogs, setPatientTrendLogs]   = useState([]);
  // Clinician-private notes + archive state for the selected patient.
  // Lives in clinician_patient_notes (RLS-restricted to owning clinician).
  const [patientNote, setPatientNote]             = useState(null);
  // Set of patient ids the clinician has archived. Sidebar filters them
  // out of the main Patients list and surfaces them in a separate
  // Archived section. Loaded once for the clinician + bumped after
  // archive/un-archive actions.
  const [archivedPatientIds, setArchivedPatientIds] = useState(new Set());
  const [patientActionsOpen, setPatientActionsOpen]     = useState(false);
  // Anchor element captured at click time so the Popover can render under the
  // trigger button. Stored as state (not ref) because the trigger lives in
  // a child component (ProtocolLibrary) for sendToPatientAnchor.
  const [patientActionsAnchor, setPatientActionsAnchor] = useState(null);
  const [sendToPatientPickerOpen, setSendToPatientPickerOpen] = useState(false);
  const [sendToPatientAnchor, setSendToPatientAnchor]   = useState(null);
  const [confirmArchivePatient, setConfirmArchivePatient]     = useState(false);
  // When true, the patient-view ProtocolLibrary opens its internal
  // new-protocol create modal; on successful creation we auto-send the
  // result to the currently-selected patient.
  const [createForPatientOpen, setCreateForPatientOpen]       = useState(false);
  const [needsIFMigration, setNeedsIFMigration]   = useState(false);
  const { show: showToast } = useToast();

  const isClinician = profile?.is_clinician === true;

  useEffect(() => {
    if (!isClinician || !user?.id || !token) return;
    dbGetMyPatients(user.id, token).catch(() => []).then(rows => setPatients(rows || []));
    // Load the clinician's notes/archive rows so the sidebar can sort
    // patients into Active vs Archived sections.
    dbGetClinicianNotes(user.id, token).catch(() => []).then(rows => {
      const archived = new Set();
      for (const r of (rows || [])) {
        if (r.archived_at) archived.add(r.patient_id);
      }
      setArchivedPatientIds(archived);
    });
  }, [isClinician, user?.id]);

  // Enrich each patient with 30-day adherence trend + counts so the sidebar
  // can render rich rows (avatar + name + adherence% + sparkline + status).
  // Fires after `patients` resolves; runs in parallel per-patient. Stats
  // populate progressively as fetches complete. Selecting a patient does
  // NOT re-trigger — those fetches live elsewhere for the detail view.
  useEffect(() => {
    if (!isClinician || !token || patients.length === 0) return;
    const today    = startOfDay(new Date());
    const startKey = dateKey(new Date(today.getTime() - 29 * 86400000));
    const endKey   = dateKey(today);
    let cancelled = false;

    patients.forEach((p) => {
      Promise.all([
        dbGetProtocols(p.id, token).catch(() => []),
        dbGetSupps(p.id, token).catch(() => []),
        dbGetSchedule(p.id, token).catch(() => null),
        dbGetPatientLogs(p.id, startKey, endKey, token).catch(() => []),
      ]).then(([protos, supps, sched, logs]) => {
        if (cancelled) return;
        const activeCount = (protos || []).filter(pr => pr.status === 'active').length;
        // activeSlotIds for this patient's schedule mode — IF v2 has its own slot vocab.
        const mode = sched?.schedule_type || 'none';
        const cfg  = { ...DEFAULT_CONFIG, ...(sched?.offsets || {}) };
        const mc   = cfg.meal_count || 3;
        const slotList = mode === 'fasting'
          ? IF_SLOTS.filter(s => {
              if (s.id === 'pre_meal_2' || s.id === 'meal_2') return mc >= 2;
              if (s.id === 'pre_meal_3' || s.id === 'meal_3') return mc >= 3;
              if (s.id === 'evening')                          return !!cfg.evening_mode;
              return true;
            })
          : SLOTS;
        const slotIds = new Set(slotList.map(s => s.id));
        // Map logs by date for fast lookup
        const logMap = {};
        for (const l of (logs || [])) logMap[l.log_date] = l;
        // Compute 30 daily values, oldest → newest
        const sparkline = [];
        for (let off = 29; off >= 0; off--) {
          const d  = new Date(today.getTime() - off * 86400000);
          const dk = dateKey(d);
          sparkline.push(calculateAdherenceForDate(d, supps || [], logMap[dk] || null, slotIds));
        }
        // 7d and 30d averages from the sparkline (drop nulls just in case)
        const avg = (arr) => {
          const v = arr.filter(x => x != null);
          return v.length === 0 ? null : Math.round(v.reduce((a, b) => a + b, 0) / v.length);
        };
        // Most-recent log_date with any check recorded — drives the
        // "Last log" column in the roster + the patient identity meta line.
        let lastLogDate = null;
        for (const l of (logs || [])) {
          if (!l.checked || Object.keys(l.checked).length === 0) continue;
          if (!lastLogDate || l.log_date > lastLogDate) lastLogDate = l.log_date;
        }
        const stats = {
          activeCount,
          adherence7:  avg(sparkline.slice(-7)),
          adherence30: avg(sparkline),
          sparkline,
          lastLogDate,
        };
        setPatientStats(prev => ({ ...prev, [p.id]: stats }));
      });
    });

    return () => { cancelled = true; };
  }, [isClinician, token, patients]);

  // Fetch the selected patient's supplements, protocols, schedule, and a
  // 60-day window of daily_logs once when they're selected. Both the cockpit
  // (PatientDetailPanel) and the right column (ProtocolLibrary in patient
  // mode) read from this shared state, so the two surfaces never disagree
  // and the per-protocol adherence map is derived from a single source.
  useEffect(() => {
    if (!selectedPatient?.id || !token) {
      setPatientSupps([]);
      setPatientProtos([]);
      setPatientSched(null);
      setPatientTrendLogs([]);
      setPatientNote(null);
      return;
    }
    const today = startOfDay(new Date());
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 59);
    Promise.all([
      dbGetSupps(selectedPatient.id, token).catch(() => []),
      dbGetProtocols(selectedPatient.id, token).catch(() => []),
      dbGetSchedule(selectedPatient.id, token).catch(() => null),
      dbGetPatientLogs(selectedPatient.id, dateKey(windowStart), dateKey(today), token).catch(() => []),
      dbGetClinicianNote(user.id, selectedPatient.id, token).catch(() => null),
    ]).then(([supps, protos, sched, logs, note]) => {
      setPatientSupps(supps || []);
      setPatientProtos(protos || []);
      setPatientSched(sched || null);
      setPatientTrendLogs(logs || []);
      setPatientNote(note);
    });
  }, [selectedPatient?.id, token]);

  // Save clinician note text for the currently-selected patient. Optimistic:
  // updates local state immediately, persists in background. Returns the
  // upserted row so the caller can capture archived_at + timestamps too.
  // Also keeps the sidebar's archived-set in sync.
  const saveClinicianNote = async (partial) => {
    if (!selectedPatient?.id || !token || !user?.id) return null;
    const merged = {
      clinician_id: user.id,
      patient_id:   selectedPatient.id,
      notes:        partial.notes ?? patientNote?.notes ?? '',
      archived_at:  partial.archived_at !== undefined ? partial.archived_at : (patientNote?.archived_at ?? null),
    };
    setPatientNote(prev => ({ ...(prev || {}), ...merged }));
    // Reflect archive change in the sidebar's filter immediately.
    if (partial.archived_at !== undefined) {
      setArchivedPatientIds(prev => {
        const next = new Set(prev);
        if (partial.archived_at) next.add(selectedPatient.id);
        else                     next.delete(selectedPatient.id);
        return next;
      });
    }
    try {
      const result = await dbUpsertClinicianNote(merged, token);
      const row = Array.isArray(result) ? result[0] : result;
      if (row) setPatientNote(row);
      return row;
    } catch (e) {
      console.warn('saveClinicianNote failed', e);
      return null;
    }
  };

  // Un-archive a specific patient (only invoked from the Archived section
  // in the sidebar — clears archived_at and brings them back to the main
  // list). Bypasses saveClinicianNote because that one is scoped to the
  // currently-selected patient.
  const unarchivePatient = async (patientId) => {
    if (!user?.id || !token) return;
    setArchivedPatientIds(prev => {
      const next = new Set(prev);
      next.delete(patientId);
      return next;
    });
    try {
      await dbUpsertClinicianNote({
        clinician_id: user.id,
        patient_id:   patientId,
        notes:        '', // safe — merge will preserve existing notes
        archived_at:  null,
      }, token);
    } catch (e) { console.warn('unarchivePatient failed', e); }
  };

  // Split patients into Active vs Archived for the sidebar.
  const activePatients   = patients.filter(p => !archivedPatientIds.has(p.id));
  const archivedPatients = patients.filter(p =>  archivedPatientIds.has(p.id));

  // Derive the patient's active slot ids (IF v2 vs standard) and the per-
  // protocol adherence map. Both feed the right-column ProtocolLibrary and
  // the patient cockpit.
  const patientActiveSlotIds = (() => {
    const mode = patientSched?.schedule_type || 'none';
    const cfg  = { ...DEFAULT_CONFIG, ...(patientSched?.offsets || {}) };
    const mc   = cfg.meal_count || 3;
    const list = mode === 'fasting'
      ? IF_SLOTS.filter(s => {
          if (s.id === 'pre_meal_2' || s.id === 'meal_2') return mc >= 2;
          if (s.id === 'pre_meal_3' || s.id === 'meal_3') return mc >= 3;
          if (s.id === 'evening')                          return !!cfg.evening_mode;
          return true;
        })
      : SLOTS;
    return new Set(list.map(s => s.id));
  })();

  const patientProtocolAdherence = (() => {
    if (!selectedPatient || patientProtos.length === 0) return null;
    const map = {};
    for (const p of patientProtos) {
      if (p.status !== 'active') continue;
      map[p.id] = calculateProtocolAdherence(p, patientSupps, patientTrendLogs, patientActiveSlotIds, 30);
    }
    return map;
  })();

  // IF is absolute-time (not anchor-relative) — handled by computeIFSlotTimes in getSlotTime.
  const slotOffsets   = (scheduleMode === "fixed" || scheduleMode === "fasting") ? null : deriveOffsets(scheduleMode, scheduleConfig);
  const visibleSupps  = supps.filter(s => !pendingDeletes[s.id]);
  const activeProtocolIds = new Set(protocols.filter(p => p.status === 'active').map(p => p.id));
  const homeSupps     = visibleSupps.filter(s => isActiveSupp(s) && isSupplementActiveOn(s, viewDate) && (!s.protocol_id || activeProtocolIds.has(s.protocol_id)));

  const dk         = dateKey(viewDate);
  const isToday    = dateKey(viewDate) === dateKey(TODAY);
  const isFuture   = startOfDay(viewDate) > TODAY;
  const isPast     = !isToday && startOfDay(viewDate) < TODAY;
  const isReadOnly = isPast && !pastDayEditing;
  const pillTime   = pillTimes[dk] || null;
  const viewDay    = viewDate.getDay();
  // Day 1 = the user's profile was created today. Triggers the home-screen
  // inline tip in the empty state to teach the schedule mental model in context.
  const isDay1 = !!profile?.created_at && dateKey(new Date(profile.created_at)) === dateKey(TODAY);

  // fixed mode: always active; consistent mode: pre-populate with set time
  const effectivePillTime = scheduleMode === "fixed"
    ? (pillTime || "00:00")
    : anchorBehavior === "consistent"
      ? (pillTime || consistentTime)
      : pillTime;

  // Register service worker early so it's ready to receive pushes
  useEffect(() => { registerServiceWorker().catch(() => {}); }, []);

  // Recompute notifications when the user returns to the app in a different timezone
  // and refresh the pending-received-protocols count (in case a peer sent one
  // while the app was backgrounded).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (currentTz !== lastTzRef.current) {
        lastTzRef.current = currentTz;
        recomputeNotifications(token);
      }
      if (user?.id) {
        dbGetReceivedProtocols(user.id, token)
          .then(rows => setPendingReceivedCount((rows || []).length))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [token, user?.id]);

  // Desktop resize listener removed — isDesktop is now a hard-coded false
  // (mobile-only product, see comment at declaration). Re-introduce if/when
  // desktop is reactivated.

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [protos, s, log, sched, prof, histRows, received] = await Promise.all([
          dbGetProtocols(user.id, token).catch(() => []),
          dbGetSupps(user.id, token),
          dbGetLog(user.id, dk, token),
          dbGetSchedule(user.id, token),
          dbGetProfile(user.id, token).catch(() => null),
          dbGetSupplementHistory(user.id, token).catch(() => []),
          dbGetReceivedProtocols(user.id, token).catch(() => []),
        ]);
        setProtocols(protos || []);
        setPendingReceivedCount((received || []).length);
        setSupplementHistory((histRows || []).map(r => r.name));
        setProfile(prof);
        if (prof === null) setNeedsNamePrompt(true);
        // IF v2 users have already had `fasted` renamed to mean something else (pre-window slot).
        // Guard the old fasted→pre_breakfast migration so it doesn't fire for v2 users.
        const isIFv2 = sched?.schedule_type === "fasting" && !!sched?.offsets?._if_v2_migrated;
        const migrated = [];
        const toWrite  = [];
        for (const supp of (s || [])) {
          let out = supp;
          // Only apply old fasted→pre_breakfast rename for pre-v2 IF users.
          if (!isIFv2 && out.slots?.includes("fasted")) {
            out = { ...out, slots: out.slots.map(sl => sl === "fasted" ? "pre_breakfast" : sl) };
          }
          if (out.slots?.some(sl => sl === "injectable" || sl === "topical")) {
            out = { ...out, slots: out.slots.filter(sl => sl !== "injectable" && sl !== "topical") };
          }
          if (sched?.schedule_type === "fasting" && !isIFv2 && out.slots?.includes("rx")) {
            out = { ...out, slots: out.slots.filter(sl => sl !== "rx") };
          }
          migrated.push(out);
          if (out !== supp) toWrite.push(out);
        }
        setSupps(migrated.map(s => ({ ...s, paused: s.paused ?? false })));
        for (const supp of toWrite) {
          try { await dbUpdateSupp(supp, token); } catch (e) { console.warn("Migration write failed for", supp.id, e); }
        }
        if (log?.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0, 5) }));
        if (log?.checked)   setChecked(log.checked);
        if (sched?.schedule_type) setScheduleMode(sched.schedule_type);

        let behavior = "flexible";
        let cTime    = "07:00";
        if (sched?.offsets) {
          const { _anchor_behavior, _consistent_time, ...savedConfig } = sched.offsets;
          if (_anchor_behavior) { behavior = _anchor_behavior; setAnchorBehavior(_anchor_behavior); }
          if (_consistent_time) { cTime = _consistent_time;   setConsistentTime(_consistent_time); }
          setScheduleConfig({
            ...DEFAULT_CONFIG,
            ...savedConfig,
            fixed_times: { ...DEFAULT_CONFIG.fixed_times, ...(savedConfig.fixed_times || {}) },
          });
        }

        if (!sched) setNeedsOnboarding(true);

        // Trigger IF v2 migration screen for existing IF users who haven't migrated yet.
        if (sched?.schedule_type === "fasting" && !isIFv2) setNeedsIFMigration(true);

        // auto-set pill time for consistent mode if not already logged today
        if (behavior === "consistent" && !log?.pill_time) {
          setPillTimes(pt => ({ ...pt, [dk]: cTime }));
        }
      } catch (e) {
        console.error("Initial load failed:", e);
      } finally {
        setLoading(false);
        onProtocolLoadEnd();
      }
    })();
  }, [token]);

  // Auto-set pill time when switching to consistent mode or when date changes
  useEffect(() => {
    if (loading || anchorBehavior !== "consistent" || !isToday || pillTimes[dk]) return;
    setPillTimes(pt => ({ ...pt, [dk]: consistentTime }));
  }, [anchorBehavior, consistentTime, dk, loading, isToday]);

  // Load log when date changes
  useEffect(() => {
    if (loading) return;
    dbGetLog(user.id, dk, token).then(log => {
      if (!log) return;
      if (log.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0, 5) }));
      if (log.checked)   setChecked(c => ({ ...c, ...log.checked }));
    }).catch(e => console.error(e));
  }, [dk]);

  // Load week logs for the week strip (mobile + desktop) + pre-populate past day state.
  // Week strip ships on both surfaces as of Session 1 (mobile audit).
  useEffect(() => {
    if (loading) return;
    const start = dateKey(viewedWeekStart);
    const end = dateKey(viewedWeekEnd);
    dbGetDailyLogsRange(user.id, start, end, token).then(rows => {
      setWeekLogs(rows || []);
      const mergedChecked = {};
      const mergedPillTimes = {};
      for (const row of (rows || [])) {
        if (row.checked) Object.assign(mergedChecked, row.checked);
        if (row.pill_time) mergedPillTimes[row.log_date] = row.pill_time.slice(0, 5);
      }
      if (Object.keys(mergedChecked).length > 0) setChecked(c => ({ ...c, ...mergedChecked }));
      if (Object.keys(mergedPillTimes).length > 0) setPillTimes(pt => ({ ...pt, ...mergedPillTimes }));
    }).catch(e => console.error('Week logs fetch failed:', e));
  }, [viewedWeekEnd, loading]);

  // Keep weekLogs in sync with checked state so rings update immediately after toggling
  useEffect(() => {
    const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk + '_')));
    setWeekLogs(prev => {
      const idx = prev.findIndex(l => l.log_date === dk);
      if (idx < 0) {
        return Object.keys(dayChecked).length > 0
          ? [...prev, { log_date: dk, checked: dayChecked }]
          : prev;
      }
      const updated = [...prev];
      updated[idx] = { ...updated[idx], checked: dayChecked };
      return updated;
    });
  }, [checked, dk]);

  // Auto-save — skip on read-only past days to avoid overwriting history with empty state.
  // When the viewed day changes mid-debounce, flush the previous day's pending save
  // immediately so rapid-toggle-then-navigate doesn't drop check edits.
  useEffect(() => {
    if (loading) return;
    if (lastDkRef.current && lastDkRef.current !== dk && pendingSaveRef.current) {
      const oldDk = lastDkRef.current;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const pt = pillTimes[oldDk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(oldDk)));
      dbUpsertLog({ user_id: user.id, log_date: oldDk, pill_time: pt || null, checked: dayChecked }, token).catch(() => showToast("Couldn't save check — try again"));
      pendingSaveRef.current = false;
    }
    lastDkRef.current = dk;
    if (isPast && !pastDayEditing) return;
    clearTimeout(saveTimer.current);
    pendingSaveRef.current = true;
    saveTimer.current = setTimeout(() => {
      const pt = pillTimes[dk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk)));
      dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: pt || null, checked: dayChecked }, token).catch(() => showToast("Couldn't save check — try again"));
      pendingSaveRef.current = false;
    }, 200);
  }, [checked, pillTimes, dk, loading, isPast, pastDayEditing]);

  // Streak — count consecutive days where every active supplement has all its
  // expected checks (slotted entries by (date,slot,supp) and anytime entries by
  // (date,'anytime',supp)). Iterating per supplement avoids assuming any fixed
  // slot set (works for IF v2 slots and anytime supps alike).
  useEffect(() => {
    let s = 0; const d = new Date(TODAY);
    for (let i = 0; i < 30; i++) {
      const ddk = dateKey(d);
      const pt  = pillTimes[ddk];
      if (!pt && scheduleMode !== "fixed" && scheduleMode !== "fasting" && scheduleMode !== "none" && anchorBehavior !== "consistent") break;
      const day = d.getDay();
      const daySupps = supps.filter(x => isActiveSupp(x) && x.days.includes(day));
      if (daySupps.length === 0) break;
      const allDone = daySupps.every(x => {
        if (!x.slots || x.slots.length === 0) return !!checked[`${ddk}_anytime_${x.id}`];
        return x.slots.every(sid => !!checked[`${ddk}_${sid}_${x.id}`]);
      });
      if (!allDone) break;
      s++; d.setDate(d.getDate() - 1);
    }
    setStreak(s);
  }, [checked, pillTimes, supps, scheduleMode, anchorBehavior]);

  const viewedWeekStart = new Date(viewedWeekEnd);
  viewedWeekStart.setDate(viewedWeekStart.getDate() - 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const canNavigateNext = dateKey(viewedWeekEnd) < dateKey(TODAY);

  const handlePrevWeek = () => setViewedWeekEnd(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() - 7);
    return d;
  });
  const handleNextWeek = () => setViewedWeekEnd(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + 7);
    const todayCap = startOfDay(TODAY);
    return d > todayCap ? todayCap : d;
  });

  const setPillForDay = (t) => {
    setPillTimes(pt => ({ ...pt, [dk]: t }));
    recomputeNotifications(token);
  };

  const getSlotTime = (sid) => {
    if (scheduleMode === "fixed") {
      if (sid === "pre_breakfast" || sid === "pre_lunch" || sid === "pre_dinner") {
        const mealId = sid.replace("pre_", "");
        const mealTime = scheduleConfig.fixed_times?.[mealId];
        if (!mealTime) return null;
        return addMins(parseHHMM(mealTime), -(scheduleConfig.pre_meal_window ?? 0));
      }
      const ft = scheduleConfig.fixed_times?.[sid];
      return ft ? parseHHMM(ft) : null;
    }
    // IF v2: absolute slot times derived from eating_window_start config.
    if (scheduleMode === "fasting") {
      if (sid === "evening") {
        const em = scheduleConfig.evening_mode;
        if (em === "fixed" && scheduleConfig.evening_time) return parseHHMM(scheduleConfig.evening_time);
        if (em === "before_sleep" && scheduleConfig.sleep_time) {
          const offsetMins = (scheduleConfig.evening_offset_hours ?? 1) * 60 + (scheduleConfig.evening_offset_minutes ?? 0);
          return addMins(parseHHMM(scheduleConfig.sleep_time), -offsetMins);
        }
        return null;
      }
      const ifTimes = computeIFSlotTimes(scheduleConfig);
      const t = ifTimes[sid];
      return t ? parseHHMM(t) : null;
    }
    // Evening bucket — absolute time, independent of anchor (medication/wakeup only)
    if (sid === "after_dinner" && (scheduleMode === "medication" || scheduleMode === "wakeup") && scheduleConfig.evening_mode !== undefined) {
      const em = scheduleConfig.evening_mode;
      if (em === "fixed" && scheduleConfig.evening_time) return parseHHMM(scheduleConfig.evening_time);
      if (em === "before_sleep" && scheduleConfig.sleep_time) {
        const offsetMins = (scheduleConfig.evening_offset_hours ?? 1) * 60 + (scheduleConfig.evening_offset_minutes ?? 0);
        return addMins(parseHHMM(scheduleConfig.sleep_time), -offsetMins);
      }
      return null;
    }
    if (!effectivePillTime) return null;
    if (sid === "rx") return parseHHMM(effectivePillTime);
    const offset = slotOffsets?.[sid];
    if (offset === null || offset === undefined) return null;
    return addMins(parseHHMM(effectivePillTime), offset);
  };

  const slotTimeStr     = (sid) => { const t = getSlotTime(sid); return t ? fmtTime(t) : "--:--"; };
  // Schema: an entry in `checked` can be:
  //   true                              — legacy on-time check (pre-Session 5)
  //   false / undefined                 — unchecked
  //   { checked: boolean, at?: "HH:MM" } — new shape, captures actual log time
  //                                        for late or retro logs
  // Read helpers treat both shapes as equivalent for the boolean check.
  const checkValue      = (sid, suppId) => checked[`${dk}_${sid}_${suppId}`];
  const isChecked       = (sid, suppId) => {
    const v = checkValue(sid, suppId);
    if (v === true) return true;
    if (v && typeof v === "object" && v.checked) return true;
    return false;
  };
  const checkedAtTime   = (sid, suppId) => {
    const v = checkValue(sid, suppId);
    return v && typeof v === "object" ? v.at || null : null;
  };
  const toggleCheck     = (sid, suppId) => {
    if (isReadOnly) return;
    const k = `${dk}_${sid}_${suppId}`;
    setChecked(c => {
      const nextChecked = !isChecked(sid, suppId);
      // Toggling off — remove the entry entirely (cleaner persistence than `false`).
      if (!nextChecked) {
        const { [k]: _omit, ...rest } = c;
        return rest;
      }
      // Toggling on — preserve any prior `at` timestamp the user set via log-at.
      const prev = c[k];
      const prevAt = prev && typeof prev === "object" ? prev.at : null;
      return { ...c, [k]: prevAt ? { checked: true, at: prevAt } : true };
    });
  };
  // Explicit log-at-time: stamps the entry with a specific time and marks checked.
  const logCheckAt      = (sid, suppId, atTime) => {
    if (isReadOnly) return;
    const k = `${dk}_${sid}_${suppId}`;
    setChecked(c => ({ ...c, [k]: { checked: true, at: atTime } }));
  };
  // Bulk-complete all incomplete supps in a slot (Session 6 / D3 — take-all).
  // Preserves any prior `at` timestamps that were set via log-at. Skips supps
  // that are already checked. No-op on read-only days.
  const takeAllInSlot   = (sid, supps) => {
    if (isReadOnly) return;
    setChecked(c => {
      const next = { ...c };
      for (const supp of supps) {
        const k = `${dk}_${sid}_${supp.id}`;
        const prev = next[k];
        const alreadyChecked = prev === true || (prev && typeof prev === "object" && prev.checked);
        if (alreadyChecked) continue;
        const prevAt = prev && typeof prev === "object" ? prev.at : null;
        next[k] = prevAt ? { checked: true, at: prevAt } : true;
      }
      return next;
    });
  };
  const getSuppsForSlot = (sid) => homeSupps.filter(s => s.slots.includes(sid) && s.days.includes(viewDay));

  const startDay = () => {
    if (isFuture) return;
    const t = fmtTime(new Date());
    setPillForDay(t);
    if (scheduleMode !== "wakeup") {
      const rxSupps = homeSupps.filter(s => s.slots.includes("rx") && s.days.includes(viewDay));
      setChecked(c => { const n = { ...c }; rxSupps.forEach(s => { n[`${dk}_rx_${s.id}`] = true; }); return n; });
    }
    setFlashGreen(true); setTimeout(() => setFlashGreen(false), 600);
  };

  const slotStatus = (sid) => {
    if (isFuture) return "future";
    const t = getSlotTime(sid); if (!t) return "future";
    const sl = getSuppsForSlot(sid);
    if (sl.length > 0 && sl.every(s => isChecked(sid, s.id))) return "done";
    if (!isToday) return "missed";
    const diff = (new Date() - t) / 60000;
    if (diff > 15) return "missed"; if (diff > -5) return "now"; return "future";
  };

  // For IF mode, core slots are the active IF slot IDs filtered by meal_count.
  const mealCount = scheduleConfig.meal_count ?? 3;
  const coreSlotIds = scheduleMode === "fasting"
    ? [
        "fasted", "meal_1",
        ...(mealCount >= 2 ? ["pre_meal_2", "meal_2"] : []),
        ...(mealCount >= 3 ? ["pre_meal_3", "meal_3"] : []),
        ...(scheduleConfig.evening_mode ? ["evening"] : []),
      ]
    : CORE_SLOTS;

  const anytimeSupps = homeSupps.filter(s => s.slots.length === 0 && s.days.includes(viewDay));
  let coreTotal = anytimeSupps.length, coreDone = 0;
  anytimeSupps.forEach(s => { if (isChecked("anytime", s.id)) coreDone++; });
  coreSlotIds.forEach(sid => {
    const sl = getSuppsForSlot(sid);
    coreTotal += sl.length;
    sl.forEach(s => { if (isChecked(sid, s.id)) coreDone++; });
  });
  const pct = coreTotal > 0 ? Math.round((coreDone / coreTotal) * 100) : 0;

  let nextFixedSlot = null;
  if (scheduleMode === "fixed" && isToday) {
    const now = new Date();
    let earliest = null;
    for (const sid of CORE_SLOTS) {
      if (getSuppsForSlot(sid).length === 0) continue;
      const t = getSlotTime(sid);
      if (!t || t <= now) continue;
      if (!earliest || t < earliest.t) earliest = { t, sid };
    }
    if (earliest) {
      nextFixedSlot = {
        time: slotTimeStr(earliest.sid),
        label: SLOTS.find(s => s.id === earliest.sid)?.label ?? earliest.sid,
      };
    }
  }

  const blankForm = (protocol_id = null) => ({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", paused: false, status: 'active', protocol_id, treatment_mode: "indefinite", starts_at: null, ends_at: null, cycle_on_value: null, cycle_on_unit: null, cycle_off_value: null, cycle_off_unit: null });

  const openAdd   = () => {
    const active = protocols.filter(p => p.status === 'active');
    setEditingId(null);
    setForm(blankForm(active.length === 1 ? active[0].id : null));
    setSubmitError(null);
    setFormOpen(true);
  };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...(supp.slots || [])], days: [...(supp.days || [])], category: supp.category || "Oral", paused: supp.paused ?? false, status: supp.status ?? 'active', protocol_id: supp.protocol_id || null, treatment_mode: supp.treatment_mode || "indefinite", starts_at: supp.starts_at || null, ends_at: supp.ends_at || null, cycle_on_value: supp.cycle_on_value || null, cycle_on_unit: supp.cycle_on_unit || null, cycle_off_value: supp.cycle_off_value || null, cycle_off_unit: supp.cycle_off_unit || null }); setSubmitError(null); setFormOpen(true); };

  // Log-at sheet helpers — opens the time-picker sheet for a specific
  // (slot, supplement) pair and writes the picked time to the daily log.
  const openLogAt = (sid, supp, slotLabel) => {
    if (isReadOnly) return;
    setLogAtTarget({
      sid,
      suppId: supp.id,
      name: supp.name,
      dueTime: slotTimeStr(sid),
      slotLabel: slotLabel || null,
    });
  };
  const submitLogAt = (atTime) => {
    if (!logAtTarget) return;
    logCheckAt(logAtTarget.sid, logAtTarget.suppId, atTime);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const openAddToProtocol = (protocol) => {
    setEditingId(null);
    setForm(blankForm(protocol.id));
    setSubmitError(null);
    setFormOpen(true);
  };

  // Fire-and-forget notif recompute that surfaces failures as a toast instead
  // of silently swallowing them. Used by every recompute trigger that follows
  // a user action; TZ-change recomputes stay silent.
  const recomputeWithToast = () => {
    recomputeNotifications(token).then(ok => {
      if (!ok) showToast("Notifications didn't update — try again later");
    });
  };

  const submitForm = async () => {
    if (!form.name.trim() || submitting) return;
    const txMode = form.treatment_mode || "indefinite";
    if (txMode === "scheduled") {
      if (!form.starts_at || !form.ends_at) { setSubmitError("Start and end dates are required for a scheduled course"); return; }
      if (form.ends_at <= form.starts_at)   { setSubmitError("End date must be after start date"); return; }
    }
    if (txMode === "cycled") {
      if (!form.starts_at)                                          { setSubmitError("Start date is required for a cycled treatment"); return; }
      if (!form.cycle_on_value  || form.cycle_on_value  <= 0)       { setSubmitError("On duration must be greater than 0"); return; }
      if (!form.cycle_off_value || form.cycle_off_value <= 0)       { setSubmitError("Off duration must be greater than 0"); return; }
      if (form.ends_at && form.ends_at <= form.starts_at)           { setSubmitError("End date must be after start date"); return; }
    }
    setSubmitting(true);
    setSubmitError(null);
    const cat = form.category || "Oral";
    const finalDays = form.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : form.days;
    const txFields = {
      treatment_mode:  txMode,
      starts_at:       txMode === "indefinite" ? null : (form.starts_at || null),
      ends_at:         txMode === "indefinite" ? null : (form.ends_at   || null),
      cycle_on_value:  txMode === "cycled" ? (form.cycle_on_value  || null) : null,
      cycle_on_unit:   txMode === "cycled" ? (form.cycle_on_unit   || (form.cycle_on_value  ? "days" : null)) : null,
      cycle_off_value: txMode === "cycled" ? (form.cycle_off_value || null) : null,
      cycle_off_unit:  txMode === "cycled" ? (form.cycle_off_unit  || (form.cycle_off_value ? "days" : null)) : null,
    };
    try {
      if (editingId) {
        await dbUpdateSupp({ ...form, days: finalDays, category: cat, id: editingId, ...txFields }, token);
        setSupps(s => s.map(x => x.id === editingId ? { ...form, days: finalDays, category: cat, id: editingId, ...txFields } : x));
        showToast(`Updated ${form.name}`);
      } else {
        const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: finalDays, category: cat, paused: false, status: 'active', stopped_at: null, user_id: user.id, protocol_id: form.protocol_id || null, ...txFields }, token);
        if (rows?.[0]) setSupps(s => [...s, rows[0]]);
        showToast(`Added ${form.name}`);
        const savedName = form.name.trim();
        if (savedName) {
          setSupplementHistory(h => h.includes(savedName) ? h : [savedName, ...h]);
          dbAddSupplementHistory(user.id, savedName, token).catch(() => {});
        }
      }
      recomputeWithToast();
      closeForm();
    } catch (err) {
      setSubmitError("Couldn't save — try again");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSupp = async () => {
    if (!editingId) return;
    const supp = supps.find(s => s.id === editingId);
    if (!supp) return;
    try {
      await dbDeleteSupp(editingId, token);
      setSupps(s => s.filter(x => x.id !== editingId));
      closeForm();
      showToast(`Deleted ${supp.name}`);
    } catch (err) {
      showToast("Couldn't delete — try again");
      console.error(err);
    }
  };

  const deleteSuppById = async (suppId) => {
    const supp = supps.find(s => s.id === suppId);
    if (!supp) return;
    try {
      await dbDeleteSupp(suppId, token);
      setSupps(s => s.filter(x => x.id !== suppId));
      showToast(`Deleted ${supp.name}`);
    } catch (err) {
      showToast("Couldn't delete — try again");
      console.error(err);
    }
  };

  const resumeSupp = async (supp) => {
    try {
      const updated = { ...supp, status: 'active', paused: false };
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === supp.id ? updated : x));
      showToast(`${supp.name} resumed`);
    } catch (err) {
      showToast(`Couldn't resume ${supp.name}. Try again.`);
      console.error(err);
    }
  };

  const saveSchedule = async (mode, config, behavior, cTime) => {
    // IF uses absolute-time scheduling — no anchor behavior or consistent time needed.
    const offsets = mode === "fasting"
      ? { ...config }
      : { ...config, _anchor_behavior: behavior, _consistent_time: cTime };
    try {
      await dbSaveSchedule({ user_id: user.id, schedule_type: mode, offsets }, token);
      setScheduleMode(mode);
      setScheduleConfig(config);
      setAnchorBehavior(behavior);
      setConsistentTime(cTime);

      // Switching to flexible: clear today's pre-populated pill_time so the
      // "Start my day" CTA reappears — but only if the user hasn't checked
      // anything off yet (checked entries = real logged data, don't touch those).
      if (behavior === "flexible" && isToday) {
        const hasAnyChecks = Object.values(checked[dk] || {}).some(v => v === true);
        if (!hasAnyChecks) {
          setPillTimes(pt => { const next = { ...pt }; delete next[dk]; return next; });
          dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: null, checked: {} }, token)
            .catch(e => console.error("Failed to clear log pill_time:", e));
        }
      }

      // Switching to consistent: pre-populate today's pill_time with the set time.
      if (behavior === "consistent" && isToday && cTime) {
        setPillTimes(pt => ({ ...pt, [dk]: cTime }));
      }

      recomputeWithToast();
    } catch (err) {
      showToast("Couldn't save — try again");
      console.error(err);
      return false;
    }
    return true;
  };

  const togglePause = async (supp) => {
    const wasPaused = isPausedSupp(supp);
    const updated = { ...supp, status: wasPaused ? 'active' : 'paused', paused: !wasPaused };
    try {
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === supp.id ? updated : x));
      showToast(wasPaused ? `Resumed ${supp.name}` : `Paused ${supp.name}`);
      recomputeWithToast();
    } catch (err) {
      showToast("Couldn't update — try again");
      console.error(err);
      return false;
    }
    return true;
  };

  // ── Protocol actions ─────────────────────────────────────────────────────
  const addProtocol = async (data, intent = 'stack') => {
    try {
      const status = intent === 'save_later' ? 'archived' : 'active';
      let archivedNames = '';
      if (intent === 'replace') {
        const activeProtos = protocols.filter(p => p.status === 'active');
        archivedNames = activeProtos.map(p => p.name).join(', ');
        await Promise.all(activeProtos.map(p => dbArchiveProtocol(p.id, token)));
        setProtocols(prev => prev.map(p => p.status === 'active' ? { ...p, status: 'archived' } : p));
        const archivedIds = new Set(activeProtos.map(p => p.id));
        setSupps(s => s.map(x => archivedIds.has(x.protocol_id) ? { ...x, status: 'active', paused: false } : x));
      }
      const rows = await dbAddProtocol({ ...data, status, user_id: user.id }, token);
      if (rows?.[0]) setProtocols(p => [...p, rows[0]]);
      const suffix = intent === 'replace' && archivedNames ? ` · ${archivedNames} archived` : '';
      showToast(`${data.name} created${suffix}`);
      return rows?.[0] ?? null;
    } catch (err) { showToast("Couldn't create protocol. Try again."); console.error(err); return null; }
  };

  const updateProtocol = async (protocol) => {
    try {
      await dbUpdateProtocol(protocol, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? protocol : x));
    } catch (err) { showToast("Couldn't save. Try again."); console.error(err); }
  };

  const archiveProtocol = async (protocol) => {
    try {
      await dbArchiveProtocol(protocol.id, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? { ...x, status: 'archived' } : x));
      setSupps(s => s.map(x => x.protocol_id === protocol.id ? { ...x, status: 'active', paused: false } : x));
      showToast(`${protocol.name} archived`);
    } catch (err) { showToast("Couldn't archive. Try again."); console.error(err); }
  };

  // Activate an archived protocol. `intent` controls what happens to the
  // user's existing active protocols:
  //   'stack'   — leave actives untouched, activate this one alongside (default)
  //   'replace' — archive all current actives first, then activate this one
  // Default 'stack' preserves the prior single-arg call sites.
  const activateProtocol = async (protocol, intent = 'stack') => {
    let archivedNames = '';
    try {
      if (intent === 'replace') {
        const activeProtos = protocols.filter(p => p.status === 'active' && p.id !== protocol.id);
        archivedNames = activeProtos.map(p => p.name).join(', ');
        await Promise.all(activeProtos.map(p => dbArchiveProtocol(p.id, token)));
        setProtocols(prev => prev.map(p => (p.status === 'active' && p.id !== protocol.id) ? { ...p, status: 'archived' } : p));
        const archivedIds = new Set(activeProtos.map(p => p.id));
        setSupps(s => s.map(x => archivedIds.has(x.protocol_id) ? { ...x, status: 'active', paused: false } : x));
      }
      await dbActivateProtocol(protocol.id, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? { ...x, status: 'active' } : x));
      const suffix = intent === 'replace' && archivedNames ? ` · ${archivedNames} archived` : '';
      showToast(`${protocol.name} activated${suffix}`);
    } catch (err) { showToast("Couldn't activate. Try again."); console.error(err); }
  };

  const deleteProtocol = async (protocol) => {
    try {
      // Hard-delete supplements that belonged to the protocol first so they
      // don't become orphans (they'd stay in supps, still count toward
      // adherence, but never render anywhere since their protocol_id no longer
      // exists). Cascade cleanup uses the hard-delete path so we don't litter
      // the DB with soft-deleted ghost rows for a protocol that no longer exists.
      const orphans = supps.filter(s => s.protocol_id === protocol.id);
      await Promise.all(orphans.map(s => dbHardDeleteSupp(s.id, token)));
      await dbDeleteProtocol(protocol.id, token);
      setSupps(s => s.filter(x => x.protocol_id !== protocol.id));
      setProtocols(p => p.filter(x => x.id !== protocol.id));
      showToast(`${protocol.name} deleted`);
    } catch (err) { showToast("Couldn't delete. Try again."); console.error(err); }
  };

  // Decline a received protocol — marks the row as 'declined' (not
  // 'pending') so it disappears from the recipient's queue without
  // activating. Distinct from Cancel (which closes the modal but keeps
  // the row pending for later). Doesn't notify the sender of the decline.
  const declineReceived = async (send) => {
    try {
      await dbUpdateProtocolSend(send.id, { status: 'declined' }, token);
      setPendingReceivedCount(c => Math.max(0, c - 1));
      showToast(`${send.name} declined`);
    } catch (err) {
      console.error(err);
      showToast("Couldn't decline. Try again.");
    }
  };

  // Activate or save a received protocol. `intent` controls what happens to
  // the recipient's existing actives:
  //   'stack'      — new protocol added as active, current actives untouched
  //   'replace'    — current actives archived, new protocol added as active
  //   'save_later' — new protocol added as archived (sits in their archived tab)
  // Default 'stack' preserves the prior single-button behavior.
  const activateReceived = async (send, intent = 'stack') => {
    // Multi-step write: 1) (replace only) archive existing actives, 2) create
    // protocol, 3) bulk-insert supps, 4) mark send activated. If supps fail
    // mid-batch we roll back the new protocol so the user can retry cleanly.
    // The archive step in 'replace' is intentionally not rolled back —
    // archiving is non-destructive and the user can reactivate from their
    // archived tab.
    let newProto = null;
    let archivedNames = '';
    try {
      if (intent === 'replace') {
        const activeProtos = protocols.filter(p => p.status === 'active');
        archivedNames = activeProtos.map(p => p.name).join(', ');
        await Promise.all(activeProtos.map(p => dbArchiveProtocol(p.id, token)));
        setProtocols(prev => prev.map(p => p.status === 'active' ? { ...p, status: 'archived' } : p));
        const archivedIds = new Set(activeProtos.map(p => p.id));
        setSupps(s => s.map(x => archivedIds.has(x.protocol_id) ? { ...x, status: 'active', paused: false } : x));
      }
      const newStatus = intent === 'save_later' ? 'archived' : 'active';
      // source must be 'user' or 'clinician' per the protocols.source CHECK
      // constraint. The fact that this protocol came from a peer is preserved
      // in the protocol_sends row (with clinician_id = sender's user id) —
      // can be surfaced as attribution later.
      const protoRows = await dbAddProtocol({ name: send.name, status: newStatus, user_id: user.id, treatment_mode: 'indefinite', source: 'user' }, token);
      newProto = protoRows?.[0];
      if (!newProto) throw new Error('Protocol creation failed');
      const snapshot = send.supplements_snapshot || [];
      const suppRows = await Promise.all(snapshot.map(s =>
        dbAddSupp({ name: s.name, dose: s.dose || '', notes: s.notes || '', slots: s.slots || [], days: s.days?.length ? s.days : [0,1,2,3,4,5,6], category: s.category || 'Oral', paused: false, status: 'active', stopped_at: null, user_id: user.id, protocol_id: newProto.id, treatment_mode: 'indefinite', starts_at: null, ends_at: null, cycle_on_value: null, cycle_on_unit: null, cycle_off_value: null, cycle_off_unit: null }, token)
      ));
      setProtocols(p => [...p, newProto]);
      setSupps(s => [...s, ...suppRows.flatMap(r => r || []).map(x => ({ ...x, paused: x.paused ?? false }))]);
      await dbUpdateProtocolSend(send.id, { status: 'activated' }, token);
      setPendingReceivedCount(c => Math.max(0, c - 1));
      const verb = intent === 'save_later' ? 'saved' : 'activated';
      const suffix = intent === 'replace' && archivedNames ? ` · ${archivedNames} archived` : '';
      showToast(`${send.name} ${verb}${suffix}`);
    } catch (err) {
      console.error(err);
      if (newProto) {
        // Rollback: hard-delete the partial protocol + any supps already inserted under it.
        // Rollback uses hard-delete because these rows were never user-acknowledged — soft
        // would leave deleted_at-stamped ghosts the user never knew existed.
        try {
          const inserted = await supa("GET", `/rest/v1/supplements?protocol_id=eq.${newProto.id}&select=id`, null, token).catch(() => []);
          await Promise.all((inserted || []).map(s => dbHardDeleteSupp(s.id, token).catch(() => {})));
          await dbDeleteProtocol(newProto.id, token).catch(() => {});
        } catch (rollbackErr) {
          console.error("activateReceived rollback also failed:", rollbackErr);
        }
      }
      showToast("Couldn't save protocol. Try again.");
    }
  };

  const sendProtocol = async (protocol, patientId) => {
    try {
      const snapshot = visibleSupps.filter(s => s.protocol_id === protocol.id).map(s => ({ name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category }));
      await dbSendProtocol({ clinician_id: user.id, patient_id: patientId, source_protocol_id: protocol.id, name: protocol.name, supplements_snapshot: snapshot }, token);
      showToast(`${protocol.name} sent`);
    } catch (err) { showToast("Couldn't send protocol. Try again."); console.error(err); }
  };

  // Peer-to-peer protocol send. Resolves email to user id, writes the send
  // row, fires the notify-recipient edge function. Returns a result object so
  // the Send modal can show an inline error (e.g. "no Origin user with that
  // email") instead of just a toast that the user might miss.
  const sendProtocolToUser = async (protocol, email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === (user.email || '').toLowerCase()) {
      return { ok: false, error: "That's your own email" };
    }
    try {
      const match = await dbLookupUserByEmail(cleanEmail, token);
      if (!match?.user_id) {
        return { ok: false, error: 'No Origin user with that email' };
      }
      const snapshot = visibleSupps
        .filter(s => s.protocol_id === protocol.id)
        .map(s => ({ name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category }));
      const rows = await dbSendProtocol({
        clinician_id: user.id,
        patient_id: match.user_id,
        source_protocol_id: protocol.id,
        name: protocol.name,
        supplements_snapshot: snapshot,
      }, token);
      const sendRow = Array.isArray(rows) ? rows[0] : rows;
      const recipientLabel = match.display_name?.trim().split(' ')[0] || cleanEmail;
      showToast(`Sent to ${recipientLabel}`);
      // DIAGNOSTIC (May 20 evening) — Bego didn't get notifications either,
      // so the push isn't a per-device issue. Surface the edge function's
      // response as a second toast to expose the failure mode without
      // requiring devtools. Revert to silent fire-and-forget once root cause
      // is fixed.
      if (sendRow?.id) {
        const senderName = profile?.display_name?.trim().split(' ')[0] || 'Someone';
        dbNotifyProtocolSent(sendRow.id, senderName, token)
          .then(body => {
            try {
              const r = JSON.parse(body);
              if (r?.ok && r?.sent > 0) showToast(`Push sent (${r.sent})`);
              else if (r?.reason)      showToast(`Push: ${r.reason}`);
              else                     showToast(`Push: ${String(body).slice(0, 80)}`);
            } catch {
              showToast(`Push raw: ${String(body).slice(0, 80)}`);
            }
          })
          .catch(e => showToast(`Push error: ${(e?.message || e).toString().slice(0, 100)}`));
      }
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Couldn't send. Try again." };
    }
  };

  const undoDelete = (suppId) => {
    setPendingDeletes(p => {
      const entry = p[suppId];
      if (entry) clearTimeout(entry.timeoutId);
      const next = { ...p }; delete next[suppId]; return next;
    });
  };

  const requestDelete = (supp) => {
    if (pendingDeletes[supp.id]) return; // already pending, no-op
    const timeoutId = setTimeout(async () => {
      try {
        await dbDeleteSupp(supp.id, token);
        setSupps(s => s.filter(x => x.id !== supp.id));
        recomputeWithToast();
      } catch (err) {
        showToast("Couldn't delete — try again");
        console.error(err);
      } finally {
        setPendingDeletes(p => { const next = { ...p }; delete next[supp.id]; return next; });
      }
    }, 5000);
    setPendingDeletes(p => ({ ...p, [supp.id]: { supp, timeoutId } }));
    showToast(`Deleted ${supp.name}`, {
      icon: <Trash2 size={16} />,
      duration: 5000,
      action: { label: "Undo", onClick: () => undoDelete(supp.id) },
    });
  };

  const handleSignOut = () => {
    Object.values(pendingDeletes).forEach(({ supp, timeoutId }) => {
      clearTimeout(timeoutId);
      dbDeleteSupp(supp.id, token);
    });
    onSignOut();
  };

  const shortDate = viewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (loading) return null;
  if (needsNamePrompt) return (
    <PromptName onSave={async (name) => {
      try {
        await dbCreateProfile({ id: user.id, display_name: name }, token);
        setProfile({ id: user.id, display_name: name });
      } catch {
        setProfile({ id: user.id, display_name: null });
      }
      setNeedsNamePrompt(false);
    }} />
  );
  if (needsOnboarding) return (
    <Onboarding onComplete={async (mode, config, behavior, cTime) => {
      // New fasting users go straight to v2 — flag so they skip the migration screen.
      const finalConfig = mode === "fasting" ? { ...config, _if_v2_migrated: true } : config;
      const ok = await saveSchedule(mode, finalConfig, behavior, cTime);
      if (ok) {
        setNeedsOnboarding(false);
        if (isPushSupported() && !needsHomeScreenInstall()) {
          const sub = await getCurrentSubscription();
          if (!sub) setNeedsNotificationPrompt(true);
        }
      }
      return ok;
    }} />
  );
  if (needsNotificationPrompt) return (
    <NotificationPrompt
      onEnable={async () => {
        try {
          await subscribeToPush();
          await dbUpdateScheduleField("notifications_enabled", true, user.id, token);
        } catch {
          // permission denied or any other error — just continue to app
        }
        setNeedsNotificationPrompt(false);
      }}
      onSkip={() => setNeedsNotificationPrompt(false)}
    />
  );
  if (needsIFMigration) return (
    <IFMigrationScreen
      oldConfig={scheduleConfig}
      consistentTime={consistentTime}
      hasLegacyEveningSupps={supps.some(s => s.slots?.includes("after_dinner"))}
      onComplete={async (newConfig) => {
        // Persist new v2 config with migration flag
        const configWithFlag = { ...newConfig, _if_v2_migrated: true };
        const ok = await saveSchedule("fasting", configWithFlag, "flexible", consistentTime);
        if (!ok) return;

        // Remap supplement slots from v1 IF slot IDs to v2 IDs.
        const slotMap = {
          pre_breakfast: "fasted",
          breakfast:     "meal_1",
          pre_lunch:     "pre_meal_2",
          lunch:         "meal_2",
          pre_dinner:    "pre_meal_3",
          dinner:        "meal_3",
          after_dinner:  "evening",
        };
        const toUpdate = [];
        const migratedSupps = supps.map(s => {
          const remapped = s.slots?.map(sl => slotMap[sl] ?? sl);
          const changed  = remapped?.some((sl, i) => sl !== s.slots[i]);
          if (!changed) return s;
          const updated = { ...s, slots: remapped };
          toUpdate.push(updated);
          return updated;
        });
        setSupps(migratedSupps);
        for (const s of toUpdate) {
          try { await dbUpdateSupp(s, token); } catch (e) { console.warn("IF slot migration write failed for", s.id, e); }
        }
        setNeedsIFMigration(false);
        recomputeWithToast();
      }}
    />
  );

  // Active slot list for home screen — mode-aware.
  const activeSlotList = scheduleMode === "fasting"
    ? IF_SLOTS.filter(s => {
        if (s.id === "pre_meal_2" || s.id === "meal_2") return mealCount >= 2;
        if (s.id === "pre_meal_3" || s.id === "meal_3") return mealCount >= 3;
        if (s.id === "evening") return !!scheduleConfig.evening_mode;
        return true;
      })
    : SLOTS;

  // Take-all first-run hint condition: visible only when at least one slot
  // has 2+ items (otherwise the affordance has no real value), not on past
  // days, and not yet dismissed. The InlineTip primitive handles persistence.
  const hasMultiSuppSlot =
    anytimeSupps.length >= 2 ||
    activeSlotList.some(s => getSuppsForSlot(s.id).length >= 2);

  const slotCardsContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs2 }}>
      {hasMultiSuppSlot && !isReadOnly && !isPast && !isFuture && (
        <InlineTip id="take-all-hint" label="Tip">
          Tap the icon at the left of a slot to log every item in it at once.
        </InlineTip>
      )}
      {activeSlotList.map(slot => {
        const slotSupps = getSuppsForSlot(slot.id);
        if (!slotSupps.length) return null;
        const hasOffset = scheduleMode === "fixed"
          ? !!scheduleConfig.fixed_times?.[slot.id]
          : scheduleMode === "fasting"
            ? !!computeIFSlotTimes(scheduleConfig)[slot.id] || (slot.id === "evening" && !!scheduleConfig.evening_mode)
            : slot.id === "rx"
              ? !!pillTime
              : slotOffsets?.[slot.id] !== null && slotOffsets?.[slot.id] !== undefined;
        const noSched = scheduleMode === "none";
        const timeLabel = noSched ? "" : (hasOffset ? slotTimeStr(slot.id) : "variable");
        const status = noSched ? "future" : slotStatus(slot.id);
        const overrideLabel = getSlotLabelForMode(slot.id, scheduleMode);
        const displaySlot = overrideLabel ? { ...slot, label: overrideLabel } : slot;
        return <SlotCard key={slot.id} slot={displaySlot} slotSupps={slotSupps} status={status} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={noSched ? null : effectivePillTime} isFuture={isFuture} isChecked={isChecked} checkedAtTime={checkedAtTime} toggleCheck={toggleCheck} takeAllInSlot={takeAllInSlot} openEdit={openEdit} openLogAt={openLogAt} noSchedule={noSched} isReadOnly={isReadOnly} isPast={isPast} />;
      })}
      {anytimeSupps.length > 0 && (
        <SlotCard slot={ANYTIME_SLOT} slotSupps={anytimeSupps} status="future" timeLabel="" hasOffset={false} pillTime={null} isFuture={isFuture} isChecked={isChecked} checkedAtTime={checkedAtTime} toggleCheck={toggleCheck} takeAllInSlot={takeAllInSlot} openEdit={openEdit} openLogAt={openLogAt} noSchedule isReadOnly={isReadOnly} isPast={isPast} />
      )}
    </div>
  );

  if (isDesktop) {
    // Right column has three possible states on desktop:
    //   - default: ProtocolLibrary (always present surface on the right)
    //   - settings: SettingsScreen, opened from the avatar
    //   - protocol_detail: a single protocol drilled into from the library
    // 'manage_protocol' as a nav target is no longer needed — the library is
    // always visible — but the stack entry still exists for legacy back-nav.
    const topScreen = screenStack[screenStack.length - 1]?.name;
    const rightColumnView =
      topScreen === 'settings' ? 'settings' :
      topScreen === 'protocol_detail' ? 'protocol_detail' :
      'library';
    const firstName = profile?.display_name?.trim().split(" ")[0] || null;
    // Default clinician landing: Patient Roster. My Origin click sets
    // activeNavItem='home' which falls back to the personal cockpit.
    // Non-clinicians never hit this branch — they always see their cockpit.
    const showRoster = isClinician && !selectedPatient && activeNavItem === 'roster';
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: theme.surface.canvas, padding: spacing.lg, gap: spacing.md, boxSizing: "border-box", fontFamily: typography.fontBody, color: theme.text.primary, WebkitFontSmoothing: "antialiased" }}>

        {/* Top bar — clinician chrome that spans all three panels below.
            Brand · greeting · avatar. Patient identity (when selected) stays
            inside the main column as in-context patient header. */}
        <header style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.lg,
          padding: `0 ${spacing.xs}px`,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: typography.fontHeading,
            fontSize: typography.title,
            fontWeight: typography.semibold,
            color: theme.text.primary,
            letterSpacing: typography.headingLetterSpacing,
          }}>
            Origin
          </span>
          <div style={{ flex: 1 }} />
          <AccountAvatar displayName={firstName} onClick={() => pushScreen('settings')} />
        </header>

        {/* Panel row */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, gap: spacing.lg }}>
        {isClinician && (
          <Sidebar
            pushScreen={pushScreen}
            isClinician={isClinician}
            activeNavItem={activeNavItem}
            onNavChange={(nav) => { setActiveNavItem(nav); setSelectedPatient(null); }}
            patients={activePatients}
            archivedPatients={archivedPatients}
            onUnarchivePatient={unarchivePatient}
            selectedPatient={selectedPatient}
            onPatientSelect={(p) => setSelectedPatient(prev => (p === null || prev?.id === p.id) ? null : p)}
            patientStats={patientStats}
          />
        )}
        <main style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          background: theme.surface.card,
          border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          borderRadius: theme.radius.surface,
          padding: spacing.xl,
          boxSizing: "border-box",
        }}>
          {/* Inline patient identity + overflow (only in patient view).
              Own-home view has no inline header — greeting is in the top bar. */}
          {selectedPatient && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl, gap: spacing.md }}>
              <PatientIdentityBlock
                patient={selectedPatient}
                activeCount={patientStats[selectedPatient.id]?.activeCount}
                trendLogs={patientTrendLogs}
                theme={theme}
              />
              <Button
                variant="icon"
                aria-label="Patient actions"
                onClick={(e) => { setPatientActionsAnchor(e.currentTarget); setPatientActionsOpen(true); }}
              >
                <MoreHorizontal size={18} />
              </Button>
            </div>
          )}

          {showRoster ? (
            <PatientRoster
              patients={activePatients}
              patientStats={patientStats}
              onPatientSelect={(p) => setSelectedPatient(p)}
            />
          ) : selectedPatient ? (
            <>
              <PatientDetailPanel
                patient={selectedPatient}
                token={token}
                patientSupps={patientSupps}
                patientProtos={patientProtos}
                patientSched={patientSched}
                patientTrendLogs={patientTrendLogs}
                activeSlotIds={patientActiveSlotIds}
              />
              {/* Diagnostic analytics stack lives in the main column under the
                  cockpit — that's where the clinician's eye lands after the
                  week strip. Right column stays focused on the patient's
                  protocols (Phase 2 of clinician-surfaces audit). */}
              <PatientAnalyticsPanel
                supplements={patientSupps}
                protocols={patientProtos}
                trendLogs={patientTrendLogs}
                activeSlotIds={patientActiveSlotIds}
                scheduleMode={patientSched?.schedule_type || 'none'}
                initialNotes={patientNote?.notes || ''}
                onSaveNotes={(notes) => saveClinicianNote({ notes })}
              />
            </>
          ) : (<>
          {/* Personal home greeting — restrained, lives here so it only
              appears in the clinician's own cockpit, not over patient views. */}
          <h1 style={{
            fontFamily: typography.fontHeading,
            fontSize: typography.heading,
            fontWeight: typography.semibold,
            color: theme.text.primary,
            letterSpacing: typography.headingLetterSpacing,
            margin: 0,
            marginBottom: spacing.lg,
          }}>
            Hello, {firstName || 'there'}
          </h1>
          <WeekStrip
            weekDates={weekDates}
            weekLogs={weekLogs}
            supplements={supps}
            selectedDate={viewDate}
            onSelectDate={(date) => { setViewDate(startOfDay(date)); setPastDayEditing(false); }}
            onPrev={handlePrevWeek}
            onNext={handleNextWeek}
            canNavigateNext={canNavigateNext}
            activeSlotIds={new Set(coreSlotIds)}
          />
          <div style={{ display: "flex", flexDirection: "row", gap: spacing.xl, marginTop: spacing.xl, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <TodayPanel
                viewDate={viewDate}
                isToday={isToday}
                isPast={isPast}
                isFuture={isFuture}
                homeSupps={homeSupps}
                anytimeSupps={anytimeSupps}
                getSuppsForSlot={getSuppsForSlot}
                isChecked={isChecked}
                toggleCheck={toggleCheck}
                slotTimeStr={slotTimeStr}
                slotStatus={slotStatus}
                scheduleMode={scheduleMode}
                pillTime={pillTime}
                anchorBehavior={anchorBehavior}
                consistentTime={consistentTime}
                eatingWindowStart={scheduleConfig.eating_window_start}
                activeSlotList={activeSlotList}
                isReadOnly={isReadOnly}
                pastDayEditing={pastDayEditing}
                setPastDayEditing={setPastDayEditing}
                startDay={startDay}
                editPillTime={editPillTime}
                setEditPillTime={setEditPillTime}
                tmpTime={tmpTime}
                setTmpTime={setTmpTime}
                setPillForDay={setPillForDay}
                openEdit={openEdit}
              />
            </div>
            <div style={{ flex: 1 }}>
              <InsightsPanel
                supplements={supps}
                weekDates={weekDates}
                weekLogs={weekLogs}
                streak={streak}
                scheduleMode={scheduleMode}
                anchorBehavior={anchorBehavior}
                consistentTime={consistentTime}
                activeSlotIds={new Set(coreSlotIds)}
              />
            </div>
          </div>
          </>)}
        </main>

        {/* Right aside collapses on the clinician roster — there's no
            patient-scoped content to host there. Reappears when a patient
            is selected (their protocols / settings / detail) or when the
            clinician explicitly enters personal mode via My Origin. */}
        {!showRoster && (
        <aside style={{
          width: 420,
          flexShrink: 0,
          background: theme.surface.card,
          border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          borderRadius: theme.radius.surface,
          // In patient view the aside owns the scroll so the analytics panel
          // can stack below the library; in clinician's own view the inner
          // screen (library / settings / protocol detail) owns its own scroll.
          overflowY: selectedPatient && rightColumnView === 'library' ? 'auto' : 'hidden',
          overflowX: 'hidden',
          display: "flex",
          flexDirection: "column",
        }}>
          {rightColumnView === 'settings' && (
            <SettingsScreen
              desktop
              isOpen
              onBack={popScreen}
              onSignOut={handleSignOut}
              user={user}
              token={token}
              profile={profile}
              onProfileUpdate={(updated) => setProfile(updated)}
              onNotificationsEnabled={recomputeWithToast}
              scheduleMode={scheduleMode}
              scheduleConfig={scheduleConfig}
              anchorBehavior={anchorBehavior}
              consistentTime={consistentTime}
              onSaveSchedule={saveSchedule}
              supplements={visibleSupps}
            />
          )}
          {rightColumnView === 'library' && (
            <ProtocolLibrary
              desktop
              embedded
              isOpen
              readOnly={!!selectedPatient}
              onBack={popScreen}
              protocols={selectedPatient ? patientProtos : protocols}
              supplements={selectedPatient ? patientSupps : visibleSupps}
              onAddProtocol={addProtocol}
              onOpenDetail={(protocol) => { setSelectedProtocol(protocol); pushScreen('protocol_detail'); }}
              onProtocolCreated={(p) => {
                // In patient mode, a freshly-created protocol is automatically
                // sent to the selected patient. In clinician's own mode, we
                // navigate to the new protocol's detail screen as before.
                if (selectedPatient) {
                  sendProtocol(p, selectedPatient.id);
                  setCreateForPatientOpen(false);
                } else {
                  setSelectedProtocol(p);
                  pushScreen('protocol_detail');
                  openAddToProtocol(p);
                }
              }}
              userId={selectedPatient ? selectedPatient.id : user.id}
              token={token}
              onActivateReceived={selectedPatient ? null : activateReceived}
              adherenceMap={selectedPatient ? patientProtocolAdherence : null}
              onPlusClick={selectedPatient ? (e) => { setSendToPatientAnchor(e?.currentTarget || null); setSendToPatientPickerOpen(true); } : null}
              controlledShowNew={selectedPatient ? createForPatientOpen : undefined}
              onShowNewChange={selectedPatient ? setCreateForPatientOpen : undefined}
            />
          )}
          {/* PatientAnalyticsPanel moved into the main column under
              PatientDetailPanel (clinician audit Phase 2). Right aside stays
              focused on the patient's protocols. */}
          {rightColumnView === 'protocol_detail' && (
            <ProtocolDetailScreen
              desktop
              isOpen
              readOnly={!!selectedPatient}
              onBack={popScreen}
              protocol={selectedProtocol}
              supplements={selectedPatient ? patientSupps : visibleSupps}
              onUpdateProtocol={updateProtocol}
              onArchiveProtocol={archiveProtocol}
              onActivateProtocol={activateProtocol}
              onDeleteProtocol={deleteProtocol}
              onAddSupp={() => openAddToProtocol(selectedProtocol)}
              onEditSupp={openEdit}
              onTogglePauseSupp={togglePause}
              onResumeSupp={resumeSupp}
              onDeleteSupp={deleteSuppById}
              isClinician={isClinician && !selectedPatient}
              patients={patients}
              onSendToPatient={sendProtocol}
            />
          )}
        </aside>
        )}
        </div>
        {/* EditForm — context-preserving side panel on desktop, bottom sheet
            on mobile (delegated to Modal internally). Lets the clinician/user
            keep an eye on the surface they're editing against. */}
        <SidePanel
          open={formOpen}
          onClose={closeForm}
          title={editingId ? "Edit item" : "New item"}
          footer={
            <>
              {submitError && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs, textAlign: "center" }}>{submitError}</div>}
              <Button variant="primary" fullWidth onClick={submitForm} disabled={submitting || !form.name?.trim()}>
                {submitting ? <InlineLoader size="sm" /> : (editingId ? "Save changes" : "Add to protocol")}
              </Button>
            </>
          }
        >
          <EditForm key={editingId ?? 'new'} form={form} setForm={setForm} editingId={editingId} onDelete={deleteSupp} scheduleMode={scheduleMode} mealCount={mealCount} eveningMode={scheduleConfig.evening_mode ?? null} supplementHistory={supplementHistory} activeProtocols={protocols.filter(p => p.status === 'active')} />
        </SidePanel>

        {/* Patient actions overflow menu — Archive only. Popover anchored to
            the ⋯ trigger; lighter than a modal for a single-action menu. */}
        <Popover
          open={patientActionsOpen}
          onClose={() => setPatientActionsOpen(false)}
          anchorRef={{ current: patientActionsAnchor }}
          placement="bottom-end"
          width={220}
        >
          <PopoverItem onClick={() => { setPatientActionsOpen(false); setConfirmArchivePatient(true); }}>
            Archive patient
          </PopoverItem>
        </Popover>

        {/* Send-or-create picker — popover anchored to the + in the
            patient's protocols column. Two paths: build new protocol
            (auto-sends on save), or send one from the clinician's library. */}
        <Popover
          open={sendToPatientPickerOpen}
          onClose={() => setSendToPatientPickerOpen(false)}
          anchorRef={{ current: sendToPatientAnchor }}
          placement="bottom-end"
          width={280}
        >
          <PopoverItem
            icon={<Plus size={14} />}
            onClick={() => { setSendToPatientPickerOpen(false); setCreateForPatientOpen(true); }}
          >
            Create new protocol
          </PopoverItem>
          {protocols.filter(p => p.status === 'active').length > 0 && (
            <PopoverSection>From your library</PopoverSection>
          )}
          {protocols.filter(p => p.status === 'active').map((proto) => (
            <PopoverItem
              key={proto.id}
              onClick={async () => {
                await sendProtocol(proto, selectedPatient.id);
                setSendToPatientPickerOpen(false);
              }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, width: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proto.name}</span>
                <span style={{
                  fontSize: typography.label, color: theme.text.secondary,
                  fontFamily: typography.fontData, flexShrink: 0,
                }}>
                  {visibleSupps.filter(s => s.protocol_id === proto.id).length}
                </span>
              </span>
            </PopoverItem>
          ))}
        </Popover>

        {/* Archive patient confirmation — only hides from clinician's roster
            (RLS access preserved per Phase 4 design). Patient is not notified. */}
        <Modal
          open={confirmArchivePatient}
          onClose={() => setConfirmArchivePatient(false)}
          size="compact"
          title={`Archive ${selectedPatient?.display_name || 'patient'}?`}
          footer={
            <div style={{ display: 'flex', gap: spacing.xs }}>
              <Button variant="tertiary" fullWidth onClick={() => setConfirmArchivePatient(false)}>Cancel</Button>
              <Button variant="primary" fullWidth onClick={async () => {
                await saveClinicianNote({ archived_at: new Date().toISOString() });
                setConfirmArchivePatient(false);
                setSelectedPatient(null);
              }}>Archive</Button>
            </div>
          }
        >
          <p style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.6, margin: 0 }}>
            Hides them from your patient list. You'll keep access to their data and can restore from the Archived section in the sidebar. The patient isn't notified.
          </p>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: typography.fontBody, color: theme.text.primary, maxWidth: layout.maxContentWidth, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: BG_GRADIENT, minHeight: "100vh" }}>

      {/* Header: [avatar] greeting · right-side actions vary by past/today.
          Today/future: [Library] [+] — Add closest to edge for thumb reach.
          Past day: [Library] [Edit/Done] — Add hidden (items always create with
          today's timestamp, so adding while viewing yesterday is misleading);
          Edit/Done takes the edge slot for the same thumb-reach reason. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
          <AccountAvatar size="touch" displayName={profile?.display_name?.trim().split(" ")[0] || null} onClick={() => pushScreen('settings')} />
          <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {profile?.display_name ? `Hello, ${profile.display_name.trim().split(" ")[0]}` : "Hello"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <Button variant="icon" aria-label={pendingReceivedCount > 0 ? `Open Library — ${pendingReceivedCount} received` : "Open Library"} onClick={() => pushScreen('manage_protocol')}>
              <Library size={18} />
            </Button>
            {pendingReceivedCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: -4, right: -4,
                  minWidth: 16, height: 16, padding: '0 3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  // Square badge — matches Origin's zero-radius design language
                  // (radius.xs..xl all = 0; radius.full reserved for genuinely
                  // circular shapes like adherence rings and avatars).
                  borderRadius: 0,
                  background: theme.status.success,
                  color: theme.surface.canvas,
                  fontFamily: typography.fontData,
                  fontSize: 10, fontWeight: typography.semibold,
                  lineHeight: 1,
                  // Canvas-colored border creates a small gap lifting the
                  // badge off the icon edge.
                  border: `2px solid ${theme.surface.canvas}`,
                  pointerEvents: 'none',
                }}
              >
                {pendingReceivedCount > 9 ? '9+' : pendingReceivedCount}
              </span>
            )}
          </div>
          {isPast ? (
            <Button
              variant="icon"
              aria-label={pastDayEditing ? "Done editing" : "Edit past day"}
              onClick={() => setPastDayEditing(!pastDayEditing)}
              style={pastDayEditing ? { background: theme.accent.subtle, color: theme.accent.onSubtle, borderColor: theme.accent.default } : undefined}
            >
              {pastDayEditing ? <span style={{ fontSize: typography.label, fontWeight: typography.semibold, padding: `0 ${spacing.xxs}px` }}>Done</span> : <Pencil size={16} />}
            </Button>
          ) : (
            <Button variant="icon" aria-label="Add item" onClick={openAdd}>
              <Plus size={18} />
            </Button>
          )}
        </div>
      </div>

      {/* Week strip — date nav + glanceable adherence (Session 1 of mobile audit).
          activeSlotIds is required so the per-day ring math doesn't inflate the
          denominator for IF v2 users whose supplements carry both legacy and
          IF v2 slot ids in their `slots` array (e.g. ["meal_1","breakfast"]).
          Without this filter, the WeekStrip counts both ids as expected checks
          while the user only checks the active one, producing 50% rings even
          when the user is at 100% per the Hero. Same coreSlotIds set is passed
          to the desktop callsite at 1589. */}
      <div style={{ marginBottom: spacing.md }}>
        <WeekStrip
          weekDates={weekDates}
          weekLogs={weekLogs}
          supplements={visibleSupps}
          selectedDate={viewDate}
          onSelectDate={(date) => { setViewDate(startOfDay(date)); setPastDayEditing(false); }}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
          canNavigateNext={canNavigateNext}
          activeSlotIds={new Set(coreSlotIds)}
          compact
        />
      </div>

      {/* Hero card */}
      <Hero
        scheduleMode={scheduleMode} isToday={isToday} viewDate={viewDate} shortDate={shortDate}
        pct={pct} coreTotal={coreTotal} coreDone={coreDone}
        pillTime={pillTime} anchorBehavior={anchorBehavior} consistentTime={consistentTime}
        eatingWindowStart={scheduleConfig.eating_window_start}
        editPillTime={editPillTime} setEditPillTime={setEditPillTime}
        tmpTime={tmpTime} setTmpTime={setTmpTime} setPillForDay={setPillForDay}
        isFuture={isFuture} flashGreen={flashGreen} startDay={startDay} viewDay={viewDay}
        isPast={isPast} isReadOnly={isReadOnly}
        nextFixedSlot={nextFixedSlot}
      />

      {/* Main slot list — read-only state is signaled by the in-Hero eyebrow
          ("Viewing X · read-only"), no opacity dim on the content tree. */}
      <div style={{ borderRadius: theme.radius.surface, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, background: theme.surface.card, padding: spacing.md, marginBottom: spacing.md }}>
        {homeSupps.length === 0 ? (
          <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
            <div style={{ fontSize: typography.display, color: theme.text.secondary, marginBottom: spacing.md, fontFamily: typography.fontHeading, lineHeight: 1 }}>◯</div>
            <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>No items yet</div>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.5, marginBottom: spacing.lg }}>Add your first to begin tracking.</div>
            {!isPast && <Button variant="primary" fullWidth onClick={openAdd}>Add to protocol</Button>}
            {/* Day-1 inline tip — only on the home empty state for first-day users.
                Schedule-mode-specific copy. Dismissible, never returns once dismissed. */}
            {!isPast && isDay1 && DAY1_TIP[scheduleMode] && (
              <div style={{ marginTop: spacing.md }}>
                <InlineTip id={`day1-${scheduleMode}`} label={DAY1_TIP[scheduleMode].label}>
                  {DAY1_TIP[scheduleMode].body}
                </InlineTip>
              </div>
            )}
          </div>
        ) : slotCardsContent}
      </div>

      {/* Screens */}
      <SettingsScreen
        isOpen={screenStack.some(s => s.name === 'settings')}
        onBack={popScreen}
        onSignOut={handleSignOut}
        user={user}
        token={token}
        profile={profile}
        onProfileUpdate={(updated) => setProfile(updated)}
        onNotificationsEnabled={recomputeWithToast}
        scheduleMode={scheduleMode}
        scheduleConfig={scheduleConfig}
        anchorBehavior={anchorBehavior}
        consistentTime={consistentTime}
        onSaveSchedule={saveSchedule}
        supplements={visibleSupps}
      />
      <ProtocolLibrary
        isOpen={screenStack.some(s => s.name === 'manage_protocol')}
        onBack={popScreen}
        protocols={protocols}
        supplements={visibleSupps}
        onAddProtocol={addProtocol}
        onOpenDetail={(protocol) => { setSelectedProtocol(protocol); pushScreen('protocol_detail'); }}
        onProtocolCreated={(p) => { setSelectedProtocol(p); pushScreen('protocol_detail'); openAddToProtocol(p); }}
        userId={user.id}
        token={token}
        onActivateReceived={activateReceived}
        onDeclineReceived={declineReceived}
      />
      <ProtocolDetailScreen
        isOpen={screenStack.some(s => s.name === 'protocol_detail')}
        onBack={popScreen}
        protocol={selectedProtocol}
        supplements={visibleSupps}
        onUpdateProtocol={updateProtocol}
        onArchiveProtocol={archiveProtocol}
        onActivateProtocol={activateProtocol}
        onDeleteProtocol={deleteProtocol}
        onAddSupp={() => openAddToProtocol(selectedProtocol)}
        onEditSupp={openEdit}
        onTogglePauseSupp={togglePause}
        onResumeSupp={resumeSupp}
        onDeleteSupp={deleteSuppById}
        isClinician={false}
        patients={patients}
        onSendToPatient={sendProtocol}
        onSendToUser={sendProtocolToUser}
      />
      <SidePanel
        open={formOpen}
        onClose={closeForm}
        title={editingId ? "Edit item" : "New item"}
        footer={
          <>
            {submitError && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs, textAlign: "center" }}>{submitError}</div>}
            <Button variant="primary" fullWidth onClick={submitForm} disabled={submitting || !form.name?.trim()}>
              {submitting ? <InlineLoader size="sm" /> : (editingId ? "Save changes" : "Add to protocol")}
            </Button>
          </>
        }
      >
        <EditForm key={editingId ?? 'new'} form={form} setForm={setForm} editingId={editingId} onDelete={deleteSupp} scheduleMode={scheduleMode} mealCount={mealCount} eveningMode={scheduleConfig.evening_mode ?? null} supplementHistory={supplementHistory} activeProtocols={protocols.filter(p => p.status === 'active')} />
      </SidePanel>
      <LogAtSheet
        open={!!logAtTarget}
        target={logAtTarget}
        onClose={() => setLogAtTarget(null)}
        onConfirm={submitLogAt}
      />
    </div>
  );
}
