/**
 * Pre-show launcher (04-UI-SPEC §Layout, Component Inventory; D-01/D-02). The
 * "Ready when you are" empty state with the single accent-gold **Start Show**
 * CTA — the one pre-show tap. Tapping it calls `startShow()`, which auto-stamps
 * today's date and writes the provisional-attendance trackedShows row (the row
 * itself IS the dex credit, DEX-01/D-02) — no venue picker, no network.
 *
 * Reuses PlaceholderView's Heading/Body token classes verbatim (the inherited
 * Phase 3 centered-state idiom). Accent gold is reserved (04-UI-SPEC §Color) —
 * the Start Show fill is one of its three sanctioned uses.
 */
import { Play } from "lucide-react";
import { config } from "../config.ts";
import { startShow } from "../db/db.ts";

export function PreShowLauncher() {
  const copy = config.copy.show;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.preShowHeading}
        </h1>
        <p className="mt-2 max-w-xs text-base leading-normal text-text-muted">
          {copy.preShowBody}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void startShow()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-[20px] font-semibold text-surface"
      >
        <Play size={22} />
        {copy.startCta}
      </button>
    </div>
  );
}
