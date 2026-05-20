import { useRef, useState } from "react";
import Modal from "../Modal";
import Popover, { PopoverItem, PopoverSection } from "../Popover";
import SidePanel from "../SidePanel";
import LogAtSheet from "../LogAtSheet";
import Button from "../Button";

// Portal-based components can't render meaningfully in a static showcase grid
// (their position is `fixed`, they hijack the viewport, they need refs).
// Each preview below is a self-contained trigger button + the real component
// with its own open state so the design-system page can demo them safely.

export function ModalPreview({ size = "default", withFooter = false, title = "Confirm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
        Open Modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size={size}
        footer={withFooter ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
          </div>
        ) : undefined}
      >
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          {size === "compact"
            ? "Compact body copy. Used for confirms and short prompts. Max width 360px on desktop."
            : "Default body copy. Used for forms and longer content. Max width 480px on desktop. On mobile this becomes a bottom sheet with drag-to-dismiss."}
        </div>
      </Modal>
    </>
  );
}

export function PopoverPreview({ withSection = false, destructive = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <>
      <span ref={ref} style={{ display: "inline-block" }}>
        <Button variant="secondary" size="compact" onClick={() => setOpen(o => !o)}>
          Open Popover
        </Button>
      </span>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        placement="bottom-start"
        width={240}
      >
        <PopoverItem onClick={() => setOpen(false)}>Edit</PopoverItem>
        <PopoverItem onClick={() => setOpen(false)}>Duplicate</PopoverItem>
        {withSection && (
          <>
            <PopoverSection>Danger zone</PopoverSection>
            <PopoverItem destructive onClick={() => setOpen(false)}>Archive</PopoverItem>
          </>
        )}
        {destructive && !withSection && (
          <PopoverItem destructive onClick={() => setOpen(false)}>Delete</PopoverItem>
        )}
      </Popover>
    </>
  );
}

export function LogAtSheetPreview({ target }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
        Open LogAtSheet
      </Button>
      <LogAtSheet
        open={open}
        target={target}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export function SidePanelPreview({ withFooter = true }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
        Open SidePanel
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Edit supplement"
        footer={withFooter ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Save</Button>
          </div>
        ) : undefined}
      >
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          Right-side editing panel for focused work that should preserve surrounding context.
          480px wide on desktop, no backdrop. On mobile this primitive delegates to Modal
          (bottom sheet) since side panels don't fit a phone viewport.
        </div>
      </SidePanel>
    </>
  );
}
