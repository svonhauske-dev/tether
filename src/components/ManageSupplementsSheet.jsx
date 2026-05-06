import { useState } from "react";
import { Trash2, Pause, Play } from "lucide-react";
import { spacing, typography, touch } from "../design-system";
import { useTheme } from "../lib/theme";
import Modal from "./Modal";
import Badge from "./Badge";
import Label from "./Label";
import Button from "./Button";

const CATEGORY_ORDER = ["Oral", "Rx", "Injectable", "Topical"];

export default function ManageSupplementsSheet({ open, onClose, supplements, onEdit, onDelete, onTogglePause }) {
  const { theme } = useTheme();
  const [confirmId, setConfirmId] = useState(null);

  const grouped = CATEGORY_ORDER
    .map(cat => ({
      cat,
      items: [...supplements.filter(s => s.category === cat)].sort((a, b) => {
        if (a.paused !== b.paused) return a.paused ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    }))
    .filter(g => g.items.length > 0);

  const handleTrash = (e, supp) => {
    e.stopPropagation();
    setConfirmId(supp.id);
  };

  const handleDelete = (supp) => {
    setConfirmId(null);
    onDelete(supp);
  };

  if (supplements.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Manage protocol">
        <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
          <div style={{ fontSize: typography.display, marginBottom: spacing.md }}>💊</div>
          <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>Your protocol is empty</div>
          <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5 }}>Add your first item to get started. Your daily schedule builds from when you take the first one each morning.</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage protocol">
      {grouped.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: spacing.lg }}>
          <Label style={{ marginBottom: spacing.xs }}>{cat}</Label>
          {items.map((supp, i) => {
            const isConfirming = confirmId === supp.id;
            const isLast = i === items.length - 1;
            return (
              <div
                key={supp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: `${spacing.sm}px 0`,
                  borderBottom: isLast ? "none" : `1px solid ${theme.border.subtle}`,
                  minHeight: touch.min,
                  opacity: supp.paused ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {isConfirming ? (
                  <>
                    <span style={{ flex: 1, fontSize: typography.body, color: theme.text.secondary, paddingRight: spacing.sm }}>
                      Delete {supp.name}?
                    </span>
                    <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
                      <Button variant="tertiary" size="compact" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" size="compact" onClick={() => handleDelete(supp)}>
                        Delete
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      onClick={() => onEdit(supp)}
                      style={{ flex: 1, cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", paddingRight: spacing.sm, display: "flex", alignItems: "center", gap: spacing.xs, minWidth: 0 }}
                    >
                      <span style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium }}>
                        {supp.name}
                      </span>
                      {supp.paused && <Badge variant="neutral">Paused</Badge>}
                    </div>
                    <Button
                      variant="icon"
                      aria-label={supp.paused ? `Resume ${supp.name}` : `Pause ${supp.name}`}
                      onClick={(e) => { e.stopPropagation(); onTogglePause(supp); }}
                      style={{ border: "none" }}
                    >
                      {supp.paused
                        ? <Play size={18} color={theme.text.secondary} />
                        : <Pause size={18} color={theme.text.secondary} />
                      }
                    </Button>
                    <Button
                      variant="icon"
                      aria-label={`Delete ${supp.name}`}
                      onClick={(e) => handleTrash(e, supp)}
                      style={{ border: "none", color: theme.status.danger }}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
