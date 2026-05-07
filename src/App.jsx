import { useState, useEffect, useRef } from "react";
import {
  spacing, typography, touch, layout,
  shadows, zIndex,
} from "./design-system";
import { ThemeProvider, useTheme } from './lib/theme';
import DevThemePicker from "./components/DevThemePicker";
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, toHrMin, fromHrMin, MODES, deriveOffsets, getSlotLabelForMode } from "./config";
import { Settings, Trash2, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Button from "./components/Button";
import Input from "./components/Input";
import Card from "./components/Card";
import Badge from "./components/Badge";
import Label from "./components/Label";
import Modal from "./components/Modal";
import SettingsModal from "./components/SettingsModal";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import ManageSupplementsSheet from "./components/ManageSupplementsSheet";
import Onboarding from "./components/Onboarding";
import Loader from "./components/Loader";
import InlineLoader from "./components/InlineLoader";
import Auth from "./components/Auth";
import PromptName from "./components/PromptName";
import SlotCard from "./components/SlotCard";
import EditForm from "./components/EditForm";
import ScheduleModal from "./components/ScheduleModal";
import Hero from "./components/Hero";
import {
  supa, getSession, signInPassword, signUp, signOut, refreshSession,
  dbGetSupps, dbAddSupp, dbUpdateSupp, dbDeleteSupp,
  dbGetLog, dbUpsertLog,
  dbGetSchedule, dbSaveSchedule,
  dbUpdateScheduleField,
  dbGetProfile, dbCreateProfile,
  recomputeNotifications,
} from './lib/api';
import { fmtTime, addMins, parseHHMM, dateKey, startOfDay, TODAY } from './lib/time';
import { SLOTS, isPushSupported, needsHomeScreenInstall, getCurrentSubscription, registerServiceWorker, subscribeToPush } from './lib/notifications';
import NotificationPrompt from "./components/NotificationPrompt";

// ── Constants ─────────────────────────────────────────────────────────────────

// BG_GRADIENT is derived from theme inside ProtocolApp

const CORE_SLOTS = ["rx", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

// ANYTIME_SLOT color is set inside ProtocolApp after theme is available






// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const token = () => localStorage.getItem("sb_token") || "";

  useEffect(() => { getSession().then(u => { setUser(u); setAuthLoading(false); }); }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        {authLoading
          ? <Loader text="Loading…" />
          : !user
            ? <Auth onSignIn={u => setUser(u)} />
            : <ProtocolApp user={user} token={token()} onSignOut={() => { signOut(); setUser(null); }} />
        }
        <Toast />
        {import.meta.env.DEV && <DevThemePicker />}
      </ToastProvider>
    </ThemeProvider>
  );
}

// ── ProtocolApp ───────────────────────────────────────────────────────────────

function ProtocolApp({ user, token, onSignOut }) {
  const { theme, syncFromDB } = useTheme();

  // Sync theme from DB once on auth — DB wins over localStorage for cross-device consistency
  useEffect(() => { syncFromDB(user.id, token); }, []);
  const ANYTIME_SLOT = { id: "anytime", label: "Anytime", sublabel: "No specific time", icon: "◦", color: theme.text.muted };
  const BG_GRADIENT = theme.gradients.bg;
  const [supps, setSupps]                   = useState([]);
  const [pillTimes, setPillTimes]           = useState({});
  const [checked, setChecked]               = useState({});
  const [loading, setLoading]               = useState(true);
  const [viewDate, setViewDate]             = useState(TODAY);
  const [editPillTime, setEditPillTime]     = useState(false);
  const [tmpTime, setTmpTime]               = useState("");
  const [formOpen, setFormOpen]             = useState(false);
  const [editingId, setEditingId]           = useState(null);
  const [form, setForm]                     = useState({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", timePreference: "Anytime", paused: false });
  const [streak, setStreak]                 = useState(0);
  const [flashGreen, setFlashGreen]         = useState(false);
  const [showSchedule, setShowSchedule]     = useState(false);
  const [scheduleMode, setScheduleMode]     = useState("none");
  const [scheduleConfig, setScheduleConfig] = useState({
    ...DEFAULT_CONFIG,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times },
  });
  const [anchorBehavior, setAnchorBehavior] = useState("flexible");
  const [consistentTime, setConsistentTime] = useState("07:00");
  const [showSettings, setShowSettings]     = useState(false);
  const [showManage, setShowManage]         = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profile, setProfile]               = useState(null);
  const [needsNamePrompt, setNeedsNamePrompt] = useState(false);
  const [pastDayEditing, setPastDayEditing]         = useState(false);
  const [needsNotificationPrompt, setNeedsNotificationPrompt] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [submitError, setSubmitError]         = useState(null);
  const saveTimer = useRef(null);
  const schedSaveRef = useRef(null);
  const { show: showToast } = useToast();

  const slotOffsets   = scheduleMode === "fixed" ? null : deriveOffsets(scheduleMode, scheduleConfig);
  const visibleSupps  = supps.filter(s => !pendingDeletes[s.id]);
  const homeSupps     = visibleSupps.filter(s => !s.paused);

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

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, log, sched, prof] = await Promise.all([
          dbGetSupps(token),
          dbGetLog(dk, token),
          dbGetSchedule(token),
          dbGetProfile(user.id, token).catch(() => null),
        ]);
        setProfile(prof);
        if (prof === null) setNeedsNamePrompt(true);
        const migrated = [];
        const toWrite  = [];
        for (const supp of (s || [])) {
          let out = supp;
          if (out.slots?.includes("fasted")) {
            out = { ...out, slots: out.slots.map(sl => sl === "fasted" ? "pre_breakfast" : sl) };
          }
          if ((out.category === "Injectable" || out.category === "Topical") && !out.timePreference) {
            out = { ...out, timePreference: "Anytime" };
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

        // auto-set pill time for consistent mode if not already logged today
        if (behavior === "consistent" && !log?.pill_time) {
          setPillTimes(pt => ({ ...pt, [dk]: cTime }));
        }
      } catch (e) {
        console.error("Initial load failed:", e);
      } finally {
        setLoading(false);
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
    dbGetLog(dk, token).then(log => {
      if (!log) return;
      if (log.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0, 5) }));
      if (log.checked)   setChecked(c => ({ ...c, ...log.checked }));
    }).catch(e => console.error(e));
  }, [dk]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pt = pillTimes[dk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk)));
      dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: pt || null, checked: dayChecked }, token).catch(() => showToast("Couldn't save check — try again"));
    }, 200);
  }, [checked, pillTimes, dk, loading]);

  // Streak
  useEffect(() => {
    let s = 0; const d = new Date(TODAY);
    for (let i = 0; i < 30; i++) {
      const ddk = dateKey(d);
      const pt  = pillTimes[ddk];
      if (!pt && scheduleMode !== "fixed" && scheduleMode !== "none" && anchorBehavior !== "consistent") break;
      const day     = d.getDay();
      const allDone = CORE_SLOTS.every(sid => supps.filter(x => !x.paused && x.slots.includes(sid) && x.days.includes(day)).every(x => !!checked[`${ddk}_${sid}_${x.id}`]));
      if (!allDone) break;
      s++; d.setDate(d.getDate() - 1);
    }
    setStreak(s);
  }, [checked, pillTimes, supps, scheduleMode, anchorBehavior]);

  const goDay         = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate() + offset); setViewDate(startOfDay(d)); setPastDayEditing(false); };
  const setPillForDay = (t) => {
    setPillTimes(pt => ({ ...pt, [dk]: t }));
    recomputeNotifications(token);
  };

  const getSlotTime = (sid) => {
    if (sid === "injectable" || sid === "topical") return null;
    if (scheduleMode === "fixed") {
      const ft = scheduleConfig.fixed_times?.[sid];
      return ft ? parseHHMM(ft) : null;
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

  const anytimeSupps = scheduleMode === "none"
    ? homeSupps.filter(s => s.slots.length === 0 && s.days.includes(viewDay))
    : [];
  let coreTotal = anytimeSupps.length, coreDone = 0;
  anytimeSupps.forEach(s => { if (isChecked("anytime", s.id)) coreDone++; });
  CORE_SLOTS.forEach(sid => {
    const sl = getSuppsForSlot(sid).filter(s => (s.category || "Oral") !== "Injectable" && (s.category || "Oral") !== "Topical");
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

  const openAdd   = () => { setEditingId(null); setForm({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", timePreference: "Anytime", paused: false, treatment_mode: "indefinite", starts_at: null, ends_at: null, cycle_on_value: null, cycle_on_unit: null, cycle_off_value: null, cycle_off_unit: null }); setSubmitError(null); setFormOpen(true); };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...supp.slots], days: [...supp.days], category: supp.category || "Oral", timePreference: supp.timePreference || "Anytime", paused: supp.paused ?? false, treatment_mode: supp.treatment_mode || "indefinite", starts_at: supp.starts_at || null, ends_at: supp.ends_at || null, cycle_on_value: supp.cycle_on_value || null, cycle_on_unit: supp.cycle_on_unit || null, cycle_off_value: supp.cycle_off_value || null, cycle_off_unit: supp.cycle_off_unit || null }); setSubmitError(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

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
        const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: finalDays, category: cat, timePreference: form.timePreference || "Anytime", paused: false, user_id: user.id, ...txFields }, token);
        if (rows?.[0]) setSupps(s => [...s, rows[0]]);
        showToast(`Added ${form.name}`);
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

  const saveSchedule = async (mode, config, behavior, cTime) => {
    const offsets = { ...config, _anchor_behavior: behavior, _consistent_time: cTime };
    try {
      await dbSaveSchedule({ user_id: user.id, schedule_type: mode, offsets }, token);
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

      showToast("Schedule updated");
      recomputeNotifications(token);
    } catch (err) {
      showToast("Couldn't save — try again");
      console.error(err);
      return false;
    }
    setShowSchedule(false);
    return true;
  };

  const togglePause = async (supp) => {
    const updated = { ...supp, paused: !supp.paused };
    try {
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === supp.id ? updated : x));
      showToast(updated.paused ? `Paused ${supp.name}` : `Resumed ${supp.name}`);
      recomputeNotifications(token);
    } catch (err) {
      showToast("Couldn't update — try again");
      console.error(err);
      return false;
    }
    return true;
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

  if (loading) return <Loader text="Loading your protocol…" />;
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
      const ok = await saveSchedule(mode, config, behavior, cTime);
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

  return (
    <div style={{ fontFamily: typography.fontBody, color: theme.text.primary, maxWidth: layout.maxContentWidth, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: BG_GRADIENT, minHeight: "100vh" }}>

      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: theme.text.primary, fontFamily: typography.fontHeading }}>
          {profile?.display_name ? `Hello, ${profile.display_name.trim().split(" ")[0]}` : "Hello"}
        </span>
        <Button variant="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
          <Settings size={18} />
        </Button>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <Button variant="icon" aria-label="Previous day" onClick={() => goDay(-1)}><ChevronLeft size={24} color={theme.text.secondary} style={{ marginRight: spacing.xxxs }} /></Button>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${spacing.xs}px` }}>
          <div style={{ fontSize: typography.label, color: theme.text.muted, fontWeight: typography.semibold, letterSpacing: typography.labelSpacingWide, textTransform: "uppercase", marginBottom: spacing.xxxs, fontFamily: typography.fontHeading }}>MY PROTOCOL</div>
          <button onClick={() => { if (!isToday) { setViewDate(TODAY); setPastDayEditing(false); } }} style={{ fontSize: typography.title, fontWeight: typography.bold, letterSpacing: typography.headingLetterSpacing, background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? theme.text.primary : theme.accent.default, padding: 0, display: "block", width: "100%", textAlign: "center", fontFamily: typography.fontHeading }}>{dayLabel}</button>
          <div style={{ fontSize: typography.caption2, color: theme.text.faint, marginTop: spacing.xxxs, minHeight: 14, letterSpacing: typography.labelSpacingTight }}>{isToday ? shortDate : "tap to return to today"}</div>
        </div>
        <Button variant="icon" aria-label="Next day" onClick={() => goDay(1)}><ChevronRight size={24} color={theme.text.secondary} style={{ marginLeft: spacing.xxxs }} /></Button>
      </div>

      {/* Add row — hidden on past days (not scope of past-day editing) */}
      {!isPast && (
        <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.md }}>
          <Button variant="primary" onClick={openAdd} style={{ flex: 1 }}>+ Add item</Button>
          <Button variant="secondary" onClick={() => setShowSchedule(true)} style={{ flex: 1, background: theme.surface.modal }}>Edit schedule</Button>
        </div>
      )}

      {/* Content area — visually muted on read-only past days */}
      <div style={{ opacity: isReadOnly ? 0.6 : 1, transition: "opacity 200ms ease-out" }}>

        {/* Hero card */}
        <Hero
          scheduleMode={scheduleMode} isToday={isToday} viewDate={viewDate} shortDate={shortDate}
          pct={pct} coreTotal={coreTotal} coreDone={coreDone}
          pillTime={pillTime} anchorBehavior={anchorBehavior} consistentTime={consistentTime}
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs2 }}>
              {/* Anytime block — only in no-schedule mode, for unsorted supplements */}
              {scheduleMode === "none" && anytimeSupps.length > 0 && (
                <SlotCard slot={ANYTIME_SLOT} slotSupps={anytimeSupps} status="future" timeLabel="" hasOffset={false} pillTime={null} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule isReadOnly={isReadOnly} isPast={isPast} />
              )}
              {SLOTS.map(slot => {
                const slotSupps = slot.id === "injectable"
                  ? getSuppsForSlot(slot.id).filter(s => s.category === "Injectable")
                  : slot.id === "topical"
                    ? getSuppsForSlot(slot.id).filter(s => s.category === "Topical")
                    : getSuppsForSlot(slot.id).filter(s => s.category !== "Injectable" && s.category !== "Topical");
                if (!slotSupps.length) return null;
                const isVarSlot = slot.id === "injectable" || slot.id === "topical";
                const hasOffset = scheduleMode === "fixed"
                  ? !isVarSlot && !!scheduleConfig.fixed_times?.[slot.id]
                  : slot.id === "rx"
                    ? !!pillTime
                    : !isVarSlot && slotOffsets?.[slot.id] !== null && slotOffsets?.[slot.id] !== undefined;
                const noSched = scheduleMode === "none";
                const timeLabel = noSched ? "" : isVarSlot ? "variable" : (hasOffset ? slotTimeStr(slot.id) : "variable");
                const status = noSched ? "future" : slotStatus(slot.id);
                const overrideLabel = getSlotLabelForMode(slot.id, scheduleMode);
                const displaySlot = overrideLabel ? { ...slot, label: overrideLabel } : slot;
                return <SlotCard key={slot.id} slot={displaySlot} slotSupps={slotSupps} status={status} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={noSched ? null : effectivePillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule={noSched} isReadOnly={isReadOnly} isPast={isPast} />;
              })}
            </div>
          )}
        </div>

      </div>{/* end opacity wrapper */}

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenManage={() => { setShowSettings(false); setShowManage(true); }}
        onSignOut={handleSignOut}
        user={user}
        token={token}
        profile={profile}
        onProfileUpdate={(updated) => setProfile(updated)}
        onNotificationsEnabled={() => recomputeNotifications(token)}
      />
      <ManageSupplementsSheet
        open={showManage}
        onClose={() => setShowManage(false)}
        supplements={visibleSupps}
        onEdit={(supp) => { setShowManage(false); openEdit(supp); }}
        onDelete={requestDelete}
        onTogglePause={togglePause}
      />
      <Modal
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
        <EditForm form={form} setForm={setForm} editingId={editingId} />
      </Modal>
      <Modal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        title="Daily schedule"
        footer={<Button variant="primary" fullWidth onClick={() => schedSaveRef.current?.()}>Save schedule</Button>}
      >
        <ScheduleModal
          key={String(showSchedule)}
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
          scheduleConfig={scheduleConfig}
          setScheduleConfig={setScheduleConfig}
          anchorBehavior={anchorBehavior}
          consistentTime={consistentTime}
          onSave={saveSchedule}
          onClose={() => setShowSchedule(false)}
          saveFnRef={schedSaveRef}
        />
      </Modal>
    </div>
  );
}
