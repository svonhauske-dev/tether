import { useEffect } from "react";
import { colors, spacing, radius, typography, layout, shadows, zIndex as zIndexTokens } from "../design-system";
import Button from "./Button";

export default function Modal({ open, onClose, title, children, footer }) {
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
    <>
      {/* Full-screen backdrop — negative top/bottom extend past visual viewport into safe-area zones */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: "calc(-1 * env(safe-area-inset-top))",
          bottom: "calc(-1 * env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          background: colors.bgBackdrop,
          opacity: open ? 1 : 0,
          transition: "opacity 250ms ease-out",
          pointerEvents: open ? "all" : "none",
          zIndex: zIndexTokens.backdrop,
        }}
      />
      {/* Modal positioning wrapper */}
      <div
        style={{
          fontFamily: typography.fontBody,
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: zIndexTokens.modal,
          pointerEvents: open ? "all" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Modal container */}
        <div
          style={{
            position: "relative",
            width: `calc(100% - ${spacing.md * 2}px)`,
            maxWidth: layout.maxContentWidth,
            maxHeight: `calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 48px)`,
            background: colors.bgModal,
            borderRadius: radius.lg,
            boxShadow: shadows.modal,
            transform: open ? "scale(1)" : "scale(0.95)",
            opacity: open ? 1 : 0,
            transition: "transform 250ms ease-out, opacity 250ms ease-out",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `${spacing.sm}px ${spacing.md}px`,
            flexShrink: 0,
            borderBottom: `1px solid ${colors.borderSubtle}`,
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
            padding: `${spacing.sm}px ${spacing.md}px`,
            flex: 1,
            WebkitOverflowScrolling: "touch",
          }}>
            {children}
          </div>
          {/* Sticky footer */}
          {footer && (
            <div style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              flexShrink: 0,
              borderTop: `1px solid ${colors.borderSubtle}`,
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
