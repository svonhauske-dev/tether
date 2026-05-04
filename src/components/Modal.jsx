import { useEffect } from "react";
import { colors, spacing, radius, typography } from "../design-system";
import Button from "./Button";

export default function Modal({ open, onClose, title, children }) {
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
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
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
      {/* Modal container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          background: colors.bgModal,
          borderRadius: radius.lg,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.95)",
          transition: "opacity 250ms ease-out, transform 250ms ease-out",
        }}
      >
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
