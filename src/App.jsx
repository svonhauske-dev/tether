import { useState, useEffect, useRef } from "react";
import {
  spacing, typography, touch, layout,
  shadows, zIndex, breakpoints,
} from "./design-system";
import { ThemeProvider, useTheme } from './lib/theme';
import DevThemePicker from "./components/DevThemePicker";
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, toHrMin, fromHrMin, MODES, deriveOffsets, getSlotLabelForMode, computeIFSlotTimes, IF_SLOT_IDS } from "./config";
import { Settings, Trash2, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Button from "./components/Button";
import Input from "./components/Input";
import Card from "./components/Card";
import Badge from "./components/Badge";
import Label from "./components/Label";
import Modal from "./components/Modal";
import SettingsScreen from "./components/SettingsScreen";
import { NavigationProvider, useNavigation } from "./lib/navigation";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import ProtocolLibrary from "./components/ProtocolLibrary";
import ProtocolDetailScreen from "./components/ProtocolDetailScreen";
import Onboarding from "./components/Onboarding";
import Loader from "./components/Loader";
import InlineLoader from "./components/InlineLoader";
import Auth from "./components/Auth";
import PromptName from "./components/PromptName";
import SlotCard from "./components/SlotCard";
import EditForm from "./components/EditForm";
import Hero from "./components/Hero";
import Sidebar, { AccountAvatar } from "./components/Sidebar";
import PatientDetailPanel from "./components/PatientDetailPanel";
import WeekStrip from "./components/WeekStrip";
import TodayPanel from "./components/TodayPanel";
import InsightsPanel from "./components/InsightsPanel";
import {
  supa, getSession, signInPassword, signUp, signOut, refreshSession,
  dbGetProtocols, dbAddProtocol, dbUpdateProtocol, dbDeleteProtocol,
  dbPauseProtocol, dbArchiveProtocol, dbActivateProtocol,
  dbGetSupps, dbAddSupp, dbUpdateSupp, dbDeleteSupp,
  dbGetLog, dbUpsertLog,
  dbGetSchedule, dbSaveSchedule,
  dbUpdateScheduleField,
  dbGetProfile, dbCreateProfile,
  recomputeNotifications,
  dbGetSupplementHistory, dbAddSupplementHistory,
  dbGetDailyLogsRange,
  dbGetMyPatients,
  dbSendProtocol,
  dbGetReceivedProtocols,
  dbUpdateProtocolSend,
} from './lib/api';
import { fmtTime, addMins, parseHHMM, dateKey, startOfDay, TODAY, isSupplementActiveOn, isActiveSupp, isStoppedSupp, isPausedSupp } from './lib/time';
import { SLOTS, IF_SLOTS, isPushSupported, needsHomeScreenInstall, getCurrentSubscription, registerServiceWorker, subscribeToPush } from './lib/notifications';
import NotificationPrompt from "./components/NotificationPrompt";
import IFMigrationScreen from "./components/IFMigrationScreen";
import DesignSystemPage from "./components/design-system-page/DesignSystemPage";

// ── Constants ─────────────────────────────────────────────────────────────────

// BG_GRADIENT is derived from theme inside ProtocolApp

// Non-IF core slot IDs. IF uses IF_SLOT_IDS from config.js (mode-aware, filtered by meal_count).
const CORE_SLOTS = ["rx", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

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
        <DevThemePicker />
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
          {import.meta.env.DEV && <DevThemePicker />}
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
  const lastTzRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= breakpoints.desktop
  );
  const [weekLogs, setWeekLogs] = useState([]);
  const [viewedWeekEnd, setViewedWeekEnd] = useState(() => startOfDay(TODAY));
  const [selectedProtocol, setSelectedProtocol]   = useState(null);
  const [activeNavItem, setActiveNavItem]         = useState('home');
  const [patients, setPatients]                   = useState([]);
  const [selectedPatient, setSelectedPatient]     = useState(null);
  const [needsIFMigration, setNeedsIFMigration]   = useState(false);
  const { show: showToast } = useToast();

  const isClinician = profile?.is_clinician === true;

  useEffect(() => {
    if (!isClinician || !user?.id || !token) return;
    dbGetMyPatients(user.id, token).catch(() => []).then(rows => setPatients(rows || []));
  }, [isClinician, user?.id]);

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

  // fixed mode: always active; consistent mode: pre-populate with set time
  const effectivePillTime = scheduleMode === "fixed"
    ? (pillTime || "00:00")
    : anchorBehavior === "consistent"
      ? (pillTime || consistentTime)
      : pillTime;

  // Register service worker early so it's ready to receive pushes
  useEffect(() => { registerServiceWorker().catch(() => {}); }, []);

  // Recompute notifications when the user returns to the app in a different timezone
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (currentTz !== lastTzRef.current) {
        lastTzRef.current = currentTz;
        recomputeNotifications(token);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [token]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= breakpoints.desktop);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [protos, s, log, sched, prof, histRows] = await Promise.all([
          dbGetProtocols(user.id, token).catch(() => []),
          dbGetSupps(user.id, token),
          dbGetLog(user.id, dk, token),
          dbGetSchedule(token),
          dbGetProfile(user.id, token).catch(() => null),
          dbGetSupplementHistory(token).catch(() => []),
        ]);
        setProtocols(protos || []);
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

  // Load week logs for desktop adherence rings + pre-populate past day state
  useEffect(() => {
    if (loading || !isDesktop) return;
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
  }, [viewedWeekEnd, loading, isDesktop]);

  // Keep weekLogs in sync with checked state so rings update immediately after toggling
  useEffect(() => {
    if (!isDesktop) return;
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
  }, [checked, dk, isDesktop]);

  // Auto-save — skip on read-only past days to avoid overwriting history with empty state
  useEffect(() => {
    if (loading) return;
    if (isPast && !pastDayEditing) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pt = pillTimes[dk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk)));
      dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: pt || null, checked: dayChecked }, token).catch(() => showToast("Couldn't save check — try again"));
    }, 200);
  }, [checked, pillTimes, dk, loading, isPast, pastDayEditing]);

  // Streak
  useEffect(() => {
    let s = 0; const d = new Date(TODAY);
    for (let i = 0; i < 30; i++) {
      const ddk = dateKey(d);
      const pt  = pillTimes[ddk];
      if (!pt && scheduleMode !== "fixed" && scheduleMode !== "fasting" && scheduleMode !== "none" && anchorBehavior !== "consistent") break;
      const day     = d.getDay();
      const allDone = CORE_SLOTS.every(sid => supps.filter(x => isActiveSupp(x) && x.slots.includes(sid) && x.days.includes(day)).every(x => !!checked[`${ddk}_${sid}_${x.id}`]));
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

  const goDay         = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate() + offset); setViewDate(startOfDay(d)); setPastDayEditing(false); };
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
  const toggleCheck     = (sid, suppId) => { if (isReadOnly) return; const k = `${dk}_${sid}_${suppId}`; setChecked(c => ({ ...c, [k]: !c[k] })); };
  const isChecked       = (sid, suppId) => !!checked[`${dk}_${sid}_${suppId}`];
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

  const openManageSchedule = () => pushScreen('settings');
  const openManageProtocol = () => pushScreen('manage_protocol');

  const blankForm = (protocol_id = null) => ({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", paused: false, status: 'active', protocol_id, treatment_mode: "indefinite", starts_at: null, ends_at: null, cycle_on_value: null, cycle_on_unit: null, cycle_off_value: null, cycle_off_unit: null });

  const openAdd   = () => {
    const active = protocols.filter(p => p.status === 'active');
    setEditingId(null);
    setForm(blankForm(active.length === 1 ? active[0].id : null));
    setSubmitError(null);
    setFormOpen(true);
  };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...(supp.slots || [])], days: [...(supp.days || [])], category: supp.category || "Oral", paused: supp.paused ?? false, status: supp.status ?? 'active', protocol_id: supp.protocol_id || null, treatment_mode: supp.treatment_mode || "indefinite", starts_at: supp.starts_at || null, ends_at: supp.ends_at || null, cycle_on_value: supp.cycle_on_value || null, cycle_on_unit: supp.cycle_on_unit || null, cycle_off_value: supp.cycle_off_value || null, cycle_off_unit: supp.cycle_off_unit || null }); setSubmitError(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const openAddToProtocol = (protocol) => {
    setEditingId(null);
    setForm(blankForm(protocol.id));
    setSubmitError(null);
    setFormOpen(true);
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
          dbAddSupplementHistory(savedName, token).catch(() => {});
        }
      }
      recomputeNotifications(token);
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

  const stopSupp = async () => {
    if (!editingId) return;
    const supp = supps.find(s => s.id === editingId);
    if (!supp) return;
    const today = dateKey(new Date());
    try {
      await dbUpdateSupp({ ...supp, status: 'stopped', stopped_at: today }, token);
      setSupps(s => s.map(x => x.id === editingId ? { ...x, status: 'stopped', stopped_at: today } : x));
      closeForm();
      showToast(`${supp.name} stopped`);
    } catch (err) {
      showToast(`Couldn't stop ${supp.name}. Try again.`);
      console.error(err);
    }
  };

  const resumeSupp = async (supp) => {
    try {
      const updated = { ...supp, status: 'active', stopped_at: null };
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === supp.id ? updated : x));
      showToast(`${supp.name} resumed`);
    } catch (err) {
      showToast(`Couldn't resume ${supp.name}. Try again.`);
      console.error(err);
    }
  };

  const resumeSuppFromForm = async () => {
    if (!editingId) return;
    const supp = supps.find(s => s.id === editingId);
    if (!supp) return;
    try {
      const updated = { ...supp, status: 'active', stopped_at: null };
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === editingId ? updated : x));
      setForm(f => ({ ...f, status: 'active', stopped_at: null }));
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

      recomputeNotifications(token);
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
      recomputeNotifications(token);
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

  const pauseProtocol = async (protocol) => {
    try {
      await dbPauseProtocol(protocol.id, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? { ...x, status: 'paused' } : x));
      setSupps(s => s.map(x => x.protocol_id === protocol.id ? { ...x, status: 'active', paused: false } : x));
      showToast(`${protocol.name} paused`);
    } catch (err) { showToast("Couldn't pause. Try again."); console.error(err); }
  };

  const archiveProtocol = async (protocol) => {
    try {
      await dbArchiveProtocol(protocol.id, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? { ...x, status: 'archived' } : x));
      setSupps(s => s.map(x => x.protocol_id === protocol.id ? { ...x, status: 'active', paused: false } : x));
      showToast(`${protocol.name} archived`);
    } catch (err) { showToast("Couldn't archive. Try again."); console.error(err); }
  };

  const activateProtocol = async (protocol) => {
    try {
      await dbActivateProtocol(protocol.id, token);
      setProtocols(p => p.map(x => x.id === protocol.id ? { ...x, status: 'active' } : x));
      showToast(`${protocol.name} activated`);
    } catch (err) { showToast("Couldn't activate. Try again."); console.error(err); }
  };

  const deleteProtocol = async (protocol) => {
    try {
      await dbDeleteProtocol(protocol.id, token);
      setProtocols(p => p.filter(x => x.id !== protocol.id));
    } catch (err) { showToast("Couldn't delete. Try again."); console.error(err); }
  };

  const activateReceived = async (send) => {
    try {
      const protoRows = await dbAddProtocol({ name: send.name, status: 'active', user_id: user.id, treatment_mode: 'indefinite', source: 'clinician' }, token);
      const newProto = protoRows?.[0];
      if (!newProto) throw new Error('Protocol creation failed');
      const snapshot = send.supplements_snapshot || [];
      const suppRows = await Promise.all(snapshot.map(s =>
        dbAddSupp({ name: s.name, dose: s.dose || '', notes: s.notes || '', slots: s.slots || [], days: s.days?.length ? s.days : [0,1,2,3,4,5,6], category: s.category || 'Oral', paused: false, status: 'active', stopped_at: null, user_id: user.id, protocol_id: newProto.id, treatment_mode: 'indefinite', starts_at: null, ends_at: null, cycle_on_value: null, cycle_on_unit: null, cycle_off_value: null, cycle_off_unit: null }, token)
      ));
      setProtocols(p => [...p, newProto]);
      setSupps(s => [...s, ...suppRows.flatMap(r => r || []).map(x => ({ ...x, paused: x.paused ?? false }))]);
      await dbUpdateProtocolSend(send.id, { status: 'activated' }, token);
      showToast(`${send.name} activated`);
    } catch (err) { showToast("Couldn't activate. Try again."); console.error(err); }
  };

  const sendProtocol = async (protocol, patientId) => {
    try {
      const snapshot = visibleSupps.filter(s => s.protocol_id === protocol.id).map(s => ({ name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category }));
      await dbSendProtocol({ clinician_id: user.id, patient_id: patientId, source_protocol_id: protocol.id, name: protocol.name, supplements_snapshot: snapshot }, token);
      showToast(`${protocol.name} sent`);
    } catch (err) { showToast("Couldn't send protocol. Try again."); console.error(err); }
  };

  const handleEditFormTogglePause = async () => {
    const supp = supps.find(s => s.id === editingId);
    if (!supp) return;
    const ok = await togglePause(supp);
    if (ok) closeForm();
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
        recomputeNotifications(token);
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

  const dayLabel  = isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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
        recomputeNotifications(token);
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

  const slotCardsContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs2 }}>
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
        return <SlotCard key={slot.id} slot={displaySlot} slotSupps={slotSupps} status={status} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={noSched ? null : effectivePillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule={noSched} isReadOnly={isReadOnly} isPast={isPast} />;
      })}
      {anytimeSupps.length > 0 && (
        <SlotCard slot={ANYTIME_SLOT} slotSupps={anytimeSupps} status="future" timeLabel="" hasOffset={false} pillTime={null} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule isReadOnly={isReadOnly} isPast={isPast} />
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ display: "flex", flexDirection: "row", height: "100dvh", overflow: "hidden", background: theme.surface.canvas, fontFamily: typography.fontBody, color: theme.text.primary, WebkitFontSmoothing: "antialiased" }}>
        <Sidebar
          pushScreen={pushScreen}
          displayName={profile?.display_name?.trim().split(" ")[0] || null}
          isClinician={isClinician}
          activeNavItem={activeNavItem}
          onNavChange={(nav) => { setActiveNavItem(nav); setSelectedPatient(null); }}
          patients={patients}
          selectedPatient={selectedPatient}
          onPatientSelect={(p) => setSelectedPatient(prev => prev?.id === p.id ? null : p)}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: spacing.xl, minWidth: 0 }}>
          {selectedPatient ? (
            <PatientDetailPanel patient={selectedPatient} token={token} />
          ) : (<>
          {/* Header: greeting left, avatar right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
            <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading }}>
              Hello, {profile?.display_name?.trim().split(" ")[0] || 'there'}
            </span>
            <AccountAvatar displayName={profile?.display_name?.trim().split(" ")[0] || null} />
          </div>
          <WeekStrip
            weekDates={weekDates}
            weekLogs={weekLogs}
            supplements={supps}
            selectedDate={viewDate}
            onSelectDate={(date) => { setViewDate(startOfDay(date)); setPastDayEditing(false); }}
            onPrev={handlePrevWeek}
            onNext={handleNextWeek}
            canNavigateNext={canNavigateNext}
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
                onConfigureSchedule={openManageSchedule}
                onManageProtocol={openManageProtocol}
              />
            </div>
          </div>
          </>)}
        </main>

        <SettingsScreen
          isOpen={screenStack.some(s => s.name === 'settings')}
          onBack={popScreen}
          onSignOut={handleSignOut}
          user={user}
          token={token}
          profile={profile}
          onProfileUpdate={(updated) => setProfile(updated)}
          onNotificationsEnabled={() => recomputeNotifications(token)}
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
          token={token}
          onActivateReceived={activateReceived}
        />
        <ProtocolDetailScreen
          isOpen={screenStack.some(s => s.name === 'protocol_detail')}
          onBack={popScreen}
          protocol={selectedProtocol}
          supplements={visibleSupps}
          onUpdateProtocol={updateProtocol}
          onPauseProtocol={pauseProtocol}
          onArchiveProtocol={archiveProtocol}
          onActivateProtocol={activateProtocol}
          onDeleteProtocol={deleteProtocol}
          onAddSupp={() => openAddToProtocol(selectedProtocol)}
          onEditSupp={openEdit}
          onTogglePauseSupp={togglePause}
          onResumeSupp={resumeSupp}
          isClinician={isClinician}
          patients={patients}
          onSendToPatient={sendProtocol}
        />
        <Modal
          open={formOpen}
          onClose={closeForm}
          title={editingId ? "Edit item" : "New item"}
          footer={
            form.status !== 'stopped' ? (
              <>
                {submitError && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs, textAlign: "center" }}>{submitError}</div>}
                <Button variant="primary" fullWidth onClick={submitForm} disabled={submitting || !form.name?.trim()}>
                  {submitting ? <InlineLoader size="sm" /> : (editingId ? "Save changes" : "Add to protocol")}
                </Button>
              </>
            ) : null
          }
        >
          <EditForm key={editingId ?? 'new'} form={form} setForm={setForm} editingId={editingId} onStop={stopSupp} onResume={resumeSuppFromForm} onDelete={deleteSupp} scheduleMode={scheduleMode} mealCount={mealCount} eveningMode={scheduleConfig.evening_mode ?? null} supplementHistory={supplementHistory} activeProtocols={protocols.filter(p => p.status === 'active')} />
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: typography.fontBody, color: theme.text.primary, maxWidth: layout.maxContentWidth, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: BG_GRADIENT, minHeight: "100vh" }}>

      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading }}>
          {profile?.display_name ? `Hello, ${profile.display_name.trim().split(" ")[0]}` : "Hello"}
        </span>
        <Button variant="icon" aria-label="Settings" onClick={() => pushScreen('settings')}>
          <Settings size={18} />
        </Button>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <Button variant="icon" aria-label="Previous day" onClick={() => goDay(-1)}><ChevronLeft size={24} color={theme.text.secondary} style={{ marginRight: spacing.xxxs }} /></Button>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${spacing.xs}px` }}>
          <div style={{ fontSize: typography.label, color: theme.text.secondary, fontWeight: typography.semibold, letterSpacing: typography.labelSpacingWide, textTransform: "uppercase", marginBottom: spacing.xxxs, fontFamily: typography.fontHeading }}>MY PROTOCOL</div>
          <button onClick={() => { if (!isToday) { setViewDate(TODAY); setPastDayEditing(false); } }} style={{ fontSize: typography.title, fontWeight: typography.bold, letterSpacing: typography.headingLetterSpacing, background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? theme.text.primary : theme.accent.default, padding: 0, display: "block", width: "100%", textAlign: "center", fontFamily: typography.fontHeading }}>{dayLabel}</button>
          <div style={{ fontSize: typography.caption2, color: theme.text.faint, marginTop: spacing.xxxs, minHeight: 14, letterSpacing: typography.labelSpacingTight }}>{isToday ? shortDate : "tap to return to today"}</div>
        </div>
        <Button variant="icon" aria-label="Next day" onClick={() => goDay(1)}><ChevronRight size={24} color={theme.text.secondary} style={{ marginLeft: spacing.xxxs }} /></Button>
      </div>

      {/* Add row — hidden on past days (not scope of past-day editing) */}
      {!isPast && (
        <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.md }}>
          <Button variant="primary" onClick={openAdd} style={{ flex: 1 }}>+ Add item</Button>
          <Button variant="secondary" onClick={() => pushScreen('manage_protocol')} style={{ flex: 1, background: theme.surface.modal }}>Protocols</Button>
        </div>
      )}

      {/* Content area — visually muted on read-only past days */}
      <div style={{ opacity: isReadOnly ? 0.6 : 1, transition: "opacity 200ms ease-out" }}>

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
          pastDayEditing={pastDayEditing} setPastDayEditing={setPastDayEditing}
          nextFixedSlot={nextFixedSlot}
        />

        {/* Main slot list */}
        <div style={{ borderRadius: theme.radius.surface, border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, background: theme.surface.card, padding: spacing.md, marginBottom: spacing.md }}>
          {homeSupps.length === 0 ? (
            <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
              <div style={{ fontSize: typography.display, marginBottom: spacing.md }}>💊</div>
              <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>Your protocol is empty</div>
              <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5, marginBottom: spacing.lg }}>Add your first item to get started.</div>
              {!isPast && <Button variant="primary" fullWidth onClick={openAdd}>Add to protocol</Button>}
            </div>
          ) : slotCardsContent}
        </div>

      </div>{/* end opacity wrapper */}

      {/* Screens */}
      <SettingsScreen
        isOpen={screenStack.some(s => s.name === 'settings')}
        onBack={popScreen}
        onSignOut={handleSignOut}
        user={user}
        token={token}
        profile={profile}
        onProfileUpdate={(updated) => setProfile(updated)}
        onNotificationsEnabled={() => recomputeNotifications(token)}
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
      />
      <ProtocolDetailScreen
        isOpen={screenStack.some(s => s.name === 'protocol_detail')}
        onBack={popScreen}
        protocol={selectedProtocol}
        supplements={visibleSupps}
        onUpdateProtocol={updateProtocol}
        onPauseProtocol={pauseProtocol}
        onArchiveProtocol={archiveProtocol}
        onActivateProtocol={activateProtocol}
        onDeleteProtocol={deleteProtocol}
        onAddSupp={() => openAddToProtocol(selectedProtocol)}
        onEditSupp={openEdit}
        onTogglePauseSupp={togglePause}
        onResumeSupp={resumeSupp}
      />
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? "Edit item" : "New item"}
        footer={
          form.status !== 'stopped' ? (
            <>
              {submitError && <div style={{ fontSize: typography.label, color: theme.status.danger, marginBottom: spacing.xs, textAlign: "center" }}>{submitError}</div>}
              <Button variant="primary" fullWidth onClick={submitForm} disabled={submitting || !form.name?.trim()}>
                {submitting ? <InlineLoader size="sm" /> : (editingId ? "Save changes" : "Add to protocol")}
              </Button>
            </>
          ) : null
        }
      >
        <EditForm key={editingId ?? 'new'} form={form} setForm={setForm} editingId={editingId} onStop={stopSupp} onResume={resumeSuppFromForm} onDelete={deleteSupp} scheduleMode={scheduleMode} mealCount={mealCount} eveningMode={scheduleConfig.evening_mode ?? null} supplementHistory={supplementHistory} activeProtocols={protocols.filter(p => p.status === 'active')} />
      </Modal>
    </div>
  );
}
