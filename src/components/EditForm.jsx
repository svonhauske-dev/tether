import { useState } from 'react';
import { spacing, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import { SLOTS } from '../lib/notifications';
import { dateKey } from '../lib/time';
import Button from './Button';
import Input from './Input';
import Label from './Label';
import Badge from './Badge';
import HelperText from './HelperText';

const CATEGORIES = ["Oral", "Rx", "Injectable", "Topical"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TREATMENT_MODES = [
  { value: "indefinite", label: "Indefinite" },
  { value: "scheduled",  label: "Scheduled"  },
  { value: "cycled",     label: "Cycled"      },
];
const UNITS = ["days", "weeks", "months"];

export default function EditForm({ form, setForm, editingId }) {
  const { theme } = useTheme();
  const [nameTouched, setNameTouched] = useState(false);
  const [touched, setTouched] = useState({});

  const today = dateKey(new Date());
  const touch = (field) => setTouched(t => ({ ...t, [field]: true }));

  const toggleSlot = (sid) => setForm(f => ({ ...f, slots: f.slots.includes(sid) ? f.slots.filter(x => x !== sid) : [...f.slots, sid] }));
  const toggleDay  = (i)   => setForm(f => ({ ...f, days:  f.days.includes(i)   ? f.days.filter(x => x !== i)   : [...f.days, i]   }));

  const handleModeChange = (newMode) => {
    setTouched({});
    setForm(f => {
      const next = { ...f, treatment_mode: newMode };
      if (newMode === "indefinite") {
        next.starts_at = null; next.ends_at = null;
        next.cycle_on_value = null; next.cycle_on_unit = null;
        next.cycle_off_value = null; next.cycle_off_unit = null;
      } else {
        if (!next.starts_at) next.starts_at = today;
        if (newMode === "scheduled") {
          next.cycle_on_value = null; next.cycle_on_unit = null;
          next.cycle_off_value = null; next.cycle_off_unit = null;
        }
        if (newMode === "cycled") {
          next.ends_at = null;
          if (!next.cycle_on_unit)  next.cycle_on_unit  = "days";
          if (!next.cycle_off_unit) next.cycle_off_unit = "days";
        }
      }
      return next;
    });
  };

  const mode = form.treatment_mode || "indefinite";
  const dateOrderError = mode !== "indefinite" && form.starts_at && form.ends_at && form.ends_at <= form.starts_at;

  const errStyle = { fontSize: typography.label, color: theme.status.danger, marginTop: spacing.xxxs };

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
            <div style={errStyle}>Name is required</div>
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

      <div style={{ marginBottom: spacing.md }}>
        <Label>Which days</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {DAYS.map((d, i) => (
            <Button key={i} variant="circle" active={form.days.includes(i)} onClick={() => toggleDay(i)}>{d[0]}</Button>
          ))}
        </div>
      </div>

      {/* Treatment */}
      <div style={{ marginBottom: spacing.md }}>
        <Label>Treatment</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {TREATMENT_MODES.map(({ value, label }) => (
            <Button key={value} variant="pill" active={mode === value} style={{ flex: 1 }} onClick={() => handleModeChange(value)}>
              {label}
            </Button>
          ))}
        </div>

        {mode === "scheduled" && (
          <div style={{ marginTop: spacing.sm }}>
            <HelperText style={{ marginBottom: spacing.sm }}>Set a start and end date for this course.</HelperText>
            <div style={{ display: "flex", gap: spacing.xs }}>
              <div style={{ flex: 1 }}>
                <Label style={{ marginBottom: spacing.xxs }}>Starts</Label>
                <Input
                  type="date" style={{ minHeight: touch.min }}
                  value={form.starts_at || ""}
                  onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))}
                  onBlur={() => touch("starts_at")}
                />
                {touched.starts_at && !form.starts_at && <div style={errStyle}>Required</div>}
              </div>
              <div style={{ flex: 1 }}>
                <Label style={{ marginBottom: spacing.xxs }}>Ends</Label>
                <Input
                  type="date" style={{ minHeight: touch.min }}
                  value={form.ends_at || ""}
                  onChange={e => setForm(f => ({ ...f, ends_at: e.target.value || null }))}
                  onBlur={() => touch("ends_at")}
                />
                {touched.ends_at && !form.ends_at && <div style={errStyle}>Required</div>}
              </div>
            </div>
            {dateOrderError && <div style={{ ...errStyle, marginTop: spacing.xs }}>End date must be after start date</div>}
          </div>
        )}

        {mode === "cycled" && (
          <div style={{ marginTop: spacing.sm }}>
            <HelperText style={{ marginBottom: spacing.sm }}>Cycle this on and off. Leave 'Ends' blank for indefinite cycling.</HelperText>

            <div style={{ marginBottom: spacing.sm }}>
              <Label style={{ marginBottom: spacing.xxs }}>Starts</Label>
              <Input
                type="date" style={{ minHeight: touch.min }}
                value={form.starts_at || ""}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))}
                onBlur={() => touch("starts_at")}
              />
              {touched.starts_at && !form.starts_at && <div style={errStyle}>Required</div>}
            </div>

            <div style={{ marginBottom: spacing.sm }}>
              <Label style={{ marginBottom: spacing.xxs }}>On</Label>
              <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                <Input
                  variant="number"
                  value={form.cycle_on_value || ""}
                  placeholder="0"
                  min="1"
                  onChange={e => setForm(f => ({ ...f, cycle_on_value: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => touch("cycle_on_value")}
                />
                <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
                  {UNITS.map(u => (
                    <Button key={u} variant="pill" active={form.cycle_on_unit === u} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, cycle_on_unit: u }))}>
                      {u}
                    </Button>
                  ))}
                </div>
              </div>
              {touched.cycle_on_value && (!form.cycle_on_value || form.cycle_on_value <= 0) && <div style={errStyle}>Must be greater than 0</div>}
            </div>

            <div style={{ marginBottom: spacing.sm }}>
              <Label style={{ marginBottom: spacing.xxs }}>Off</Label>
              <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                <Input
                  variant="number"
                  value={form.cycle_off_value || ""}
                  placeholder="0"
                  min="1"
                  onChange={e => setForm(f => ({ ...f, cycle_off_value: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => touch("cycle_off_value")}
                />
                <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
                  {UNITS.map(u => (
                    <Button key={u} variant="pill" active={form.cycle_off_unit === u} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, cycle_off_unit: u }))}>
                      {u}
                    </Button>
                  ))}
                </div>
              </div>
              {touched.cycle_off_value && (!form.cycle_off_value || form.cycle_off_value <= 0) && <div style={errStyle}>Must be greater than 0</div>}
            </div>

            <div>
              <Label style={{ marginBottom: spacing.xxs }}>Ends (optional)</Label>
              <Input
                type="date" style={{ minHeight: touch.min }}
                value={form.ends_at || ""}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value || null }))}
              />
            </div>
            {dateOrderError && <div style={{ ...errStyle, marginTop: spacing.xs }}>End date must be after start date</div>}
          </div>
        )}
      </div>
    </div>
  );
}
