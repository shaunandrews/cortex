import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Popover, VisuallyHidden } from '@wordpress/ui';

/**
 * Cursor-anchored context menu built on Popover. Parent owns the open state
 * and anchor coordinates; pass `null` anchor when closed.
 */

export type ContextAnchor = { x: number; y: number } | null;

type Props = {
  anchor: ContextAnchor;
  title?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function ContextMenu({ anchor, title = 'Context menu', onClose, children }: Props) {
  const open = anchor !== null;

  // Build a virtual anchor element for Popover's positioner.
  const virtualAnchor = useRef({
    getBoundingClientRect: () => new DOMRect(0, 0, 0, 0),
  });
  if (anchor) {
    virtualAnchor.current = {
      getBoundingClientRect: () =>
        new DOMRect(anchor.x, anchor.y, 0, 0),
    };
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Popover.Popup
        anchor={virtualAnchor.current}
        align="start"
        side="bottom"
        sideOffset={2}
        className="context-menu"
      >
        <VisuallyHidden>
          <Popover.Title>{title}</Popover.Title>
        </VisuallyHidden>
        <div className="context-menu-list" role="menu">{children}</div>
      </Popover.Popup>
    </Popover.Root>
  );
}

type ItemProps = {
  onSelect: () => void;
  disabled?: boolean;
  children: ReactNode;
  destructive?: boolean;
};

export function ContextMenuItem({ onSelect, disabled, destructive, children }: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu-item${destructive ? ' is-destructive' : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onSelect();
      }}
    >
      {children}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="context-menu-separator" role="separator" />;
}

type SubmenuProps = {
  label: ReactNode;
  disabled?: boolean;
  children: ReactNode;
};

type Point = { x: number; y: number };

// Sign of the cross product of (b - a) and (p - a). Positive if p is to the
// left of line a→b, negative if to the right, zero if collinear.
function sideSign(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = sideSign(a, b, p);
  const d2 = sideSign(b, c, p);
  const d3 = sideSign(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function pointInRect(p: Point, r: DOMRect): boolean {
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

/**
 * Hover-triggered inline submenu with a Kamens-style safe triangle.
 *
 * When the user moves diagonally from the trigger toward the submenu, the
 * cursor briefly leaves the trigger row before entering the submenu. A naïve
 * mouseleave-closes-it handler makes that traversal jittery. Instead, while
 * the submenu is open we install a pointermove listener and keep the menu
 * open as long as the cursor is inside the triangle formed by the last
 * "in-trigger" position and the two submenu edge corners nearest the trigger.
 * If the user stalls inside the triangle we close after a grace period; if
 * they leave the triangle we close immediately.
 */
export function ContextMenuSubmenu({ label, disabled, children }: SubmenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<Point | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  function clearClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose(delayMs: number) {
    clearClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, delayMs);
  }

  function handleTriggerEnter(e: React.MouseEvent) {
    if (disabled) return;
    clearClose();
    originRef.current = { x: e.clientX, y: e.clientY };
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    function onMove(e: PointerEvent) {
      const cursor = { x: e.clientX, y: e.clientY };
      const triggerRect = triggerEl!.getBoundingClientRect();
      const submenuEl = submenuRef.current;
      const submenuRect = submenuEl?.getBoundingClientRect() ?? null;

      // Case A: cursor on the trigger → refresh origin and stay open
      if (pointInRect(cursor, triggerRect)) {
        originRef.current = cursor;
        clearClose();
        return;
      }

      // Case B: cursor inside the submenu → stay open
      if (submenuRect && pointInRect(cursor, submenuRect)) {
        clearClose();
        return;
      }

      // Case C: outside both — check the safe triangle
      if (submenuRect && originRef.current) {
        const origin = originRef.current;
        // Submenu may open right (most common) or left (near viewport edge).
        const openLeft = submenuRect.right < triggerRect.left;
        const nearEdgeX = openLeft ? submenuRect.right : submenuRect.left;
        const topCorner = { x: nearEdgeX, y: submenuRect.top };
        const bottomCorner = { x: nearEdgeX, y: submenuRect.bottom };
        if (pointInTriangle(cursor, origin, topCorner, bottomCorner)) {
          // User is tracking toward the submenu. Keep open, but arm a slow
          // fallback in case they stall.
          scheduleClose(400);
          return;
        }
      }

      // Cursor is moving away from the submenu — close soon.
      scheduleClose(80);
    }

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }

    window.addEventListener('pointermove', onMove);
    document.addEventListener('click', onDocClick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('click', onDocClick);
      clearClose();
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`context-menu-submenu${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        role="menuitem"
        ref={triggerRef}
        className="context-menu-item context-menu-item--submenu"
        disabled={disabled}
        onMouseEnter={handleTriggerEnter}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="context-menu-item-label">{label}</span>
        <span className="context-menu-item-chevron" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div
          ref={submenuRef}
          className="context-menu-submenu-popup"
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}
