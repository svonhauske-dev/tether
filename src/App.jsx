import { useState, useEffect, useRef } from "react";

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

const dbGetSupps   = (t)      => supa("GET",    "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
const dbAddSupp    = (s, t)   => supa("POST",   "/rest/v1/supplements", s, t);
const dbUpdateSupp = (s, t)   => supa("PATCH",  `/rest/v1/supplements?id=eq.${s.id}`, { name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, updated_at: new Date().toISOString() }, t);
const dbDeleteSupp = (id, t)  => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
const dbGetLog     = (date, t)=> supa("GET",    `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
const dbUpsertLog  = (log, t) => supa("POST",   "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOTS = [
  { id: "rx",            label: "Start my day",            sublabel: "Rx only · empty stomach",       icon: "★", color: "#4ade80" },
  { id: "fasted",        label: "Empty stomach",           sublabel: "30 min post-Rx · before eating", icon: "○", color: "#34d399" },
  { id: "pre_breakfast", label: "30 min before breakfast", sublabel: "Weight Loss Pack · enzymes",     icon: "◎", color: "#67e8f9" },
  { id: "breakfast",     label: "With breakfast",          sublabel: "Fat-soluble · need food",        icon: "●", color: "#67e8f9" },
  { id: "pre_lunch",     label: "30 min before lunch",     sublabel: "T3 2nd dose · empty stomach",   icon: "◎", color: "#c084fc" },
  { id: "lunch",         label: "With lunch",              sublabel: "Thyroid complex 2nd dose",       icon: "●", color: "#c084fc" },
  { id: "pre_dinner",    label: "Before dinner",           sublabel: "Enzymes only",                   icon: "◎", color: "#fb923c" },
  { id: "dinner",        label: "With dinner",             sublabel: "2nd doses · fat-soluble",        icon: "●", color: "#fb923c" },
  { id: "after_dinner",  label: "After dinner",            sublabel: "Wind-down · before bed",         icon: "◑", color: "#818cf8" },
  { id: "injectable",    label: "Injectables",             sublabel: "Protocol · subcutaneous",        icon: "⊕", color: "#94a3b8" },
];

const SLOT_OFFSETS = {
  rx: 0, fasted: 30, pre_breakfast: 45, breakfast: 60,
  pre_lunch: 330, lunch: 360, pre_dinner: 750, dinner: 780,
  after_dinner: 900, injectable: null,
};

const CORE_SLOTS = ["rx", "fasted", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner"];

// ── Utilities ─────────────────────────────────────────────────────────────────

const pad          = (n) => String(n).padStart(2, "0");
const fmtTime      = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addMins      = (d, m) => new Date(d.getTime() + m * 60000);
const parseHHMM    = (s) => { const [h, m] = s.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; };
const dateKey      = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay   = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const getMonthYear = () => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
const notifOK      = () => "Notification" in window;

const TODAY        = startOfDay(new Date());
const P            = "16px";

// ── Notifications ─────────────────────────────────────────────────────────────

function scheduleNotifications(pt, supps, vd, dk) {
  if (window._nto) window._nto.forEach(clearTimeout);
  window._nto = [];
  if (!pt || Notification.permission !== "granted") return;
  const base = parseHHMM(pt), now = new Date();
  SLOTS.forEach(slot => {
    const offset = SLOT_OFFSETS[slot.id]; if (offset === null) return;
    const t = addMins(base, offset), diff = t - now; if (diff < 0) return;
    const sl = supps.filter(s => s.slots.includes(slot.id) && s.days.includes(vd));
    if (!sl.length) return;
    window._nto.push(setTimeout(() => {
      try { new Notification("Time for your protocol", { body: `${slot.label}: ${sl.map(s => s.name).join(", ")}`, tag: `${dk}_${slot.id}` }); } catch (e) {}
    }, diff));
  });
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%", padding: "12px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", fontSize: 16,
  boxSizing: "border-box", background: "#0d0f1a", color: "#fff",
  display: "block", WebkitAppearance: "none", outline: "none",
};
const labelStyle = {
  fontSize: 11, color: "#8b90a0", marginBottom: 6, display: "block",
  fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
};

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

  const si = { ...inputStyle, textAlign: "center", fontSize: 18 };

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", background: "linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: P }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💊</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>Protocol Tracker</div>
        <div style={{ fontSize: 14, color: "#4a5568", marginBottom: 40, lineHeight: 1.7 }}>Your supplement schedule,<br />anchored to your morning Rx.</div>
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="your@email.com" type="email" style={si} />
        <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="password" type="password" style={{ ...si, marginTop: 10 }} />
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 12, padding: "15px", background: "#4ade80", color: "#0a0a0f", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
          {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setMsg(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#4a5568", fontSize: 13, cursor: "pointer" }}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        {msg && <div style={{ marginTop: 14, fontSize: 13, color: "#f87171" }}>{msg}</div>}
      </div>
    </div>
  );
}

// ── Loader ────────────────────────────────────────────────────────────────────

function Loader({ text }) {
  return (
    <div style={{ background: "linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#4a5568" }}>{text}</div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.78)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: P }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#13151f", borderRadius: 24, padding: P, maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.08)" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{editingId ? "Edit supplement" : "New supplement"}</span>
        <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b90a0" }}>✕</button>
      </div>
      {[["Name", "name", "e.g. Magnesium Glycinate"], ["Dose", "dose", "e.g. 2 caps (300 mg)"], ["Notes", "notes", "e.g. Thorne · with food"]].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{lbl}</label>
          <input style={inputStyle} value={form[key]} placeholder={ph} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>When to take it</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {SLOTS.map(slot => { const on = form.slots.includes(slot.id); return (
            <button key={slot.id} onClick={() => toggleSlot(slot.id)} style={{ fontSize: 12, padding: "7px 13px", borderRadius: 20, cursor: "pointer", background: on ? slot.color + "22" : "transparent", color: on ? slot.color : "#8b90a0", border: `1px solid ${on ? slot.color : "rgba(255,255,255,0.1)"}`, fontWeight: on ? 600 : 400 }}>{slot.label}</button>
          ); })}
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Which days</label>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map((d, i) => { const on = form.days.includes(i); return (
            <button key={i} onClick={() => toggleDay(i)} style={{ width: 38, height: 38, borderRadius: "50%", fontSize: 13, cursor: "pointer", fontWeight: 600, background: on ? "#4ade80" : "transparent", color: on ? "#0a0a0f" : "#8b90a0", border: `1px solid ${on ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: 0, flexShrink: 0 }}>{d[0]}</button>
          ); })}
        </div>
      </div>
      {editingId && <button onClick={onDelete} style={{ width: "100%", padding: "13px", borderRadius: 12, cursor: "pointer", background: "transparent", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", fontSize: 15, fontWeight: 500, marginBottom: 10 }}>Delete supplement</button>}
      <button onClick={onSubmit} style={{ width: "100%", padding: "15px", borderRadius: 12, cursor: "pointer", background: "#4ade80", color: "#0a0a0f", border: "none", fontSize: 16, fontWeight: 700 }}>{editingId ? "Save changes" : "Add supplement"}</button>
    </div>
  );
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, slotSupps, status, timeLabel, pillTime, isFuture, isChecked, toggleCheck, openEdit }) {
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);

  const SC = {
    done:   { border: "rgba(255,255,255,0.05)",  bg: "rgba(255,255,255,0.02)", hbg: "transparent",           badge: null },
    missed: { border: "rgba(249,115,22,0.35)",   bg: "rgba(249,115,22,0.05)", hbg: "rgba(249,115,22,0.07)",  badge: { label: "missed", bg: "rgba(124,45,18,0.5)",    color: "#fed7aa" } },
    now:    { border: "rgba(74,222,128,0.45)",   bg: "rgba(74,222,128,0.04)", hbg: "rgba(74,222,128,0.07)",  badge: { label: "now",    bg: "rgba(74,222,128,0.18)",   color: "#4ade80" } },
    future: { border: "rgba(255,255,255,0.05)",  bg: "rgba(255,255,255,0.02)", hbg: "transparent",           badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ marginBottom: 8, borderRadius: 12, border: `1px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: status === "future" && !pillTime ? 0.38 : 1 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: 6, background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#0a0a0f", fontSize: 11, fontWeight: 700 }}>✓</span></div>
            : <span style={{ color: slot.color, fontSize: 12, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: allDone ? "#4a5568" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>
              {slot.label}
              {sc.badge && <span style={{ fontSize: 11, background: sc.badge.bg, color: sc.badge.color, borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>{sc.badge.label}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#4a5568", marginTop: 1 }}>{allDone && !expanded ? `${slotSupps.length} supplement${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: pillTime && SLOT_OFFSETS[slot.id] !== null ? slot.color : "#4a5568", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{timeLabel}</span>
          <span style={{ fontSize: 14, color: "#4a5568", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "2px 12px", borderTop: `1px solid ${sc.border}` }}>
          {slotSupps.map((supp, i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < slotSupps.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div onClick={() => { if (!isFuture) toggleCheck(slot.id, supp.id); }} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, border: `1.5px solid ${done ? "#4ade80" : "rgba(255,255,255,0.15)"}`, background: done ? "#4ade80" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isFuture ? "default" : "pointer" }}>
                  {done && <span style={{ color: "#0a0a0f", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: done ? "#4a5568" : "#f1f5f9", textDecoration: done ? "line-through" : "none", fontWeight: done ? 400 : 500 }}>{supp.name}</div>
                  <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>{supp.dose}</div>
                  {supp.notes && <div style={{ fontSize: 10, color: "#2d3748", marginTop: 1 }}>{supp.notes}</div>}
                </div>
                <button onClick={e => { e.stopPropagation(); openEdit(supp); }} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", color: "#6b7280", flexShrink: 0, minHeight: 32, display: "flex", alignItems: "center" }}>Edit</button>
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
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const token = () => localStorage.getItem("sb_token") || "";

  useEffect(() => { getSession().then(u => { setUser(u); setAuthLoading(false); }); }, []);

  if (authLoading) return <Loader text="Loading…" />;
  if (!user) return <SignIn onSignIn={u => setUser(u)} />;
  return <ProtocolApp user={user} token={token()} onSignOut={() => { signOut(); setUser(null); }} />;
}

// ── ProtocolApp ───────────────────────────────────────────────────────────────

function ProtocolApp({ user, token, onSignOut }) {
  const [supps, setSupps]               = useState([]);
  const [pillTimes, setPillTimes]       = useState({});
  const [checked, setChecked]           = useState({});
  const [loading, setLoading]           = useState(true);
  const [viewDate, setViewDate]         = useState(TODAY);
  const [editPillTime, setEditPillTime] = useState(false);
  const [tmpTime, setTmpTime]           = useState("");
  const [formOpen, setFormOpen]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6] });
  const [notifStatus, setNotifStatus]   = useState(notifOK() ? Notification.permission : "unsupported");
  const [streak, setStreak]             = useState(0);
  const [flashGreen, setFlashGreen]     = useState(false);
  const saveTimer    = useRef(null);

  const dk       = dateKey(viewDate);
  const isToday  = dateKey(viewDate) === dateKey(TODAY);
  const isFuture = startOfDay(viewDate) > TODAY;
  const pillTime = pillTimes[dk] || null;
  const viewDay  = viewDate.getDay();

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await dbGetSupps(token);
      setSupps(s || []);
      const log = await dbGetLog(dk, token);
      if (log?.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0, 5) }));
      if (log?.checked)   setChecked(log.checked);
      setLoading(false);
    })();
  }, [token]);

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
      const ddk = dateKey(d), pt = pillTimes[ddk]; if (!pt) break;
      const day = d.getDay();
      const allDone = CORE_SLOTS.every(sid => supps.filter(x => x.slots.includes(sid) && x.days.includes(day)).every(x => !!checked[`${ddk}_${sid}_${x.id}`]));
      if (!allDone) break; s++; d.setDate(d.getDate() - 1);
    }
    setStreak(s);
  }, [checked, pillTimes, supps]);

  const goDay          = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate() + offset); setViewDate(startOfDay(d)); };
  const setPillForDay  = (t) => setPillTimes(pt => ({ ...pt, [dk]: t }));
  const getSlotTime    = (sid) => { if (!pillTime || SLOT_OFFSETS[sid] === null) return null; return addMins(parseHHMM(pillTime), SLOT_OFFSETS[sid]); };
  const slotTimeStr    = (sid) => { const t = getSlotTime(sid); return t ? fmtTime(t) : "--:--"; };
  const toggleCheck    = (sid, suppId) => { const k = `${dk}_${sid}_${suppId}`; setChecked(c => ({ ...c, [k]: !c[k] })); };
  const isChecked      = (sid, suppId) => !!checked[`${dk}_${sid}_${suppId}`];
  const getSuppsForSlot = (sid) => supps.filter(s => s.slots.includes(sid) && s.days.includes(viewDay));

  const startDay = () => {
    if (isFuture) return;
    const t = fmtTime(new Date());
    setPillForDay(t);
    const rxSupps = supps.filter(s => s.slots.includes("rx") && s.days.includes(viewDay));
    setChecked(c => { const n = { ...c }; rxSupps.forEach(s => { n[`${dk}_rx_${s.id}`] = true; }); return n; });
    scheduleNotifications(t, supps, viewDay, dk);
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
  CORE_SLOTS.forEach(sid => { const sl = getSuppsForSlot(sid); coreTotal += sl.length; sl.forEach(s => { if (isChecked(sid, s.id)) coreDone++; }); });
  const pct = coreTotal > 0 ? Math.round((coreDone / coreTotal) * 100) : 0;

  // Supplement CRUD
  const openAdd   = () => { setEditingId(null); setForm({ name: "", dose: "", notes: "", slots: [], days: [0, 1, 2, 3, 4, 5, 6] }); setFormOpen(true); };
  const openEdit  = (supp) => { setEditingId(supp.id); setForm({ name: supp.name, dose: supp.dose, notes: supp.notes || "", slots: [...supp.slots], days: [...supp.days] }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await dbUpdateSupp({ ...form, id: editingId }, token);
      setSupps(s => s.map(x => x.id === editingId ? { ...form, id: editingId } : x));
    } else {
      const rows = await dbAddSupp({ name: form.name, dose: form.dose, notes: form.notes, slots: form.slots, days: form.days, user_id: user.id }, token);
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

  const r = 28, circ = 2 * Math.PI * r, dash = circ * (pct / 100);
  const dayLabel = isToday ? "Today" : viewDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const card = { borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: flashGreen ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: P, marginBottom: P, transition: "background 0.4s ease" };

  if (loading) return <Loader text="Loading your protocol…" />;

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", color: "#fff", maxWidth: 480, margin: "0 auto", padding: `20px ${P} 80px`, WebkitFontSmoothing: "antialiased", background: "linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: P }}>
        <button onClick={() => goDay(-1)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#8b90a0", borderRadius: 10, flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>PROTOCOL · {getMonthYear().toUpperCase()}</div>
          <button onClick={() => { if (!isToday) setViewDate(TODAY); }} style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", background: "none", border: "none", cursor: isToday ? "default" : "pointer", color: isToday ? "#fff" : "#4ade80", padding: 0, display: "block", width: "100%", textAlign: "center" }}>{dayLabel}</button>
          {!isToday && <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>tap to return to today</div>}
        </div>
        <button onClick={() => goDay(1)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#8b90a0", borderRadius: 10, flexShrink: 0 }}>›</button>
      </div>

      {/* Hero card */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: pillTime ? 12 : 0 }}>
              <div style={{ flex: 1 }}>
                {!pillTime ? (
                  <div>
                    <button onClick={startDay} style={{ padding: "15px 20px", background: isFuture ? "rgba(255,255,255,0.05)" : "#4ade80", color: isFuture ? "#4a5568" : "#0a0a0f", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: isFuture ? "default" : "pointer", display: "block", width: "100%", textAlign: "center" }}>
                      {isFuture ? "Future day" : "Start my day"}
                    </button>
                    {!isFuture && <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6, textAlign: "center" }}>logs your Rx meds · sets full schedule</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Protocol started</div>
                    {editPillTime ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="time" value={tmpTime} onChange={e => setTmpTime(e.target.value)} style={{ fontSize: 16, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#fff" }} />
                        <button onClick={() => { setPillForDay(tmpTime); setEditPillTime(false); }} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff" }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", color: "#4ade80" }}>{pillTime}</span>
                        <button onClick={() => { setTmpTime(pillTime); setEditPillTime(true); }} style={{ fontSize: 13, color: "#4a5568", background: "none", border: "none", cursor: "pointer", padding: 0 }}>edit</button>
                      </div>
                    )}
                    {pct === 100 && <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 600, marginTop: 4 }}>Protocol complete ✓</div>}
                  </div>
                )}
              </div>
              {/* Progress ring */}
              <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
                <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <circle cx="34" cy="34" r={r} fill="none" stroke="#4ade80" strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round" transform="rotate(-90 34 34)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                <text x="34" y="34" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="13" fontWeight="700">{pct}%</text>
              </svg>
            </div>
            {/* Footer row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}>
              <div>
                {notifStatus === "default"      && <button onClick={async () => { const r = await Notification.requestPermission(); setNotifStatus(r); }} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 20, cursor: "pointer", border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.06)", color: "#4ade80", fontWeight: 600 }}>Enable reminders</button>}
                {notifStatus === "granted"      && <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 500 }}>Reminders on</span>}
                {notifStatus === "denied"       && <span style={{ fontSize: 12, color: "#f87171" }}>Reminders blocked</span>}
                {notifStatus === "unsupported"  && <span style={{ fontSize: 12, color: "#4a5568" }}>Add to home screen for reminders</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {streak > 0 && <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.18)", borderRadius: 20, padding: "4px 10px" }}><span style={{ fontSize: 13 }}>🔥</span><span style={{ fontSize: 12, fontWeight: 700, color: "#fb923c" }}>{streak} day streak</span></div>}
                <button onClick={onSignOut} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#4a5568" }}>Sign out</button>
              </div>
            </div>
          </div>

          {/* Add row */}
          <div style={{ marginBottom: P }}>
            <button onClick={openAdd} style={{ width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", border: "1px dashed rgba(74,222,128,0.22)", background: "rgba(74,222,128,0.03)", fontSize: 14, fontWeight: 600, color: "#4ade80" }}>+ Add supplement</button>
          </div>

          {/* Slot list */}
          <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: P, marginBottom: P }}>
            {supps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>💊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>Your protocol is empty</div>
                <div style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginBottom: 20 }}>Add your medications and supplements above.<br />The schedule anchors to when you take your first Rx each morning.</div>
                <button onClick={openAdd} style={{ width: "100%", padding: "11px 0", borderRadius: 12, cursor: "pointer", background: "#4ade80", color: "#0a0a0f", border: "none", fontSize: 14, fontWeight: 700 }}>Add first supplement</button>
              </div>
            ) : SLOTS.map(slot => {
              const slotSupps = getSuppsForSlot(slot.id); if (!slotSupps.length) return null;
              return <SlotCard key={slot.id} slot={slot} slotSupps={slotSupps} status={slotStatus(slot.id)} timeLabel={SLOT_OFFSETS[slot.id] === null ? "variable" : slotTimeStr(slot.id)} pillTime={pillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit} />;
            })}
          </div>

      {/* Modals */}
      <Modal open={formOpen} onClose={closeForm}>
        <EditForm form={form} setForm={setForm} editingId={editingId} onSubmit={submitForm} onCancel={closeForm} onDelete={deleteSupp} />
      </Modal>
    </div>
  );
}
