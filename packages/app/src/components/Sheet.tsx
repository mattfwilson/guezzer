/**
 * Phase-8 A11Y-01 (D-01): the ONE shared sheet/modal primitive the 6 true modals
 * migrate onto (plans 02/03) — it absorbs the `rounded-t-2xl border-t
 * border-hairline bg-elevated` + safe-area shell copied inline into every sheet
 * today, and wires the net-new a11y layer (focus trap + inert + Escape + restore)
 * in ONE place (RESEARCH.md §Pattern 3).
 *
 * Key mechanics:
 * - Portals to `document.body` via `createPortal`, so an open sheet's DOM lands
 *   OUTSIDE `#app-content` and stays interactive while the background is `inert`.
 * - `useFocusTrap(contentRef, { active: open && modal })` — initial focus + Tab-wrap
 *   + ref-counted `inert` + focus-restore. Only MODAL sheets trap/inert; a non-modal
 *   sheet (the NodeSheet variant, D-02) still gets Escape + focus-restore but leaves
 *   the background interactive and renders no scrim.
 * - `useDialogDismiss(open, onClose)` — Escape via the shared LIFO stack (topmost only).
 * - Preserves the `if (!open) return null` guard (V7 / T-08-04): a closed or error
 *   sheet renders nothing and never throws. `children` pass through untouched — no
 *   HTML injection, never `dangerouslySetInnerHTML` (T-08-01).
 *
 * The primitive deliberately owns NO scroll internals, drag geometry, or content
 * layout — those stay in each sheet so it never over-abstracts.
 */
import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { config } from "../config.ts";
import { useDialogDismiss } from "./a11y/useDialogDismiss.ts";
import { useFocusTrap } from "./a11y/useFocusTrap.ts";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the `role="dialog"` container (kglw-derived → React text). */
  ariaLabel: string;
  /** `bottom-sheet` (default) = the absorbed shell; `fullscreen` = CompareView-style overlay. */
  variant?: "bottom-sheet" | "fullscreen";
  /** Default true. false = non-modal NodeSheet variant: no trap, no inert, no scrim (D-02). */
  modal?: boolean;
  /** Default = modal. Renders the tap-to-close backdrop scrim (bottom-sheet only). */
  backdrop?: boolean;
  /** Element to focus on open instead of the first focusable (e.g. the Settings name input). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function Sheet({
  open,
  onClose,
  ariaLabel,
  variant = "bottom-sheet",
  modal = true,
  backdrop = modal,
  initialFocusRef,
  children,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Hooks run every render (before the closed-sheet guard). The trap/inert engage
  // only while the sheet is actually open AND modal; Escape is available whenever open.
  useFocusTrap(contentRef, { active: open && modal, initialFocusRef });
  useDialogDismiss(open, onClose);

  // V7 / T-08-04: closed sheet renders nothing, never throws.
  if (!open) return null;
  if (typeof document === "undefined") return null;

  const dialogProps = {
    ref: contentRef,
    role: "dialog" as const,
    "aria-modal": modal,
    "aria-label": ariaLabel,
    tabIndex: -1,
  };

  if (variant === "fullscreen") {
    // Full-screen overlay (CompareView): no backdrop; the view supplies its own header-X.
    return createPortal(
      <div
        {...dialogProps}
        className="fixed inset-0 overflow-y-auto bg-surface"
        style={{ zIndex: config.ui.z.sheet }}
      >
        {children}
      </div>,
      document.body,
    );
  }

  // bottom-sheet: optional backdrop scrim + the absorbed shell card.
  return createPortal(
    <div
      className={
        "fixed inset-0 flex flex-col justify-end " +
        (backdrop ? "bg-black/50" : "pointer-events-none")
      }
      style={{ zIndex: backdrop ? config.ui.z.sheetScrim : config.ui.z.sheet }}
      onClick={backdrop ? onClose : undefined}
    >
      <div
        {...dialogProps}
        className="pointer-events-auto rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{
          zIndex: config.ui.z.sheet,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
