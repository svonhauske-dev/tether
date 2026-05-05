import { colors } from '../design-system';
import { parseHHMM, addMins } from './time';

export const notifOK = () => "Notification" in window;

export const SLOTS = [
  { id: "rx",            label: "Anchor Medication", sublabel: "Empty stomach · first thing", icon: "★", color: colors.slotAnchor },
  { id: "pre_breakfast", label: "Before Breakfast",  sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreBreakfast },
  { id: "breakfast",     label: "With Breakfast",    sublabel: "With food",                   icon: "●", color: colors.slotBreakfast },
  { id: "pre_lunch",     label: "Before Lunch",      sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreLunch },
  { id: "lunch",         label: "With Lunch",        sublabel: "With food",                   icon: "●", color: colors.slotLunch },
  { id: "pre_dinner",    label: "Before Dinner",     sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreDinner },
  { id: "dinner",        label: "With Dinner",       sublabel: "With food",                   icon: "●", color: colors.slotDinner },
  { id: "after_dinner",  label: "After Dinner",      sublabel: "Before bed",                  icon: "◑", color: colors.slotEvening },
  { id: "injectable",    label: "Injectables",       sublabel: "Subcutaneous",                icon: "⊕", color: colors.slotInjectable },
  { id: "topical",       label: "Topicals",          sublabel: "Skin & external",             icon: "◐", color: colors.slotTopical },
];

export function scheduleNotifications(pt, supps, vd, dk, offsets) {
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
