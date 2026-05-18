const pad = (n) => String(n).padStart(2, "0");

export const fmtTime    = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addMins    = (d, m) => new Date(d.getTime() + m * 60000);
export const parseHHMM  = (s) => { const [h, m] = s.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; };
export const dateKey    = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };

export const TODAY = startOfDay(new Date());

function convertToDays(value, unit) {
  if (unit === "days")   return value;
  if (unit === "weeks")  return value * 7;
  if (unit === "months") return value * 30;
  return 0;
}

export function isSupplementActiveOn(supp, date) {
  const checkDate = startOfDay(date);

  // Don't show a supplement on days before it was added. created_at is the implicit
  // start date for indefinite supps; explicit starts_at takes priority for scheduled/cycled.
  if (supp.created_at) {
    const createdLocal = startOfDay(new Date(supp.created_at));
    if (checkDate < createdLocal) return false;
  }

  // Soft-deleted supps stop being expected from the deletion date forward.
  // Defensive check — `dbGetSupps` already filters `deleted_at IS NULL`, but if
  // a deleted row leaks through any other read path, this keeps the math clean.
  if (supp.deleted_at) {
    const deletedLocal = startOfDay(new Date(supp.deleted_at));
    if (checkDate >= deletedLocal) return false;
  }

  if (!supp.treatment_mode || supp.treatment_mode === "indefinite") return true;

  const parseLocalDate = (s) => { const [y, m, d] = s.split("-").map(Number); return startOfDay(new Date(y, m - 1, d)); };
  const startsAt  = supp.starts_at ? parseLocalDate(supp.starts_at) : null;
  const endsAt    = supp.ends_at   ? parseLocalDate(supp.ends_at)   : null;

  if (startsAt && checkDate < startsAt) return false;
  if (endsAt   && checkDate >= endsAt)  return false;

  if (supp.treatment_mode === "scheduled") return true;

  if (supp.treatment_mode === "cycled") {
    if (!startsAt || !supp.cycle_on_value || !supp.cycle_off_value) return false;
    const daysSinceStart  = Math.floor((checkDate - startsAt) / (1000 * 60 * 60 * 24));
    const onDays          = convertToDays(supp.cycle_on_value,  supp.cycle_on_unit);
    const offDays         = convertToDays(supp.cycle_off_value, supp.cycle_off_unit);
    const cycleDays       = onDays + offDays;
    if (cycleDays === 0) return false;
    return (daysSinceStart % cycleDays) < onDays;
  }

  return true;
}

export function isActiveSupp(supp) {
  return supp.status === 'active' || (!supp.status && !supp.paused);
}

export function isPausedSupp(supp) {
  return supp.status === 'paused' || (!supp.status && supp.paused === true);
}
