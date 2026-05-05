import { useState, useEffect } from 'react';
import { colors, spacing, radius, typography } from '../design-system';
import Badge from './Badge';
import Button from './Button';

export default function SlotCard({ slot, slotSupps, status, timeLabel, hasOffset, pillTime, isFuture, isChecked, toggleCheck, openEdit, noSchedule }) {
  const allDone = slotSupps.every(s => isChecked(slot.id, s.id));
  const [expanded, setExpanded] = useState(!allDone);
  useEffect(() => { setExpanded(!allDone); }, [allDone]);
  const isVariableSlot = slot.id === "injectable" || slot.id === "topical";

  const SC = {
    done:   { border: colors.borderSubtle,          bg: colors.cardSubtle,        hbg: "transparent",                badge: null },
    missed: { border: colors.borderSubtle,           bg: colors.cardSubtle,        hbg: "transparent",                badge: { label: "late",   bg: colors.warningSubtle,          color: colors.warning } },
    now:    { border: colors.statusNowBorder,       bg: colors.statusNowBg,       hbg: colors.statusNowHover,        badge: { label: "now",    bg: colors.statusNowBadgeBg,     color: colors.accent } },
    future: { border: colors.borderSubtle,          bg: colors.cardSubtle,        hbg: "transparent",                badge: null },
  };
  const sc = SC[status];

  return (
    <div style={{ borderRadius: radius.md, border: `1px solid ${sc.border}`, background: sc.bg, overflow: "hidden", opacity: !noSchedule && status === "future" && !pillTime && !isVariableSlot ? 0.38 : 1 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: `${spacing.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center", background: sc.hbg, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
          {allDone
            ? <div style={{ width: 20, height: 20, borderRadius: radius.xs, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: colors.textOnAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span></div>
            : <span style={{ color: slot.color, fontSize: typography.caption, flexShrink: 0, width: 20, textAlign: "center" }}>{slot.icon}</span>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: typography.caption, fontWeight: typography.semibold, color: allDone ? colors.textMuted : colors.textPrimary, display: "flex", alignItems: "center", gap: spacing.xs }}>
              {slot.label}
              {sc.badge && <Badge variant={sc.badge.label === "now" ? "now" : "missed"}>{sc.badge.label}</Badge>}
            </div>
            <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xxxs, minHeight: 16 }}>{allDone && !expanded ? `${slotSupps.length} supplement${slotSupps.length !== 1 ? "s" : ""} done` : slot.sublabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
          {!noSchedule && <span style={{ fontSize: typography.caption, color: pillTime && hasOffset ? slot.color : colors.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: typography.semibold }}>{timeLabel}</span>}
          <span style={{ fontSize: typography.caption, color: colors.textMuted, display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: `0 ${spacing.md}px ${spacing.xxs}px`, borderTop: `1px solid ${sc.border}` }}>
          {slotSupps.map((supp, i) => {
            const done = isChecked(slot.id, supp.id);
            return (
              <div key={supp.id} style={{ display: "flex", alignItems: "center", gap: spacing.xs, padding: `${spacing.sm}px 0`, borderBottom: i < slotSupps.length - 1 ? `1px solid ${colors.divider}` : "none", minHeight: 52 }}>
                <div onClick={() => { if (!isFuture) toggleCheck(slot.id, supp.id); }} style={{ width: 24, height: 24, borderRadius: radius.sm, flexShrink: 0, border: `1.5px solid ${done ? colors.accent : colors.borderStrong}`, background: done ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isFuture ? "default" : "pointer" }}>
                  {done && <span style={{ color: colors.textOnAccent, fontSize: typography.label, fontWeight: typography.bold }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.body, color: done ? colors.textDone : colors.textPrimary, textDecoration: done ? "line-through" : "none", fontWeight: done ? typography.regular : typography.medium, display: "flex", alignItems: "center", gap: spacing.xxs }}>
                    {supp.name}
                    {supp.category === "Rx" && <Badge variant="category">Rx</Badge>}
                  </div>
                  <div style={{ fontSize: typography.label, color: colors.textMuted, marginTop: spacing.xxxs, minHeight: 14 }}>{supp.dose}{supp.notes ? " · " + supp.notes : ""}</div>
                </div>
                <Button variant="secondary" size="compact" onClick={e => { e.stopPropagation(); openEdit(supp); }}>Edit</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
