import { useEffect } from "react";
import { colors, spacing, radius, typography } from "../design-system";
import Button from "./Button";

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(function() {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return function() {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [open]);

  return (
    <div
      style={{
        fontFamily: typography.fontBody,
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        pointerEvents: open ? "all" : "none",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          background: colors.bgBackdrop,
          opacity: open ? 1 : 0,
          transition: "opacity 250ms ease-out",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          background: colors.bgModal,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 250ms ease-out",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 40,
          height: 4,
          borderRadius: radius.full,
          background: colors.borderStrong,
          margin: "8px auto 0",
          flexShrink: 0,
        }} />
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `${spacing.sm}px ${spacing.md}px`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: typography.title,
            fontWeight: typography.semibold,
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
          }}>{title}</span>
          <Button variant="icon" aria-label="Close" onClick={onClose}>✕</Button>
        </div>
        {/* Scrollable body */}
        <div style={{
          overflowY: "auto",
          padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
          flex: 1,
          WebkitOverflowScrolling: "touch",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
