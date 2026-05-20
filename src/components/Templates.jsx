import { useState, useMemo } from "react";
import { ChevronRight, Plus, Send, UserPlus } from "lucide-react";
import { spacing, typography, touch } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";
import Popover, { PopoverItem, PopoverSection } from "./Popover";

// Templates surface — sibling to ProtocolLibrary. Both show clinician-owned
// protocols; this one filters to `is_template = true`. Distinct verbs:
//   Library  = run / track     (your own active protocols)
//   Templates = share / publish (shells you send to patients or take into rotation)
//
// Per-row actions on a template:
//   Send to patient — Popover with patient picker, reuses dbSendProtocol
//   Use for myself  — clone into a new owned protocol with is_template=false

function TemplateRow({ template, suppCount, sentCount, patients, onTap, onSendToPatient, onUseForMyself }) {
  const { theme } = useTheme();
  const [sendOpen, setSendOpen] = useState(false);
  const [sendAnchor, setSendAnchor] = useState(null);

  const handleSendClick = (e) => {
    e.stopPropagation();
    setSendAnchor(e.currentTarget);
    setSendOpen(true);
  };

  const handleUseClick = (e) => {
    e.stopPropagation();
    onUseForMyself?.(template);
  };

  return (
    <>
      <button
        onClick={onTap}
        style={{
          display: "flex", alignItems: "center", width: "100%", gap: spacing.sm,
          background: "none", border: "none",
          borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          padding: `${spacing.sm}px 0`,
          minHeight: touch.row, textAlign: "left", cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: 2 }}>
            {template.name}
          </div>
          <div style={{ fontSize: typography.caption, color: theme.text.secondary }}>
            {suppCount} {suppCount === 1 ? "supplement" : "supplements"}
            {sentCount > 0 && ` · Sent to ${sentCount} ${sentCount === 1 ? "patient" : "patients"}`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: spacing.xxs, flexShrink: 0 }}>
          <Button
            variant="icon"
            aria-label={`Send ${template.name} to patient`}
            onClick={handleSendClick}
            disabled={!patients?.length}
          >
            <Send size={16} />
          </Button>
          <Button
            variant="icon"
            aria-label={`Use ${template.name} for myself`}
            onClick={handleUseClick}
          >
            <UserPlus size={16} />
          </Button>
          <ChevronRight size={18} color={theme.text.secondary} />
        </div>
      </button>

      <Popover
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        anchorRef={{ current: sendAnchor }}
        placement="bottom-end"
        width={240}
      >
        <PopoverSection>Send to patient</PopoverSection>
        {patients?.length ? (
          patients.map(p => (
            <PopoverItem
              key={p.id}
              onClick={() => {
                setSendOpen(false);
                onSendToPatient?.(template, p.id);
              }}
            >
              {p.display_name || p.email || "Unnamed patient"}
            </PopoverItem>
          ))
        ) : (
          <PopoverItem disabled>No active patients</PopoverItem>
        )}
      </Popover>
    </>
  );
}

export default function Templates({
  templates = [],
  supplements = [],
  patients = [],
  sendCountsByTemplateId = {},
  onCreateTemplate,
  onOpenTemplate,
  onSendToPatient,
  onUseForMyself,
}) {
  const { theme } = useTheme();

  const suppCountByProtocolId = useMemo(() => {
    const m = {};
    for (const s of supplements) {
      if (!s.protocol_id) continue;
      m[s.protocol_id] = (m[s.protocol_id] ?? 0) + 1;
    }
    return m;
  }, [supplements]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
        <h1 style={{
          fontFamily: typography.fontHeading,
          fontSize: typography.heading,
          fontWeight: typography.semibold,
          color: theme.text.primary,
          letterSpacing: typography.headingLetterSpacing,
          margin: 0,
        }}>
          Protocol Templates
        </h1>
        <Button variant="secondary" onClick={onCreateTemplate}>
          <Plus size={16} style={{ marginRight: spacing.xxs }} />
          New template
        </Button>
      </header>

      {templates.length === 0 ? (
        <div style={{
          padding: `${spacing.xxl}px ${spacing.lg}px`,
          textAlign: "center",
          color: theme.text.secondary,
          fontSize: typography.caption,
          border: `${theme.borderWidth.default}px dashed ${theme.border.subtle}`,
        }}>
          <div style={{ fontSize: typography.title, color: theme.text.primary, marginBottom: spacing.xs, fontFamily: typography.fontHeading }}>
            No templates yet
          </div>
          Create a template to share a protocol with patients or save shapes you use often.
        </div>
      ) : (
        <div role="list">
          {templates.map(t => (
            <TemplateRow
              key={t.id}
              template={t}
              suppCount={suppCountByProtocolId[t.id] ?? 0}
              sentCount={sendCountsByTemplateId[t.id] ?? 0}
              patients={patients}
              onTap={() => onOpenTemplate?.(t)}
              onSendToPatient={onSendToPatient}
              onUseForMyself={onUseForMyself}
            />
          ))}
        </div>
      )}
    </div>
  );
}
