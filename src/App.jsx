import { useState, useEffect, useRef } from "react";
import {
  colors, spacing, radius, typography, touch, layout,
  ghostButtonStyle,
} from "./design-system";
import { Settings, Trash2, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Button from "./components/Button";
import Input from "./components/Input";
import Card from "./components/Card";
import Badge from "./components/Badge";
import Label from "./components/Label";
import BottomSheet from "./components/BottomSheet";
import SettingsModal from "./components/SettingsModal";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import ManageSupplementsSheet from "./components/ManageSupplementsSheet";

const SUPA_URL = "https://yahimlivfieuknagusxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaGltbGl2ZmlldWtuYWd1c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODYwNDIsImV4cCI6MjA5MzM2MjA0Mn0._5_t5k1NCAHAFHEz0clqD8fSxsNCMzlqBoRPSmD7wxs";

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function refreshSession() {
  const refreshToken = localStorage.getItem("sb_refresh_token");
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.access_token) {
        localStorage.setItem("sb_token", d.access_token);
        if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
        return d.access_token;
      }
    }
  } catch (e) {}
  return null;
}

async function supa(method, path, body, token) {
  const url = `${SUPA_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPA_KEY,
    "Authorization": `Bearer ${token || SUPA_KEY}`,
    "Prefer": "resolution=merge-duplicates,return=representation",
  };

  let res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  if (res.status === 401 && token) {
    const newToken = await refreshSession();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    }
  }

  if (!res.ok) {
    let detail = null;
    try { detail = await res.json(); } catch {}
    const err = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function getSession() {
  const token = localStorage.getItem("sb_token");
  if (!token) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
    });
    if (res.ok) { const d = await res.json(); return d.id ? d : null; }
    if (res.status === 401) {
      const newToken = await refreshSession();
      if (newToken) {
        const retry = await fetch(`${SUPA_URL}/auth/v1/user`, {
          headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${newToken}` },
        });
        if (retry.ok) { const d = await retry.json(); return d.id ? d : null; }
      }
    }
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
  if (res.ok && d.access_token) {
    localStorage.setItem("sb_token", d.access_token);
    if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
    return d.user;
  }
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
    if (d.access_token) {
      localStorage.setItem("sb_token", d.access_token);
      if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
      return d.user;
    }
  }
  return null;
}

function signOut() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_refresh_token");
}

// ── DB helpers ────────────────────────────────────────────────────────────────

const dbGetSupps     = (t)       => supa("GET",    "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
const dbAddSupp      = (s, t)    => supa("POST",   "/rest/v1/supplements", s, t);
const dbUpdateSupp   = (s, t)    => supa("PATCH",  `/rest/v1/supplements?id=eq.${s.id}`, { name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category, timePreference: s.timePreference, paused: s.paused ?? false, updated_at: new Date().toISOString() }, t);
const dbDeleteSupp   = (id, t)   => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
const dbGetLog       = (date, t) => supa("GET",    `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
const dbUpsertLog    = (log, t)  => supa("POST",   "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
const dbGetSchedule  = (t)       => supa("GET",    "/rest/v1/user_schedule?select=*", null, t).then(r => r?.[0] || null);
const dbSaveSchedule = (data, t) => supa("POST",   "/rest/v1/user_schedule?on_conflict=user_id", data, t);

// ── Constants ─────────────────────────────────────────────────────────────────

const BG_GRADIENT = `linear-gradient(160deg,${colors.bgBase} 0%,${colors.bgGradientMid} 50%,${colors.bgGradientEnd} 100%)`;

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
  { id: "topical",       label: "Topicals",          sublabel: "Skin & external",             icon: "◐", color: colors.slotTopical },
];

const DEFAULT_CONFIG = {
  pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660,
  window_start: 0, window_length: 480, meals_per_day: 2,
  fixed_times: {
    pre_breakfast: "07:30", breakfast: "08:00", pre_lunch: "11:30", lunch: "12:00",
    pre_dinner: "17:30", dinner: "18:00", after_dinner: "20:00", injectable: null, topical: null,
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
  { key: "topical",      label: "Topicals" },
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
    if (slot.id === "injectable" || slot.id === "topical") return;
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

  return (
    <div style={{ fontFamily: typography.fontBody, background: BG_GRADIENT, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }}>💊</div>
        <div style={{ fontSize: typography.hero, fontWeight: typography.bold, color: colors.textPrimary, letterSpacing: "-0.02em", marginBottom: spacing.xs }}>Tether</div>
        <div style={{ fontSize: typography.caption, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 1.7 }}>Your supplement schedule,<br />built around your life.</div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="your@email.com" />
        </div>
        <div style={{ marginBottom: spacing.md, textAlign: "left" }}>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="password" />
        </div>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={loading}>
          {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setMsg(""); }} style={{ marginTop: spacing.md, background: "none", border: "none", color: colors.textMuted, fontSize: typography.caption, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
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
    <div style={{ background: BG_GRADIENT, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: typography.caption, color: colors.textMuted }}>{text}</div>
    </div>
  );
}

// ── EditForm ──────────────────────────────────────────────────────────────────

function EditForm({ form, setForm, editingId, onSubmit, onCancel, onDelete, onTogglePause }) {
  const toggleSlot = (sid) => setForm(f => ({ ...f, slots: f.slots.includes(sid) ? f.slots.filter(x => x !== sid) : [...f.slots, sid] }));
  const toggleDay  = (i)   => setForm(f => ({ ...f, days:  f.days.includes(i)   ? f.days.filter(x => x !== i)   : [...f.days, i]   }));
  return (
    <div>
      {editingId && form.paused && (
        <div style={{ marginBottom: spacing.md }}>
          <Badge variant="neutral">Currently paused</Badge>
        </div>
      )}
      {[["Name", "name", "e.g. Magnesium Glycinate"], ["Dose", "dose", "e.g. 2 caps (300 mg)"], ["Notes", "notes", "e.g. Thorne · with food"]].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: spacing.md }}>
          <Label>{lbl}</Label>
          <Input value={form[key]} placeholder={ph} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}
      <div style={{ marginBottom: spacing.md }}>
        <Label>Category</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {CATEGORIES.map(cat => {
            const on = form.category === cat;
            return (
              <Button key={cat} variant="pill" active={on} solidActive style={{ flex: 1 }} onClick={() => {
                if (cat === "Injectable") {
                  setForm(f => ({ ...f, category: cat, slots: ["injectable"], timePreference: f.timePreference || "Anytime" }));
                } else if (cat === "Topical") {
                  setForm(f => ({ ...f, category: cat, slots: ["topical"], timePreference: f.timePreference || "Anytime" }));
                } else {
                  setForm(f => ({ ...f, category: cat, slots: [], timePreference: "Anytime" }));
                }
              }}>
                {cat}
              </Button>
            );
          })}
        </div>
      </div>
      {(form.category === "Injectable" || form.category === "Topical") ? (
        <div style={{ marginBottom: spacing.md }}>
          <Label>When to take it</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            {["Morning", "Midday", "Evening", "Before Bed", "Anytime"].map(pref => {
              const on = form.timePreference === pref;
              return (
                <Button key={pref} variant="pill" active={on} onClick={() => setForm(f => ({ ...f, timePreference: pref }))}>
                  {pref}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: spacing.md }}>
          <Label>When to take it</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            {SLOTS.filter(s => s.id !== "injectable" && s.id !== "topical").map(slot => {
              const on = form.slots.includes(slot.id);
              return (
                <Button key={slot.id} variant="pill" active={on} onClick={() => toggleSlot(slot.id)}>
                  {slot.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginBottom: spacing.lg }}>
        <Label>Which days</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {DAYS.map((d, i) => (
            <Button key={i} variant="circle" active={form.days.includes(i)} onClick={() => toggleDay(i)}>{d[0]}</Button>
          ))}
        </div>
      </div>
      {editingId ? (
        <>
          <Button variant="primary" fullWidth onClick={onSubmit} style={{ marginBottom: spacing.xs }}>Save changes</Button>
          <div style={{ display: "flex", gap: spacing.xs }}>
            <Button variant="secondary" secondaryStyle="solid" style={{ flex: 1 }} onClick={onTogglePause}>
              {form.paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="destructive" style={{ flex: 1 }} onClick={onDelete}>Delete</Button>
          </div>
        </>
      ) : (
        <Button variant="primary" fullWidth onClick={onSubmit}>Add supplement</Button>
      )}
    </div>
  );
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

function toHrMin(totalMins) {
  if (!totalMins && totalMins !== 0) return { h: 0, m: 0 };
  return { h: Math.floor(totalMins / 60), m: totalMins % 60 };
}
function fromHrMin(h, m) { return (parseInt(h) || 0) * 60 + (parseInt(m) || 0); }

const segBtnStyle = (on) => ({
  flex: 1,
  padding: `${spacing.sm}px`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontSize: typography.caption,
  background: on ? colors.accentDim : "transparent",
  color: on ? colors.accent : colors.textSecondary,
  border: `1px solid ${on ? colors.accentBorder : colors.borderStrong}`,
  fontWeight: on ? typography.semibold : typography.regular,
  minHeight: layout.segHeight,
});

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

  return (
    <div>
      {/* 2×2 mode grid */}
      <div style={{ marginBottom: spacing.lg }}>
        <Label>Schedule type</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.xs }}>
          {MODES.map(m => {
            const on = localMode === m.id;
            return (
              <Card key={m.id} onClick={() => setLocalMode(m.id)} style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: spacing.xxs, minHeight: layout.modeButtonHeight, background: on ? colors.accentDim : "transparent", border: `1px solid ${on ? colors.accentBorder : colors.borderStrong}`, marginBottom: 0 }}>
                <span style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: on ? colors.accent : colors.textPrimary }}>{m.title}</span>
                <span style={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.4 }}>{m.desc}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Anchor note */}
      {localMode !== "fixed" && (
        <Card variant="accent" style={{ padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.label, color: colors.accent, marginBottom: spacing.md }}>
          {ANCHOR_NOTES[localMode]}
        </Card>
      )}

      {/* Flexible / Consistent toggle (non-fixed modes) */}
      {localMode !== "fixed" && (
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

      {/* Live preview */}
      <div style={{ marginBottom: spacing.lg }}>
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
      </div>

      <Button variant="primary" fullWidth onClick={handleSave}>Save schedule</Button>
    </div>
  );
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, slotSupps, status, timeLabel, hasOffset, pillTime, isFuture, isChecked, toggleCheck, openEdit }) {
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);
  const isVariableSlot = slot.id === "injectable" || slot.id === "topical";

  const SC = {
    done:   { border: colors.borderSubtle,          bg: colors.cardSubtle,        hbg: "transparent",                badge: null },
    missed: { border: colors.statusMissedBorder,    bg: colors.statusMissedBg,    hbg: colors.statusMissedHover,     badge: { label: "missed", bg: colors.statusMissedBadgeBg,  color: colors.statusMissedBadgeColor } },
    now:    { border: colors.statusNowBorder,       bg: colors.statusNowBg,       hbg: colors.statusNowHover,        badge: { label: "now",    bg: colors.statusNowBadgeBg,     color: colors.accent } },
    future: { border: colors.borderSubtle,          bg: colors.cardSubtle,        hbg: "transparent",                badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ marginBottom: spacing.xs, borderRadius: radius.md, border: `1px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: status === "future" && !pillTime && !isVariableSlot ? 0.38 : 1 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: `${spacing.sm}px ${spacing.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: radius.xs, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.bold }}>✓</span></div>
            : <span style={{ color: slot.color, fontSize: typography.caption, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: allDone ? colors.textMuted : colors.textPrimary, display: "flex", alignItems: "center", gap: spacing.xs }}>
              {slot.label}
              {sc.badge && <Badge variant={sc.badge.label === "now" ? "now" : "missed"}>{sc.badge.label}</Badge>}
            </div>
            <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: 2, minHeight: 16 }}>{allDone && !expanded ? `${slotSupps.length} supplement${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
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
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.sm}px 0`, borderBottom: i < slotSupps.length - 1 ? `1px solid ${colors.divider}` : "none", minHeight: 52 }}>
                <div onClick={() => { if (!isFuture) toggleCheck(slot.id, supp.id); }} style={{ width: 24, height: 24, borderRadius: radius.sm, flexShrink: 0, border: `1.5px solid ${done ? colors.accent : colors.borderStrong}`, background: done ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isFuture ? "default" : "pointer" }}>
                  {done && <span style={{ color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.bold }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.body, color: done ? colors.textDone : colors.textPrimary, textDecoration: done ? "line-through" : "none", fontWeight: done ? typography.regular : typography.medium, display: "flex", alignItems: "center", gap: spacing.xxs }}>
                    {supp.name}
                    {supp.category === "Rx" && <Badge variant="category">Rx</Badge>}
                  </div>
                  <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: 2, minHeight: 14 }}>{supp.dose}{supp.notes ? " · " + supp.notes : ""}</div>
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

  return (
    <ToastProvider>
      {authLoading
        ? <Loader text="Loading…" />
        : !user
          ? <SignIn onSignIn={u => setUser(u)} />
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
  const [form, setForm]                     = useState({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6], category: "Oral", timePreference: "Anytime", paused: false });
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
  const [showSettings, setShowSettings]     = useState(false);
  const [showManage, setShowManage]         = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState({});
  const saveTimer = useRef(null);
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
      if (!pt && scheduleMode !== "fixed" && anchorBehavior !== "consistent") break;
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

  let coreTotal = 0, coreDone = 0;
  CORE_SLOTS.forEach(sid => {
    const sl = getSuppsForSlot(sid).filter(s => (s.category || "Oral") !== "Injectable" && (s.category || "Oral") !== "Topical");
    coreTotal += sl.length;
    sl.forEach(s => { if (isChecked(sid, s.id)) coreDone++; });
  });
  const pct = coreTotal > 0 ? Math.round((coreDone / coreTotal) * 100) : 0;

  const openAdd   = () => { setEditingId(null); setForm({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6], category: "Oral", timePreference: "Anytime", paused: false }); setFormOpen(true); };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...supp.slots], days: [...supp.days], category: supp.category || "Oral", timePreference: supp.timePreference || "Anytime", paused: supp.paused ?? false }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    const cat = form.category || "Oral";
    if (editingId) {
      try {
        await dbUpdateSupp({ ...form, category: cat, id: editingId }, token);
        setSupps(s => s.map(x => x.id === editingId ? { ...form, category: cat, id: editingId } : x));
        showToast(`Updated ${form.name}`);
      } catch (err) {
        showToast("Couldn't save — try again");
        console.error(err);
        return;
      }
    } else {
      try {
        const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: form.days, category: cat, timePreference: form.timePreference || "Anytime", paused: false, user_id: user.id }, token);
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
      showToast("Schedule updated");
    } catch (err) {
      showToast("Couldn't save — try again");
      console.error(err);
      return;
    }
    setShowSchedule(false);
  };

  const togglePause = async (supp) => {
    const updated = { ...supp, paused: !supp.paused };
    try {
      await dbUpdateSupp(updated, token);
      setSupps(s => s.map(x => x.id === supp.id ? updated : x));
      showToast(updated.paused ? `Paused ${supp.name}` : `Resumed ${supp.name}`);
      const updatedHome = supps.map(x => x.id === supp.id ? updated : x).filter(s => !pendingDeletes[s.id] && !s.paused);
      scheduleNotifications(effectivePillTime, updatedHome, viewDay, dk, slotOffsets);
      return true;
    } catch (err) {
      showToast("Couldn't update — try again");
      console.error(err);
      return false;
    }
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

  return (
    <div style={{ fontFamily: typography.fontBody, color: colors.textPrimary, maxWidth: 480, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px max(80px, env(safe-area-inset-bottom))`, WebkitFontSmoothing: "antialiased", background: BG_GRADIENT, minHeight: "100vh" }}>

      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <span style={{ fontSize: typography.heading, fontWeight: typography.semibold, color: colors.textPrimary, fontFamily: typography.fontHeading }}>Tether</span>
        <Button variant="icon" aria-label="Settings" onClick={() => setShowSettings(true)} style={{ width: touch.min, height: touch.min }}>
          <Settings size={18} />
        </Button>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <Button variant="icon" aria-label="Previous day" onClick={() => goDay(-1)} style={{ width: touch.min, height: touch.min, borderRadius: radius.md, border: `1px solid ${colors.borderBase}` }}><ChevronLeft size={24} color={colors.textSecondary} /></Button>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${spacing.xs}px` }}>
          <div style={{ fontSize: typography.label, color: colors.textMuted, fontWeight: typography.semibold, letterSpacing: typography.labelSpacingWide, textTransform: "uppercase", marginBottom: spacing.xxxs, fontFamily: typography.fontHeading }}>MY PROTOCOL</div>
          <button onClick={() => { if (!isToday) setViewDate(TODAY); }} style={{ fontSize: typography.title, fontWeight: typography.bold, letterSpacing: "-0.02em", background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? colors.textPrimary : colors.accent, padding: 0, display: "block", width: "100%", textAlign: "center", fontFamily: typography.fontHeading }}>{dayLabel}</button>
          <div style={{ fontSize: typography.caption2, color: colors.textFaint, marginTop: 2, minHeight: 14, letterSpacing: typography.labelSpacingTight }}>{isToday ? shortDate : "tap to return to today"}</div>
        </div>
        <Button variant="icon" aria-label="Next day" onClick={() => goDay(1)} style={{ width: touch.min, height: touch.min, borderRadius: radius.md, border: `1px solid ${colors.borderBase}` }}><ChevronRight size={24} color={colors.textSecondary} /></Button>
      </div>

      {/* Add row */}
      <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.md }}>
        <Button variant="secondary" secondaryStyle="dashed" onClick={openAdd} style={{ flex: 1 }}>+ Add Supplement</Button>
        <Button variant="tertiary" onClick={() => setShowSchedule(true)} style={{ flex: 1 }}>Edit Schedule</Button>
      </div>

      {/* Hero card */}
      <Card style={{ borderRadius: radius.xl, border: `1px solid ${colors.borderBase}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: `${spacing.sm}px ${spacing.md}px`, marginBottom: spacing.md, background: flashGreen ? colors.accentDim : colors.bgCard, transition: "background 0.4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <div style={{ flex: 1 }}>
            {scheduleMode === "fixed" ? (
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
                    <button onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }} style={{ ...ghostButtonStyle, width: "auto", borderRadius: radius.sm }}>Save</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                    <span style={{ fontSize: typography.display, fontWeight: typography.bold, letterSpacing: "-0.04em", color: colors.accent, fontFamily: typography.fontHeading }}>{heroDisplayTime}</span>
                    {pillTime && <button onClick={() => { setTmpTime(pillTime); setEditPillTime(true); }} style={{ fontSize: typography.caption, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>edit</button>}
                  </div>
                )}
                {pct === 100 && <div style={{ fontSize: typography.caption, color: colors.accent, fontWeight: typography.semibold, marginTop: spacing.xs }}>Protocol complete ✓</div>}
              </div>
            ) : (
              <div>
                <Button variant="primary" fullWidth onClick={startDay} style={{ minHeight: spacing.xxl, background: isFuture ? colors.bgCardHover : colors.accent, color: isFuture ? colors.textMuted : colors.textPrimary, cursor: isFuture ? "default" : "pointer" }}>
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
            <div style={{ fontSize: typography.caption, color: colors.textMuted, lineHeight: 1.7, marginBottom: spacing.lg }}>Add your medications and supplements. Your schedule builds from when you take your first med each morning.</div>
            <Button variant="primary" fullWidth onClick={openAdd}>Add first supplement</Button>
          </div>
        ) : SLOTS.map(slot => {
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
          const timeLabel = isVarSlot ? "variable" : (hasOffset ? slotTimeStr(slot.id) : "variable");
          return <SlotCard key={slot.id} slot={slot} slotSupps={slotSupps} status={slotStatus(slot.id)} timeLabel={timeLabel} hasOffset={hasOffset} pillTime={effectivePillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} />;
        })}
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
      <BottomSheet open={formOpen} onClose={closeForm} title={editingId ? "Edit supplement" : "New supplement"}>
        <EditForm form={form} setForm={setForm} editingId={editingId} onSubmit={submitForm} onCancel={closeForm} onDelete={deleteSupp} onTogglePause={handleEditFormTogglePause} />
      </BottomSheet>
      <BottomSheet open={showSchedule} onClose={() => setShowSchedule(false)} title="Daily Schedule">
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
        />
      </BottomSheet>
    </div>
  );
}
