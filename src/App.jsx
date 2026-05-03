import { useState, useEffect, useRef } from "react";
import {
  colors, spacing, radius, typography, touch,
  cardStyle, inputStyle, labelStyle, primaryButtonStyle, ghostButtonStyle, badgeStyle,
} from "./design-system";

const SUPA_URL = "https://yahimlivfieuknagusxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaGltbGl2ZmlldWtuYWd1c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODYwNDIsImV4cCI6MjA5MzM2MjA0Mn0._5_t5k1NCAHAFHEz0clqD8fSxsNCMzlqBoRPSmD7wxs";

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supa(method, path, body, token) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPA_KEY,
    "Authorization": `Bearer ${token || SUPA_KEY}`,
    "Prefer": "resolution=merge-duplicates,return=representation",
  };
  const res = await fetch(SUPA_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.ok ? res.json() : null;
}

async function getSession() {
  const token = localStorage.getItem("sb_token");
  if (!token) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
    });
    if (res.ok) { const d = await res.json(); return d.id ? d : null; }
  } catch (e) {}
  return null;
}

async function signUp(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (res.ok && d.access_token) { localStorage.setItem("sb_token", d.access_token); return d.user; }
  return null;
}

async function signInPassword(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    const d = await res.json();
    if (d.access_token) { localStorage.setItem("sb_token", d.access_token); return d.user; }
  }
  return null;
}

function signOut() { localStorage.removeItem("sb_token"); }

// ── DB helpers ────────────────────────────────────────────────────────────────

const dbGetSupps     = (t)       => supa("GET",    "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
const dbAddSupp      = (s, t)    => supa("POST",   "/rest/v1/supplements", s, t);
const dbUpdateSupp   = (s, t)    => supa("PATCH",  `/rest/v1/supplements?id=eq.${s.id}`, { name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category, updated_at: new Date().toISOString() }, t);
const dbDeleteSupp   = (id, t)   => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
const dbGetLog       = (date, t) => supa("GET",    `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
const dbUpsertLog    = (log, t)  => supa("POST",   "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
const dbGetSchedule  = (t)       => supa("GET",    "/rest/v1/user_schedule?select=*", null, t).then(r => r?.[0] || null);
const dbSaveSchedule = (data, t) => supa("POST",   "/rest/v1/user_schedule?on_conflict=user_id", data, t);

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOTS = [
  { id: "rx",            label: "Anchor Medication", sublabel: "Empty stomach · first thing", icon: "★", color: colors.slotRx },
  { id: "pre_breakfast", label: "Before Breakfast",  sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreBreakfast },
  { id: "breakfast",     label: "With Breakfast",    sublabel: "With food",                   icon: "●", color: colors.slotBreakfast },
  { id: "pre_lunch",     label: "Before Lunch",      sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreLunch },
  { id: "lunch",         label: "With Lunch",        sublabel: "With food",                   icon: "●", color: colors.slotLunch },
  { id: "pre_dinner",    label: "Before Dinner",     sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreDinner },
  { id: "dinner",        label: "With Dinner",       sublabel: "With food",                   icon: "●", color: colors.slotDinner },
  { id: "after_dinner",  label: "After Dinner",      sublabel: "Before bed",                  icon: "◑", color: colors.slotAfterDinner },
  { id: "injectable",    label: "Injectables",       sublabel: "Subcutaneous",                icon: "⊕", color: colors.slotInjectable },
];

const DEFAULT_CONFIG = {
  pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660,
  window_start: 0, window_length: 480, meals_per_day: 2,
  fixed_times: {
    pre_breakfast: "07:30", breakfast: "08:00", pre_lunch: "11:30", lunch: "12:00",
    pre_dinner: "17:30", dinner: "18:00", after_dinner: "20:00", injectable: null,
  },
};

function deriveOffsets(mode, cfg) {
  if (mode === "fixed") return null;
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
  };
}

// Row 1: Medication | Wakeup — Row 2: Fasting | Fixed
const MODES = [
  { id: "medication", title: "Medication Anchor",    desc: "Cascades from when you take your meds" },
  { id: "wakeup",     title: "Wake Up Anchor",       desc: "Cascades from when you wake up" },
  { id: "fasting",    title: "Intermittent Fasting", desc: "Builds around your eating window" },
  { id: "fixed",      title: "Fixed Times",          desc: "Same schedule every day" },
];

const ANCHOR_NOTES = {
  medication: "Anchor = when you take your medication each morning",
  fasting:    "Anchor = when your eating window opens",
  wakeup:     "Anchor = when you wake up each morning",
};

const FIXED_SLOTS = [
  { key: "pre_breakfast", label: "Before Breakfast" },
  { key: "breakfast",     label: "Breakfast" },
  { key: "pre_lunch",    label: "Before Lunch" },
  { key: "lunch",        label: "Lunch" },
  { key: "pre_dinner",   label: "Before Dinner" },
  { key: "dinner",       label: "Dinner" },
  { key: "after_dinner", label: "Evening" },
  { key: "injectable",   label: "Injectables" },
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

const CATEGORIES = ["Oral", "Rx", "Injectable", "Topical"];

// ── Utilities ─────────────────────────────────────────────────────────────────

const pad        = (n) => String(n).padStart(2, "0");
const fmtTime    = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addMins    = (d, m) => new Date(d.getTime() + m * 60000);
const parseHHMM  = (s) => { const [h, m] = s.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; };
const dateKey    = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const notifOK    = () => "Notification" in window;

const TODAY = startOfDay(new Date());

// ── Notifications ─────────────────────────────────────────────────────────────

function scheduleNotifications(pt, supps, vd, dk, offsets) {
  if (window._nto) window._nto.forEach(clearTimeout);
  window._nto = [];
  if (!pt || Notification.permission !== "granted") return;
  const base = parseHHMM(pt), now = new Date();
  SLOTS.forEach(slot => {
    if (slot.id === "injectable") return;
    const offset = slot.id === "rx" ? 0 : (offsets?.[slot.id] ?? null);
    if (offset === null) return;
    const t = addMins(base, offset), diff = t - now; if (diff < 0) return;
    const sl = supps.filter(s => s.slots.includes(slot.id) && s.days.includes(vd));
    if (!sl.length) return;
    window._nto.push(setTimeout(() => {
      try { new Notification("Time for your protocol", { body: `${slot.label}: ${sl.map(s => s.name).join(", ")}`, tag: `${dk}_${slot.id}` }); } catch (e) {}
    }, diff));
  });
}

// ── SignIn ────────────────────────────────────────────────────────────────────

function SignIn({ onSignIn }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState("signin");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setMsg("");
    const user = mode === "signin"
      ? await signInPassword(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);
    if (user) onSignIn(user);
    else setMsg(mode === "signin" ? "Invalid email or password." : "Could not create account — try again.");
  };

  const si = { ...inputStyle, textAlign: "center", fontSize: 16 };

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", background: `linear-gradient(160deg,${colors.bgBase} 0%,#0a0f1e 50%,#060a12 100%)`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }}>💊</div>
        <div style={{ fontSize: typography.hero, fontWeight: typography.bold, color: colors.textPrimary, letterSpacing: "-0.02em", marginBottom: spacing.xs }}>Protocol Tracker</div>
        <div style={{ fontSize: typography.caption, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 1.7 }}>Your supplement schedule,<br />built around your life.</div>
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="your@email.com" type="email" style={si} />
        <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="password" type="password" style={{ ...si, marginTop: spacing.xs }} />
        <button onClick={handleSubmit} disabled={loading} style={{ ...primaryButtonStyle, marginTop: spacing.md, cursor: loading ? "default" : "pointer" }}>
          {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setMsg(""); }} style={{ marginTop: spacing.md, background: "none", border: "none", color: colors.textMuted, fontSize: typography.caption, cursor: "pointer" }}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        {msg && <div style={{ marginTop: spacing.md, fontSize: typography.caption, color: colors.danger }}>{msg}</div>}
      </div>
    </div>
  );
}

// ── Loader ────────────────────────────────────────────────────────────────────

function Loader({ text }) {
  return (
    <div style={{ background: `linear-gradient(160deg,${colors.bgBase} 0%,#0a0f1e 50%,#060a12 100%)`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: typography.caption, color: colors.textMuted }}>{text}</div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, children }) {
  useEffect(function() {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return function() {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.78)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: colors.bgModal, borderRadius: radius.xl, padding: spacing.lg, maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box", border: `1px solid ${colors.borderBase}` }}>
        {children}
      </div>
    </div>
  );
}

// ── EditForm ──────────────────────────────────────────────────────────────────

function EditForm({ form, setForm, editingId, onSubmit, onCancel, onDelete }) {
  const toggleSlot = (sid) => setForm(f => ({ ...f, slots: f.slots.includes(sid) ? f.slots.filter(x => x !== sid) : [...f.slots, sid] }));
  const toggleDay  = (i)   => setForm(f => ({ ...f, days:  f.days.includes(i)   ? f.days.filter(x => x !== i)   : [...f.days, i]   }));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <span style={{ fontSize: typography.title, fontWeight: typography.bold, color: colors.textPrimary }}>{editingId ? "Edit supplement" : "New supplement"}</span>
        <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: radius.full, border: `1px solid ${colors.borderStrong}`, background: colors.bgCardHover, cursor: "pointer", fontSize: typography.caption, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary }}>✕</button>
      </div>
      {[["Name", "name", "e.g. Magnesium Glycinate"], ["Dose", "dose", "e.g. 2 caps (300 mg)"], ["Notes", "notes", "e.g. Thorne · with food"]].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: spacing.md }}>
          <label style={labelStyle}>{lbl}</label>
          <input style={inputStyle} value={form[key]} placeholder={ph} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}
      <div style={{ marginBottom: spacing.md }}>
        <label style={labelStyle}>Category</label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {CATEGORIES.map(cat => {
            const on = form.category === cat;
            return (
              <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                style={{ flex: 1, padding: `${spacing.xs}px`, borderRadius: radius.md, cursor: "pointer",
                  fontSize: typography.caption, background: on ? colors.accent : "transparent",
                  color: on ? colors.textPrimary : colors.textSecondary,
                  border: `1px solid ${on ? colors.accent : colors.borderStrong}`,
                  fontWeight: on ? typography.semibold : typography.regular, minHeight: 36 }}>
                {cat}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: spacing.lg }}>
        <label style={labelStyle}>When to take it</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
          {SLOTS.map(slot => { const on = form.slots.includes(slot.id); return (
            <button key={slot.id} onClick={() => toggleSlot(slot.id)} style={{ fontSize: typography.caption, padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.full, cursor: "pointer", background: on ? slot.color + "22" : "transparent", color: on ? slot.color : colors.textSecondary, border: `1px solid ${on ? slot.color : colors.borderStrong}`, fontWeight: on ? typography.semibold : typography.regular }}>{slot.label}</button>
          ); })}
        </div>
      </div>
      <div style={{ marginBottom: spacing.lg }}>
        <label style={labelStyle}>Which days</label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {DAYS.map((d, i) => { const on = form.days.includes(i); return (
            <button key={i} onClick={() => toggleDay(i)} style={{ width: touch.min, height: touch.min, borderRadius: radius.full, fontSize: typography.caption, cursor: "pointer", fontWeight: typography.semibold, background: on ? colors.accent : "transparent", color: on ? colors.textPrimary : colors.textSecondary, border: `1px solid ${on ? colors.accent : colors.borderStrong}`, padding: 0, flexShrink: 0 }}>{d[0]}</button>
          ); })}
        </div>
      </div>
      {editingId && <button onClick={onDelete} style={{ width: "100%", padding: `${spacing.sm}px ${spacing.md}px`, minHeight: touch.min, borderRadius: radius.lg, cursor: "pointer", background: "transparent", color: colors.danger, border: `1px solid rgba(248,113,113,0.25)`, fontSize: typography.body, fontWeight: typography.medium, marginBottom: spacing.xs }}>Delete supplement</button>}
      <button onClick={onSubmit} style={primaryButtonStyle}>{editingId ? "Save changes" : "Add supplement"}</button>
    </div>
  );
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

function toHrMin(totalMins) {
  if (!totalMins && totalMins !== 0) return { h: 0, m: 0 };
  return { h: Math.floor(totalMins / 60), m: totalMins % 60 };
}
function fromHrMin(h, m) { return (parseInt(h) || 0) * 60 + (parseInt(m) || 0); }

const numInputStyle = { ...inputStyle, width: 52, textAlign: "right", padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: 16 };

// ── ScheduleModal ─────────────────────────────────────────────────────────────

function ScheduleModal({ scheduleMode, setScheduleMode, scheduleConfig, setScheduleConfig,
                         anchorBehavior, consistentTime, onSave, onClose }) {
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

  const segBtn = (on) => ({
    flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.md, cursor: "pointer",
    fontSize: typography.caption, background: on ? colors.accentDim : "transparent",
    color: on ? colors.accent : colors.textSecondary,
    border: `1px solid ${on ? colors.accentBorder : colors.borderStrong}`,
    fontWeight: on ? typography.semibold : typography.regular, minHeight: 40,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <span style={{ fontSize: typography.title, fontWeight: typography.bold, color: colors.textPrimary }}>Daily Schedule</span>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: radius.full, border: `1px solid ${colors.borderStrong}`, background: colors.bgCardHover, cursor: "pointer", fontSize: typography.caption, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary }}>✕</button>
      </div>

      {/* 2×2 mode grid */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={labelStyle}>Schedule type</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.xs }}>
          {MODES.map(m => {
            const on = localMode === m.id;
            return (
              <button key={m.id} onClick={() => setLocalMode(m.id)} style={{ textAlign: "left", padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, cursor: "pointer", background: on ? colors.accentDim : "transparent", border: `1px solid ${on ? colors.accentBorder : colors.borderStrong}`, display: "flex", flexDirection: "column", gap: 4, minHeight: 64 }}>
                <span style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: on ? colors.accent : colors.textPrimary }}>{m.title}</span>
                <span style={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.4 }}>{m.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Anchor note */}
      {localMode !== "fixed" && (
        <div style={{ marginBottom: spacing.md, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, background: colors.accentDim, border: `1px solid ${colors.accentBorder}`, fontSize: typography.label, color: colors.accent }}>
          {ANCHOR_NOTES[localMode]}
        </div>
      )}

      {/* Flexible / Consistent toggle (non-fixed modes) */}
      {localMode !== "fixed" && (
        <div style={{ marginBottom: spacing.md }}>
          <label style={labelStyle}>Daily timing</label>
          <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.xs }}>
            {[["flexible", "Flexible"], ["consistent", "Consistent"]].map(([val, label]) => {
              const on = localBehavior === val;
              return (
                <button key={val} onClick={() => setLocalBehavior(val)} style={segBtn(on)}>{label}</button>
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
              <label style={labelStyle}>Start time</label>
              <input type="time" value={localTime} onChange={e => setLocalTime(e.target.value)}
                style={{ fontSize: 16, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`, background: colors.bgInner,
                  color: colors.textPrimary, width: "100%", boxSizing: "border-box", outline: "none" }} />
            </div>
          )}
        </div>
      )}

      {/* Medication / Wakeup: offset editor */}
      {isOffsetMode && (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <label style={labelStyle}>Meal schedule</label>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              {mealRows.map(({ key, label, nullable }) => {
                const total   = localConfig[key];
                const isEmpty = total === null || total === undefined;
                const { h, m } = toHrMin(isEmpty ? 0 : total);
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.md, background: colors.bgCard, border: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
                    <input
                      type="number" min="0" max="23"
                      value={isEmpty ? "" : h}
                      onChange={e => updateConfig(key, e.target.value === "" ? (nullable ? null : 0) : fromHrMin(e.target.value, isEmpty ? 0 : m))}
                      placeholder="0"
                      style={numInputStyle}
                    />
                    <span style={{ fontSize: typography.label, color: colors.textMuted }}>hr</span>
                    <input
                      type="number" min="0" max="59"
                      value={isEmpty ? "" : m}
                      onChange={e => updateConfig(key, e.target.value === "" ? (nullable ? null : 0) : fromHrMin(isEmpty ? 0 : h, e.target.value))}
                      placeholder="0"
                      style={numInputStyle}
                    />
                    <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>after anchor</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: spacing.lg }}>
            <label style={labelStyle}>Pre-meal window</label>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.md, background: colors.bgCard, border: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Take pre-meal supplements</span>
              <input
                type="number" min="0" max="120"
                value={localConfig.pre_meal_window ?? 30}
                onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)}
                style={numInputStyle}
              />
              <span style={{ fontSize: typography.label, color: colors.textMuted }}>min before eating</span>
            </div>
            <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xs, paddingLeft: spacing.xs }}>applies to all meals</div>
          </div>
        </>
      )}

      {/* Fasting: segmented controls */}
      {localMode === "fasting" && (
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ marginBottom: spacing.md }}>
            <label style={labelStyle}>Window length</label>
            <div style={{ display: "flex", gap: spacing.xs }}>
              {[[240, "4 hr"], [360, "6 hr"], [480, "8 hr"]].map(([val, lbl]) => {
                const on = (localConfig.window_length ?? 480) === val;
                return <button key={val} onClick={() => updateConfig("window_length", val)} style={segBtn(on)}>{lbl}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <label style={labelStyle}>Meals per day</label>
            <div style={{ display: "flex", gap: spacing.xs }}>
              {[[2, "2 meals"], [3, "3 meals"]].map(([val, lbl]) => {
                const on = (localConfig.meals_per_day ?? 2) === val;
                return <button key={val} onClick={() => updateConfig("meals_per_day", val)} style={segBtn(on)}>{lbl}</button>;
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.md, background: colors.bgCard, border: `1px solid ${colors.borderSubtle}` }}>
            <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>Pre-meal window</span>
            <input type="number" min="0" max="120" value={localConfig.pre_meal_window ?? 30} onChange={e => updateConfig("pre_meal_window", parseInt(e.target.value) || 0)} style={numInputStyle} />
            <span style={{ fontSize: typography.label, color: colors.textMuted, minWidth: 60 }}>min before</span>
          </div>
        </div>
      )}

      {/* Fixed: time pickers */}
      {localMode === "fixed" && (
        <div style={{ marginBottom: spacing.lg }}>
          <label style={labelStyle}>Fixed times</label>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {FIXED_SLOTS.map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.md, background: colors.bgCard, border: `1px solid ${colors.borderSubtle}` }}>
                <span style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>{label}</span>
                <input
                  type="time"
                  value={localConfig.fixed_times?.[key] || ""}
                  onChange={e => updateFixed(key, e.target.value)}
                  style={{ background: colors.bgInput, color: colors.textPrimary, border: `1px solid ${colors.borderStrong}`, borderRadius: radius.sm, fontSize: 16, padding: `${spacing.xs}px ${spacing.sm}px`, outline: "none" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live preview */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={labelStyle}>{localMode === "fixed" ? "Schedule preview" : "Preview (7:00 am anchor)"}</label>
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
      </div>

      <button onClick={handleSave} style={primaryButtonStyle}>Save schedule</button>
    </div>
  );
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, slotSupps, status, timeLabel, hasOffset, pillTime, isFuture, isChecked, toggleCheck, openEdit }) {
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);

  const SC = {
    done:   { border: colors.borderSubtle,     bg: "rgba(255,255,255,0.02)", hbg: "transparent",           badge: null },
    missed: { border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.05)", hbg: "rgba(249,115,22,0.07)", badge: { label: "missed", bg: "rgba(124,45,18,0.5)",   color: "#fed7aa" } },
    now:    { border: "rgba(61,154,143,0.45)", bg: "rgba(61,154,143,0.04)", hbg: "rgba(61,154,143,0.07)",  badge: { label: "now",    bg: "rgba(61,154,143,0.18)", color: colors.accent } },
    future: { border: colors.borderSubtle,     bg: "rgba(255,255,255,0.02)", hbg: "transparent",           badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ marginBottom: spacing.xs, borderRadius: radius.md, border: `1px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: status === "future" && !pillTime ? 0.38 : 1 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: `${spacing.sm}px ${spacing.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: radius.xs, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.bold }}>✓</span></div>
            : <span style={{ color: slot.color, fontSize: typography.caption, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: allDone ? colors.textMuted : colors.textPrimary, display: "flex", alignItems: "center", gap: spacing.xs }}>
              {slot.label}
              {sc.badge && <span style={badgeStyle(sc.badge.bg, sc.badge.color)}>{sc.badge.label}</span>}
            </div>
            <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: 2 }}>{allDone && !expanded ? `${slotSupps.length} supplement${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
          <span style={{ fontSize: typography.caption, color: pillTime && hasOffset ? slot.color : colors.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: typography.semibold }}>{timeLabel}</span>
          <span style={{ fontSize: typography.caption, color: colors.textMuted, display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: `0 ${spacing.md}px`, borderTop: `1px solid ${sc.border}` }}>
          {slotSupps.map((supp, i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.sm}px 0`, borderBottom: i < slotSupps.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                <div onClick={() => { if (!isFuture) toggleCheck(slot.id, supp.id); }} style={{ width: 24, height: 24, borderRadius: radius.sm, flexShrink: 0, border: `1.5px solid ${done ? colors.accent : colors.borderStrong}`, background: done ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isFuture ? "default" : "pointer" }}>
                  {done && <span style={{ color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.bold }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.body, color: done ? colors.textDone : colors.textPrimary, textDecoration: done ? "line-through" : "none", fontWeight: done ? typography.regular : typography.medium }}>{supp.name}</div>
                  <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: 2 }}>{supp.dose}</div>
                  {supp.notes && <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xxs }}>{supp.notes}</div>}
                </div>
                <button onClick={e => { e.stopPropagation(); openEdit(supp); }} style={{ fontSize: typography.label, padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, cursor: "pointer", border: `1px solid ${colors.borderBase}`, background: colors.bgCard, color: colors.textSecondary, flexShrink: 0, minHeight: touch.min, display: "flex", alignItems: "center" }}>Edit</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const token = () => localStorage.getItem("sb_token") || "";

  useEffect(() => { getSession().then(u => { setUser(u); setAuthLoading(false); }); }, []);

  if (authLoading) return <Loader text="Loading…" />;
  if (!user) return <SignIn onSignIn={u => setUser(u)} />;
  return <ProtocolApp user={user} token={token()} onSignOut={() => { signOut(); setUser(null); }} />;
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
  const [form, setForm]                     = useState({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6], category: "Oral" });
  const [notifStatus, setNotifStatus]       = useState(notifOK() ? Notification.permission : "unsupported");
  const [streak, setStreak]                 = useState(0);
  const [flashGreen, setFlashGreen]         = useState(false);
  const [showSchedule, setShowSchedule]     = useState(false);
  const [scheduleMode, setScheduleMode]     = useState("medication");
  const [scheduleConfig, setScheduleConfig] = useState({
    ...DEFAULT_CONFIG,
    fixed_times: { ...DEFAULT_CONFIG.fixed_times },
  });
  const [anchorBehavior, setAnchorBehavior] = useState("flexible");
  const [consistentTime, setConsistentTime] = useState("07:00");
  const saveTimer = useRef(null);

  const slotOffsets = scheduleMode === "fixed" ? null : deriveOffsets(scheduleMode, scheduleConfig);

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
      const [s, log, sched] = await Promise.all([
        dbGetSupps(token),
        dbGetLog(dk, token),
        dbGetSchedule(token),
      ]);
      const migrated = (s || []).map(supp =>
        supp.slots?.includes("fasted")
          ? { ...supp, slots: supp.slots.map(sl => sl === "fasted" ? "pre_breakfast" : sl) }
          : supp
      );
      setSupps(migrated);
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

      // auto-set pill time for consistent mode if not already logged today
      if (behavior === "consistent" && !log?.pill_time) {
        setPillTimes(pt => ({ ...pt, [dk]: cTime }));
      }

      setLoading(false);
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
    });
  }, [dk]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pt = pillTimes[dk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk)));
      dbUpsertLog({ user_id: user.id, log_date: dk, pill_time: pt || null, checked: dayChecked }, token);
    }, 800);
  }, [checked, pillTimes, dk, loading]);

  // Streak
  useEffect(() => {
    let s = 0; const d = new Date(TODAY);
    for (let i = 0; i < 30; i++) {
      const ddk = dateKey(d);
      const pt  = pillTimes[ddk];
      if (!pt && scheduleMode !== "fixed" && anchorBehavior !== "consistent") break;
      const day     = d.getDay();
      const allDone = CORE_SLOTS.every(sid => supps.filter(x => x.slots.includes(sid) && x.days.includes(day)).every(x => !!checked[`${ddk}_${sid}_${x.id}`]));
      if (!allDone) break;
      s++; d.setDate(d.getDate() - 1);
    }
    setStreak(s);
  }, [checked, pillTimes, supps, scheduleMode, anchorBehavior]);

  const goDay         = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate() + offset); setViewDate(startOfDay(d)); };
  const setPillForDay = (t) => setPillTimes(pt => ({ ...pt, [dk]: t }));

  const getSlotTime = (sid) => {
    if (sid === "injectable") return null;
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
  const getSuppsForSlot = (sid) => supps.filter(s => s.slots.includes(sid) && s.days.includes(viewDay));

  const startDay = () => {
    if (isFuture) return;
    const t = fmtTime(new Date());
    setPillForDay(t);
    if (scheduleMode !== "wakeup") {
      const rxSupps = supps.filter(s => s.slots.includes("rx") && s.days.includes(viewDay));
      setChecked(c => { const n = { ...c }; rxSupps.forEach(s => { n[`${dk}_rx_${s.id}`] = true; }); return n; });
    }
    scheduleNotifications(t, supps, viewDay, dk, slotOffsets);
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

  let coreTotal = 0, coreDone = 0;
  CORE_SLOTS.forEach(sid => {
    const sl = getSuppsForSlot(sid).filter(s => (s.category || "Oral") !== "Injectable");
    coreTotal += sl.length;
    sl.forEach(s => { if (isChecked(sid, s.id)) coreDone++; });
  });
  const pct = coreTotal > 0 ? Math.round((coreDone / coreTotal) * 100) : 0;

  const openAdd   = () => { setEditingId(null); setForm({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6], category: "Oral" }); setFormOpen(true); };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...supp.slots], days: [...supp.days], category: supp.category || "Oral" }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    const cat = form.category || "Oral";
    if (editingId) {
      await dbUpdateSupp({ ...form, category: cat, id: editingId }, token);
      setSupps(s => s.map(x => x.id === editingId ? { ...form, category: cat, id: editingId } : x));
    } else {
      const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: form.days, category: cat, user_id: user.id }, token);
      if (rows?.[0]) setSupps(s => [...s, rows[0]]);
    }
    closeForm();
  };

  const deleteSupp = async () => {
    if (!editingId) return;
    await dbDeleteSupp(editingId, token);
    setSupps(s => s.filter(x => x.id !== editingId));
    closeForm();
  };

  const saveSchedule = async (mode, config, behavior, cTime) => {
    const offsets = { ...config, _anchor_behavior: behavior, _consistent_time: cTime };
    await dbSaveSchedule({ user_id: user.id, schedule_type: mode, offsets }, token);
    setAnchorBehavior(behavior);
    setConsistentTime(cTime);
    setShowSchedule(false);
  };

  const injectableSupps = supps.filter(s => s.category === "Injectable" && s.days.includes(viewDay));

  const r = 30, circ = 2 * Math.PI * r, dash = circ * (pct / 100);
  const dayLabel   = isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const heroCard   = { ...cardStyle, background: flashGreen ? colors.accentDim : colors.bgCard, transition: "background 0.4s ease" };
  const navArrow   = { width: touch.min, height: touch.min, display: "flex", alignItems: "center", justifyContent: "center", fontSize: typography.title, background: colors.bgCardHover, border: `1px solid ${colors.borderBase}`, cursor: "pointer", color: colors.textSecondary, borderRadius: radius.md, flexShrink: 0 };

  // Hero state helpers
  const isConsistent   = anchorBehavior === "consistent";
  const heroHasTime    = pillTime != null || isConsistent;
  const heroDisplayTime = pillTime || consistentTime;

  if (loading) return <Loader text="Loading your protocol…" />;

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", color: colors.textPrimary, maxWidth: 480, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: `linear-gradient(160deg,${colors.bgBase} 0%,#0a0f1e 50%,#060a12 100%)`, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <button onClick={() => goDay(-1)} style={navArrow}>‹</button>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${spacing.xs}px` }}>
          <div style={{ fontSize: typography.label, color: colors.textMuted, fontWeight: typography.semibold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>MY PROTOCOL</div>
          <button onClick={() => { if (!isToday) setViewDate(TODAY); }} style={{ fontSize: typography.title, fontWeight: typography.bold, letterSpacing: "-0.02em", background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? colors.textPrimary : colors.accent, padding: 0, display: "block", width: "100%", textAlign: "center" }}>{dayLabel}</button>
          {!isToday && <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xxs }}>tap to return to today</div>}
        </div>
        <button onClick={() => goDay(1)} style={navArrow}>›</button>
      </div>

      {/* Hero card */}
      <div style={heroCard}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: (heroHasTime || scheduleMode === "fixed") ? spacing.md : 0 }}>
          <div style={{ flex: 1 }}>
            {scheduleMode === "fixed" ? (
              <div>
                <div style={{ fontSize: typography.label, color: colors.textMuted, fontWeight: typography.semibold, letterSpacing: typography.labelSpacing, textTransform: "uppercase", marginBottom: spacing.xxs }}>Fixed schedule</div>
                <div style={{ fontSize: typography.title, fontWeight: typography.bold, color: colors.textPrimary }}>{DAYS[viewDay]}</div>
                {pct === 100 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
                {pct > 0 && pct < 100 && <div style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>{coreDone} of {coreTotal} done</div>}
              </div>
            ) : heroHasTime ? (
              <div>
                <div style={{ fontSize: typography.label, color: colors.textMuted, fontWeight: typography.semibold, letterSpacing: typography.labelSpacing, textTransform: "uppercase", marginBottom: spacing.xxs }}>
                  {pillTime ? "Started at" : "Scheduled"}
                </div>
                {editPillTime && pillTime ? (
                  <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                    <input type="time" value={tmpTime} onChange={e => setTmpTime(e.target.value)} style={{ fontSize: 16, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.sm, border: `1px solid ${colors.borderStrong}`, background: colors.bgCardHover, color: colors.textPrimary }} />
                    <button onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }} style={{ ...ghostButtonStyle, width: "auto", borderRadius: radius.sm }}>Save</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                    <span style={{ fontSize: typography.hero, fontWeight: typography.bold, letterSpacing: "-0.04em", color: colors.accent }}>{heroDisplayTime}</span>
                    {pillTime && <button onClick={() => { setTmpTime(pillTime); setEditPillTime(true); }} style={{ fontSize: typography.caption, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>edit</button>}
                  </div>
                )}
                {pct === 100 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
              </div>
            ) : (
              <div>
                <button onClick={startDay} style={{ ...primaryButtonStyle, minHeight: spacing.xxl, background: isFuture ? colors.bgCardHover : colors.accent, color: isFuture ? colors.textMuted : colors.textPrimary, cursor: isFuture ? "default" : "pointer" }}>
                  {isFuture ? "Future day" : (START_LABELS[scheduleMode] || "Start my day")}
                </button>
                {!isFuture && <div style={{ fontSize: typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" }}>{START_SUBTITLES[scheduleMode] || "sets your daily schedule"}</div>}
              </div>
            )}
          </div>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
            <circle cx="36" cy="36" r={r} fill="none" stroke={colors.borderBase} strokeWidth="5" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={colors.accent} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
            <text x="36" y="36" textAnchor="middle" dominantBaseline="middle" fill={colors.textPrimary} fontSize={typography.caption} fontWeight={typography.bold}>{pct}%</text>
          </svg>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing.xs }}>
          <div>
            {notifStatus === "default"     && <button onClick={async () => { const r = await Notification.requestPermission(); setNotifStatus(r); }} style={{ fontSize: typography.caption, padding: `${spacing.xs}px ${spacing.md}px`, minHeight: touch.min, borderRadius: radius.full, cursor: "pointer", border: `1px solid ${colors.accentBorder}`, background: colors.accentDim, color: colors.accent, fontWeight: typography.semibold }}>Enable reminders</button>}
            {notifStatus === "granted"     && <span style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.medium }}>Reminders on</span>}
            {notifStatus === "denied"      && <span style={{ fontSize: typography.caption, color: colors.danger }}>Reminders blocked</span>}
            {notifStatus === "unsupported" && <span style={{ fontSize: typography.caption, color: colors.textMuted }}>Add to home screen for reminders</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
            {streak > 0 && <div style={{ display: "flex", alignItems: "center", gap: spacing.xxs, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.18)", borderRadius: radius.full, padding: `${spacing.xxs}px ${spacing.xs}px` }}><span style={{ fontSize: typography.caption }}>🔥</span><span style={{ fontSize: typography.caption, fontWeight: typography.bold, color: "#fb923c" }}>{streak} day streak</span></div>}
            <button onClick={onSignOut} style={{ fontSize: typography.label, padding: `${spacing.xs}px ${spacing.md}px`, minHeight: touch.min, borderRadius: radius.sm, cursor: "pointer", border: `1px solid ${colors.borderBase}`, background: "transparent", color: colors.textMuted }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Add row */}
      <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.md }}>
        <button onClick={openAdd} style={{ flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.lg, cursor: "pointer", border: "1px dashed rgba(61,154,143,0.3)", background: "rgba(61,154,143,0.04)", fontSize: typography.caption, fontWeight: typography.semibold, color: "#3D9A8F", minHeight: 44, letterSpacing: "-0.01em", WebkitTapHighlightColor: "transparent" }}>+ Add Supplement</button>
        <button onClick={() => setShowSchedule(true)} style={{ flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.lg, cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontSize: typography.caption, fontWeight: typography.semibold, color: "rgba(255,255,255,0.45)", minHeight: 44, letterSpacing: "-0.01em", WebkitTapHighlightColor: "transparent" }}>Edit Schedule</button>
      </div>

      {/* Main slot list — injectable category excluded */}
      <div style={{ borderRadius: radius.xl, border: `1px solid ${colors.borderBase}`, background: colors.bgCard, padding: spacing.md, marginBottom: spacing.md }}>
        {supps.length === 0 ? (
          <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
            <div style={{ fontSize: typography.hero, marginBottom: spacing.md }}>💊</div>
            <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>Your protocol is empty</div>
            <div style={{ fontSize: typography.caption, color: colors.textMuted, lineHeight: 1.7, marginBottom: spacing.lg }}>Add your medications and supplements. Your schedule builds from when you take your first med each morning.</div>
            <button onClick={openAdd} style={{ ...primaryButtonStyle, minHeight: touch.min }}>Add first supplement</button>
          </div>
        ) : SLOTS.map(slot => {
          const slotSupps = getSuppsForSlot(slot.id).filter(s => (s.category || "Oral") !== "Injectable");
          if (!slotSupps.length) return null;
          const hasOffset = scheduleMode === "fixed"
            ? slot.id !== "injectable" && !!scheduleConfig.fixed_times?.[slot.id]
            : slot.id === "rx"
              ? !!pillTime
              : slot.id !== "injectable" && slotOffsets?.[slot.id] !== null && slotOffsets?.[slot.id] !== undefined;
          const timeLabel = slot.id === "injectable" ? "variable" : (hasOffset ? slotTimeStr(slot.id) : "variable");
          return <SlotCard key={slot.id} slot={slot} slotSupps={slotSupps} status={slotStatus(slot.id)} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={effectivePillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} />;
        })}
      </div>

      {/* Injectables section */}
      {injectableSupps.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 0 }}>
          <div style={{ fontSize: typography.label, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: spacing.sm, fontWeight: typography.semibold }}>
            Injectables
          </div>
          {injectableSupps.map(supp => {
            const done = isChecked("injectable", supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.sm, padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                <div onClick={() => toggleCheck("injectable", supp.id)}
                  style={{ width: 24, height: 24, borderRadius: radius.md, flexShrink: 0,
                    border: `1.5px solid ${done ? colors.accent : colors.borderStrong}`,
                    background: done ? colors.accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {done && <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: typography.body, color: done ? colors.textMuted : colors.textPrimary, textDecoration: done ? "line-through" : "none", fontWeight: typography.medium }}>
                    {supp.name}
                  </div>
                  <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: 2 }}>
                    {supp.dose}{supp.notes ? " · " + supp.notes : ""}
                  </div>
                </div>
                <button onClick={() => openEdit(supp)}
                  style={{ fontSize: typography.label, padding: `4px ${spacing.xs}px`, borderRadius: radius.sm,
                    cursor: "pointer", border: `1px solid ${colors.borderStrong}`,
                    background: "transparent", color: colors.textMuted }}>
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Modal open={formOpen} onClose={closeForm}>
        <EditForm form={form} setForm={setForm} editingId={editingId} onSubmit={submitForm} onCancel={closeForm} onDelete={deleteSupp} />
      </Modal>
      <Modal open={showSchedule} onClose={() => setShowSchedule(false)}>
        <ScheduleModal
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
          scheduleConfig={scheduleConfig}
          setScheduleConfig={setScheduleConfig}
          anchorBehavior={anchorBehavior}
          consistentTime={consistentTime}
          onSave={saveSchedule}
          onClose={() => setShowSchedule(false)}
        />
      </Modal>
    </div>
  );
}
