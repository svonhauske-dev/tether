import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Plus, Pause, Play, Trash2, MoreHorizontal } from "lucide-react";
import { Pill, Syringe, Droplet } from "lucide-react";
import { spacing, typography, touch, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Badge from "./Badge";
import Button from "./Button";
import Modal from "./Modal";
import Popover, { PopoverItem } from "./Popover";
import TabBar from "./TabBar";
import { isActiveSupp, isPausedSupp } from "../lib/time";

function CategoryIcon({ category, color }) {
  if (category === "Rx")         return <Pill    size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Injectable") return <Syringe size={14} color={color} style={{ flexShrink: 0 }} />;
  if (category === "Topical")    return <Droplet size={14} color={color} style={{ flexShrink: 0 }} />;
  return null;
}

// Confirm copy templates. `body` is a function so we can inject the protocol name.
const CONFIRM_COPY = {
  archive: {
    title: (name) => `Archive ${name}?`,
    body:  () => "You can restore it from Archived anytime.",
    cta:   "Archive",
    variant: "destructive",
  },
  delete: {
    title: () => "Delete protocol?",
    body:  () => "This permanently deletes the protocol and all its supplements. This cannot be undone.",
    cta:   "Delete",
    variant: "destructive",
  },
};

export default function ProtocolDetailScreen({
  isOpen, onBack, protocol, supplements,
  onUpdateProtocol, onArchiveProtocol, onActivateProtocol, onDeleteProtocol,
  onAddSupp, onEditSupp, onTogglePauseSupp, onResumeSupp, onDeleteSupp,
  isClinician, patients = [], onSendToPatient,
  onSendToUser,
  desktop = false,
  readOnly = false,
}) {
  const { theme } = useTheme();
  const [tab, setTab]                       = useState('active');
  const [editingName, setEditingName]       = useState(false);
  const [nameVal, setNameVal]               = useState('');
  const [confirmAction, setConfirmAction]   = useState(null);
  const [sendModalOpen, setSendModalOpen]   = useState(false);
  const [sending, setSending]               = useState(false);
  const [deletingSupp, setDeletingSupp]     = useState(null); // supp pending delete confirm
  const [menuOpen, setMenuOpen]             = useState(false); // overflow menu
  // Peer-to-peer "Send to someone" — email-based send to any Origin user.
  // Distinct from the clinician's roster-based send-to-patient flow above.
  const [sendUserOpen, setSendUserOpen]     = useState(false);
  const [sendUserEmail, setSendUserEmail]   = useState('');
  const [sendUserError, setSendUserError]   = useState(null);
  const [sendingUser, setSendingUser]       = useState(false);
  // Activate-from-archive intent picker. Matches the receive flow's UX:
  // when activating an archived protocol, ask whether to stack on existing
  // actives or replace them.
  const [activateIntentOpen, setActivateIntentOpen] = useState(false);
  // Anchor element for the overflow + send-to-patient popovers. Both anchor
  // to the same ⋯ trigger so the picker visually replaces the menu in place.
  const [menuAnchor, setMenuAnchor]         = useState(null);
  const nameInputRef = useRef(null);
  const scrollRef    = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setNameVal(protocol?.name || '');
      setEditingName(false);
      setConfirmAction(null);
      setDeletingSupp(null);
      setMenuOpen(false);
      setTab('active');
      if (scrollRef.current) scrollRef.current.scrollTo(0, 0);
    }
  }, [isOpen, protocol?.id]);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const isActive   = protocol?.status === 'active';
  // Protocols are Active or Archived only — the legacy 'paused' state was
  // collapsed into 'archived' when lifecycle was consolidated. Anything not
  // active is treated as archived.
  const isArchived = !isActive;

  const protocolSupps = (protocol && supplements)
    ? supplements.filter(s => s.protocol_id === protocol.id)
    : [];
  // Active = strictly status='active'. Paused supps now live in their own tab
  // (the old "Stopped" tab was renamed to "Paused" when the lifecycle states
  // were consolidated — `stopped` no longer exists as a distinct state).
  const activeSupps = protocolSupps.filter(s => isActiveSupp(s)).sort((a, b) => a.name.localeCompare(b.name));
  const pausedSupps = protocolSupps.filter(s => isPausedSupp(s)).sort((a, b) => a.name.localeCompare(b.name));

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
    if (action === 'archive') await onArchiveProtocol(protocol);
    if (action === 'delete')  { await onDeleteProtocol(protocol); onBack(); }
  };

  // Overflow menu items — order: lifecycle change → share → destructive
  // (matches iOS action-sheet convention). Destructive last so it's never
  // adjacent to a benign tap target.
  // In readOnly mode (clinician viewing a patient's protocol), the menu is
  // empty since the clinician can't modify patient-owned data.
  const menuItems = (() => {
    if (!protocol || readOnly) return [];
    const items = [];
    // 1. Lifecycle change (always first)
    if (isActive) {
      items.push({ key: 'archive',  label: 'Archive protocol',  onSelect: () => { setMenuOpen(false); setConfirmAction('archive'); } });
    } else if (isArchived) {
      items.push({ key: 'activate', label: 'Activate protocol', onSelect: () => { setMenuOpen(false); setActivateIntentOpen(true); } });
    }
    // 2. Share — clinician roster-send (dead path) or peer-to-peer send.
    //    Peer-to-peer is available regardless of active/archived: you might
    //    want to share something you ran last year that's now archived.
    if (isClinician && isActive) {
      items.push({ key: 'send', label: 'Send to patient', onSelect: () => { setMenuOpen(false); setSendModalOpen(true); } });
    }
    if (!isClinician && onSendToUser) {
      items.push({ key: 'send-user', label: 'Send to someone', onSelect: () => { setMenuOpen(false); setSendUserOpen(true); setSendUserEmail(''); setSendUserError(null); } });
    }
    // 3. Destructive (always last)
    if (isArchived) {
      items.push({ key: 'delete',   label: 'Delete protocol',   onSelect: () => { setMenuOpen(false); setConfirmAction('delete'); }, destructive: true });
    }
    return items;
  })();

  const submitSendToUser = async () => {
    const email = sendUserEmail.trim();
    if (!email || !email.includes('@')) {
      setSendUserError('Enter a valid email');
      return;
    }
    setSendingUser(true);
    setSendUserError(null);
    try {
      const result = await onSendToUser(protocol, email);
      if (result?.ok) {
        setSendUserOpen(false);
        setSendUserEmail('');
      } else {
        setSendUserError(result?.error || "Couldn't send. Try again.");
      }
    } catch (err) {
      console.error(err);
      setSendUserError("Couldn't send. Try again.");
    } finally {
      setSendingUser(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      style={desktop ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        background: theme.surface.card,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      } : {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-out',
        zIndex: 102,
        background: theme.surface.canvas,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Header — grid keeps the title centered to the screen even when the
          right side has more icons than the left. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(60px, 1fr) minmax(0, auto) minmax(60px, 1fr)',
        alignItems: 'center',
        padding: desktop
          ? `${spacing.md}px ${spacing.md}px ${spacing.sm}px`
          : `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: desktop ? theme.surface.card : theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <div style={{ justifySelf: 'start' }}>
          <Button variant="icon" aria-label="Back" onClick={onBack}>
            <ChevronLeft size={18} />
          </Button>
        </div>

        {editingName && !readOnly ? (
          <form
            onSubmit={e => { e.preventDefault(); saveName(); }}
            style={{ minWidth: 0, padding: `0 ${spacing.sm}px` }}
          >
            <input
              ref={nameInputRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveName}
              style={{
                width: '100%', background: 'none', border: 'none',
                borderBottom: `${theme.borderWidth.default}px solid ${theme.accent.default}`,
                fontSize: typography.body, fontWeight: typography.semibold,
                color: theme.text.primary, padding: `${spacing.xxs}px 0`, outline: 'none',
                textAlign: 'center', fontFamily: 'inherit',
              }}
            />
          </form>
        ) : readOnly ? (
          <span style={{
            flex: 1, textAlign: 'center',
            fontSize: typography.body, fontWeight: typography.semibold,
            color: theme.text.primary,
            padding: `${spacing.xs}px ${spacing.sm}px`,
          }}>
            {protocol?.name || ''}
          </span>
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameVal(protocol?.name || ''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: typography.body, fontWeight: typography.semibold,
              color: theme.text.primary, textAlign: 'center',
              padding: `${spacing.xs}px ${spacing.sm}px`,
              minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {protocol?.name || ''}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, justifySelf: 'end' }}>
          {menuItems.length > 0 && (
            <Button
              variant="icon"
              aria-label="Protocol actions"
              onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuOpen(true); }}
            >
              <MoreHorizontal size={18} />
            </Button>
          )}
          {!readOnly && (isActive || isArchived) && (
            <Button variant="icon" aria-label="Add supplement" onClick={onAddSupp}>
              <Plus size={18} />
            </Button>
          )}
        </div>
      </div>

      {protocol && (
        <div style={{
          maxWidth: desktop ? 'none' : layout.maxContentWidth,
          width: '100%',
          margin: '0 auto',
          padding: desktop
            ? `${spacing.md}px ${spacing.md}px ${spacing.md}px`
            : `${spacing.md}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
        }}>

          {/* Body CTAs (Send to patient + Pause/Archive/Activate/Delete row) moved
              to the overflow ⋯ menu in the header (May 17). Body now starts with
              the tab strip / list, flush under the sticky header. */}

          {/* Archived: flat list (no pause/resume, since archive resets all supps to active state).
              Active / Paused: Active / Paused tabs. */}
          {isArchived ? (
            protocolSupps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: `${spacing.xl}px ${spacing.md}px ${spacing.xxl}px` }}>
                <div style={{ fontSize: typography.display, color: theme.text.secondary, marginBottom: spacing.md, fontFamily: typography.fontHeading, lineHeight: 1 }}>◯</div>
                <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>
                  No supplements in this protocol
                </div>
                <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.5 }}>
                  Archived protocols can stay empty — they're a record of what you ran.
                </div>
              </div>
            ) : (
              <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, marginBottom: spacing.xl }}>
                {protocolSupps.map((supp, i) => {
                  const isLast = i === protocolSupps.length - 1;
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
                      <div
                        onClick={readOnly ? undefined : () => onEditSupp(supp)}
                        style={{
                          flex: 1, cursor: readOnly ? 'default' : 'pointer', userSelect: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          paddingRight: spacing.sm, display: 'flex', alignItems: 'center',
                          gap: spacing.xs2, minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium }}>
                          {supp.name}
                        </span>
                        <CategoryIcon category={supp.category} color={theme.text.secondary} />
                      </div>
                      {!readOnly && (
                        <Button
                          variant="icon"
                          aria-label={`Delete ${supp.name}`}
                          onClick={() => setDeletingSupp(supp)}
                          style={{ border: 'none' }}
                        >
                          <Trash2 size={18} color={theme.status.danger} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {/* Tab bar */}
              <TabBar
                tabs={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]}
                active={tab}
                onChange={setTab}
                style={{ marginBottom: spacing.lg }}
              />

              {/* ── Active tab ── */}
              {tab === 'active' && (
                activeSupps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: `${spacing.xl}px ${spacing.md}px ${spacing.xxl}px` }}>
                    <div style={{ fontSize: typography.display, color: theme.text.secondary, marginBottom: spacing.md, fontFamily: typography.fontHeading, lineHeight: 1 }}>◯</div>
                    <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>
                      {isActive ? 'Add your first supplement' : 'No supplements'}
                    </div>
                    <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.5, marginBottom: isActive && !readOnly ? spacing.lg : 0 }}>
                      {isActive
                        ? 'Pick a name, dose, and when in the day it goes. You can edit anything later.'
                        : 'This protocol has no active supplements.'}
                    </div>
                    {isActive && !readOnly && onAddSupp && (
                      <Button variant="primary" fullWidth onClick={onAddSupp}>
                        Add supplement
                      </Button>
                    )}
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
                            minHeight: touch.row,
                          }}
                        >
                          <div
                            onClick={readOnly ? undefined : () => onEditSupp(supp)}
                            style={{
                              flex: 1, cursor: readOnly ? 'default' : 'pointer', userSelect: 'none',
                              WebkitTapHighlightColor: 'transparent',
                              paddingRight: spacing.sm, minWidth: 0,
                            }}
                          >
                            <div style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium, display: 'flex', alignItems: 'center', gap: spacing.xs2 }}>
                              {supp.name}
                              <CategoryIcon category={supp.category} color={theme.text.secondary} />
                            </div>
                            <div style={{ fontSize: typography.label, color: theme.text.secondary, marginTop: spacing.xxxs, minHeight: 14 }}>
                              {supp.dose}{supp.notes ? ` · ${supp.notes}` : ''}
                            </div>
                          </div>
                          {!readOnly && isActive && (
                            <Button
                              variant="icon"
                              aria-label={`Pause ${supp.name}`}
                              onClick={() => onTogglePauseSupp(supp)}
                              style={{ border: 'none' }}
                            >
                              <Pause size={18} color={theme.text.secondary} />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── Paused tab ── */}
              {/* Paused row: [name] [(paused) tag] ———— [trash] [play].
                  Trash soft-deletes (writes deleted_at; row disappears from cockpit).
                  Play resumes (status='active'; row moves to the Active tab). */}
              {tab === 'paused' && (
                pausedSupps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: `${spacing.xl}px ${spacing.md}px ${spacing.xxl}px` }}>
                    <div style={{ fontSize: typography.display, color: theme.text.secondary, marginBottom: spacing.md, fontFamily: typography.fontHeading, lineHeight: 1 }}>◯</div>
                    <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>
                      Nothing paused
                    </div>
                    <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.5 }}>
                      Pause a supplement from the Active tab to keep it in this protocol without tracking it for now.
                    </div>
                  </div>
                ) : (
                  <div style={{ borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, marginBottom: spacing.xl }}>
                    {pausedSupps.map((supp, i) => {
                      const isLast = i === pausedSupps.length - 1;
                      return (
                        <div
                          key={supp.id}
                          style={{
                            display: 'flex', alignItems: 'center',
                            padding: `${spacing.sm}px 0`,
                            borderBottom: isLast ? 'none' : `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                            // Multi-line row (name + optional dose) — use touch.row (52pt)
                            // rather than touch.min (44pt) per design rules Cat 13.
                            minHeight: touch.row,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium, display: 'flex', alignItems: 'center', gap: spacing.xs2 }}>
                              {supp.name}
                              <CategoryIcon category={supp.category} color={theme.text.secondary} />
                              <Badge variant="neutral">paused</Badge>
                            </div>
                            {supp.dose && <div style={{ fontSize: typography.caption, color: theme.text.faint }}>{supp.dose}</div>}
                          </div>
                          {!readOnly && (
                            <>
                              <Button
                                variant="icon"
                                aria-label={`Delete ${supp.name}`}
                                onClick={() => setDeletingSupp(supp)}
                                style={{ border: 'none', marginRight: spacing.xxs }}
                              >
                                <Trash2 size={18} color={theme.status.danger} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label={`Resume ${supp.name}`}
                                onClick={() => onResumeSupp(supp)}
                                style={{ border: 'none' }}
                              >
                                <Play size={18} color={theme.text.primary} />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}

        </div>
      )}

      {/* Overflow menu — popover anchored to the ⋯ trigger. */}
      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={{ current: menuAnchor }}
        placement="bottom-end"
        width={220}
      >
        {menuItems.map((item) => (
          <PopoverItem
            key={item.key}
            destructive={item.destructive}
            onClick={item.onSelect}
          >
            {item.label}
          </PopoverItem>
        ))}
      </Popover>

      {/* Send-to-patient picker — popover anchored to the same ⋯ trigger so
          the picker visually replaces the menu in place. */}
      <Popover
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        anchorRef={{ current: menuAnchor }}
        placement="bottom-end"
        width={260}
      >
        {patients.length === 0 ? (
          <div style={{
            padding: `${spacing.sm}px ${spacing.sm}px`,
            fontSize: typography.caption,
            color: theme.text.secondary,
            fontFamily: typography.fontHeading,
          }}>
            No patients yet.
          </div>
        ) : (
          patients.map((p) => (
            <PopoverItem
              key={p.id}
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await onSendToPatient(protocol, p.id);
                setSending(false);
                setSendModalOpen(false);
              }}
              icon={
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: theme.surface.cardSubtle,
                  border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: typography.label, fontWeight: typography.semibold,
                  color: theme.text.primary,
                  fontFamily: typography.fontData,
                }}>
                  {(p.display_name || '?').charAt(0).toUpperCase()}
                </span>
              }
            >
              {p.display_name || 'Unnamed patient'}
            </PopoverItem>
          ))
        )}
      </Popover>

      {/* Confirmation modal (Archive / Delete) */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        size="compact"
        title={confirmAction ? CONFIRM_COPY[confirmAction].title(protocol?.name) : ''}
        footer={
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <Button variant="tertiary" fullWidth onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction ? CONFIRM_COPY[confirmAction].variant : 'primary'}
              fullWidth
              onClick={handleConfirm}
            >
              {confirmAction ? CONFIRM_COPY[confirmAction].cta : ''}
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.6, margin: 0 }}>
          {confirmAction ? CONFIRM_COPY[confirmAction].body() : ''}
        </p>
      </Modal>

      {/* Delete supplement confirmation */}
      <Modal
        open={!!deletingSupp}
        onClose={() => setDeletingSupp(null)}
        size="compact"
        title="Delete supplement?"
        footer={
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <Button variant="tertiary" fullWidth onClick={() => setDeletingSupp(null)}>Cancel</Button>
            <Button
              variant="destructive"
              fullWidth
              onClick={async () => {
                const supp = deletingSupp;
                setDeletingSupp(null);
                if (supp && onDeleteSupp) await onDeleteSupp(supp.id);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.6, margin: 0 }}>
          This permanently deletes <strong style={{ color: theme.text.primary }}>{deletingSupp?.name}</strong>. This cannot be undone.
        </p>
      </Modal>

      {/* Activate-from-archive intent picker. Matches the received-protocol
          flow's verbs so the mental model is consistent: any protocol coming
          back to active state offers Stack vs Replace. */}
      <Modal
        open={activateIntentOpen}
        onClose={() => setActivateIntentOpen(false)}
        title={`Activate ${protocol?.name || 'protocol'}`}
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%' }}>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setActivateIntentOpen(false);
                if (onActivateProtocol) onActivateProtocol(protocol, 'stack');
              }}
            >
              Stack on current
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setActivateIntentOpen(false);
                if (onActivateProtocol) onActivateProtocol(protocol, 'replace');
              }}
            >
              Replace current
            </Button>
            <Button variant="tertiary" fullWidth onClick={() => setActivateIntentOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: typography.body, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: theme.text.primary }}>Stack</strong> adds this protocol alongside your current actives.{' '}
          <strong style={{ color: theme.text.primary }}>Replace</strong> archives your current actives first.
        </p>
      </Modal>

      {/* Peer-to-peer send. The recipient (any Origin user) gets the protocol
          in their Received queue and chooses Stack / Replace / Save when they
          open it. */}
      <Modal
        open={sendUserOpen}
        onClose={() => { if (!sendingUser) setSendUserOpen(false); }}
        size="compact"
        title={`Send ${protocol?.name || 'protocol'}`}
        footer={
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <Button variant="tertiary" fullWidth onClick={() => setSendUserOpen(false)} disabled={sendingUser}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth onClick={submitSendToUser} disabled={sendingUser || !sendUserEmail.trim()}>
              {sendingUser ? 'Sending…' : 'Send'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <label style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontBody, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Recipient email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="friend@example.com"
            value={sendUserEmail}
            onChange={(e) => { setSendUserEmail(e.target.value); if (sendUserError) setSendUserError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !sendingUser && sendUserEmail.trim()) submitSendToUser(); }}
            autoFocus
            disabled={sendingUser}
            style={{
              width: '100%',
              padding: `${spacing.sm}px ${spacing.md}px`,
              background: theme.surface.cardSubtle,
              border: `${theme.borderWidth.default}px solid ${sendUserError ? theme.status.danger : theme.border.subtle}`,
              color: theme.text.primary,
              fontFamily: typography.fontBody,
              fontSize: typography.body,
              outline: 'none',
            }}
          />
          {sendUserError ? (
            <div style={{ fontSize: typography.caption, color: theme.status.danger, fontFamily: typography.fontHeading, lineHeight: 1.5 }}>
              {sendUserError}
            </div>
          ) : (
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, fontFamily: typography.fontHeading, lineHeight: 1.5 }}>
              They'll get a notification and can choose to stack, replace, or save the protocol.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
