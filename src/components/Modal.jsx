import { useEffect, useRef, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { spacing, typography, radius, shadows, effects, breakpoints, zIndex as zIndexTokens } from "../design-system";
import { useTheme } from "../lib/theme";
import Button from "./Button";

// Tracks nesting depth so each nested modal gets a higher z-index tier.
const ModalDepthCtx = createContext(0);

const ANIM_MS = 300; // matches CSS transition duration

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

// Desktop card width keyed by content shape:
//   compact (360) — confirms / pickers (Stop, Delete, Archive, Discard)
//   default (480) — most forms / standard modals
// Mobile bottom-sheet ignores this (always full-width).
const SIZE_TO_WIDTH = {
  compact: 360,
  default: 480,
};

export default function Modal({ open, onClose, title, children, footer, leftAction, size = "default" }) {
  const { theme } = useTheme();
  const isDesktop = useIsDesktop();
  const depth = useContext(ModalDepthCtx);
  const zBackdrop = zIndexTokens.backdrop + depth * 100;
  const zSheet    = zIndexTokens.modal    + depth * 100;
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const bodyRef = useRef(null);
  const sheetRef = useRef(null);

  // `mounted` controls DOM presence (stays true through the exit animation).
  // `shown` controls the visible position. Splitting them ensures the modal's
  // first render commits at translateY(100%), then a follow-up frame flips
  // to translateY(0) so the CSS transition actually animates. Without this
  // the modal pops in at its final position with no slide.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown]     = useState(false);
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

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTo(0, 0);
  }, [open]);

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

  // Reset drag state whenever modal closes (handles external close triggers)
  useEffect(function() {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  // Escape to close + Tab focus trap
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Auto-focus first focusable element when modal opens
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) setTimeout(() => focusable[0].focus(), 50);
  }, [open]);

  const handleDragStart = (e) => {
    touchStartY.current = e.touches[0].pageY;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleDragMove = (e) => {
    const deltaY = e.touches[0].pageY - touchStartY.current;
    if (deltaY > 0) setDragOffset(deltaY);
  };

  // Read final position from the event (avoids stale closure on dragOffset state)
  const handleDragEnd = (e) => {
    const finalOffset = Math.max(0, e.changedTouches[0].pageY - touchStartY.current);
    setIsDragging(false);
    setDragOffset(0);
    if (finalOffset > 100) onClose();
  };

  const mobileTransform = isDragging
    ? `translateY(${dragOffset}px)`
    : shown ? "translateY(0)" : "translateY(100%)";
  const desktopTransform = shown
    ? "translate(-50%, -50%) scale(1)"
    : "translate(-50%, -50%) scale(0.96)";

  const sheetTransform = isDesktop ? desktopTransform : mobileTransform;
  const sheetTransition = isDragging
    ? "none"
    : isDesktop
      ? "transform 200ms ease-out, opacity 200ms ease-out"
      : "transform 0.3s ease-out";

  if (!mounted) return null;

  const desktopMaxWidth = SIZE_TO_WIDTH[size] ?? SIZE_TO_WIDTH.default;
  const desktopSheetStyle = {
    position: "fixed",
    top: "50%",
    left: "50%",
    width: `min(${desktopMaxWidth}px, calc(100vw - 48px))`,
    maxHeight: "80dvh",
    borderRadius: theme.radius.surface,
    border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
    opacity: shown ? 1 : 0,
  };

  const mobileSheetStyle = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "90dvh",
    borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  // Portal to document.body so position:fixed is never constrained by a
  // transformed ancestor (e.g. the outer sheet's translateY animation).
  return createPortal(
    <ModalDepthCtx.Provider value={depth + 1}>
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
          backdropFilter: isDesktop ? "none" : effects.backdropBlur,
          WebkitBackdropFilter: isDesktop ? "none" : effects.backdropBlur,
          opacity: shown ? 1 : 0,
          transition: "opacity 250ms ease-out",
          pointerEvents: shown ? "all" : "none",
          zIndex: zBackdrop,
        }}
      />

      {/* Sheet/dialog card — bottom-anchored on mobile, centered on desktop */}
      <div
        ref={sheetRef}
        style={{
          fontFamily: typography.fontBody,
          background: theme.surface.modal,
          boxShadow: shadows.modal,
          transform: sheetTransform,
          transition: sheetTransition,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: zSheet,
          pointerEvents: open ? "all" : "none",
          ...(isDesktop ? desktopSheetStyle : mobileSheetStyle),
        }}
      >
        {/* Drag zone — mobile only (bottom-sheet dismiss gesture) */}
        {!isDesktop && (
          <div
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            style={{
              width: "100%",
              paddingTop: 16,
              paddingBottom: 12,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
              cursor: "grab",
              WebkitTapHighlightColor: "transparent",
              touchAction: "none",
            }}
          >
            {/* Visual drag handle pill */}
            <div style={{
              width: 36,
              height: 5,
              borderRadius: theme.radius.pill,
              background: theme.border.subtle,
              opacity: 0.7,
              flexShrink: 0,
            }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isDesktop
            ? `${spacing.md}px ${spacing.md}px ${spacing.sm}px`
            : `${spacing.xs}px ${spacing.md}px ${spacing.sm}px`,
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
        <div ref={bodyRef} style={{
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
    </ModalDepthCtx.Provider>,
    document.body
  );
}
