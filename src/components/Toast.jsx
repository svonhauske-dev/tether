import { useState, useEffect, useContext } from "react";
import { colors, spacing, radius, typography, touch, layout, shadows, zIndex as zIndexTokens } from "../design-system";
import { ToastContext } from "./ToastContext";

function ToastItem({ toast, onDismiss }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const visible = entered && !toast.leaving;

  return (
    <div
      style={{
        fontFamily: typography.fontBody,
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        background: colors.bgModal,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.md,
        padding: `${spacing.sm}px ${spacing.md}px`,
        boxShadow: shadows.popover,
        transform: visible ? "translateY(0)" : "translateY(calc(100% + 16px))",
        opacity: visible ? 1 : 0,
        transition: "transform 250ms ease-out, opacity 200ms ease-out",
        pointerEvents: "all",
      }}
    >
      {toast.icon && (
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: colors.textSecondary }}>
          {toast.icon}
        </span>
      )}
      <span style={{ flex: 1, fontSize: typography.body, color: colors.textPrimary }}>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action.onClick();
            onDismiss(toast.id);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: typography.body,
            fontWeight: typography.semibold,
            color: colors.accent,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            minHeight: touch.min,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
            fontFamily: typography.fontBody,
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export default function Toast() {
  const context = useContext(ToastContext);
  if (!context?.toasts?.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: spacing.md,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: zIndexTokens.toast,
        width: `calc(100% - ${spacing.md * 2}px)`,
        maxWidth: layout.toastMaxWidth,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
        pointerEvents: "none",
      }}
    >
      {context.toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={context.dismiss} />
      ))}
    </div>
  );
}
