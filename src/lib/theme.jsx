import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { themes } from "../design-system";
import {
  getThemePreference as dbGetThemePref,
  setThemePreference as dbSetThemePref,
} from "./api";

export const THEME_NAMES = Object.keys(themes);
const PREF_KEY = "origin_theme_preference";
const VALID_PREFS = ["achromatic"];

function resolveTheme(pref) {
  if (THEME_NAMES.includes(pref)) return pref;
  return "achromatic";
}

function getStoredPref() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return VALID_PREFS.includes(v) ? v : "achromatic";
  } catch {
    return "achromatic";
  }
}

function getInitial() {
  const pref = getStoredPref();
  let name = resolveTheme(pref);
  // URL param overrides resolved theme for dev/sharing — doesn't change stored pref
  try {
    const param = new URLSearchParams(window.location.search).get("theme");
    if (param && THEME_NAMES.includes(param)) name = param;
  } catch {}
  return { pref, name };
}

const ThemeContext = createContext({
  theme: themes.achromatic,
  themeName: "achromatic",
  themePreference: "achromatic",
  setTheme: () => {},
  setThemePreference: () => {},
  syncFromDB: async () => {},
});

export function ThemeProvider({ children }) {
  const [{ pref, name }, setState] = useState(getInitial);
  const userIdRef = useRef(null);

  // (The old 'system' branch — prefers-color-scheme listener calling an
  // undefined getSystemTheme — was unreachable since VALID_PREFS only
  // accepts 'achromatic'. Removed in Round C cleanup.)

  // Called once by ProtocolApp after auth — fetches DB preference and syncs if it differs from localStorage
  const syncFromDB = useCallback(async (userId, token) => {
    userIdRef.current = userId;
    try {
      const dbPref = await dbGetThemePref(userId, token);
      if (dbPref && VALID_PREFS.includes(dbPref)) {
        const localPref = getStoredPref();
        if (dbPref !== localPref) {
          try { localStorage.setItem(PREF_KEY, dbPref); } catch {}
          setState({ pref: dbPref, name: resolveTheme(dbPref) });
        }
      }
    } catch (e) {
      console.error("[theme] DB sync failed:", e);
    }
  }, []);

  // Persists preference to localStorage, resolves new active theme, and fire-and-forgets to DB
  const setThemePreference = useCallback((newPref) => {
    try { localStorage.setItem(PREF_KEY, newPref); } catch {}
    setState({ pref: newPref, name: resolveTheme(newPref) });
    const userId = userIdRef.current;
    if (userId) {
      const token = localStorage.getItem("sb_token") || "";
      dbSetThemePref(newPref, userId, token).catch(e => {
        console.error("[theme] DB write failed:", e);
      });
    }
  }, []);

  // Dev-only: set active theme without touching stored preference (used by DevThemePicker)
  const setTheme = (newName) => {
    setState(s => ({ ...s, name: newName }));
  };

  const theme = themes[name] ?? themes.achromatic;

  useEffect(() => {
    document.body.style.background = theme.surface.canvas;
    const GEIST = '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    const t = theme.typography ?? {};
    document.documentElement.style.setProperty('--font-body',    t.fontBody    ?? GEIST);
    document.documentElement.style.setProperty('--font-heading', t.fontHeading ?? GEIST);
    document.documentElement.style.setProperty('--font-data',    t.fontData    ?? GEIST);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeName: name, themePreference: pref, setTheme, setThemePreference, syncFromDB }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
