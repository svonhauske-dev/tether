import { useState } from 'react';
import { colors, spacing, typography } from '../design-system';
import { SLOTS } from '../lib/notifications';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import Badge from './Badge';

const CATEGORIES = ["Oral", "Rx", "Injectable", "Topical"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function EditForm({ form, setForm, editingId }) {
  const [nameTouched, setNameTouched] = useState(false);
  const toggleSlot = (sid) => setForm(f => ({ ...f, slots: f.slots.includes(sid) ? f.slots.filter(x => x !== sid) : [...f.slots, sid] }));
  const toggleDay  = (i)   => setForm(f => ({ ...f, days:  f.days.includes(i)   ? f.days.filter(x => x !== i)   : [...f.days, i]   }));
  return (
    <div>
      {editingId && form.paused && (
        <div style={{ marginBottom: spacing.md }}>
          <Badge variant="neutral">Currently paused</Badge>
        </div>
      )}
      {[["Name", "name", "e.g. Magnesium Glycinate"], ["Dose", "dose", "e.g. 2 caps (300 mg)"], ["Notes", "notes", "e.g. Thorne · with food"]].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: spacing.md }}>
          <Label>{lbl}</Label>
          <Input
            value={form[key]}
            placeholder={ph}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            {...(key === "name" ? { onBlur: () => setNameTouched(true) } : {})}
          />
          {key === "name" && nameTouched && !form.name?.trim() && (
            <div style={{ fontSize: typography.label, color: colors.danger, marginTop: spacing.xxxs }}>Name is required</div>
          )}
        </div>
      ))}
      <div style={{ marginBottom: spacing.md }}>
        <Label>Category</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {CATEGORIES.map(cat => {
            const on = form.category === cat;
            return (
              <Button key={cat} variant="pill" active={on} style={{ flex: 1 }} onClick={() => {
                if (cat === "Injectable") {
                  setForm(f => ({ ...f, category: cat, slots: ["injectable"], timePreference: f.timePreference || "Anytime" }));
                } else if (cat === "Topical") {
                  setForm(f => ({ ...f, category: cat, slots: ["topical"], timePreference: f.timePreference || "Anytime" }));
                } else {
                  setForm(f => ({ ...f, category: cat, slots: [], timePreference: "Anytime" }));
                }
              }}>
                {cat}
              </Button>
            );
          })}
        </div>
      </div>
      {(form.category === "Injectable" || form.category === "Topical") ? (
        <div style={{ marginBottom: spacing.md }}>
          <Label>When to take it</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            {["Morning", "Midday", "Evening", "Before Bed", "Anytime"].map(pref => {
              const on = form.timePreference === pref;
              return (
                <Button key={pref} variant="pill" active={on} onClick={() => setForm(f => ({ ...f, timePreference: pref }))}>
                  {pref}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: spacing.md }}>
          <Label>When to take it</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            {SLOTS.filter(s => s.id !== "injectable" && s.id !== "topical").map(slot => {
              const on = form.slots.includes(slot.id);
              return (
                <Button key={slot.id} variant="pill" active={on} onClick={() => toggleSlot(slot.id)}>
                  {slot.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginBottom: spacing.sm }}>
        <Label>Which days</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {DAYS.map((d, i) => (
            <Button key={i} variant="circle" active={form.days.includes(i)} onClick={() => toggleDay(i)}>{d[0]}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}
