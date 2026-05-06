import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { spacing, radius, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import Badge from './Badge';
import Button from './Button';

export default function SlotCard({ slot, slotSupps, status, timeLabel, hasOffset, pillTime, isFuture, isChecked, toggleCheck, openEdit, noSchedule, isReadOnly, isPast }) {
  const { theme } = useTheme();
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);
  const isVariableSlot = slot.id === "injectable" || slot.id === "topical";

  const SC = {
    done:   { border: theme.border.subtle,          bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: null },
    missed: { border: theme.border.subtle,           bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: { label: "late",   bg: theme.status.warningSubtle,          color: theme.status.warning } },
    now:    { border: theme.status.nowBorder,       bg: theme.status.nowBg,       hbg: theme.status.nowHover,        badge: { label: "now",    bg: theme.status.nowBadgeBg,     color: theme.accent.default } },
    future: { border: theme.border.subtle,          bg: theme.surface.cardSubtle,        hbg: "transparent",                badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ borderRadius: radius.md, border: `1px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: !noSchedule && status === "future" && !pillTime && !isVariableSlot ? 0.38 : 1 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: `${spacing.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: radius.xs, background: theme.accent.default, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: theme.text.onAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span></div>
            : <span style={{ color: theme.slot.default, fontSize: typography.caption, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: allDone ? theme.text.muted : theme.text.primary, display: "flex", alignItems: "center", gap: spacing.xs }}>
              {slot.label}
              {sc.badge && <Badge variant={sc.badge.label === "now" ? "now" : "missed"}>{sc.badge.label}</Badge>}
            </div>
            <div style={{ fontSize: typography.label, color: theme.text.muted, marginTop: spacing.xxxs, minHeight: 16 }}>{allDone && !expanded ? `${slotSupps.length} item${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
          {!noSchedule && <span style={{ fontSize: typography.caption, color: pillTime && hasOffset ? theme.slot.default : theme.text.muted, fontVariantNumeric: "tabular-nums", fontWeight: typography.semibold }}>{timeLabel}</span>}
          <span style={{ fontSize: typography.caption, color: theme.text.muted, display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: `${spacing.xs}px`, borderTop: `1px solid ${sc.border}` }}>
          {slotSupps.map((supp, i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.sm}px 0`, borderBottom: i < slotSupps.length - 1 ? `1px solid ${theme.border.subtle}` : "none", minHeight: touch.row, borderRadius: radius.sm /* outer(12) - pad(8) = 4 */ }}>
                <div onClick={() => { if (!isFuture && !isReadOnly) toggleCheck(slot.id, supp.id); }} style={{ width: 24, height: 24, borderRadius: radius.sm, flexShrink: 0, border: `1.5px solid ${done ? theme.accent.default : theme.border.strong}`, background: done ? theme.accent.default : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: (isFuture || isReadOnly) ? "default" : "pointer" }}>
                  {done && <span style={{ color: theme.text.onAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.body, color: done ? theme.text.muted : theme.text.primary, textDecoration: done ? "line-through" : "none", fontWeight: done ? typography.regular : typography.medium, display: "flex", alignItems: "center", gap: spacing.xxs }}>
                    {supp.name}
                    {supp.category === "Rx" && <Badge variant="category">Rx</Badge>}
                  </div>
                  <div style={{ fontSize: typography.label, color: theme.text.muted, marginTop: spacing.xxxs, minHeight: 14 }}>{supp.dose}{supp.notes ? " · " + supp.notes : ""}</div>
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
