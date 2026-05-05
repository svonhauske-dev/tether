import { useState, useEffect, useRef } from "react";
import {
  colors, spacing, radius, typography, touch, layout,
  gradients, shadows, zIndex, segBtnStyle,
} from "./design-system";
import { DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, toHrMin, fromHrMin } from "./config";
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
import Auth from "./components/Auth";
import SlotCard from "./components/SlotCard";
import EditForm from "./components/EditForm";
import {
  supa, getSession, signInPassword, signUp, signOut, refreshSession,
  dbGetSupps, dbAddSupp, dbUpdateSupp, dbDeleteSupp,
  dbGetLog, dbUpsertLog,
  dbGetSchedule, dbSaveSchedule,
} from './lib/api';
import { fmtTime, addMins, parseHHMM, dateKey, startOfDay, TODAY } from './lib/time';
import { SLOTS, scheduleNotifications, notifOK } from './lib/notifications';

// ── Constants ─────────────────────────────────────────────────────────────────

const BG_GRADIENT = gradients.bg;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function deriveOffsets(mode, cfg) {
  if (mode === "none" || mode === "fixed") return null;
  if (mode === "fasting") {
    const winStart = cfg.window_start ?? 0;
    const winLen   = cfg.window_length ?? 480;
    const meals    = cfg.meals_per_day ?? 2;
    const interval = Math.floor(winLen / (meals + 1));
    const pmw      = cfg.pre_meal_window ?? 30;
    return {
      pre_breakfast: winStart + interval - pmw,
      breakfast:     winStart + interval,
      pre_lunch:     meals >= 2 ? winStart + (interval * 2) - pmw : null,
      lunch:         meals >= 2 ? winStart + (interval * 2) : null,
      pre_dinner:    meals >= 3 ? winStart + (interval * 3) - pmw : null,
      dinner:        meals >= 3 ? winStart + (interval * 3) : null,
      after_dinner:  winStart + winLen + 30,
      injectable:    null,
      topical:       null,
    };
  }
  const pmw       = cfg.pre_meal_window ?? 30;
  const pre_bfast = (cfg.breakfast ?? 60) - pmw;
  return {
    pre_breakfast: pre_bfast,
    breakfast:     cfg.breakfast ?? 60,
    pre_lunch:     (cfg.lunch ?? 300) - pmw,
    lunch:         cfg.lunch ?? 300,
    pre_dinner:    (cfg.dinner ?? 540) - pmw,
    dinner:        cfg.dinner ?? 540,
    after_dinner:  cfg.after_dinner ?? 660,
    injectable:    null,
    topical:       null,
  };
}

const MODES = [
  { id: "none",       title: "No Schedule",          desc: "Just a checklist — no times, no notifications" },
  { id: "medication", title: "Medication Anchor",    desc: "Cascades from when you take your meds" },
  { id: "wakeup",     title: "Wake Up Anchor",       desc: "Cascades from when you wake up" },
  { id: "fasting",    title: "Intermittent Fasting", desc: "Builds around your eating window" },
  { id: "fixed",      title: "Fixed Times",          desc: "Same schedule every day" },
];

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

const CORE_SLOTS = ["rx", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

const ANYTIME_SLOT = { id: "anytime", label: "Anytime", sublabel: "No specific time", icon: "◦", color: colors.textMuted };

const CATEGORIES = ["Oral", "Rx", "Injectable", "Topical"];




// ── ScheduleModal ─────────────────────────────────────────────────────────────

function ScheduleModal({ scheduleMode, setScheduleMode, scheduleConfig, setScheduleConfig,
                         anchorBehavior, consistentTime, onSave, onClose, saveFnRef }) {
  const [localMode,     setLocalMode]     = useState(scheduleMode);
  const [localConfig,   setLocalConfig]   = useState({
    ...DEFAULT_CONFIG,
    ...scheduleConfig,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times, ...(scheduleConfig.fixed_times || {}) },
  });
  const [localBehavior, setLocalBehavior] = useState(anchorBehavior);
  const [localTime,     setLocalTime]     = useState(consistentTime);

  const updateConfig = (key, value) => setLocalConfig(c => ({ ...c, [key]: value }));
  const updateFixed  = (key, value) => setLocalConfig(c => ({
    ...c, fixed_times: { ...c.fixed_times, [key]: value || null },
  }));

  const handleSave = () => {
    setScheduleMode(localMode);
    setScheduleConfig(localConfig);
    onSave(localMode, localConfig, localBehavior, localTime);
  };
  if (saveFnRef) saveFnRef.current = handleSave;

  const previewBase = parseHHMM("07:00");
  const derived     = localMode !== "fixed" ? deriveOffsets(localMode, localConfig) : null;

  const previewRows = localMode === "fixed"
    ? FIXED_SLOTS
        .filter(fs => localConfig.fixed_times?.[fs.key])
        .map(fs => ({ label: fs.label, timeStr: localConfig.fixed_times[fs.key] }))
        .sort((a, b) => a.timeStr.localeCompare(b.timeStr))
    : [
        { label: MODES.find(m => m.id === localMode)?.title ?? "Anchor", offset: 0 },
        ...Object.entries(derived || {})
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([sid, offset]) => ({ label: SLOTS.find(s => s.id === sid)?.label ?? sid, offset })),
      ].sort((a, b) => a.offset - b.offset);

  const mealRows = [
    { key: "breakfast",    label: "Breakfast" },
    { key: "lunch",        label: "Lunch" },
    { key: "dinner",       label: "Dinner" },
    { key: "after_dinner", label: "Evening" },
  ];

  const isOffsetMode = localMode === "medication" || localMode === "wakeup";

  return (
    <div>
      {/* Mode grid — "none" spans full width, others 2-col */}
      <div style={{ marginBottom: spacing.lg }}>
        <Label>Schedule type</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.xs }}>
          {MODES.map(m => {
            const on = localMode === m.id;
            return (
              <Card key={m.id} onClick={() => setLocalMode(m.id)} style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: spacing.xxs, minHeight: layout.modeButtonHeight, background: on ? colors.accentSubtle : "transparent", border: `1px solid ${on ? colors.accent : colors.borderSubtle}`, marginBottom: 0, ...(m.id === "none" ? { gridColumn: "1 / -1" } : {}) }}>
                <span style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: on ? colors.accent : colors.textPrimary }}>{m.title}</span>
                <span style={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.4 }}>{m.desc}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* No Schedule — explanation only, no config */}
      {localMode === "none" && (
        <Card variant="accent" style={{ padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.label, color: colors.accent, marginBottom: spacing.md }}>
          Tracking only — no notifications. Add supplements without picking "when to take it" to use a pure checklist.
        </Card>
      )}

      {/* Anchor note */}
      {localMode !== "fixed" && localMode !== "none" && (
        <Card variant="accent" style={{ padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.label, color: colors.accent, marginBottom: spacing.md }}>
          {ANCHOR_NOTES[localMode]}
        </Card>
      )}

      {/* Flexible / Consistent toggle (non-fixed, non-none modes) */}
      {localMode !== "fixed" && localMode !== "none" && (
        <div style={{ marginBottom: spacing.md }}>
          <Label>Daily timing</Label>
          <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.xs }}>
            {[["flexible", "Flexible"], ["consistent", "Consistent"]].map(([val, label]) => {
              const on = localBehavior === val;
              return (
                <button key={val} onClick={() => setLocalBehavior(val)} style={segBtnStyle(on)}>{label}</button>
              );
            })}
          </div>
          <div style={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.6 }}>
            {localBehavior === "flexible"
              ? "Tap each morning to set your schedule for the day."
              : "Your schedule runs automatically at the same time every day."}
          </div>
          {localBehavior === "consistent" && (
            <div style={{ marginTop: spacing.sm }}>
              <Label>Start time</Label>
              <Input variant="time" value={localTime} onChange={e => setLocalTime(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* Medication / Wakeup: offset editor */}
      {isOffsetMode && (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meal schedule</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              {mealRows.map(({ key, label }) => {
                const total   = localConfig[key];
                const isEmpty = total === null || total === undefined;
                const { h, m } = toHrMin(isEmpty ? 0 : total);
                return (
                  <Card key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                    <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
                    <Input
                      variant="number" width={52} min="0" max="23"
                      value={isEmpty ? "" : h}
                      onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(e.target.value, isEmpty ? 0 : m))}
                      placeholder="0"
                    />
                    <span style={{ fontSize: typography.label, color: colors.textMuted }}>hr</span>
                    <Input
                      variant="number" width={52} min="0" max="59"
                      value={isEmpty ? "" : m}
                      onChange={e => updateConfig(key, e.target.value === "" ? 0 : fromHrMin(isEmpty ? 0 : h, e.target.value))}
                      placeholder="0"
                    />
                    <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>after anchor</span>
                  </Card>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: spacing.lg }}>
            <Label>Pre-meal window</Label>
            <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Take pre-meal supplements</span>
              <Input
                variant="number" width={52} min="0" max="120"
                value={localConfig.pre_meal_window ?? 30}
                onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
              />
              <span style={{ fontSize: typography.label, color: colors.textMuted }}>min before eating</span>
            </Card>
            <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xs, paddingLeft: spacing.xs }}>applies to all meals</div>
          </div>
        </>
      )}

      {/* Fasting: segmented controls */}
      {localMode === "fasting" && (
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Window length</Label>
            <div style={{ display: "flex", gap: spacing.xs }}>
              {[[240, "4 hr"], [360, "6 hr"], [480, "8 hr"]].map(([val, lbl]) => {
                const on = (localConfig.window_length ?? 480) === val;
                return <button key={val} onClick={() => updateConfig("window_length", val)} style={segBtnStyle(on)}>{lbl}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <Label>Meals per day</Label>
            <div style={{ display: "flex", gap: spacing.xs }}>
              {[[2, "2 meals"], [3, "3 meals"]].map(([val, lbl]) => {
                const on = (localConfig.meals_per_day ?? 2) === val;
                return <button key={val} onClick={() => updateConfig("meals_per_day", val)} style={segBtnStyle(on)}>{lbl}</button>;
              })}
            </div>
          </div>
          <Card style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
            <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Pre-meal supplements</span>
            <Input variant="number" width={52} min="0" max="120" value={localConfig.pre_meal_window ?? 30} onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)} />
            <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>min before</span>
          </Card>
          <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xs, paddingLeft: spacing.xs }}>How many minutes before each meal to take pre-meal supplements</div>
        </div>
      )}

      {/* Fixed: time pickers */}
      {localMode === "fixed" && (
        <div style={{ marginBottom: spacing.lg }}>
          <Label>Fixed times</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {FIXED_SLOTS.map(({ key, label }) => (
              <Card key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: 0 }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
                <Input
                  variant="time"
                  value={localConfig.fixed_times?.[key] || ""}
                  onChange={e => updateFixed(key, e.target.value)}
                  style={{ width: "auto" }}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Live preview — hidden in no-schedule mode */}
      {localMode !== "none" && <div style={{ marginBottom: spacing.lg }}>
        <Label>{localMode === "fixed" ? "Schedule preview" : "Preview (7:00 am anchor)"}</Label>
        <div style={{ borderRadius: radius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.bgCard, padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.xs }}>
          {previewRows.length === 0
            ? <span style={{ fontSize: typography.caption, color: colors.textMuted }}>No times configured yet</span>
            : previewRows.map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <span style={{ fontSize: typography.caption, fontVariantNumeric: "tabular-nums", color: colors.accent, fontWeight: typography.semibold, minWidth: 42 }}>
                    {row.timeStr ?? fmtTime(addMins(previewBase, row.offset))}
                  </span>
                  <span style={{ fontSize: typography.caption, color: colors.textMuted }}>—</span>
                  <span style={{ fontSize: typography.caption, color: colors.textSecondary }}>{row.label}</span>
                </div>
              ))
          }
        </div>
      </div>}

    </div>
  );
}


// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const token = () => localStorage.getItem("sb_token") || "";

  useEffect(() => { getSession().then(u => { setUser(u); setAuthLoading(false); }); }, []);

  return (
    <ToastProvider>
      {authLoading
        ? <Loader text="Loading…" />
        : !user
          ? <Auth onSignIn={u => setUser(u)} />
          : <ProtocolApp user={user} token={token()} onSignOut={() => { signOut(); setUser(null); }} />
      }
      <Toast />
    </ToastProvider>
  );
}

// ── ProtocolApp ───────────────────────────────────────────────────────────────

function ProtocolApp({ user, token, onSignOut }) {
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
  const [notifStatus, setNotifStatus]       = useState(notifOK() ? Notification.permission : "unsupported");
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
  const saveTimer = useRef(null);
  const schedSaveRef = useRef(null);
  const { show: showToast } = useToast();

  const slotOffsets   = scheduleMode === "fixed" ? null : deriveOffsets(scheduleMode, scheduleConfig);
  const visibleSupps  = supps.filter(s => !pendingDeletes[s.id]);
  const homeSupps     = visibleSupps.filter(s => !s.paused);

  const dk       = dateKey(viewDate);
  const isToday  = dateKey(viewDate) === dateKey(TODAY);
  const isFuture = startOfDay(viewDate) > TODAY;
  const pillTime = pillTimes[dk] || null;
  const viewDay  = viewDate.getDay();

  // fixed mode: always active; consistent mode: pre-populate with set time
  const effectivePillTime = scheduleMode === "fixed"
    ? (pillTime || "00:00")
    : anchorBehavior === "consistent"
      ? (pillTime || consistentTime)
      : pillTime;

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, log, sched] = await Promise.all([
          dbGetSupps(token),
          dbGetLog(dk, token),
          dbGetSchedule(token),
        ]);
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
      dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: pt || null, checked: dayChecked }, token).catch(e => console.error(e));
    }, 800);
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

  const goDay         = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate() + offset); setViewDate(startOfDay(d)); };
  const setPillForDay = (t) => setPillTimes(pt => ({ ...pt, [dk]: t }));

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
  const toggleCheck     = (sid, suppId) => { const k = `${dk}_${sid}_${suppId}`; setChecked(c => ({ ...c, [k]: !c[k] })); };
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
    scheduleNotifications(t, homeSupps, viewDay, dk, slotOffsets);
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

  const openAdd   = () => { setEditingId(null); setForm({ name: "", dose: "", notes: "", slots: [], days: [], category: "Oral", timePreference: "Anytime", paused: false }); setFormOpen(true); };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...supp.slots], days: [...supp.days], category: supp.category || "Oral", timePreference: supp.timePreference || "Anytime", paused: supp.paused ?? false }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    const cat = form.category || "Oral";
    const finalDays = form.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : form.days;
    if (editingId) {
      try {
        await dbUpdateSupp({ ...form, days: finalDays, category: cat, id: editingId }, token);
        setSupps(s => s.map(x => x.id === editingId ? { ...form, days: finalDays, category: cat, id: editingId } : x));
        showToast(`Updated ${form.name}`);
      } catch (err) {
        showToast("Couldn't save — try again");
        console.error(err);
        return;
      }
    } else {
      try {
        const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: finalDays, category: cat, timePreference: form.timePreference || "Anytime", paused: false, user_id: user.id }, token);
        if (rows?.[0]) setSupps(s => [...s, rows[0]]);
        showToast(`Added ${form.name}`);
      } catch (err) {
        showToast("Couldn't save — try again");
        console.error(err);
        return;
      }
    }
    closeForm();
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
    } catch (err) {
      showToast("Couldn't update — try again");
      console.error(err);
      return false;
    }
    try {
      const updatedHome = supps.map(x => x.id === supp.id ? updated : x).filter(s => !pendingDeletes[s.id] && !s.paused);
      scheduleNotifications(effectivePillTime, updatedHome, viewDay, dk, slotOffsets);
    } catch (e) {
      console.warn("scheduleNotifications failed (non-fatal):", e);
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

  const r = 30, circ = 2 * Math.PI * r, dash = circ * (pct / 100);
  const dayLabel   = isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const shortDate  = viewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // Hero state helpers
  const isConsistent   = anchorBehavior === "consistent";
  const heroHasTime    = pillTime != null || isConsistent;
  const heroDisplayTime = pillTime || consistentTime;

  if (loading) return <Loader text="Loading your protocol…" />;
  if (needsOnboarding) return (
    <Onboarding onComplete={async (mode, config, behavior, cTime) => {
      const ok = await saveSchedule(mode, config, behavior, cTime);
      if (ok) setNeedsOnboarding(false);
    }} />
  );

  return (
    <div style={{ fontFamily: typography.fontBody, color: colors.textPrimary, maxWidth: layout.maxContentWidth, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: BG_GRADIENT, minHeight: "100vh" }}>

      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: colors.textPrimary, fontFamily: typography.fontHeading }}>Tether</span>
        <Button variant="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
          <Settings size={18} />
        </Button>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <Button variant="icon" aria-label="Previous day" onClick={() => goDay(-1)}><ChevronLeft size={24} color={colors.textSecondary} /></Button>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${spacing.xs}px` }}>
          <div style={{ fontSize: typography.label, color: colors.textMuted, fontWeight: typography.semibold, letterSpacing: typography.labelSpacingWide, textTransform: "uppercase", marginBottom: spacing.xxxs, fontFamily: typography.fontHeading }}>MY PROTOCOL</div>
          <button onClick={() => { if (!isToday) setViewDate(TODAY); }} style={{ fontSize: typography.title, fontWeight: typography.bold, letterSpacing: typography.headingLetterSpacing, background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? colors.textPrimary : colors.accent, padding: 0, display: "block", width: "100%", textAlign: "center", fontFamily: typography.fontHeading }}>{dayLabel}</button>
          <div style={{ fontSize: typography.caption2, color: colors.textFaint, marginTop: spacing.xxxs, minHeight: 14, letterSpacing: typography.labelSpacingTight }}>{isToday ? shortDate : "tap to return to today"}</div>
        </div>
        <Button variant="icon" aria-label="Next day" onClick={() => goDay(1)}><ChevronRight size={24} color={colors.textSecondary} /></Button>
      </div>

      {/* Add row */}
      <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.md }}>
        <Button variant="primary" onClick={openAdd} style={{ flex: 1 }}>+ Add Supplement</Button>
        <Button variant="secondary" onClick={() => setShowSchedule(true)} style={{ flex: 1 }}>Edit Schedule</Button>
      </div>

      {/* Hero card */}
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

      {/* Main slot list */}
      <div style={{ borderRadius: radius.xl, border: `1px solid ${colors.borderBase}`, background: colors.bgCard, padding: spacing.md, marginBottom: spacing.md }}>
        {homeSupps.length === 0 ? (
          <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
            <div style={{ fontSize: typography.hero, marginBottom: spacing.md }}>💊</div>
            <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>Your protocol is empty</div>
            <div style={{ fontSize: typography.caption, color: colors.textMuted, lineHeight: 1.7, marginBottom: spacing.lg }}>Add your first supplement to get started.</div>
            <Button variant="primary" fullWidth onClick={openAdd}>Add first supplement</Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {/* Anytime block — only in no-schedule mode, for unsorted supplements */}
            {scheduleMode === "none" && anytimeSupps.length > 0 && (
              <SlotCard slot={ANYTIME_SLOT} slotSupps={anytimeSupps} status="future" timeLabel="" hasOffset={false} pillTime={null} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule />
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
              return <SlotCard key={slot.id} slot={slot} slotSupps={slotSupps} status={status} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={noSched ? null : effectivePillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} noSchedule={noSched} />;
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        notifStatus={notifStatus}
        onEnableNotifications={async () => { const r = await Notification.requestPermission(); setNotifStatus(r); return r; }}
        onOpenManage={() => { setShowSettings(false); setShowManage(true); }}
        onSignOut={handleSignOut}
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
        title={editingId ? "Edit supplement" : "New supplement"}
        footer={
          <Button variant="primary" fullWidth onClick={submitForm}>
            {editingId ? "Save changes" : "Add supplement"}
          </Button>
        }
      >
        <EditForm form={form} setForm={setForm} editingId={editingId} />
      </Modal>
      <Modal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        title="Daily Schedule"
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
