import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { spacing, typography, shadows, breakpoints, zIndex as zIndexTokens } from "../design-system";
import { useTheme } from "../lib/theme";
import Modal from "./Modal";
import Button from "./Button";

const ANIM_MS = 250;
const PANEL_WIDTH = 480;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= breakpoints.desktop
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= breakpoints.desktop);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

// Right-side editing panel for focused work that should preserve surrounding
// context (Linear / Notion / Stripe Dashboard pattern). On desktop renders as
// a 480px panel anchored to the right edge with no backdrop — the surface
// beneath stays visible so the clinician/user can reference what they're
// editing. On mobile delegates to Modal (bottom sheet) since side panels
// don't fit a phone viewport.
//
// API matches Modal so migration from <Modal> to <SidePanel> is a tag swap:
//   <SidePanel open onClose title footer>
//     {body}
//   </SidePanel>
export default function SidePanel({ open, onClose, title, children, footer }) {
  const isDesktop = useIsDesktop();
  const { theme } = useTheme();
  const bodyRef = useRef(null);
  const panelRef = useRef(null);

  // Animation gating — same double-state pattern as Modal so the panel
  // commits at translateX(100%) before flipping to 0.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    } else {
      setShown(false);
      const t = setTimeout(() => setMounted(false), ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset scroll on open so the user always starts at the top of the form.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTo(0, 0);
  }, [open]);

  // Escape to close + Tab focus trap (desktop only — mobile delegates to Modal
  // which has its own focus trap).
  useEffect(() => {
    if (!open || !isDesktop) return;
    const handleKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, isDesktop]);

  // Auto-focus the first focusable element on open.
  useEffect(() => {
    if (!open || !isDesktop || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) setTimeout(() => focusable[0].focus(), 50);
  }, [open, isDesktop]);

  // Mobile: delegate to Modal entirely. Same props, same behavior. SidePanel
  // shape doesn't make sense on a phone — slide-from-right is essentially a
  // full-screen takeover and the existing bottom-sheet pattern is right.
  if (!isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title} footer={footer}>
        {children}
      </Modal>
    );
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* No backdrop on desktop — preserving surface context is the whole
          reason side panels exist. Click-outside dismissal is still wired
          via a transparent capture layer. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0, left: 0, right: PANEL_WIDTH, bottom: 0,
          opacity: shown ? 1 : 0,
          transition: `opacity ${ANIM_MS}ms ease-out`,
          pointerEvents: shown ? "all" : "none",
          background: "transparent",
          zIndex: zIndexTokens.modal - 1,
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={title ? "sidepanel-title" : undefined}
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: PANEL_WIDTH,
          maxWidth: "100vw",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          background: theme.surface.modal,
          borderLeft: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          boxShadow: shadows.modal,
          display: "flex",
          flexDirection: "column",
          fontFamily: typography.fontBody,
          color: theme.text.primary,
          zIndex: zIndexTokens.modal,
        }}
      >
        {/* Sticky header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing.md}px ${spacing.lg}px`,
          borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          background: theme.surface.modal,
          flexShrink: 0,
        }}>
          <span id="sidepanel-title" style={{
            fontSize: typography.body,
            fontWeight: typography.semibold,
            color: theme.text.primary,
            fontFamily: typography.fontBody,
          }}>
            {title}
          </span>
          <Button variant="icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {/* Scrollable body */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: spacing.lg,
          }}
        >
          {children}
        </div>

        {/* Sticky footer (optional) */}
        {footer && (
          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
            background: theme.surface.modal,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
