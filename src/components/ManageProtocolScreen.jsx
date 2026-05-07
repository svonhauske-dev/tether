import { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Pause, Play } from "lucide-react";
import { spacing, typography, touch, layout } from "../design-system";
import { useTheme } from "../lib/theme";
import Badge from "./Badge";
import Label from "./Label";
import Button from "./Button";
import ScheduleTab from "./ScheduleTab";
import { isPausedSupp, isStoppedSupp } from "../lib/time";
import { dbGetAdherenceCounts } from "../lib/api";

const CATEGORY_ORDER = ["Oral", "Rx", "Injectable", "Topical"];

function formatStoppedDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const opts = date.getFullYear() === today.getFullYear()
    ? { month: "long", day: "numeric" }
    : { month: "long", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", opts);
}

export default function ManageProtocolScreen({ isOpen, onBack, supplements, token, onEdit, onDelete, onTogglePause, onResume, scheduleMode, scheduleConfig, anchorBehavior, consistentTime, onSaveSchedule }) {
  const { theme } = useTheme();
  const [viewMode, setViewMode]             = useState("active");
  const [confirmStopId, setConfirmStopId]   = useState(null);
  const [adherenceCounts, setAdherenceCounts] = useState({});

  const activeSupps  = supplements.filter(s => !isStoppedSupp(s));
  const stoppedSupps = [...supplements.filter(s => isStoppedSupp(s))].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!isOpen) {
      setViewMode("active");
      setConfirmStopId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || viewMode !== "stopped" || !token) return;
    const ids = stoppedSupps.map(s => s.id);
    if (!ids.length) return;
    dbGetAdherenceCounts(ids, token)
      .then(counts => setAdherenceCounts(counts))
      .catch(() => {});
  }, [isOpen, viewMode, token, stoppedSupps.length]);

  const grouped = CATEGORY_ORDER
    .map(cat => ({
      cat,
      items: [...activeSupps.filter(s => s.category === cat)].sort((a, b) => {
        if (isPausedSupp(a) !== isPausedSupp(b)) return isPausedSupp(a) ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-out",
        zIndex: 101,
        background: theme.surface.canvas,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Sticky header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `max(20px, env(safe-area-inset-top)) ${spacing.md}px ${spacing.sm}px`,
        background: theme.surface.canvas,
        borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: `${spacing.xs}px`, marginLeft: -spacing.xs,
            color: theme.text.primary, display: "flex", alignItems: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <span style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary }}>
          Manage protocol
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        maxWidth: layout.maxContentWidth,
        margin: "0 auto",
        padding: `${spacing.lg}px ${spacing.md}px max(80px, env(safe-area-inset-bottom))`,
      }}>

        {supplements.length === 0 ? (
          <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
            <div style={{ fontSize: typography.display, marginBottom: spacing.md }}>💊</div>
            <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>Your protocol is empty</div>
            <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5 }}>Add your first item to get started. Your daily schedule builds from when you take the first one each morning.</div>
          </div>
        ) : (
          <>
            {/* Tab nav */}
            <div style={{ display: "flex", borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`, marginBottom: spacing.lg }}>
              {[["active", "Active"], ["stopped", "Stopped"], ["schedule", "Schedule"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setViewMode(val)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    borderBottom: viewMode === val
                      ? `2px solid ${theme.accent.default}`
                      : "2px solid transparent",
                    marginBottom: -1,
                    padding: `${spacing.xs}px 0 ${spacing.sm}px`,
                    fontSize: typography.body,
                    fontWeight: viewMode === val ? typography.semibold : typography.regular,
                    color: viewMode === val ? theme.text.primary : theme.text.muted,
                    cursor: "pointer",
                    textAlign: "center",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Active view ── */}
            {viewMode === "active" && (
              grouped.length === 0 ? (
                <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px`, color: theme.text.secondary, fontSize: typography.body }}>
                  No active supplements
                </div>
              ) : (
                grouped.map(({ cat, items }, idx) => (
                  <div key={cat} style={{
                    ...(idx > 0 ? {
                      borderTop: `${theme.borderWidth.subtle}px solid ${theme.border.subtle}`,
                      marginTop: spacing.lg,
                      paddingTop: spacing.lg,
                    } : {}),
                  }}>
                    <Label style={{ marginBottom: spacing.xs }}>{cat}</Label>
                    {items.map((supp, i) => {
                      const isLast = i === items.length - 1;
                      return (
                        <div
                          key={supp.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: `${spacing.sm}px 0`,
                            borderBottom: isLast ? "none" : `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                            minHeight: touch.min,
                            opacity: isPausedSupp(supp) ? 0.5 : 1,
                            transition: "opacity 0.2s",
                          }}
                        >
                          <>
                            <div
                              onClick={() => onEdit(supp)}
                              style={{ flex: 1, cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", paddingRight: spacing.sm, display: "flex", alignItems: "center", gap: spacing.xs, minWidth: 0 }}
                            >
                              <span style={{ fontSize: typography.body, color: theme.text.primary, fontWeight: typography.medium }}>
                                {supp.name}
                              </span>
                              {isPausedSupp(supp) && <Badge variant="neutral">Paused</Badge>}
                            </div>
                            <Button
                              variant="icon"
                              aria-label={isPausedSupp(supp) ? `Resume ${supp.name}` : `Pause ${supp.name}`}
                              onClick={(e) => { e.stopPropagation(); onTogglePause(supp); }}
                              style={{ border: "none" }}
                            >
                              {isPausedSupp(supp)
                                ? <Play size={18} color={theme.text.secondary} />
                                : <Pause size={18} color={theme.text.secondary} />
                              }
                            </Button>
                          </>
                        </div>
                      );
                    })}
                  </div>
                ))
              )
            )}

            {/* ── Stopped view ── */}
            {viewMode === "stopped" && (
              stoppedSupps.length === 0 ? (
                <div style={{ textAlign: "center", padding: `${spacing.xl}px ${spacing.md}px` }}>
                  <div style={{ fontSize: typography.body, fontWeight: typography.semibold, color: theme.text.primary, marginBottom: spacing.xs }}>
                    No archived supplements yet
                  </div>
                  <div style={{ fontSize: typography.caption, color: theme.text.secondary, lineHeight: 1.5 }}>
                    Supplements you stop will appear here. You can resume them anytime.
                  </div>
                </div>
              ) : (
                stoppedSupps.map((supp, i) => {
                  const isLast = i === stoppedSupps.length - 1;
                  const count = adherenceCounts[supp.id] ?? 0;
                  return (
                    <div
                      key={supp.id}
                      style={{
                        padding: `${spacing.sm}px 0`,
                        borderBottom: isLast ? "none" : `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
                      }}
                    >
                      {confirmStopId === supp.id ? (
                        <div style={{ display: "flex", alignItems: "center", minHeight: touch.min }}>
                          <span style={{ flex: 1, fontSize: typography.body, color: theme.text.secondary, paddingRight: spacing.sm }}>
                            Permanently delete {supp.name}?
                          </span>
                          <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
                            <Button variant="tertiary" size="compact" onClick={() => setConfirmStopId(null)}>Cancel</Button>
                            <Button variant="destructive" size="compact" onClick={() => { setConfirmStopId(null); onDelete(supp); }}>Delete</Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: typography.body, fontWeight: typography.medium, color: theme.text.primary, marginBottom: spacing.xxxs }}>
                              {supp.name}
                            </div>
                            {supp.dose && (
                              <div style={{ fontSize: typography.caption, color: theme.text.muted, marginBottom: spacing.xxxs }}>
                                {supp.dose}
                              </div>
                            )}
                            {supp.stopped_at && (
                              <div style={{ fontSize: typography.caption, color: theme.text.muted, marginBottom: spacing.xxxs }}>
                                Stopped {formatStoppedDate(supp.stopped_at)}
                              </div>
                            )}
                            <div style={{ fontSize: typography.caption, color: theme.text.faint }}>
                              Taken {count} {count === 1 ? "time" : "times"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0, alignItems: "center", paddingTop: spacing.xxxs }}>
                            <Button variant="secondary" size="compact" onClick={() => onResume(supp)}>
                              Resume
                            </Button>
                            <Button
                              variant="icon"
                              aria-label={`Delete ${supp.name}`}
                              onClick={() => setConfirmStopId(supp.id)}
                              style={{ border: "none", color: theme.status.danger }}
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
            {/* ── Schedule view ── */}
            {viewMode === "schedule" && (
              <ScheduleTab
                scheduleMode={scheduleMode}
                scheduleConfig={scheduleConfig}
                anchorBehavior={anchorBehavior}
                consistentTime={consistentTime}
                onSave={onSaveSchedule}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
