import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { spacing, typography, touch, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";
import Label from "./Label";
import Input from "./Input";
import Modal from "./Modal";
import TabBar from "./TabBar";
import HelperText from "./HelperText";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDuration(startStr, value, unit) {
  const d = startStr ? new Date(startStr + 'T00:00:00') : new Date();
  if (unit === 'weeks')  d.setDate(d.getDate() + value * 7);
  if (unit === 'months') d.setMonth(d.getMonth() + value);
  return d.toISOString().split('T')[0];
}

function ProtocolRow({ protocol, count, onTap }) {
  const { theme } = useTheme();
  const isArchived = protocol.status !== 'active';
  return (
    <button
      onClick={onTap}
      style={{
        display: "flex", alignItems: "center", width: "100%",
        background: "none", border: "none",
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        padding: `${spacing.sm}px 0`, cursor: "pointer",
        minHeight: touch.min, textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        opacity: isArchived ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: "2px" }}>
          {protocol.name}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>
          {count} {count === 1 ? "supplement" : "supplements"}
          {protocol.status === 'paused'   && " · Paused"}
          {protocol.status === 'archived' && " · Archived"}
          {protocol.ends_at && protocol.status === 'active' && ` · Ends ${formatDate(protocol.ends_at)}`}
        </div>
      </div>
      <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
    </button>
  );
}

function IntentOption({ label, description, onClick, theme }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `${spacing.sm}px 0`,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        minHeight: touch.min, cursor: "pointer", userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ flex: 1, paddingRight: spacing.sm }}>
        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: "2px" }}>
          {label}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
    </div>
  );
}

const DURATION_UNITS = ["weeks", "months"];

export default function ProtocolLibrary({ isOpen, onBack, protocols, supplements, onAddProtocol, onOpenDetail }) {
  const { theme } = useTheme();
  const today = new Date().toISOString().split('T')[0];

  const [tab, setTab]           = useState('active');
  const [showNew, setShowNew]   = useState(false);
  const [step, setStep]         = useState('form');
  const [newName, setNewName]   = useState('');
  const [txMode, setTxMode]     = useState('indefinite');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt]     = useState('');
  const [durValue, setDurValue] = useState('');
  const [durUnit, setDurUnit]   = useState('weeks');
  const [creating, setCreating] = useState(false);

  const activeProtocols   = protocols.filter(p => p.status === 'active');
  const archivedProtocols = protocols.filter(p => p.status !== 'active').sort((a, b) => a.name.localeCompare(b.name));
  const suppCount = (pid) => supplements.filter(s => s.protocol_id === pid).length;

  const dateError = txMode === 'scheduled' && startsAt && endsAt && endsAt <= startsAt;
  const step1Valid = newName.trim() && (
    txMode === 'indefinite' ||
    (txMode === 'scheduled' && startsAt && endsAt && !dateError) ||
    (txMode === 'duration'  && Number(durValue) > 0)
  );

  const resetNew = () => {
    setShowNew(false);
    setStep('form');
    setNewName('');
    setTxMode('indefinite');
    setStartsAt('');
    setEndsAt('');
    setDurValue('');
    setDurUnit('weeks');
    setCreating(false);
  };

  const handleCreate = async (intent) => {
    if (creating) return;
    setCreating(true);
    const computedStartsAt = txMode === 'indefinite' ? null : (startsAt || today);
    const computedEndsAt = txMode === 'indefinite'  ? null
      : txMode === 'duration'   ? addDuration(today, Number(durValue), durUnit)
      : endsAt || null;
    await onAddProtocol({
      name: newName.trim(),
      treatment_mode: txMode === 'duration' ? 'scheduled' : txMode,
      starts_at: computedStartsAt,
      ends_at: computedEndsAt,
    }, intent);
    resetNew();
  };

  const handleStep1Continue = () => {
    if (!step1Valid || creating) return;
    if (activeProtocols.length === 0) {
      handleCreate('stack');
    } else {
      setStep('intent');
    }
  };

  const replacedNames = activeProtocols.map(p => p.name).join(', ');

  const modalTitle = step === 'form' ? 'New protocol' : `Adding "${newName.trim()}"`;
  const modalFooter = step === 'form' ? (
    <Button
      variant="primary"
      fullWidth
      onClick={handleStep1Continue}
      disabled={!step1Valid || creating}
    >
      {creating ? "Creating…" : activeProtocols.length === 0 ? "Create protocol" : "Continue"}
    </Button>
  ) : (
    <Button variant="tertiary" fullWidth onClick={() => setStep('form')}>
      Back
    </Button>
  );

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      transform: isOpen ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s ease-out",
      zIndex: 101,
      background: theme.surface.canvas,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: "sticky", top: 0, zIndex: 1,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          background: "none", border: "none", cursor: "pointer",
          padding: `${spacing.xs}px`, marginLeft: -spacing.xs,
          color: theme.text.primary, display: "flex", alignItems: "center",
          WebkitTapHighlightColor: "transparent",
        }}>
          <ChevronLeft size={24} />
        </button>
        <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary }}>
          Protocols
        </span>
        <button onClick={() => setShowNew(true)} aria-label="New protocol" style={{
          background: "none", border: "none", cursor: "pointer",
          padding: `${spacing.xs}px`, marginRight: -spacing.xs,
          color: theme.accent.default, display: "flex", alignItems: "center",
          WebkitTapHighlightColor: "transparent",
        }}>
          <Plus size={22} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: layout.maxContentWidth, margin: "0 auto",
        padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>
        <TabBar
          tabs={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
          active={tab}
          onChange={setTab}
          style={{ marginBottom: spacing.lg }}
        />

        {tab === 'active' && (
          activeProtocols.length === 0 ? (
            <div style={{ fontSize: typography.body, color: theme.text.secondary }}>
              No active protocols. Tap + to create one.
            </div>
          ) : (
            <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}` }}>
              {activeProtocols.map(p => (
                <ProtocolRow key={p.id} protocol={p} count={suppCount(p.id)} onTap={() => onOpenDetail(p)} />
              ))}
            </div>
          )
        )}

        {tab === 'archived' && (
          archivedProtocols.length === 0 ? (
            <div style={{ fontSize: typography.body, color: theme.text.secondary }}>
              No archived protocols.
            </div>
          ) : (
            <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}` }}>
              {archivedProtocols.map(p => (
                <ProtocolRow key={p.id} protocol={p} count={suppCount(p.id)} onTap={() => onOpenDetail(p)} />
              ))}
            </div>
          )
        )}
      </div>

      {/* New Protocol modal — two-step */}
      <Modal
        open={showNew}
        onClose={resetNew}
        title={modalTitle}
        footer={modalFooter}
      >
        {/* ── Step 1: form ── */}
        {step === 'form' && (
          <form onSubmit={e => { e.preventDefault(); handleStep1Continue(); }}>
            <div style={{ marginBottom: spacing.md }}>
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Immunity Protocol"
                autoComplete="off"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <Label>Duration</Label>
              <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.sm }}>
                {[['indefinite', 'Indefinite'], ['scheduled', 'Scheduled'], ['duration', 'For a set time']].map(([val, label]) => (
                  <Button
                    key={val}
                    variant="selector"
                    active={txMode === val}
                    style={{ flex: 1 }}
                    onClick={() => setTxMode(val)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {txMode === 'scheduled' && (
                <div style={{ display: "flex", gap: spacing.xs }}>
                  <div style={{ flex: 1 }}>
                    <Label style={{ marginBottom: spacing.xxs }}>Starts</Label>
                    <Input
                      type="date"
                      value={startsAt}
                      onChange={e => setStartsAt(e.target.value)}
                      style={{ height: touch.min, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label style={{ marginBottom: spacing.xxs }}>Ends</Label>
                    <Input
                      type="date"
                      value={endsAt}
                      onChange={e => setEndsAt(e.target.value)}
                      style={{ height: touch.min, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}
              {dateError && (
                <div style={{ fontSize: typography.label, color: theme.status.danger, marginTop: spacing.xxxs }}>
                  End date must be after start date
                </div>
              )}

              {txMode === 'duration' && (
                <div>
                  <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                    <Input
                      variant="number"
                      value={durValue}
                      placeholder="0"
                      min="1"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onChange={e => setDurValue(e.target.value)}
                      style={{ width: 72 }}
                    />
                    <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
                      {DURATION_UNITS.map(u => (
                        <Button key={u} variant="selector" active={durUnit === u} style={{ flex: 1 }} onClick={() => setDurUnit(u)}>
                          {u}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {durValue > 0 && (
                    <HelperText style={{ marginTop: spacing.xxs }}>
                      Ends {formatDate(addDuration(today, Number(durValue), durUnit))}
                    </HelperText>
                  )}
                </div>
              )}
            </div>
          </form>
        )}

        {/* ── Step 2: intent ── */}
        {step === 'intent' && (
          <div>
            <IntentOption
              theme={theme}
              label="Replace current"
              description={`${replacedNames} will be archived. ${newName.trim()} becomes your active protocol.`}
              onClick={() => handleCreate('replace')}
            />
            <IntentOption
              theme={theme}
              label="Stack on top"
              description={`Supplements from all active protocols appear on your home screen simultaneously.`}
              onClick={() => handleCreate('stack')}
            />
            <IntentOption
              theme={theme}
              label="Save for later"
              description="Added to your library without activating. Enable it whenever you're ready."
              onClick={() => handleCreate('save_later')}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
