import { useEffect } from "react";
import { X } from "lucide-react";
import { spacing, typography, radius, shadows, effects, zIndex as zIndexTokens } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";

export default function Modal({ open, onClose, title, children, footer, leftAction }) {
  const { theme } = useTheme();

  useEffect(function() {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return function() {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Full-screen backdrop — negative top/bottom extend past safe-area zones */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: "calc(-1 * env(safe-area-inset-top))",
          bottom: "calc(-1 * env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          background: theme.surface.backdrop,
          backdropFilter: effects.backdropBlur,
          WebkitBackdropFilter: effects.backdropBlur,
          opacity: open ? 1 : 0,
          transition: "opacity 250ms ease-out",
          pointerEvents: open ? "all" : "none",
          zIndex: zIndexTokens.backdrop,
        }}
      />

      {/* Bottom sheet card */}
      <div
        style={{
          fontFamily: typography.fontBody,
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "90dvh",
          background: theme.surface.modal,
          borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
          boxShadow: shadows.modal,
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease-out",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: zIndexTokens.modal,
          pointerEvents: open ? "all" : "none",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36,
          height: 5,
          borderRadius: theme.radius.pill,
          background: theme.border.subtle,
          margin: `${spacing.sm}px auto`,
          flexShrink: 0,
          opacity: 0.7,
        }} />

        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `${spacing.xs}px ${spacing.md}px ${spacing.sm}px`,
          flexShrink: 0,
          borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        }}>
          {leftAction ? (
            <>
              {leftAction}
              <span style={{
                fontSize: typography.title,
                fontWeight: typography.semibold,
                color: theme.text.primary,
                fontFamily: typography.fontHeading,
              }}>{title}</span>
            </>
          ) : (
            <span style={{
              fontSize: typography.title,
              fontWeight: typography.semibold,
              color: theme.text.primary,
              fontFamily: typography.fontHeading,
            }}>{title}</span>
          )}
          <Button variant="icon" aria-label="Close" onClick={onClose}><X size={18} /></Button>
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
            borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
