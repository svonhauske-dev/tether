import { useState, useEffect } from "react";
import { dbGetReceivedProtocols } from "../lib/api";
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

function ProtocolRow({ protocol, count, onTap, adherence }) {
  const { theme } = useTheme();
  const isArchived = protocol.status !== 'active';
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      style={{
        display: "flex", alignItems: "center", width: "100%",
        background: "none", border: "none",
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        padding: `${spacing.sm}px 0`, cursor: onTap ? "pointer" : "default",
        minHeight: touch.min, textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        opacity: isArchived ? 0.55 : 1,
        gap: spacing.sm,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: "2px" }}>
          {protocol.name}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>
          {count} {count === 1 ? "supplement" : "supplements"}
          {protocol.source === 'clinician' && " · From clinician"}
          {protocol.status === 'archived' && " · Archived"}
          {protocol.ends_at && protocol.status === 'active' && ` · Ends ${formatDate(protocol.ends_at)}`}
        </div>
      </div>
      {adherence && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: typography.title,
            fontWeight: typography.bold,
            fontFamily: typography.fontData,
            color: theme.text.primary,
            lineHeight: 1,
          }}>
            {adherence.pct}%
          </div>
          <div style={{
            fontSize: typography.caption,
            color: theme.text.secondary,
            marginTop: spacing.xxxs,
          }}>
            {adherence.days} {adherence.days === 1 ? 'day' : 'days'}
          </div>
        </div>
      )}
      {onTap && <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />}
    </button>
  );
}

function IntentOption({ label, description, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        padding: `${spacing.sm}px 0`,
        minHeight: touch.min, cursor: "pointer", userSelect: "none",
        textAlign: "left",
        fontFamily: "inherit",
        color: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ flex: 1, paddingRight: spacing.sm }}>
        <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: spacing.xxxs }}>
          {label}
        </div>
        <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      <ChevronRight size={18} color={theme.text.secondary} style={{ flexShrink: 0 }} />
    </button>
  );
}

const DURATION_UNITS = ["days", "weeks", "months"];

// Optional controlled-create-modal pattern:
//   - `controlledShowNew` (boolean, optional): if defined, replaces the
//     internal showNew state — parent owns whether the create modal is open.
//   - `onShowNewChange(value)`: called whenever the library wants to flip
//     it (user closes via X or after a successful create).
// Used in the patient-view "Create new and send" flow where App.jsx
// triggers create externally and reacts to the completion.
export default function ProtocolLibrary({ isOpen, onBack, protocols, supplements, onAddProtocol, onOpenDetail, onProtocolCreated, userId, token, onActivateReceived, onDeclineReceived, deepLinkSendId = null, onDeepLinkConsumed = null, desktop = false, embedded = false, readOnly = false, adherenceMap = null, onPlusClick = null, controlledShowNew, onShowNewChange }) {
  const { theme } = useTheme();
  const today = new Date().toISOString().split('T')[0];

  const [tab, setTab]                       = useState('active');
  const [internalShowNew, setInternalShowNew] = useState(false);
  // Controlled if controlledShowNew prop is provided, otherwise internal state.
  const showNew    = controlledShowNew !== undefined ? controlledShowNew : internalShowNew;
  const setShowNew = (val) => {
    setInternalShowNew(val);
    if (onShowNewChange) onShowNewChange(val);
  };
  const [step, setStep]                     = useState('form');
  const [newName, setNewName]               = useState('');
  const [txMode, setTxMode]                 = useState('indefinite');
  const [schedSub, setSchedSub]             = useState('duration');
  const [startsAt, setStartsAt]             = useState('');
  const [endsAt, setEndsAt]                 = useState('');
  const [durValue, setDurValue]             = useState('');
  const [durUnit, setDurUnit]               = useState('weeks');
  const [creating, setCreating]             = useState(false);
  const [received, setReceived]             = useState([]);
  const [activateModalSend, setActivateModalSend] = useState(null);
  const [activating, setActivating]         = useState(false);

  // Refetch when Library opens, userId becomes available, or token rotates —
  // covers (1) fresh-mount race where userId may not be ready, (2) reopening
  // after new sends arrived in the background.
  useEffect(() => {
    if (!isOpen || !token || !userId) return;
    dbGetReceivedProtocols(userId, token).then(rows => setReceived(rows || [])).catch(() => {});
  }, [isOpen, userId, token]);

  // Notification deep link — when the user taps a "Sofia sent you a protocol"
  // push, App.jsx routes the send_id here. Match it against the loaded
  // received list and pop the review modal for that exact send. The match
  // may not exist yet on the first render (received fetch in flight), so the
  // effect re-runs when `received` populates. Consumes (clears upstream)
  // once matched so it can't re-trigger.
  useEffect(() => {
    if (!deepLinkSendId || !received.length) return;
    const match = received.find(s => s.id === deepLinkSendId);
    if (match) {
      setActivateModalSend(match);
      if (onDeepLinkConsumed) onDeepLinkConsumed();
    }
  }, [deepLinkSendId, received, onDeepLinkConsumed]);

  const activeProtocols   = protocols.filter(p => p.status === 'active');
  const archivedProtocols = protocols.filter(p => p.status !== 'active').sort((a, b) => a.name.localeCompare(b.name));
  const suppCount = (pid) => supplements.filter(s => s.protocol_id === pid).length;

  const dateError = txMode === 'scheduled' && schedSub === 'dates' && startsAt && endsAt && endsAt <= startsAt;
  const step1Valid = newName.trim() && (
    txMode === 'indefinite' ||
    (txMode === 'scheduled' && schedSub === 'dates'    && startsAt && endsAt && !dateError) ||
    (txMode === 'scheduled' && schedSub === 'duration' && Number(durValue) > 0)
  );

  const resetNew = () => {
    setShowNew(false);
    setStep('form');
    setNewName('');
    setTxMode('indefinite');
    setSchedSub('duration');
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
    const computedEndsAt = txMode === 'indefinite' ? null
      : (txMode === 'scheduled' && schedSub === 'duration') ? addDuration(today, Number(durValue), durUnit)
      : endsAt || null;
    const created = await onAddProtocol({
      name: newName.trim(),
      treatment_mode: txMode,
      starts_at: computedStartsAt,
      ends_at: computedEndsAt,
    }, intent);
    // Only reset/close the modal on success. On failure (toast already shown by
    // App.jsx's addProtocol catch block), keep the form populated so the user
    // can retry without retyping.
    if (created) {
      resetNew();
      onProtocolCreated?.(created);
    } else {
      setCreating(false);
    }
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

  // In patient (readOnly + embedded) mode the right column scrolls as a
  // whole so the analytics panel below can stack with the library. We drop
  // the inner overflow/height in that case.
  const flowLayout = desktop && embedded && readOnly;
  return (
    <div style={desktop ? (flowLayout ? {
      position: "relative",
      width: "100%",
      background: theme.surface.card,
      display: "flex",
      flexDirection: "column",
    } : {
      position: "relative",
      width: "100%",
      height: "100%",
      background: theme.surface.card,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
    }) : {
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
        padding: desktop
          ? `${spacing.md}px ${spacing.md}px ${spacing.sm}px`
          : `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: desktop ? theme.surface.card : theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: "sticky", top: 0, zIndex: 1,
      }}>
        {embedded ? (
          <span style={{ width: touch.min }} aria-hidden />
        ) : (
          <Button variant="icon" aria-label="Back" onClick={onBack}>
            <ChevronLeft size={18} />
          </Button>
        )}
        <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary }}>
          Protocols
        </span>
        {readOnly && !onPlusClick ? (
          <span style={{ width: touch.min }} aria-hidden />
        ) : (
          <Button
            variant="icon"
            aria-label={readOnly ? "Send or create protocol" : "New protocol"}
            onClick={onPlusClick ? onPlusClick : () => setShowNew(true)}
          >
            <Plus size={18} />
          </Button>
        )}
      </div>

      {/* Content */}
      <div style={{
        maxWidth: desktop ? "none" : layout.maxContentWidth,
        width: "100%",
        margin: "0 auto",
        padding: desktop
          ? `${spacing.lg}px ${spacing.md}px ${spacing.md}px`
          : `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>
        {/* Received protocols — hidden in readOnly (patient-context) view.
            Sent by another Origin user via peer-to-peer share. Each row is
            its own card so multiple received protocols read as distinct
            items, not a single bundled list. Tapping a card opens the
            review modal (stack / replace / save / decline). */}
        {!readOnly && received.length > 0 && (
          <div style={{ marginBottom: spacing.xl }}>
            <Label style={{ marginBottom: spacing.xs }}>Received</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {received.map((send) => (
                <button
                  key={send.id}
                  onClick={() => setActivateModalSend(send)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
                    width: '100%',
                    padding: `${spacing.md}px`,
                    background: theme.surface.card,
                    border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                    borderRadius: theme.radius.surface,
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 120ms ease, border-color 120ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.surface.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = theme.surface.card; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary }}>
                      {send.name}
                    </div>
                    <div style={{ fontSize: typography.caption, color: theme.text.secondary, marginTop: 2 }}>
                      {(send.supplements_snapshot || []).length} supplement{(send.supplements_snapshot || []).length !== 1 ? 's' : ''} · tap to review
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <TabBar
          tabs={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
          active={tab}
          onChange={setTab}
          style={{ marginBottom: spacing.lg }}
        />

        {tab === 'active' && (
          activeProtocols.length === 0 ? (
            <div style={{ fontSize: typography.body, color: theme.text.secondary }}>
              {readOnly ? 'No active protocols.' : 'No active protocols. Tap + to create one.'}
            </div>
          ) : (
            <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}` }}>
              {activeProtocols.map(p => (
                <ProtocolRow
                  key={p.id}
                  protocol={p}
                  count={suppCount(p.id)}
                  onTap={onOpenDetail ? () => onOpenDetail(p) : undefined}
                  adherence={adherenceMap?.[p.id]}
                />
              ))}
            </div>
          )
        )}

        {tab === 'archived' && (
          archivedProtocols.length === 0 ? (
            <div style={{ fontSize: typography.body, color: theme.text.secondary }}>
              Nothing archived yet.
            </div>
          ) : (
            <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}` }}>
              {archivedProtocols.map(p => (
                <ProtocolRow
                  key={p.id}
                  protocol={p}
                  count={suppCount(p.id)}
                  onTap={onOpenDetail ? () => onOpenDetail(p) : undefined}
                />
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
                {[['indefinite', 'Indefinite'], ['scheduled', 'Scheduled']].map(([val, label]) => (
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
                <div>
                  <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.sm }}>
                    {[['duration', 'For a duration'], ['dates', 'Specific dates']].map(([val, label]) => (
                      <Button
                        key={val}
                        variant="selector"
                        active={schedSub === val}
                        style={{ flex: 1 }}
                        onClick={() => setSchedSub(val)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  {schedSub === 'duration' && (
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

                  {schedSub === 'dates' && (
                    <div>
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
                      {dateError && (
                        <div style={{ fontSize: typography.label, color: theme.status.danger, marginTop: spacing.xxxs }}>
                          End date must be after start date
                        </div>
                      )}
                    </div>
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

      {/* Received-protocol review sheet. Three intents:
            stack    — keep current actives, add this one alongside
            replace  — archive current actives, activate this one
            save_later — stash as archived for later */}
      <Modal
        open={!!activateModalSend}
        onClose={() => { if (!activating) setActivateModalSend(null); }}
        title={activateModalSend?.name || ''}
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%' }}>
            <Button
              variant="primary"
              fullWidth
              disabled={activating}
              onClick={async () => {
                if (!activateModalSend) return;
                setActivating(true);
                const send = activateModalSend;
                await onActivateReceived(send, 'stack');
                setReceived(r => r.filter(s => s.id !== send.id));
                setActivateModalSend(null);
                setActivating(false);
              }}
            >
              {activating ? 'Saving…' : 'Stack on current'}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={activating}
              onClick={async () => {
                if (!activateModalSend) return;
                setActivating(true);
                const send = activateModalSend;
                await onActivateReceived(send, 'replace');
                setReceived(r => r.filter(s => s.id !== send.id));
                setActivateModalSend(null);
                setActivating(false);
              }}
            >
              Replace current
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={activating}
              onClick={async () => {
                if (!activateModalSend) return;
                setActivating(true);
                const send = activateModalSend;
                await onActivateReceived(send, 'save_later');
                setReceived(r => r.filter(s => s.id !== send.id));
                setActivateModalSend(null);
                setActivating(false);
              }}
            >
              Save for later
            </Button>
            {onDeclineReceived && (
              <Button
                variant="destructive"
                fullWidth
                disabled={activating}
                onClick={async () => {
                  if (!activateModalSend) return;
                  setActivating(true);
                  const send = activateModalSend;
                  await onDeclineReceived(send);
                  setReceived(r => r.filter(s => s.id !== send.id));
                  setActivateModalSend(null);
                  setActivating(false);
                }}
              >
                Decline
              </Button>
            )}
            <Button variant="tertiary" fullWidth onClick={() => setActivateModalSend(null)} disabled={activating}>
              Cancel
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <p style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.6, margin: 0 }}>
            {(activateModalSend?.supplements_snapshot || []).length} supplement{(activateModalSend?.supplements_snapshot || []).length !== 1 ? 's' : ''} included.
          </p>
          {(activateModalSend?.supplements_snapshot || []).length > 0 && (
            <div style={{
              border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
              borderRadius: theme.radius.surface,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              maxHeight: 200,
              overflowY: 'auto',
            }}>
              {(activateModalSend?.supplements_snapshot || []).map((s, i) => (
                <div key={i} style={{ padding: `${spacing.xxs}px 0`, fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontBody }}>
                  <span style={{ color: theme.text.primary }}>{s.name}</span>
                  {s.dose ? ` · ${s.dose}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
