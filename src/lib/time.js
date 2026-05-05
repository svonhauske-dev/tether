const pad = (n) => String(n).padStart(2, "0");

export const fmtTime    = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addMins    = (d, m) => new Date(d.getTime() + m * 60000);
export const parseHHMM  = (s) => { const [h, m] = s.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; };
export const dateKey    = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };

export const TODAY = startOfDay(new Date());
