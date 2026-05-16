import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Plus, Pause, Play } from "lucide-react";
import { Pill, Syringe, Droplet } from "lucide-react";
import { spacing, typography, touch, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Badge from "./Badge";
import Label from "./Label";
import Button from "./Button";
import Modal from "./Modal";
import TabBar from "./TabBar";
import { isPausedSupp, isStoppedSupp } from "../lib/time";

function CategoryIcon({ category, color }) {
  if (category === "Rx")         return <Pill    size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Injectable") return <Syringe size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Topical")    return <Droplet size={14} color={color} style={{ flexShrink: 0 }} />;
  return null;
}

const CONFIRM_COPY = {
  pause:   { title: "Pause protocol?",   body: "All supplements will reset to template state. You can activate this protocol again anytime.", cta: "Pause" },
  archive: { title: "Archive protocol?", body: "All supplements will reset to template state. You can activate this protocol again anytime.", cta: "Archive" },
  delete:  { title: "Delete protocol?",  body: "This permanently deletes the protocol and all its supplements. This cannot be undone.", cta: "Delete" },
};

export default function ProtocolDetailScreen({
  isOpen, onBack, protocol, supplements,
  onUpdateProtocol, onPauseProtocol, onArchiveProtocol, onActivateProtocol, onDeleteProtocol,
  onAddSupp, onEditSupp, onTogglePauseSupp, onResumeSupp,
}) {
  const { theme } = useTheme();
  const [tab, setTab]                     = useState('active');
  const [editingName, setEditingName]     = useState(false);
  const [nameVal, setNameVal]             = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const nameInputRef = useRef(null);
  const scrollRef    = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setNameVal(protocol?.name || '');
      setEditingName(false);
      setConfirmAction(null);
      setTab('active');
      if (scrollRef.current) scrollRef.current.scrollTo(0, 0);
    }
  }, [isOpen, protocol?.id]);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const isActive   = protocol?.status === 'active';
  const isPaused   = protocol?.status === 'paused';
  const isArchived = protocol?.status === 'archived';

  const protocolSupps = (protocol && supplements)
    ? supplements.filter(s => s.protocol_id === protocol.id)
    : [];
  const activeSupps  = protocolSupps.filter(s => !isStoppedSupp(s)).sort((a, b) => {
    if (isPausedSupp(a) !== isPausedSupp(b)) return isPausedSupp(a) ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  const stoppedSupps = protocolSupps.filter(s => isStoppedSupp(s)).sort((a, b) => a.name.localeCompare(b.name));

  const saveName = async () => {
    if (!protocol) return;
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed === protocol.name) { setEditingName(false); setNameVal(protocol.name); return; }
    await onUpdateProtocol({ ...protocol, name: trimmed });
    setEditingName(false);
  };

  const handleConfirm = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'pause')   await onPauseProtocol(protocol);
    if (action === 'archive') await onArchiveProtocol(protocol);
    if (action === 'delete')  { await onDeleteProtocol(protocol); onBack(); }
  };

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-out',
        zIndex: 102,
        background: theme.surface.canvas,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: `${spacing.xs}px`, marginLeft: -spacing.xs,
            color: theme.text.primary, display: 'flex', alignItems: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft size={24} />
        </button>

        {editingName ? (
          <form
            onSubmit={e => { e.preventDefault(); saveName(); }}
            style={{ flex: 1, margin: `0 ${spacing.sm}px` }}
          >
            <input
              ref={nameInputRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveName}
              style={{
                width: '100%', background: 'none', border: 'none',
                borderBottom: `1px solid ${theme.accent.default}`,
                fontSize: typography.body, fontWeight: typography.semibold,
                color: theme.text.primary, padding: '2px 0', outline: 'none',
                textAlign: 'center', fontFamily: 'inherit',
              }}
            />
          </form>
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameVal(protocol?.name || ''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: typography.body, fontWeight: typography.semibold,
              color: theme.text.primary, flex: 1, textAlign: 'center',
              padding: `${spacing.xs}px ${spacing.sm}px`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {protocol?.name || ''}
          </button>
        )}

        {isActive ? (
          <button
            onClick={onAddSupp}
            aria-label="Add supplement"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: `${spacing.xs}px`, marginRight: -spacing.xs,
              color: theme.accent.default, display: 'flex', alignItems: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Plus size={22} />
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      {protocol && (
        <div style={{
          maxWidth: layout.maxContentWidth, margin: '0 auto',
          padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
        }}>

          {/* Protocol lifecycle actions — top, side by side */}
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.lg }}>
            {isActive && (
              <>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setConfirmAction('pause')}>Pause</Button>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setConfirmAction('archive')}>Archive</Button>
              </>
            )}
            {isPaused && (
              <>
                <Button variant="primary"   style={{ flex: 1 }} onClick={() => onActivateProtocol(protocol)}>Activate</Button>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setConfirmAction('archive')}>Archive</Button>
              </>
            )}
            {isArchived && (
              <>
                <Button variant="primary"      style={{ flex: 1 }} onClick={() => onActivateProtocol(protocol)}>Activate</Button>
                <Button variant="destructive"  style={{ flex: 1 }} onClick={() => setConfirmAction('delete')}>Delete</Button>
              </>
            )}
          </div>

          {/* Tab bar */}
          <TabBar
            tabs={[{ value: 'active', label: 'Active' }, { value: 'stopped', label: 'Stopped' }]}
            active={tab}
            onChange={setTab}
            style={{ marginBottom: spacing.lg }}
          />

          {/* ── Active tab ── */}
          {tab === 'active' && (
            activeSupps.length === 0 ? (
              <div style={{ fontSize: typography.body, color: theme.text.secondary, paddingBottom: spacing.xl }}>
                {isActive ? 'No supplements yet. Tap + to add one.' : 'No supplements.'}
              </div>
            ) : (
              <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, marginBottom: spacing.xl }}>
                {activeSupps.map((supp, i) => {
                  const isLast = i === activeSupps.length - 1;
                  return (
                    <div
                      key={supp.id}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: `${spacing.sm}px 0`,
                        borderBottom: isLast ? 'none' : `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                        minHeight: touch.min,
                        opacity: isPausedSupp(supp) ? 0.5 : 1,
                      }}
                    >
                      <div
                        onClick={() => onEditSupp(supp)}
                        style={{
                          flex: 1, cursor: 'pointer', userSelect: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          paddingRight: spacing.sm, display: 'flex', alignItems: 'center',
                          gap: '6px', minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium }}>
                          {supp.name}
                        </span>
                        <CategoryIcon category={supp.category} color={theme.text.secondary} />
                        {isPausedSupp(supp) && <Badge variant="neutral">Paused</Badge>}
                      </div>
                      {isActive && (
                        <Button
                          variant="icon"
                          aria-label={isPausedSupp(supp) ? `Resume ${supp.name}` : `Pause ${supp.name}`}
                          onClick={() => onTogglePauseSupp(supp)}
                          style={{ border: 'none' }}
                        >
                          {isPausedSupp(supp)
                            ? <Play  size={18} color={theme.text.secondary} />
                            : <Pause size={18} color={theme.text.secondary} />
                          }
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Stopped tab ── */}
          {tab === 'stopped' && (
            stoppedSupps.length === 0 ? (
              <div style={{ fontSize: typography.body, color: theme.text.secondary, paddingBottom: spacing.xl }}>
                No stopped supplements.
              </div>
            ) : (
              <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, marginBottom: spacing.xl }}>
                {stoppedSupps.map((supp, i) => {
                  const isLast = i === stoppedSupps.length - 1;
                  return (
                    <div
                      key={supp.id}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: `${spacing.sm}px 0`,
                        borderBottom: isLast ? 'none' : `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                        minHeight: touch.min,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: typography.body, color: theme.text.secondary, fontWeight: typography.medium, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {supp.name}
                          <CategoryIcon category={supp.category} color={theme.text.secondary} />
                        </div>
                        {supp.dose && <div style={{ fontSize: typography.caption, color: theme.text.faint }}>{supp.dose}</div>}
                      </div>
                      <Button variant="secondary" size="compact" onClick={() => onResumeSupp(supp)}>
                        Resume
                      </Button>
                    </div>
                  );
                })}
              </div>
            )
          )}

        </div>
      )}

      {/* Confirmation modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction ? CONFIRM_COPY[confirmAction].title : ''}
        footer={
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <Button variant="tertiary" fullWidth onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === 'delete' ? 'destructive' : 'primary'}
              fullWidth
              onClick={handleConfirm}
            >
              {confirmAction ? CONFIRM_COPY[confirmAction].cta : ''}
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: typography.body, color: theme.text.secondary, lineHeight: 1.6, margin: 0 }}>
          {confirmAction ? CONFIRM_COPY[confirmAction].body : ''}
        </p>
      </Modal>
    </div>
  );
}
