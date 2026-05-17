import { useState, useEffect } from 'react';
import { Pencil, Pill, Syringe, Droplet } from 'lucide-react';
import { spacing, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import Badge from './Badge';
import Button from './Button';

function CategoryIcon({ category, color }) {
  if (category === "Rx")         return <Pill     size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Injectable") return <Syringe  size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Topical")    return <Droplet  size={14} color={color} style={{ flexShrink: 0 }} />;
  return null;
}

export default function SlotCard({ slot, slotSupps, status, timeLabel, hasOffset, pillTime, isFuture, isChecked, toggleCheck, openEdit, noSchedule, isReadOnly, isPast }) {
  const { theme } = useTheme();
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);

  const SC = {
    done:   { border: theme.border.subtle,          bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: null },
    missed: { border: theme.border.subtle,           bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: { label: "late",   bg: theme.status.warningSubtle,          color: theme.status.warning } },
    now:    { border: theme.status.nowBorder,       bg: theme.status.nowBg,       hbg: theme.status.nowHover,        badge: { label: "now",    bg: theme.status.nowBadgeBg,     color: theme.status.nowBadgeText } },
    future: { border: theme.border.subtle,          bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ borderRadius: theme.radius.surface, border: `${theme.borderWidth.default}px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: !noSchedule && status === "future" && !pillTime ? 0.38 : 1 }}>
      <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded} style={{ width: "100%", padding: `${spacing.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, border: "none", cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", fontFamily: "inherit", color: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: theme.radius.surfaceInner, background: theme.accent.default, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: theme.text.onAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span></div>
            : <span style={{ color: theme.slot.default, fontSize: typography.caption, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: allDone ? theme.text.secondary : theme.text.primary, display: "flex", alignItems: "center", gap: spacing.xs }}>
              {slot.label}
              {sc.badge && <Badge variant={sc.badge.label === "now" ? "now" : "missed"}>{sc.badge.label}</Badge>}
            </div>
            <div style={{ fontSize: typography.label, color: theme.text.secondary, marginTop: spacing.xxxs, minHeight: 16 }}>{allDone && !expanded ? `${slotSupps.length} item${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
          {!noSchedule && <span style={{ fontSize: typography.caption, color: pillTime && hasOffset ? theme.slot.default : theme.text.secondary, fontVariantNumeric: "tabular-nums", fontWeight: typography.semibold }}>{timeLabel}</span>}
          <span style={{ fontSize: typography.caption, color: theme.text.secondary, display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: `${spacing.sm}px ${spacing.md}px`, borderTop: `${theme.borderWidth.default}px solid ${sc.border}`, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {slotSupps.map((supp, i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.xs, minHeight: touch.row }}>
                <button type="button" onClick={() => { if (!isFuture && !isReadOnly) toggleCheck(slot.id, supp.id); }} aria-label={done ? `Uncheck ${supp.name}` : `Check ${supp.name}`} aria-pressed={done} style={{ background: "none", border: "none", padding: 10, margin: -10, cursor: (isFuture || isReadOnly) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ width: 24, height: 24, borderRadius: theme.radius.surfaceInner, border: `${theme.borderWidth.accent}px solid ${done ? theme.accent.default : theme.border.strong}`, background: done ? theme.accent.default : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {done && <span style={{ color: theme.text.onAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span>}
                  </div>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.body, color: done ? theme.text.secondary : theme.text.primary, textDecoration: done ? "line-through" : "none", fontWeight: done ? typography.regular : typography.medium, display: "flex", alignItems: "center", gap: "6px" }}>
                    {supp.name}
                    <CategoryIcon category={supp.category} color={theme.text.secondary} />
                  </div>
                  <div style={{ fontSize: typography.label, color: theme.text.secondary, marginTop: spacing.xxxs, minHeight: 14 }}>{supp.dose}{supp.notes ? " · " + supp.notes : ""}</div>
                </div>
                {!isReadOnly && !isPast && <Button variant="icon" aria-label={`Edit ${supp.name}`} onClick={e => { e.stopPropagation(); openEdit(supp); }} style={{ border: "none" }}><Pencil size={16} /></Button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
