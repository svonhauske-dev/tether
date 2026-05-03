import { useState, useEffect, useRef } from "react";

const SUPA_URL = "https://yahimlivfieuknagusxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaGltbGl2ZmlldWtuYWd1c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODYwNDIsImV4cCI6MjA5MzM2MjA0Mn0._5_t5k1NCAHAFHEz0clqD8fSxsNCMzlqBoRPSmD7wxs";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";

async function supa(method, path, body, token) {
  const headers = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${token || SUPA_KEY}`, "Prefer": "return=representation" };
  const res = await fetch(SUPA_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.ok ? res.json() : null;
}

async function getSession() {
  const token = localStorage.getItem("sb_token");
  if (!token) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` }
    });
    if (res.ok) { const d = await res.json(); return d.id ? d : null; }
  } catch(e) {}
  return null;
}

async function signUp(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password })
  });
  const d = await res.json();
  console.log("signup response:", JSON.stringify(d));
  if (res.ok && d.access_token) { localStorage.setItem("sb_token", d.access_token); return d.user; }
  return null;
}

async function signInPassword(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password })
  });
  if (res.ok) {
    const d = await res.json();
    if (d.access_token) { localStorage.setItem("sb_token", d.access_token); return d.user; }
  }
  return null;
}

function signOut() { localStorage.removeItem("sb_token"); }

const dbGetSupps  = (t) => supa("GET",  "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
const dbAddSupp   = (s, t) => supa("POST", "/rest/v1/supplements", s, t);
const dbUpdateSupp = (s, t) => supa("PATCH", `/rest/v1/supplements?id=eq.${s.id}`, { name:s.name, dose:s.dose, notes:s.notes, slots:s.slots, days:s.days, updated_at:new Date().toISOString() }, t);
const dbDeleteSupp = (id, t) => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
const dbGetLog    = (date, t) => supa("GET", `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
const dbUpsertLog = (log, t) => supa("POST", "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
const dbGetLabs   = (t) => supa("GET",  "/rest/v1/lab_results?select=*&order=drawn_at.desc", null, t);
const dbAddLab    = (l, t) => supa("POST", "/rest/v1/lab_results", l, t);
const dbUpdateLab = (id, l, t) => supa("PATCH", `/rest/v1/lab_results?id=eq.${id}`, { values:l.values, drawn_at:l.drawn_at }, t);

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SLOTS = [
  { id:"rx",           label:"Start my day",           sublabel:"Rx only · empty stomach",        icon:"★", color:"#4ade80" },
  { id:"fasted",       label:"Empty stomach",          sublabel:"30 min post-Rx · before eating",  icon:"○", color:"#34d399" },
  { id:"pre_breakfast",label:"30 min before breakfast",sublabel:"Weight Loss Pack · enzymes",       icon:"◎", color:"#67e8f9" },
  { id:"breakfast",    label:"With breakfast",         sublabel:"Fat-soluble · need food",          icon:"●", color:"#67e8f9" },
  { id:"pre_lunch",    label:"30 min before lunch",    sublabel:"T3 2nd dose · empty stomach",      icon:"◎", color:"#c084fc" },
  { id:"lunch",        label:"With lunch",             sublabel:"Thyroid complex 2nd dose",         icon:"●", color:"#c084fc" },
  { id:"pre_dinner",   label:"Before dinner",          sublabel:"Enzymes only",                     icon:"◎", color:"#fb923c" },
  { id:"dinner",       label:"With dinner",            sublabel:"2nd doses · fat-soluble",          icon:"●", color:"#fb923c" },
  { id:"after_dinner", label:"After dinner",           sublabel:"Wind-down · before bed",           icon:"◑", color:"#818cf8" },
  { id:"injectable",   label:"Injectables",            sublabel:"Protocol · subcutaneous",          icon:"⊕", color:"#94a3b8" },
];
const SLOT_OFFSETS = { rx:0, fasted:30, pre_breakfast:45, breakfast:60, pre_lunch:330, lunch:360, pre_dinner:750, dinner:780, after_dinner:900, injectable:null };
const CORE_SLOTS = ["rx","fasted","pre_breakfast","breakfast","pre_lunch","lunch","pre_dinner","dinner","after_dinner"];

const LAB_MARKERS = [
  { id:"tsh",          name:"TSH",                 unit:"mIU/L",  optimalLow:0.5,  optimalHigh:2.0,  note:"Functional optimal for T3/T4 therapy" },
  { id:"ft3",          name:"Free T3",             unit:"pg/mL",  optimalLow:3.2,  optimalHigh:4.2,  note:"Upper third of range" },
  { id:"ft4",          name:"Free T4",             unit:"ng/dL",  optimalLow:1.1,  optimalHigh:1.7,  note:"Mid to upper range" },
  { id:"dhea",         name:"DHEA-S",              unit:"μg/dL",  optimalLow:150,  optimalHigh:300,  note:"Youthful range for women" },
  { id:"testosterone", name:"Testosterone (free)", unit:"pg/mL",  optimalLow:1.5,  optimalHigh:4.2,  note:"Functional optimal for women" },
  { id:"glucose",      name:"Fasting Glucose",     unit:"mg/dL",  optimalLow:72,   optimalHigh:86,   note:"Metabolic optimal" },
  { id:"insulin",      name:"Fasting Insulin",     unit:"μIU/mL", optimalLow:2,    optimalHigh:5,    note:"Optimal insulin sensitivity" },
  { id:"vitd",         name:"Vitamin D (25-OH)",   unit:"ng/mL",  optimalLow:60,   optimalHigh:80,   note:"Therapeutic range" },
  { id:"crp",          name:"hsCRP",               unit:"mg/L",   optimalLow:0,    optimalHigh:0.5,  note:"Near-zero inflammation" },
  { id:"ferritin",     name:"Ferritin",            unit:"ng/mL",  optimalLow:50,   optimalHigh:100,  note:"Optimal for thyroid function" },
];

const LAB_INSIGHTS = {
  tsh:   { optimal:"TSH is in functional range — T4/T3 protocol appears well-calibrated.", low:"TSH is suppressed — may indicate over-replacement. Worth reviewing T3 dose timing.", high:"TSH is elevated — T4 conversion or absorption may be suboptimal. Check fasting window before Rx." },
  ft3:   { optimal:"Free T3 is in the upper functional range — active thyroid hormone is well-supported.", low:"Free T3 is below optimal — T3 conversion may be limited. Selenium and zinc support conversion.", high:"Free T3 is elevated — monitor for palpitations or sleep disruption." },
  ft4:   { optimal:"Free T4 is in optimal range — Levothyroxine dose and absorption look appropriate.", low:"Free T4 is low — absorption may be affected. Ensure 60-min fasting window after Rx.", high:"Free T4 is high — may indicate over-replacement or conversion issue." },
  vitd:  { optimal:"Vitamin D is in therapeutic range — your D3+K2 protocol is working.", low:"Vitamin D is below therapeutic target — consider increasing D3 dose or checking fat absorption.", high:"Vitamin D is above target — consider reducing dose temporarily." },
  glucose:{ optimal:"Fasting glucose is in the metabolic optimal range — good insulin sensitivity.", low:"Fasting glucose is low — check meal timing and carbohydrate intake.", high:"Fasting glucose is elevated — your metabolic protocol is targeting this." },
  insulin:{ optimal:"Fasting insulin is optimal — strong insulin sensitivity.", low:"Fasting insulin is very low — consistent with good metabolic health.", high:"Fasting insulin is elevated — this is what the Weight Loss Support Pack and metabolic protocol are targeting." },
};

const pad = (n) => String(n).padStart(2,"0");
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addMins = (d, m) => new Date(d.getTime() + m * 60000);
const parseHHMM = (s) => { const [h,m] = s.split(":"); const d = new Date(); d.setHours(+h,+m,0,0); return d; };
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
const getCurrentMonthYear = () => new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"});
const notifSupported = () => "Notification" in window;
const getLabStatus = (m, val) => {
  const n = parseFloat(val); if (isNaN(n)) return null;
  if (m.id === "crp") return n <= m.optimalHigh ? "optimal" : "high";
  if (n < m.optimalLow) return "low"; if (n > m.optimalHigh) return "high"; return "optimal";
};
const STATUS_COLOR = { optimal:"#4ade80", low:"#60a5fa", high:"#f87171" };
const STATUS_BG    = { optimal:"rgba(74,222,128,0.08)", low:"rgba(96,165,250,0.08)", high:"rgba(248,113,113,0.08)" };
const TODAY = startOfDay(new Date());
const P = "16px";

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
      try { new Notification("Time for your protocol", { body:`${slot.label}: ${sl.map(s=>s.name).join(", ")}`, tag:`${dk}_${slot.id}` }); } catch(e) {}
    }, diff));
  });
}

const inputStyle = { width:"100%", padding:"12px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", fontSize:16, boxSizing:"border-box", background:"#0d0f1a", color:"#fff", display:"block", WebkitAppearance:"none", outline:"none" };
const labelStyle = { fontSize:11, color:"#8b90a0", marginBottom:6, display:"block", fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase" };

function SignIn({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

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

  const si = { ...inputStyle, textAlign:"center", fontSize:18 };

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",background:"linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:P}}>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>💊</div>
        <div style={{fontSize:26,fontWeight:700,color:"#fff",letterSpacing:"-0.02em",marginBottom:8}}>Protocol Tracker</div>
        <div style={{fontSize:14,color:"#4a5568",marginBottom:40,lineHeight:1.7}}>Your supplement schedule,<br/>anchored to your morning Rx.</div>
        <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="your@email.com" type="email" style={si}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="password" type="password" style={{...si,marginTop:10}}/>
        <button onClick={handleSubmit} disabled={loading} style={{width:"100%",marginTop:12,padding:"15px",background:"#4ade80",color:"#0a0a0f",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:loading?"default":"pointer"}}>
          {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setMsg("");}} style={{marginTop:12,background:"none",border:"none",color:"#4a5568",fontSize:13,cursor:"pointer"}}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        {msg && <div style={{marginTop:14,fontSize:13,color:"#f87171"}}>{msg}</div>}
      </div>
    </div>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.78)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:P}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,background:"#13151f",borderRadius:24,padding:P,maxHeight:"86vh",overflowY:"auto",boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)"}}>
        {children}
      </div>
    </div>
  );
}

function LabModal({ open, onClose, onSave, labs, labDate }) {
  const [entries, setEntries] = useState(labs || {});
  const [date, setDate] = useState(labDate || new Date().toISOString().split("T")[0]);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { setEntries(labs || {}); setDate(labDate || new Date().toISOString().split("T")[0]); }, [labs, labDate]);

  const handlePDF = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setParsing(true); setParseMsg("Reading PDF…");
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab); const chunks = [];
      for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i+8192)));
      const b64 = btoa(chunks.join(""));
      setParseMsg("Sending to AI…");
      const res = await fetch("/api/parse-pdf", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:"You are a medical lab result parser. Extract numeric values from lab PDFs. Return ONLY raw JSON, no markdown, no backticks. Keys: tsh, ft3, ft4, dhea, testosterone, glucose, insulin, vitd, crp, ferritin, date. Numeric strings only. Date as YYYY-MM-DD.",
          messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:"Extract lab values. Raw JSON only."}]}]})
      });
      if (!res.ok) { setParseMsg(`API error ${res.status}`); setParsing(false); return; }
      const data = await res.json();
      const txt = data.content.filter(c=>c.type==="text").map(c=>c.text).join("").trim();
      const parsed = JSON.parse(txt.replace(/^```[a-z]*\n?/,"").replace(/\n?```$/,"").trim());
      const ne = { ...entries };
      LAB_MARKERS.forEach(m => { if (parsed[m.id] != null && parsed[m.id] !== "") ne[m.id] = String(parsed[m.id]); });
      setEntries(ne); if (parsed.date) setDate(parsed.date);
      setParseMsg(`✓ ${Object.keys(parsed).filter(k=>k!=="date").length} values extracted`);
    } catch(err) { setParseMsg("Failed: " + err.message); }
    setParsing(false);
  };

  if (!open) return null;
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.78)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:P}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,background:"#13151f",borderRadius:24,padding:P,maxHeight:"86vh",overflowY:"auto",boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>Lab Results</span>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#8b90a0"}}>✕</button>
        </div>
        <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,padding:"10px 12px",marginBottom:16,fontSize:12,color:"#34d399",lineHeight:1.5}}>
          Ranges shown are functional optimal targets, not standard lab reference ranges.
        </div>
        <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={handlePDF}/>
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Upload lab PDF</label>
          <button onClick={()=>fileRef.current?.click()} disabled={parsing} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px dashed rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.04)",color:parsing?"#4a5568":"#4ade80",fontSize:14,fontWeight:600,cursor:parsing?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {parsing ? "Extracting values…" : "Upload PDF to auto-fill"}
          </button>
          {parseMsg && <div style={{fontSize:12,color:parseMsg.startsWith("✓")?"#4ade80":"#fb923c",marginTop:7,textAlign:"center"}}>{parseMsg}</div>}
        </div>
        <div style={{marginBottom:16}}><label style={labelStyle}>Date drawn</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/></div>
        {LAB_MARKERS.map(m => {
          const v = entries[m.id] || "", status = v ? getLabStatus(m,v) : null, sc = status ? STATUS_COLOR[status] : "#8b90a0";
          return (
            <div key={m.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <div><span style={{fontSize:13,color:"#e2e8f0",fontWeight:500}}>{m.name}</span><span style={{fontSize:11,color:"#4a5568",marginLeft:6}}>{m.note}</span></div>
                <span style={{fontSize:11,color:"#4a5568"}}>{m.unit} · {m.optimalLow}–{m.optimalHigh}</span>
              </div>
              <div style={{position:"relative"}}>
                <input type="number" value={v} placeholder="—" onChange={e=>{setEntries(prev=>({...prev,[m.id]:e.target.value}));}} style={{...inputStyle,paddingRight:76,border:`1px solid ${status?sc+"55":"rgba(255,255,255,0.1)"}`,background:status?STATUS_BG[status]:"#0d0f1a"}}/>
                {status && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:700,color:sc,textTransform:"capitalize"}}>{status}</span>}
              </div>
            </div>
          );
        })}
        <button onClick={()=>onSave(entries,date)} style={{width:"100%",padding:"15px",borderRadius:12,cursor:"pointer",background:"#4ade80",color:"#0a0a0f",border:"none",fontSize:16,fontWeight:700,marginTop:8}}>Save results</button>
      </div>
    </div>
  );
}

function EditForm({ form, setForm, editingId, onSubmit, onCancel, onDelete }) {
  const toggleSlot = (sid) => setForm(f => ({ ...f, slots: f.slots.includes(sid) ? f.slots.filter(x=>x!==sid) : [...f.slots, sid] }));
  const toggleDay  = (i)   => setForm(f => ({ ...f, days:  f.days.includes(i)   ? f.days.filter(x=>x!==i)   : [...f.days, i]   }));
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>{editingId ? "Edit supplement" : "New supplement"}</span>
        <button onClick={onCancel} style={{width:32,height:32,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#8b90a0"}}>✕</button>
      </div>
      {[["Name","name","e.g. Magnesium Glycinate"],["Dose","dose","e.g. 2 caps (300 mg)"],["Notes","notes","e.g. Thorne · with food"]].map(([lbl,key,ph]) => (
        <div key={key} style={{marginBottom:14}}>
          <label style={labelStyle}>{lbl}</label>
          <input style={inputStyle} value={form[key]} placeholder={ph} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
        </div>
      ))}
      <div style={{marginBottom:20}}>
        <label style={labelStyle}>When to take it</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {SLOTS.map(slot => { const on = form.slots.includes(slot.id); return (
            <button key={slot.id} onClick={()=>toggleSlot(slot.id)} style={{fontSize:12,padding:"7px 13px",borderRadius:20,cursor:"pointer",background:on?slot.color+"22":"transparent",color:on?slot.color:"#8b90a0",border:`1px solid ${on?slot.color:"rgba(255,255,255,0.1)"}`,fontWeight:on?600:400}}>{slot.label}</button>
          );})}
        </div>
      </div>
      <div style={{marginBottom:24}}>
        <label style={labelStyle}>Which days</label>
        <div style={{display:"flex",gap:6}}>
          {DAYS.map((d,i) => { const on = form.days.includes(i); return (
            <button key={i} onClick={()=>toggleDay(i)} style={{width:38,height:38,borderRadius:"50%",fontSize:13,cursor:"pointer",fontWeight:600,background:on?"#4ade80":"transparent",color:on?"#0a0a0f":"#8b90a0",border:`1px solid ${on?"#4ade80":"rgba(255,255,255,0.1)"}`,padding:0,flexShrink:0}}>{d[0]}</button>
          );})}
        </div>
      </div>
      {editingId && <button onClick={onDelete} style={{width:"100%",padding:"13px",borderRadius:12,cursor:"pointer",background:"transparent",color:"#f87171",border:"1px solid rgba(248,113,113,0.25)",fontSize:15,fontWeight:500,marginBottom:10}}>Delete supplement</button>}
      <button onClick={onSubmit} style={{width:"100%",padding:"15px",borderRadius:12,cursor:"pointer",background:"#4ade80",color:"#0a0a0f",border:"none",fontSize:16,fontWeight:700}}>{editingId ? "Save changes" : "Add supplement"}</button>
    </div>
  );
}

function SlotCard({ slot, slotSupps, status, timeLabel, pillTime, isFuture, isChecked, toggleCheck, openEdit }) {
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);

  const SC = {
    done:   { border:"rgba(255,255,255,0.05)",   bg:"rgba(255,255,255,0.02)",  hbg:"transparent",             badge:null },
    missed: { border:"rgba(249,115,22,0.35)",    bg:"rgba(249,115,22,0.05)",   hbg:"rgba(249,115,22,0.07)",   badge:{label:"missed",bg:"rgba(124,45,18,0.5)",color:"#fed7aa"} },
    now:    { border:"rgba(74,222,128,0.45)",    bg:"rgba(74,222,128,0.04)",   hbg:"rgba(74,222,128,0.07)",   badge:{label:"now",bg:"rgba(74,222,128,0.18)",color:"#4ade80"} },
    future: { border:"rgba(255,255,255,0.05)",   bg:"rgba(255,255,255,0.02)",  hbg:"transparent",             badge:null },
  };
  const sc = SC[status];

  return (
    <div style={{marginBottom:8,borderRadius:12,border:`1px solid ${sc.border}`,background:sc.bg,overflow:"hidden",opacity:status==="future"&&!pillTime?0.38:1}}>
      <div onClick={()=>setExpanded(e=>!e)} style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",background:sc.hbg,cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
          {allDone
            ? <div style={{width:20,height:20,borderRadius:6,background:"#4ade80",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#0a0a0f",fontSize:11,fontWeight:700}}>✓</span></div>
            : <span style={{color:slot.color,fontSize:12,flexShrink:0,width:20,textAlign:"center"}}>{slot.icon}</span>
          }
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:allDone?"#4a5568":"#fff",display:"flex",alignItems:"center",gap:6}}>
              {slot.label}
              {sc.badge && <span style={{fontSize:11,background:sc.badge.bg,color:sc.badge.color,borderRadius:6,padding:"1px 6px",fontWeight:600}}>{sc.badge.label}</span>}
            </div>
            <div style={{fontSize:10,color:"#4a5568",marginTop:1}}>{allDone&&!expanded ? `${slotSupps.length} supplement${slotSupps.length!==1?"s":""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontSize:12,color:pillTime&&SLOT_OFFSETS[slot.id]!==null?slot.color:"#4a5568",fontVariantNumeric:"tabular-nums",fontWeight:600}}>{timeLabel}</span>
          <span style={{fontSize:14,color:"#4a5568",display:"inline-block",transform:expanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>⌃</span>
        </div>
      </div>
      {expanded && (
        <div style={{padding:"2px 12px",borderTop:`1px solid ${sc.border}`}}>
          {slotSupps.map((supp,i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 0",borderBottom:i<slotSupps.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                <div onClick={()=>{ if(!isFuture) toggleCheck(slot.id,supp.id); }} style={{width:24,height:24,borderRadius:7,flexShrink:0,border:`1.5px solid ${done?"#4ade80":"rgba(255,255,255,0.15)"}`,background:done?"#4ade80":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:isFuture?"default":"pointer"}}>
                  {done && <span style={{color:"#0a0a0f",fontSize:12,fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,color:done?"#4a5568":"#f1f5f9",textDecoration:done?"line-through":"none",fontWeight:done?400:500}}>{supp.name}</div>
                  <div style={{fontSize:11,color:"#4a5568",marginTop:2}}>{supp.dose}</div>
                  {supp.notes && <div style={{fontSize:10,color:"#2d3748",marginTop:1}}>{supp.notes}</div>}
                </div>
                <button onClick={e=>{e.stopPropagation();openEdit(supp);}} style={{fontSize:11,padding:"5px 12px",borderRadius:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",color:"#6b7280",flexShrink:0,minHeight:32,display:"flex",alignItems:"center"}}>Edit</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const token = () => localStorage.getItem("sb_token") || "";

  useEffect(() => { getSession().then(u => { setUser(u); setAuthLoading(false); }); }, []);

  if (authLoading) return <Loader text="Loading…"/>;
  if (!user) return <SignIn onSignIn={u=>setUser(u)}/>;
  return <ProtocolApp user={user} token={token()} onSignOut={()=>{ signOut(); setUser(null); }}/>;
}

function Loader({ text }) {
  return (
    <div style={{background:"linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:14,color:"#4a5568"}}>{text}</div>
    </div>
  );
}

function ProtocolApp({ user, token, onSignOut }) {
  const [supps, setSupps]           = useState([]);
  const [pillTimes, setPillTimes]   = useState({});
  const [checked, setChecked]       = useState({});
  const [labHistory, setLabHistory] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [viewDate, setViewDate]     = useState(TODAY);
  const [activeTab, setActiveTab]   = useState("today");
  const [editPillTime, setEditPillTime] = useState(false);
  const [tmpTime, setTmpTime]       = useState("");
  const [formOpen, setFormOpen]     = useState(false);
  const [labOpen, setLabOpen]       = useState(false);
  const [editingLabIdx, setEditingLabIdx] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState({ name:"", dose:"", notes:"", slots:[], days:[0,1,2,3,4,5,6] });
  const [notifStatus, setNotifStatus] = useState(notifSupported() ? Notification.permission : "unsupported");
  const [streak, setStreak]         = useState(0);
  const [flashGreen, setFlashGreen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const saveTimer = useRef(null);
  const importPdfRef = useRef(null);

  const dk      = dateKey(viewDate);
  const isToday = dateKey(viewDate) === dateKey(TODAY);
  const isFuture = startOfDay(viewDate) > TODAY;
  const pillTime = pillTimes[dk] || null;
  const viewDay  = viewDate.getDay();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, labs] = await Promise.all([dbGetSupps(token), dbGetLabs(token)]);
      setSupps(s || []); setLabHistory(labs || []);
      const log = await dbGetLog(dk, token);
      if (log?.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0,5) }));
      if (log?.checked)   setChecked(log.checked);
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (loading) return;
    dbGetLog(dk, token).then(log => {
      if (!log) return;
      if (log.pill_time) setPillTimes(pt => ({ ...pt, [dk]: log.pill_time.slice(0,5) }));
      if (log.checked)   setChecked(c => ({ ...c, ...log.checked }));
    });
  }, [dk]);

  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pt = pillTimes[dk];
      const dayChecked = Object.fromEntries(Object.entries(checked).filter(([k]) => k.startsWith(dk)));
      dbUpsertLog({ log_date:dk, pill_time:pt||null, checked:dayChecked }, token);
    }, 800);
  }, [checked, pillTimes, dk, loading]);

  useEffect(() => {
    let s = 0; const d = new Date(TODAY);
    for (let i = 0; i < 30; i++) {
      const ddk = dateKey(d), pt = pillTimes[ddk]; if (!pt) break;
      const day = d.getDay();
      const allDone = CORE_SLOTS.every(sid => supps.filter(x=>x.slots.includes(sid)&&x.days.includes(day)).every(x=>!!checked[`${ddk}_${sid}_${x.id}`]));
      if (!allDone) break; s++; d.setDate(d.getDate()-1);
    }
    setStreak(s);
  }, [checked, pillTimes, supps]);

  const goDay = (offset) => { const d = new Date(viewDate); d.setDate(d.getDate()+offset); setViewDate(startOfDay(d)); };
  const setPillTimeForDay = (t) => setPillTimes(pt => ({ ...pt, [dk]: t }));

  const startDay = () => {
    if (isFuture) return;
    const t = fmtTime(new Date());
    setPillTimeForDay(t);
    const rxSupps = supps.filter(s=>s.slots.includes("rx")&&s.days.includes(viewDay));
    setChecked(c => { const n={...c}; rxSupps.forEach(s=>{n[`${dk}_rx_${s.id}`]=true;}); return n; });
    scheduleNotifications(t, supps, viewDay, dk);
    setFlashGreen(true); setTimeout(()=>setFlashGreen(false), 600);
  };

  const getSlotTime  = (sid) => { if (!pillTime||SLOT_OFFSETS[sid]===null) return null; return addMins(parseHHMM(pillTime), SLOT_OFFSETS[sid]); };
  const slotTimeStr  = (sid) => { const t=getSlotTime(sid); return t?fmtTime(t):"--:--"; };
  const toggleCheck  = (sid, suppId) => { const k=`${dk}_${sid}_${suppId}`; setChecked(c=>({...c,[k]:!c[k]})); };
  const isChecked    = (sid, suppId) => !!checked[`${dk}_${sid}_${suppId}`];
  const getSuppsForSlot = (sid) => supps.filter(s=>s.slots.includes(sid)&&s.days.includes(viewDay));

  const slotStatus = (sid) => {
    if (isFuture) return "future";
    const t = getSlotTime(sid); if (!t) return "future";
    const sl = getSuppsForSlot(sid);
    if (sl.length>0 && sl.every(s=>isChecked(sid,s.id))) return "done";
    if (!isToday) return "missed";
    const diff = (new Date()-t)/60000;
    if (diff>15) return "missed"; if (diff>-5) return "now"; return "future";
  };

  let coreTotal=0, coreDone=0;
  CORE_SLOTS.forEach(sid => { const sl=getSuppsForSlot(sid); coreTotal+=sl.length; sl.forEach(s=>{if(isChecked(sid,s.id))coreDone++;}); });
  const pct = coreTotal>0 ? Math.round((coreDone/coreTotal)*100) : 0;
  const latestLab = labHistory?.[0] || null;

  const openAdd  = () => { setEditingId(null); setForm({name:"",dose:"",notes:"",slots:[],days:[0,1,2,3,4,5,6]}); setFormOpen(true); };
  const openEdit = (supp) => { setEditingId(supp.id); setForm({name:supp.name,dose:supp.dose,notes:supp.notes||"",slots:[...supp.slots],days:[...supp.days]}); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await dbUpdateSupp({...form,id:editingId}, token);
      setSupps(s=>s.map(x=>x.id===editingId?{...form,id:editingId}:x));
    } else {
      const rows = await dbAddSupp({name:form.name,dose:form.dose,notes:form.notes,slots:form.slots,days:form.days}, token);
      if (rows?.[0]) setSupps(s=>[...s,rows[0]]);
    }
    closeForm();
  };

  const deleteSupp = async () => {
    if (!editingId) return;
    await dbDeleteSupp(editingId, token);
    setSupps(s=>s.filter(x=>x.id!==editingId));
    closeForm();
  };

  const handleImportPDF = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true); setImportMsg("");
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab); const chunks = [];
      for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i+8192)));
      const b64 = btoa(chunks.join(""));
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          system: `You are a supplement protocol parser. Extract all medications and supplements from this document. Return ONLY a raw JSON array, no markdown, no backticks. Each item should have these exact fields:
- name: string (supplement/medication name including dose in name if specified)
- dose: string (dosage amount and unit)
- notes: string (brand, instructions, conditions - keep it short)
- slots: array of slot IDs from this list only: ["rx", "fasted", "pre_breakfast", "breakfast", "pre_lunch", "lunch", "pre_dinner", "dinner", "after_dinner", "injectable"]
- days: array of day numbers (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) - use [0,1,2,3,4,5,6] for daily

Map timing instructions to the closest slot:
- "empty stomach / fasted / before eating / ayunas" → "fasted"
- "with breakfast / morning with food" → "breakfast"
- "before breakfast / 30 min before breakfast" → "pre_breakfast"
- "with lunch / midday with food" → "lunch"
- "before lunch / 30 min before lunch" → "pre_lunch"
- "with dinner / with food" → "dinner"
- "before dinner" → "pre_dinner"
- "after dinner / before bed / wind down" → "after_dinner"
- "injection / injectable / subcutaneous" → "injectable"
- "Rx / thyroid medication / first thing morning" → "rx"

Example output: [{"name":"Magnesium Glycinate","dose":"300mg","notes":"Thorne · with food","slots":["dinner"],"days":[0,1,2,3,4,5,6]}]`,
          messages: [{ role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
            { type: "text", text: "Extract all supplements and medications. Raw JSON array only." }
          ]}]
        })
      });
      if (!res.ok) { setImportMsg(`API error ${res.status}`); setImporting(false); return; }
      const data = await res.json();
      const txt = data.content.filter(c=>c.type==="text").map(c=>c.text).join("").trim();
      const parsed = JSON.parse(txt.replace(/^```[a-z]*\n?/,"").replace(/\n?```$/,"").trim());
      if (!Array.isArray(parsed) || parsed.length === 0) { setImportMsg("No supplements found in PDF."); setImporting(false); return; }
      const added = [];
      for (const item of parsed) {
        const rows = await dbAddSupp({ name:item.name||"", dose:item.dose||"", notes:item.notes||"", slots:Array.isArray(item.slots)?item.slots:[], days:Array.isArray(item.days)?item.days:[0,1,2,3,4,5,6] }, token);
        if (rows?.[0]) added.push(rows[0]);
      }
      setSupps(s => [...s, ...added]);
      setImportMsg(`✓ ${added.length} supplement${added.length!==1?"s":""} imported`);
    } catch(err) { setImportMsg("Failed: " + err.message); }
    setImporting(false);
  };

  const saveLabEntry = async (entries, date) => {
    if (editingLabIdx!==null && labHistory[editingLabIdx]) {
      const existing = labHistory[editingLabIdx];
      await dbUpdateLab(existing.id, {values:entries,drawn_at:date}, token);
      setLabHistory(h => { const n=[...h]; n[editingLabIdx]={...n[editingLabIdx],values:entries,drawn_at:date}; return n; });
    } else {
      const rows = await dbAddLab({values:entries,drawn_at:date}, token);
      if (rows?.[0]) setLabHistory(h=>[rows[0],...h]);
    }
    setEditingLabIdx(null); setLabOpen(false);
  };

  const buildLabInsight = (lab) => {
    if (!lab) return null;
    const insights = [];
    LAB_MARKERS.forEach(m => { const v=lab.values[m.id]; if(!v) return; const status=getLabStatus(m,v); const bank=LAB_INSIGHTS[m.id]; if(bank?.[status]) insights.push({name:m.name,status,text:bank[status]}); });
    return insights.sort((a,b)=>a.status==="optimal"?1:-1).slice(0,3);
  };
  const labInsights = latestLab ? buildLabInsight(latestLab) : null;

  const r=28, circ=2*Math.PI*r, dash=circ*(pct/100);
  const dayLabel = isToday ? "Today" : viewDate.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
  const card = { borderRadius:18, border:"1px solid rgba(255,255,255,0.07)", background:flashGreen?"rgba(74,222,128,0.06)":"rgba(255,255,255,0.03)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", padding:P, marginBottom:P, transition:"background 0.4s ease" };

  if (loading) return <Loader text="Loading your protocol…"/>;

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",color:"#fff",maxWidth:480,margin:"0 auto",padding:`20px ${P} 80px`,WebkitFontSmoothing:"antialiased",background:"linear-gradient(160deg,#080b14 0%,#0a0f1e 50%,#060a12 100%)",minHeight:"100vh"}}>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:P}}>
        <button onClick={()=>goDay(-1)} style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"#8b90a0",borderRadius:10,flexShrink:0}}>‹</button>
        <div style={{flex:1,textAlign:"center",padding:"0 8px"}}>
          <div style={{fontSize:11,color:"#4a5568",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>PROTOCOL · {getCurrentMonthYear().toUpperCase()}</div>
          <button onClick={()=>{if(!isToday)setViewDate(TODAY);}} style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em",background:"none",border:"none",cursor:isToday?"default":"pointer",color:isToday?"#fff":"#4ade80",padding:0,display:"block",width:"100%",textAlign:"center"}}>{dayLabel}</button>
          {!isToday && <div style={{fontSize:11,color:"#4a5568",marginTop:2}}>tap to return to today</div>}
        </div>
        <button onClick={()=>goDay(1)} style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"#8b90a0",borderRadius:10,flexShrink:0}}>›</button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:P,background:"rgba(255,255,255,0.04)",borderRadius:14,padding:4,border:"1px solid rgba(255,255,255,0.06)"}}>
        {[["today","Protocol"],["labs","Lab Results"]].map(([id,label]) => {
          const active = activeTab===id;
          return <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"9px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",background:active?"rgba(255,255,255,0.08)":"transparent",color:active?"#fff":"#8b90a0",border:"none"}}>{label}</button>;
        })}
      </div>

      {activeTab==="today" && (
        <div>
          <div style={card}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:pillTime?12:0}}>
              <div style={{flex:1}}>
                {!pillTime ? (
                  <div>
                    <button onClick={startDay} style={{padding:"15px 20px",background:isFuture?"rgba(255,255,255,0.05)":"#4ade80",color:isFuture?"#4a5568":"#0a0a0f",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:isFuture?"default":"pointer",display:"block",width:"100%",textAlign:"center"}}>
                      {isFuture ? "Future day" : "Start my day"}
                    </button>
                    {!isFuture && <div style={{fontSize:12,color:"#4a5568",marginTop:6,textAlign:"center"}}>logs your Rx meds · sets full schedule</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:11,color:"#4a5568",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Protocol started</div>
                    {editPillTime ? (
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="time" value={tmpTime} onChange={e=>setTmpTime(e.target.value)} style={{fontSize:16,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",color:"#fff"}}/>
                        <button onClick={()=>{setPillTimeForDay(tmpTime);setEditPillTime(false);}} style={{fontSize:13,padding:"6px 14px",borderRadius:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#fff"}}>Save</button>
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                        <span style={{fontSize:34,fontWeight:700,letterSpacing:"-0.04em",color:"#4ade80"}}>{pillTime}</span>
                        <button onClick={()=>{setTmpTime(pillTime);setEditPillTime(true);}} style={{fontSize:13,color:"#4a5568",background:"none",border:"none",cursor:"pointer",padding:0}}>edit</button>
                      </div>
                    )}
                    {pct===100 && <div style={{fontSize:13,color:"#4ade80",fontWeight:600,marginTop:4}}>Protocol complete ✓</div>}
                  </div>
                )}
              </div>
              <svg width="68" height="68" viewBox="0 0 68 68" style={{flexShrink:0}}>
                <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                <circle cx="34" cy="34" r={r} fill="none" stroke="#4ade80" strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ-dash} strokeLinecap="round" transform="rotate(-90 34 34)" style={{transition:"stroke-dashoffset 0.5s ease"}}/>
                <text x="34" y="34" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="13" fontWeight="700">{pct}%</text>
              </svg>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:10}}>
              <div>
                {notifStatus==="default"   && <button onClick={async()=>{const r=await(async()=>{if(!notifSupported())return"unsupported";if(Notification.permission==="granted")return"granted";if(Notification.permission==="denied")return"denied";return await Notification.requestPermission();})();setNotifStatus(r);}} style={{fontSize:12,padding:"5px 11px",borderRadius:20,cursor:"pointer",border:"1px solid rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.06)",color:"#4ade80",fontWeight:600}}>Enable reminders</button>}
                {notifStatus==="granted"   && <span style={{fontSize:12,color:"#4ade80",fontWeight:500}}>Reminders on</span>}
                {notifStatus==="denied"    && <span style={{fontSize:12,color:"#f87171"}}>Reminders blocked</span>}
                {notifStatus==="unsupported"&&<span style={{fontSize:12,color:"#4a5568"}}>Add to home screen for reminders</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {streak>0 && <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.18)",borderRadius:20,padding:"4px 10px"}}><span style={{fontSize:13}}>🔥</span><span style={{fontSize:12,fontWeight:700,color:"#fb923c"}}>{streak} day streak</span></div>}
                <button onClick={onSignOut} style={{fontSize:11,padding:"4px 10px",borderRadius:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#4a5568"}}>Sign out</button>
              </div>
            </div>
          </div>

          <input ref={importPdfRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={handleImportPDF}/>
          <div style={{display:"flex",gap:8,marginBottom:P}}>
            <button onClick={openAdd} style={{flex:1,padding:"13px",borderRadius:14,cursor:"pointer",border:"1px dashed rgba(74,222,128,0.22)",background:"rgba(74,222,128,0.03)",fontSize:14,fontWeight:600,color:"#4ade80"}}>
              + Add supplement
            </button>
            <button onClick={()=>importPdfRef.current?.click()} disabled={importing} style={{padding:"13px 16px",borderRadius:14,cursor:importing?"default":"pointer",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",fontSize:14,fontWeight:600,color:importing?"#4a5568":"#8b90a0",whiteSpace:"nowrap"}}>
              {importing ? "Importing…" : "Import PDF"}
            </button>
          </div>
          {importMsg && <div style={{fontSize:13,color:importMsg.startsWith("✓")?"#4ade80":"#f87171",marginBottom:P,textAlign:"center"}}>{importMsg}</div>}

          <div style={{borderRadius:18,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:P,marginBottom:P}}>
            {supps.length===0 ? (
              <div style={{textAlign:"center",padding:"2rem 1rem"}}>
                <div style={{fontSize:28,marginBottom:12}}>💊</div>
                <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:6}}>Your protocol is empty</div>
                <div style={{fontSize:13,color:"#4a5568",lineHeight:1.7,marginBottom:20}}>Add your medications and supplements above.<br/>The schedule anchors to when you take your first Rx each morning.</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={openAdd} style={{flex:1,padding:"11px 0",borderRadius:12,cursor:"pointer",background:"#4ade80",color:"#0a0a0f",border:"none",fontSize:14,fontWeight:700}}>Add first supplement</button>
                  <button onClick={()=>importPdfRef.current?.click()} disabled={importing} style={{flex:1,padding:"11px 0",borderRadius:12,cursor:importing?"default":"pointer",background:"transparent",color:importing?"#4a5568":"#8b90a0",border:"1px solid rgba(255,255,255,0.1)",fontSize:14,fontWeight:600}}>{importing?"Importing…":"Import from PDF"}</button>
                </div>
              </div>
            ) : SLOTS.map(slot => {
              const slotSupps = getSuppsForSlot(slot.id); if (!slotSupps.length) return null;
              const status = slotStatus(slot.id);
              const timeLabel = SLOT_OFFSETS[slot.id]===null ? "variable" : slotTimeStr(slot.id);
              return <SlotCard key={slot.id} slot={slot} slotSupps={slotSupps} status={status} timeLabel={timeLabel} pillTime={pillTime} isFuture={isFuture} isChecked={isChecked} toggleCheck={toggleCheck} openEdit={openEdit}/>;
            })}
          </div>

          {latestLab && (
            <div style={{borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:P,marginBottom:P}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div><div style={{fontSize:11,color:"#4a5568",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:2}}>Latest labs</div><div style={{fontSize:12,color:"#8b90a0"}}>{latestLab.drawn_at}</div></div>
                <button onClick={()=>setActiveTab("labs")} style={{fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#8b90a0"}}>See all</button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:labInsights?14:0}}>
                {LAB_MARKERS.filter(m=>latestLab.values[m.id]).slice(0,6).map(m => {
                  const v=latestLab.values[m.id], status=getLabStatus(m,v), sc=status?STATUS_COLOR[status]:"#8b90a0", sbg=status?STATUS_BG[status]:"rgba(255,255,255,0.03)";
                  return <div key={m.id} style={{background:sbg,border:`1px solid ${status?sc+"33":"rgba(255,255,255,0.06)"}`,borderRadius:10,padding:"8px 12px",minWidth:88,flex:"1 1 88px"}}><div style={{fontSize:10,color:"#4a5568",marginBottom:3,fontWeight:500}}>{m.name}</div><div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:16,fontWeight:700,color:sc}}>{v}</span><span style={{fontSize:10,color:"#4a5568"}}>{m.unit}</span></div></div>;
                })}
              </div>
              {labInsights?.map((insight,i) => {
                const sc=STATUS_COLOR[insight.status];
                return <div key={i} style={{borderTop:i===0?"1px solid rgba(255,255,255,0.05)":"none",paddingTop:i===0?12:0,marginTop:i===0?0:8,display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:6,height:6,borderRadius:"50%",background:sc,marginTop:5,flexShrink:0}}></div><div><span style={{fontSize:12,color:sc,fontWeight:600}}>{insight.name} · </span><span style={{fontSize:12,color:"#8b90a0",lineHeight:1.5}}>{insight.text}</span></div></div>;
              })}
            </div>
          )}
        </div>
      )}

      {activeTab==="labs" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:P}}>
            <div style={{fontSize:13,color:"#8b90a0"}}>Functional optimal ranges</div>
            <button onClick={()=>{setEditingLabIdx(null);setLabOpen(true);}} style={{fontSize:13,padding:"8px 16px",borderRadius:20,cursor:"pointer",border:"1px solid rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.06)",color:"#4ade80",fontWeight:600}}>+ Log results</button>
          </div>
          {labHistory.length===0 && (
            <div style={{borderRadius:18,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:P,textAlign:"center",paddingTop:"2.5rem",paddingBottom:"2.5rem"}}>
              <div style={{fontSize:28,marginBottom:10}}>🧬</div>
              <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:6}}>No lab results yet</div>
              <div style={{fontSize:13,color:"#4a5568",marginBottom:16}}>Upload a PDF or enter values manually</div>
              <button onClick={()=>{setEditingLabIdx(null);setLabOpen(true);}} style={{padding:"11px 24px",borderRadius:12,cursor:"pointer",background:"#4ade80",color:"#0a0a0f",border:"none",fontSize:14,fontWeight:700}}>Log first results</button>
            </div>
          )}
          {labHistory.map((entry,i) => {
            const isLatest=i===0, entryInsights=isLatest?buildLabInsight(entry):null;
            return (
              <div key={entry.id||i} style={{borderRadius:18,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:P,marginBottom:P}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isLatest?14:0}}>
                  <div>{isLatest&&<div style={{fontSize:11,color:"#4a5568",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:2}}>Latest results</div>}<div style={{fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{entry.drawn_at}</div></div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>{!isLatest&&<span style={{fontSize:12,color:"#4a5568"}}>{Object.keys(entry.values).length} markers</span>}<button onClick={()=>{setEditingLabIdx(i);setLabOpen(true);}} style={{fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#8b90a0"}}>{isLatest?"Edit":"View"}</button></div>
                </div>
                {isLatest && (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:entryInsights?14:0}}>
                      {LAB_MARKERS.map(m => {
                        const v=entry.values[m.id]; if(!v) return null;
                        const status=getLabStatus(m,v),sc=STATUS_COLOR[status]||"#8b90a0",sbg=STATUS_BG[status]||"rgba(255,255,255,0.03)";
                        return <div key={m.id} style={{background:sbg,border:`1px solid ${sc}33`,borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:11,color:"#4a5568",marginBottom:4,fontWeight:500}}>{m.name}</div><div style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontSize:18,fontWeight:700,color:sc}}>{v}</span><span style={{fontSize:11,color:"#4a5568"}}>{m.unit}</span></div><div style={{fontSize:10,fontWeight:700,color:sc,marginTop:3,textTransform:"capitalize"}}>{status} · {m.optimalLow}–{m.optimalHigh}</div></div>;
                      })}
                    </div>
                    {entryInsights && (
                      <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:14}}>
                        <div style={{fontSize:11,color:"#4a5568",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>Protocol insights</div>
                        {entryInsights.map((insight,j) => { const sc=STATUS_COLOR[insight.status]; return <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:j<entryInsights.length-1?10:0}}><div style={{width:6,height:6,borderRadius:"50%",background:sc,marginTop:5,flexShrink:0}}></div><div><span style={{fontSize:13,color:sc,fontWeight:600}}>{insight.name} · </span><span style={{fontSize:13,color:"#8b90a0",lineHeight:1.6}}>{insight.text}</span></div></div>; })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={closeForm}>
        <EditForm form={form} setForm={setForm} editingId={editingId} onSubmit={submitForm} onCancel={closeForm} onDelete={deleteSupp}/>
      </Modal>
      <LabModal open={labOpen} onClose={()=>{setLabOpen(false);setEditingLabIdx(null);}} onSave={saveLabEntry}
        labs={editingLabIdx!==null&&labHistory[editingLabIdx]?labHistory[editingLabIdx].values:{}}
        labDate={editingLabIdx!==null&&labHistory[editingLabIdx]?labHistory[editingLabIdx].drawn_at:""}/>
    </div>
  );
}
