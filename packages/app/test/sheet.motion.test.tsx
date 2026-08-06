import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, forwardRef, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-22 SHEET-01 — the shared `<Sheet>` primitive's ENTER motion, its
 * per-variant prop shape, the sibling scrim/card structure, and the D-25
 * no-literal-duration rule.
 *
 * ## The honest limit of this file (read before trusting it)
 *
 * These cases run against the shipped PASS-THROUGH `motion/react` double
 * (`test/components/WaveToast.test.tsx:16-36`, extended below to re-emit
 * `data-animate` and `data-transition` as well as `data-initial`). That double
 * renders children IMMEDIATELY and NEVER defers unmount, so this file proves
 * **prop correctness only** — which is exactly what it is good for, because
 * timing is noise when the question is "does the bottom-sheet card animate
 * `opacity`?".
 *
 * What it therefore CANNOT prove: the deferred-unmount window, and with it the
 * D-19 close-start contract (inert released, focus restored, `aria-hidden`,
 * `pointer-events: none` — all while the node is still in the DOM). Those are
 * proven by `sheet.closeStart.test.tsx` (plan 22-02) AGAINST THE REAL LIBRARY, for
 * the reason 22-RESEARCH §Code Examples spells out: a pass-through double makes
 * every close-start assertion pass vacuously, and a hand-rolled "retaining" double
 * makes them pass even against the §Pitfall 14 defect, which is worse than no test.
 *
 * This plan (22-01) ships ENTER ONLY — there is no `exit` variant to assert yet.
 */

/** Controllable reduced-motion value + a plain-DOM motion double. */
let reduced = false;
vi.mock("motion/react", () => ({
  useReducedMotion: () => reduced,
  // Always PRESENT. This file proves prop SHAPE, not timing: `exit` props are
  // authored identically whether or not the surface is currently exiting, and the
  // presence-derived close-start values (aria-hidden / pointer-events / the scrim
  // handler) are deliberately out of scope here — `sheet.closeStart.test.tsx` owns
  // them, against the real library, for the §Pitfall 14 reason in the header.
  useIsPresent: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        forwardRef(
          (
            {
              initial,
              animate,
              exit,
              transition,
              // Stripped, not re-emitted: `onAnimationComplete` is a `motion`-only
              // prop and React DOM would warn "Unknown event handler property" if it
              // reached a plain <div>. Its D-27 behaviour is proven in
              // `sheet.a11y.test.tsx` / `sheet.closeStart.test.tsx` against the real
              // library, where the animation that completes actually exists.
              onAnimationComplete: _onAnimationComplete,
              ...rest
            }: Record<string, unknown>,
            ref: unknown,
          ) =>
            // The shipped double emits `data-initial` only and DROPS `transition`
            // on the floor, so a config-constant timing assertion has to read a
            // `data-*` attribute — never a `transition` prop, which never lands.
            createElement(tag, {
              ...rest,
              ref,
              "data-initial": JSON.stringify(initial),
              "data-animate": JSON.stringify(animate),
              "data-transition": JSON.stringify(transition),
            }),
        ),
    },
  ),
}));

const { Sheet } = await import("../src/components/Sheet.tsx");
const { config } = await import("../src/config.ts");

const SHEET_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "Sheet.tsx",
);

/** The dialog CARD — the `role="dialog"` box the scrim is now a sibling of. */
const card = () => screen.getByRole("dialog");
/** The backdrop SCRIM, found by the class `sheet.a11y.test.tsx` already queries on. */
const scrim = () => document.querySelector<HTMLElement>(".bg-black\\/50")!;

/** Parse one of the double's re-emitted `data-*` prop snapshots. */
function motionProps(el: HTMLElement, name: "initial" | "animate" | "transition") {
  return JSON.parse(el.getAttribute(`data-${name}`) ?? "null") as Record<
    string,
    unknown
  >;
}

function openSheet(variant?: "fullscreen") {
  render(
    <Sheet open onClose={vi.fn()} ariaLabel="Motion" variant={variant}>
      <button>inside</button>
    </Sheet>,
  );
}

afterEach(() => {
  cleanup();
  reduced = false;
});

describe("SHEET-01: bottom-sheet card motion", () => {
  it("motion allowed: translates only — y is the string '100%' and opacity is UNTOUCHED", () => {
    openSheet();
    const initial = motionProps(card(), "initial");
    const animate = motionProps(card(), "animate");

    // A percentage, never a measured pixel value: sheet height is content-driven
    // and varies per surface, and a percentage transform resolves against the
    // element's own box, so the primitive never has to measure its content.
    expect(initial.y).toBe("100%");
    expect(typeof initial.y).toBe("string");
    expect(animate.y).toBe(0);

    // THE assertion that stops the card double-dimming through its own scrim. The
    // scrim owns the opacity channel; if the card animated opacity too, the two
    // would compound and the card would fade in behind its own backdrop.
    expect(initial).not.toHaveProperty("opacity");
    expect(animate).not.toHaveProperty("opacity");
  });

  it("reduced motion: cross-fades with NO translate (the shipped WaveToast path)", () => {
    reduced = true;
    openSheet();
    const initial = motionProps(card(), "initial");
    const animate = motionProps(card(), "animate");

    expect(initial.opacity).toBe(0);
    expect(animate.opacity).toBe(1);
    expect(initial).not.toHaveProperty("y");
    expect(animate).not.toHaveProperty("y");
  });
});

describe("SHEET-01: the fullscreen variant never translates (D-26)", () => {
  // A full-bleed overlay sliding a whole viewport height reads as a page
  // transition, not a sheet — so fullscreen fades in BOTH motion modes.
  for (const reducedMotion of [false, true]) {
    it(`opacity only, no y, with reduced motion = ${reducedMotion}`, () => {
      reduced = reducedMotion;
      openSheet("fullscreen");
      const initial = motionProps(card(), "initial");
      const animate = motionProps(card(), "animate");

      expect(initial.opacity).toBe(0);
      expect(animate.opacity).toBe(1);
      expect(initial).not.toHaveProperty("y");
      expect(animate).not.toHaveProperty("y");
    });
  }
});

describe("SHEET-01: the scrim cross-fades in parallel with the card (D-24)", () => {
  it("scrim fades 0 → 1 on the SAME duration as the card — parallel, never staged", () => {
    openSheet();

    expect(motionProps(scrim(), "initial").opacity).toBe(0);
    expect(motionProps(scrim(), "animate").opacity).toBe(1);

    // One duration, run in parallel. A scrim that lagged the card would leave a
    // painted scrim after the sheet is gone, which turns plan 22-02's
    // `pointer-events: none` on the first exit frame from a structural property
    // into a subtle, easily-regressed rule.
    expect(motionProps(scrim(), "transition").duration).toBe(
      motionProps(card(), "transition").duration,
    );
  });

  it("scrim and card are SIBLINGS at document.body, not nested (OQ2)", () => {
    openSheet();

    // The structural half of the no-double-dim guarantee. `opacity` applies to a
    // whole subtree, so a scrim PARENT animating 0 → 1 would drag the card's
    // rendered opacity with it no matter what the card's own props said.
    expect(scrim().contains(card())).toBe(false);
    expect(card().parentElement).toBe(document.body);
    expect(scrim().parentElement).toBe(document.body);
  });
});

describe("SHEET-01: timing comes from config, never from a literal (D-25)", () => {
  it("the card's transition reads config.ui.motion", () => {
    openSheet();
    const transition = motionProps(card(), "transition");

    // `motion` takes SECONDS; the config value stays in ms (the unit every other
    // timing constant in config.ts uses), so the consumer does the conversion.
    expect(transition.duration).toBe(config.ui.motion.SHEET_DURATION_MS / 1000);
    expect(transition.ease).toBe(config.ui.motion.SHEET_EASE_ENTER);
  });

  it("SOURCE GUARD: Sheet.tsx reads the constant and hard-codes no duration", () => {
    // Comment-stripped, in the shape `bottomSpace.test.ts` uses: block comments
    // become spaces, line comments are dropped, and `://` is preserved. A bare
    // occurrence count over UNSTRIPPED source would be wrong here — the module doc
    // legitimately discusses the ~200ms window in prose.
    const stripped = stripComments(readFileSync(SHEET_SRC, "utf8"));

    expect(stripped).toMatch(/config\.ui\.motion\.SHEET_DURATION_MS/);
    expect(
      stripped,
      "Sheet.tsx hard-codes a fractional-second duration. 200ms is a CEILING " +
        "argued from SHEET-02's close-start window (D-24) — change it in " +
        "config.ui.motion, never at the call site (D-25).",
    ).not.toMatch(/duration:\s*0?\.\d/);
  });
});

/** `bottomSpace.test.ts`'s comment stripper, verbatim — same discipline, same shape. */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.replace(
    /(^|[^:])\/\/[^\n]*/g,
    (_match, lead: string) => lead,
  );
}
