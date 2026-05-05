const SUPA_URL = "https://yahimlivfieuknagusxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaGltbGl2ZmlldWtuYWd1c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODYwNDIsImV4cCI6MjA5MzM2MjA0Mn0._5_t5k1NCAHAFHEz0clqD8fSxsNCMzlqBoRPSmD7wxs";

export async function refreshSession() {
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

export async function supa(method, path, body, token) {
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

export async function getSession() {
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

export async function signUp(email, password) {
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

export async function signInPassword(email, password) {
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

export function signOut() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_refresh_token");
}

export const dbGetSupps     = (t)       => supa("GET",    "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
export const dbAddSupp      = (s, t)    => supa("POST",   "/rest/v1/supplements", s, t);
export const dbUpdateSupp   = (s, t)    => supa("PATCH",  `/rest/v1/supplements?id=eq.${s.id}`, { name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category, timePreference: s.timePreference, paused: s.paused ?? false, updated_at: new Date().toISOString() }, t);
export const dbDeleteSupp   = (id, t)   => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
export const dbGetLog       = (date, t) => supa("GET",    `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
export const dbUpsertLog    = (log, t)  => supa("POST",   "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
export const dbGetSchedule  = (t)       => supa("GET",    "/rest/v1/user_schedule?select=*", null, t).then(r => r?.[0] || null);
export const dbSaveSchedule = (data, t) => supa("POST",   "/rest/v1/user_schedule?on_conflict=user_id", data, t);
