import { useState } from 'react';
import { spacing, typography, touch } from '../design-system';
import { useTheme } from '../lib/theme';
import { SLOTS } from '../lib/notifications';
import { dateKey, isPausedSupp } from '../lib/time';
import Button from './Button';
import Input from './Input';
import SupplementNameAutocomplete from './SupplementNameAutocomplete';
import Label from './Label';
import Badge from './Badge';
import HelperText from './HelperText';
import Modal from './Modal';

const CATEGORIES = ["Oral", "Rx", "Injectable", "Topical"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TREATMENT_MODES = [
  { value: "indefinite", label: "Indefinite" },
  { value: "scheduled",  label: "Scheduled"  },
  { value: "cycled",     label: "Cycled"      },
];
const UNITS = ["days", "weeks", "months"];

export default function EditForm({ form, setForm, editingId, onStop, onResume, onDelete, scheduleMode, supplementHistory = [], activeProtocols = [] }) {
  const { theme } = useTheme();
  const [nameTouched, setNameTouched] = useState(false);
  const [touched, setTouched] = useState({});
  const [showStopConfirm, setShowStopConfirm] = useState(false);

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

  // Archive view — supplement has been stopped
  if (form.status === 'stopped') {
    return (
      <div>
        <div style={{
          background: theme.surface.cardSubtle,
          border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          borderRadius: theme.radius.input,
          padding: `${spacing.sm}px ${spacing.md}px`,
          marginBottom: spacing.md,
          fontSize: typography.body,
          color: theme.text.secondary,
          lineHeight: 1.5,
        }}>
          This supplement is in your archive. Restart it to make changes.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginTop: spacing.sm }}>
          {onResume && <Button variant="primary" fullWidth onClick={onResume}>Resume</Button>}
          {onDelete && <Button variant="destructive" fullWidth onClick={onDelete}>Delete</Button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {editingId && isPausedSupp(form) && (
        <div style={{ marginBottom: spacing.md }}>
          <Badge variant="neutral">Currently paused</Badge>
        </div>
      )}

      {activeProtocols.length > 1 && (
        <div style={{ marginBottom: spacing.md }}>
          <Label>Protocol</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {activeProtocols.map(p => (
              <Button
                key={p.id}
                variant="selector"
                active={form.protocol_id === p.id}
                fullWidth
                onClick={() => setForm(f => ({ ...f, protocol_id: p.id }))}
              >
                {p.name}
              </Button>
            ))}
            <Button
              variant="selector"
              active={!form.protocol_id}
              fullWidth
              onClick={() => setForm(f => ({ ...f, protocol_id: null }))}
            >
              None
            </Button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: spacing.md }}>
        <Label>Name</Label>
        <SupplementNameAutocomplete
          value={form.name}
          placeholder="e.g. Magnesium Glycinate"
          history={supplementHistory}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onBlur={() => setNameTouched(true)}
        />
        {nameTouched && !form.name?.trim() && (
          <div style={errStyle}>Name is required</div>
        )}
      </div>

      {[["Dose", "dose", "e.g. 2 caps (300 mg)"], ["Notes", "notes", "e.g. Thorne · with food"]].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: spacing.md }}>
          <Label>{lbl}</Label>
          <Input
            value={form[key]}
            placeholder={ph}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            autoComplete="off"
          />
        </div>
      ))}

      <div style={{ marginBottom: spacing.md }}>
        <Label>Category</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {CATEGORIES.map(cat => {
            const on = form.category === cat;
            return (
              <Button key={cat} variant="selector" active={on} style={{ flex: 1 }} onClick={() => {
                setForm(f => ({ ...f, category: cat, slots: [] }));
              }}>
                {cat}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Treatment */}
      <div style={{ marginBottom: spacing.md }}>
        <Label>Treatment</Label>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {TREATMENT_MODES.map(({ value, label }) => (
            <Button key={value} variant="selector" active={mode === value} style={{ flex: 1 }} onClick={() => handleModeChange(value)}>
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
                  type="date" style={{ height: touch.min, boxSizing: "border-box" }}
                  value={form.starts_at || ""}
                  onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))}
                  onBlur={() => touch("starts_at")}
                />
                {touched.starts_at && !form.starts_at && <div style={errStyle}>Required</div>}
              </div>
              <div style={{ flex: 1 }}>
                <Label style={{ marginBottom: spacing.xxs }}>Ends</Label>
                <Input
                  type="date" style={{ height: touch.min, boxSizing: "border-box" }}
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
                type="date" style={{ height: touch.min, boxSizing: "border-box" }}
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={e => setForm(f => ({ ...f, cycle_on_value: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => touch("cycle_on_value")}
                />
                <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
                  {UNITS.map(u => (
                    <Button key={u} variant="selector" active={form.cycle_on_unit === u} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, cycle_on_unit: u }))}>
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={e => setForm(f => ({ ...f, cycle_off_value: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => touch("cycle_off_value")}
                />
                <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
                  {UNITS.map(u => (
                    <Button key={u} variant="selector" active={form.cycle_off_unit === u} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, cycle_off_unit: u }))}>
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
                type="date" style={{ height: touch.min, boxSizing: "border-box" }}
                value={form.ends_at || ""}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value || null }))}
              />
            </div>
            {dateOrderError && <div style={{ ...errStyle, marginTop: spacing.xs }}>End date must be after start date</div>}
          </div>
        )}
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <Label>When to take it</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
          {SLOTS.filter(s => {
            if (s.id === "rx") return scheduleMode === "medication" || form.slots.includes("rx");
            return true;
          }).map(slot => {
            if (slot.id === "rx" && scheduleMode !== "medication" && form.slots.includes("rx")) {
              return (
                <div key="rx" style={{ width: "100%" }}>
                  <Button variant="selector" active style={{ opacity: 0.45, pointerEvents: "none" }}>
                    {slot.label}
                  </Button>
                  <HelperText style={{ marginTop: spacing.xxxs }}>
                    Not available in your current schedule mode
                  </HelperText>
                </div>
              );
            }
            const on = form.slots.includes(slot.id);
            return (
              <Button key={slot.id} variant="selector" active={on} onClick={() => toggleSlot(slot.id)}>
                {slot.label}
              </Button>
            );
          })}
        </div>
        <div style={{ marginTop: spacing.sm }}>
          <Button variant="selector" active={form.slots.length === 0} onClick={() => setForm(f => ({ ...f, slots: [] }))}>
            Anytime
          </Button>
        </div>
      </div>

      {mode !== "cycled" && (
        <div style={{ marginBottom: spacing.md }}>
          <Label>Which days</Label>
          <div style={{ display: "flex", gap: spacing.xs }}>
            {DAYS.map((d, i) => (
              <Button key={i} variant="circle" active={form.days.includes(i)} onClick={() => toggleDay(i)}>{d[0]}</Button>
            ))}
          </div>
        </div>
      )}

      {editingId && onStop && (
        <div style={{ marginTop: spacing.lg }}>
          <Button variant="secondary" fullWidth onClick={() => setShowStopConfirm(true)}>
            Stop
          </Button>
        </div>
      )}

      <Modal
        open={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        title={`Stop ${form.name || "this supplement"}?`}
        footer={
          <div style={{ display: "flex", gap: spacing.xs }}>
            <Button variant="secondary" fullWidth onClick={() => setShowStopConfirm(false)}>Cancel</Button>
            <Button variant="primary" fullWidth onClick={() => { setShowStopConfirm(false); onStop?.(); }}>Stop</Button>
          </div>
        }
      >
        <div style={{ fontSize: typography.body, color: theme.text.secondary, lineHeight: 1.5 }}>
          This moves it to your archive. You can restart anytime.
        </div>
      </Modal>
    </div>
  );
}
