const SUPA_URL = "https://yahimlivfieuknagusxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaGltbGl2ZmlldWtuYWd1c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODYwNDIsImV4cCI6MjA5MzM2MjA0Mn0._5_t5k1NCAHAFHEz0clqD8fSxsNCMzlqBoRPSmD7wxs";

export async function refreshSession() {
  const refreshToken = localStorage.getItem("sb_refresh_token");
  console.log("[auth] refreshSession — refresh token present:", !!refreshToken);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    console.log("[auth] refresh endpoint status:", res.status);
    if (res.ok) {
      const d = await res.json();
      if (d.access_token) {
        localStorage.setItem("sb_token", d.access_token);
        if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
        console.log("[auth] refresh succeeded — new_refresh_token present:", !!d.refresh_token);
        return d.access_token;
      }
      console.warn("[auth] refresh ok but no access_token in body:", JSON.stringify(d));
    } else {
      const body = await res.json().catch(() => ({}));
      console.error("[auth] refresh failed:", res.status, JSON.stringify(body));
    }
  } catch (e) {
    console.error("[auth] refresh fetch threw:", e);
  }
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
  const storedRefresh = localStorage.getItem("sb_refresh_token");
  console.log("[auth] getSession boot — access_token:", !!token, "refresh_token:", !!storedRefresh);

  if (!token && !storedRefresh) {
    console.log("[auth] no credentials — showing sign-in");
    return null;
  }

  if (token) {
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
      });
      console.log("[auth] /user with access_token →", res.status);
      if (res.ok) { const d = await res.json(); return d.id ? d : null; }
      if (res.status !== 401 && res.status !== 403) {
        console.warn("[auth] unexpected /user status, not retrying:", res.status);
        return null;
      }
    } catch (e) {
      console.warn("[auth] /user fetch threw, falling through to refresh:", e);
    }
  }

  console.log("[auth] access_token expired or missing — attempting refresh...");
  if (!storedRefresh) {
    console.log("[auth] no refresh token — showing sign-in");
    return null;
  }
  const newToken = await refreshSession();
  if (!newToken) {
    console.log("[auth] refresh returned null — showing sign-in");
    return null;
  }

  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${newToken}` },
    });
    console.log("[auth] /user after refresh →", res.status);
    if (res.ok) { const d = await res.json(); return d.id ? d : null; }
  } catch (e) {
    console.error("[auth] /user retry threw:", e);
  }
  console.log("[auth] all paths exhausted — showing sign-in");
  return null;
}

export async function signUp(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) {
    const text = d?.error_description || d?.msg || d?.error || "";
    if (/already registered|already exists/i.test(text)) throw new Error("EMAIL_TAKEN");
    throw new Error("SIGNUP_FAILED");
  }
  localStorage.setItem("sb_token", d.access_token);
  if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
  return { user: d.user, session: d };
}

export async function signInPassword(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("INVALID_CREDENTIALS");
  localStorage.setItem("sb_token", d.access_token);
  if (d.refresh_token) localStorage.setItem("sb_refresh_token", d.refresh_token);
  console.log("[auth] signIn — access_token stored:", !!d.access_token, "refresh_token stored:", !!d.refresh_token);
  return { user: d.user, session: d };
}

export function signOut() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_refresh_token");
}

export const dbGetSupps     = (t)       => supa("GET",    "/rest/v1/supplements?select=*&order=created_at.asc", null, t);
export const dbAddSupp      = (s, t)    => supa("POST",   "/rest/v1/supplements", s, t);
export const dbUpdateSupp   = (s, t)    => supa("PATCH",  `/rest/v1/supplements?id=eq.${s.id}`, { name: s.name, dose: s.dose, notes: s.notes, slots: s.slots, days: s.days, category: s.category, timePreference: s.timePreference, paused: s.paused ?? false, status: s.status ?? 'active', stopped_at: s.stopped_at ?? null, treatment_mode: s.treatment_mode ?? "indefinite", starts_at: s.starts_at ?? null, ends_at: s.ends_at ?? null, cycle_on_value: s.cycle_on_value ?? null, cycle_on_unit: s.cycle_on_unit ?? null, cycle_off_value: s.cycle_off_value ?? null, cycle_off_unit: s.cycle_off_unit ?? null, updated_at: new Date().toISOString() }, t);
export const dbDeleteSupp   = (id, t)   => supa("DELETE", `/rest/v1/supplements?id=eq.${id}`, null, t);
export const dbGetLog       = (date, t) => supa("GET",    `/rest/v1/daily_logs?select=*&log_date=eq.${date}`, null, t).then(r => r?.[0] || null);
export const dbUpsertLog    = (log, t)  => supa("POST",   "/rest/v1/daily_logs?on_conflict=user_id,log_date", log, t);
export const dbGetSchedule  = (t)       => supa("GET",    "/rest/v1/user_schedule?select=*", null, t).then(r => r?.[0] || null);
export const dbSaveSchedule = (data, t) => supa("POST",   "/rest/v1/user_schedule?on_conflict=user_id", data, t);

export const dbUpdateScheduleField = (field, value, userId, token) =>
  supa("PATCH", `/rest/v1/user_schedule?user_id=eq.${userId}`, { [field]: value }, token);

export async function recomputeNotifications(token) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/recompute_notifications`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timezone }),
    });
    if (!res.ok) console.error("Recompute failed:", await res.text());
  } catch (e) {
    console.error("Recompute error:", e);
  }
}

export const dbGetProfile    = (userId, t)       => supa("GET",   `/rest/v1/user_profiles?id=eq.${userId}&select=*`, null, t).then(r => r?.[0] || null);
export const dbCreateProfile = (data, t)         => supa("POST",  "/rest/v1/user_profiles", data, t);
export const dbUpdateProfile = (userId, data, t) => supa("PATCH", `/rest/v1/user_profiles?id=eq.${userId}`, data, t);

export async function getThemePreference(userId, token) {
  const rows = await supa("GET", `/rest/v1/user_profiles?id=eq.${userId}&select=theme_preference`, null, token);
  const pref = rows?.[0]?.theme_preference;
  return (pref === "light" || pref === "dark" || pref === "system") ? pref : null;
}

export async function setThemePreference(pref, userId, token) {
  await supa("PATCH", `/rest/v1/user_profiles?id=eq.${userId}`, { theme_preference: pref }, token);
  return pref;
}

export async function updateEmail(newEmail, token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ email: newEmail }),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.msg || "EMAIL_UPDATE_FAILED"); }
  return res.json();
}

export async function updatePassword(newPassword, token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.msg || "PASSWORD_UPDATE_FAILED"); }
  return res.json();
}
