import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spacing, typography, shadows, touch, zIndex as zIndexTokens } from "../design-system";
import { useTheme } from "../lib/theme";

// Single row inside a Popover. Acts as a menu item — leading icon optional,
// destructive variant uses status.danger color. Hover state matches list
// rows elsewhere in the app.
export function PopoverItem({ onClick, icon, children, destructive = false, disabled = false }) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        width: "100%",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        minHeight: touch.min - 4,
        background: hovered && !disabled ? theme.surface.hover : "transparent",
        border: "none",
        borderRadius: theme.radius.surface,
        color: destructive ? theme.status.danger : theme.text.primary,
        fontFamily: typography.fontBody,
        fontSize: typography.caption,
        fontWeight: typography.medium,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 120ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {icon && <span style={{ display: "inline-flex", color: "currentColor" }}>{icon}</span>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </button>
  );
}

// Section label inside a Popover (uppercase caption, divider above).
export function PopoverSection({ children }) {
  const { theme } = useTheme();
  return (
    <div style={{
      padding: `${spacing.sm}px ${spacing.sm}px ${spacing.xxs}px`,
      marginTop: spacing.xxs,
      borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      fontSize: typography.label,
      color: theme.text.secondary,
      letterSpacing: typography.labelSpacingWide,
      textTransform: "uppercase",
      fontWeight: typography.semibold,
      fontFamily: typography.fontBody,
    }}>
      {children}
    </div>
  );
}

// Floating panel anchored to a trigger element. Use for short menus + pickers
// that shouldn't block the underlying surface. Lighter than Modal — no backdrop
// (or very subtle one), no focus trap, doesn't disrupt the page beneath.
//
// Dismiss: outside-click, Escape. No X button (the trigger usually toggles).
//
// API:
//   <Popover
//     open={open}
//     onClose={() => setOpen(false)}
//     anchorRef={triggerRef}
//     placement="bottom-end"   // default; also: bottom-start, top-end, top-start
//     width={280}              // default
//     gap={6}                  // distance from anchor edge
//   >
//     {children}
//   </Popover>
//
// Caller is responsible for the trigger; Popover only owns its own floating panel.
export default function Popover({
  open,
  onClose,
  anchorRef,
  placement = "bottom-end",
  width = 280,
  gap = 6,
  children,
}) {
  const { theme } = useTheme();
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);
  // Animation gating — same double-state pattern as Modal so the panel
  // commits in its hidden position before animating to visible.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    } else {
      setShown(false);
      const t = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Position calculation. Reads the anchor's rect when open changes.
  // We don't recalculate on scroll/resize for simplicity — popovers close
  // quickly enough that drift is unlikely to be visible.
  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top, left;
    const isTop    = placement.startsWith("top");
    const isEnd    = placement.endsWith("end");

    if (isTop) {
      top = rect.top - gap;
    } else {
      top = rect.bottom + gap;
    }
    if (isEnd) {
      left = rect.right - width;
    } else {
      left = rect.left;
    }

    // Viewport clamp — keep at least 8px from any edge.
    if (left < 8) left = 8;
    if (left + width > vw - 8) left = vw - 8 - width;
    if (top < 8) top = 8;

    setCoords({ top, left });
  }, [open, anchorRef, placement, width, gap]);

  // Outside-click + Escape dismissal.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    // mousedown rather than click so we react before the synthetic click
    // resolves (avoids re-opening if the trigger toggles on click).
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted || !coords) return null;

  const isTop = placement.startsWith("top");
  const translateY = isTop ? "-100%" : "0";

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width,
        transform: `translateY(${translateY}) translateY(${shown ? 0 : (isTop ? "4px" : "-4px")})`,
        opacity: shown ? 1 : 0,
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
        background: theme.surface.modal,
        border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
        borderRadius: theme.radius.surface,
        boxShadow: shadows.popover,
        padding: spacing.xs,
        zIndex: zIndexTokens.modal,
        fontFamily: typography.fontBody,
        color: theme.text.primary,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
