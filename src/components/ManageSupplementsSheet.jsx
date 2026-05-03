import { useState } from "react";
import { Trash2 } from "lucide-react";
import { colors, spacing, typography, touch } from "../design-system";
import BottomSheet from "./BottomSheet";
import Label from "./Label";
import Button from "./Button";

const CATEGORY_ORDER = ["Oral", "Rx", "Injectable", "Topical"];

export default function ManageSupplementsSheet({ open, onClose, supplements, onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);

  const grouped = CATEGORY_ORDER
    .map(cat => ({
      cat,
      items: supplements
        .filter(s => s.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name)),
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
      <BottomSheet open={open} onClose={onClose} title="Manage supplements">
        <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
          <div style={{ fontSize: typography.hero, marginBottom: spacing.md }}>💊</div>
          <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>Your protocol is empty</div>
          <div style={{ fontSize: typography.caption, color: colors.textMuted, lineHeight: 1.7 }}>Add your medications and supplements. Your schedule builds from when you take your first med each morning.</div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Manage supplements">
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
                  borderBottom: isLast ? "none" : `1px solid ${colors.divider}`,
                  minHeight: touch.min,
                }}
              >
                {isConfirming ? (
                  <>
                    <span style={{ flex: 1, fontSize: typography.body, color: colors.textSecondary, paddingRight: spacing.sm }}>
                      Delete {supp.name}?
                    </span>
                    <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
                      <Button
                        variant="tertiary"
                        onClick={() => setConfirmId(null)}
                        style={{ padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: typography.caption }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(supp)}
                        style={{ padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: typography.caption }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      onClick={() => onEdit(supp)}
                      style={{ flex: 1, cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", paddingRight: spacing.sm }}
                    >
                      <span style={{ fontSize: typography.body, color: colors.textPrimary, fontWeight: typography.medium }}>
                        {supp.name}
                      </span>
                    </div>
                    <div
                      onClick={(e) => handleTrash(e, supp)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: touch.min,
                        height: touch.min,
                        cursor: "pointer",
                        flexShrink: 0,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </BottomSheet>
  );
}
