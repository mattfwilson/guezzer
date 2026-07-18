/**
 * THROWAWAY DEV HARNESS (POLISH-01 on-device verification, plan 08-06) — mounted
 * ONLY on `location.hash === "#/dev/orb-fit"` (see App.tsx), never on a production
 * tab/route. REMOVE POST-PHASE.
 *
 * Why it exists: `fitOrbLabel` is a pure no-DOM heuristic and drifts optimistic
 * (RESEARCH §Orb-Label Legibility) — its self-report cannot be trusted as the bar.
 * `orbLabelFit.catalog.test.ts` locks the heuristic over all 264 real names, but
 * the ACTUAL bar is real glyph rendering on the owner's phone. This harness renders
 * every real `@matrix` name as a real `PredictionOrb` (at the ORB_MIN_DIAMETER floor
 * AND a representative solved diameter) plus a real `CenterNode`, then measures each
 * rendered text LINE's real width against the CIRCLE chord at that line's vertical
 * offset (POLISH-01 08-08 — no `overflow:hidden` clip, no rectangular scroll blind
 * spot) and lists any circular-SPILL offenders on-screen. Zero offenders = every
 * name renders fully INSIDE its circular fill at real sizes.
 *
 * Device flow (memory: device-uat-hosting): serve over the cloudflared HTTPS tunnel
 * (`--http-host-header localhost`), open `#/dev/orb-fit` on the iPhone, confirm the
 * banner reads zero circular-spill offenders (watch the 44-char outlier
 * `(You Gotta) Fight for Your Right (To Party!)` + `Deserted Dunes Welcome Weary Feet`).
 */
import { useEffect, useRef, useState } from "react";
import matrix from "@matrix";
import { config } from "../config.ts";
import { CenterNode } from "../show/CenterNode.tsx";
import { PredictionOrb, type OrbitCandidate } from "../show/PredictionOrb.tsx";
import type { OrbLayout } from "../show/orbitLayout.ts";

/** A representative diameter the ring solver grows orbs toward on a real stage. */
const REPRESENTATIVE_SOLVED_PX = config.show.ORB_MAX_DIAMETER;

/** The two orb diameters exercised: the absolute floor (worst case) + a solved size. */
const ORB_DIAMETERS = [config.show.ORB_MIN_DIAMETER, REPRESENTATIVE_SOLVED_PX] as const;

/** Build a valid OrbitCandidate for a real matrix node (dummy score/factors — only the label matters here). */
function toCandidate(node: {
  songId: number;
  songName: string;
  tuningFamily: OrbitCandidate["tuningFamily"];
}): OrbitCandidate {
  return {
    songId: node.songId,
    songName: node.songName,
    score: 0.42,
    factors: {
      transitionProb: 0.42,
      decay: 1,
      rotation: 1,
      alreadyPlayed: 1,
      eraPrior: 0,
      backoffTier: "transition",
      hardSegueFlag: false,
    },
    reason: "dev-harness",
    tuningFamily: node.tuningFamily,
  };
}

function orbLayout(songId: number, diameterPx: number): OrbLayout {
  return { songId, x: 0, y: 0, diameterPx };
}

interface Offender {
  name: string;
  variant: string;
  /** The specific rendered line that spilled past the circle chord. */
  line: string;
}

/** Sub-pixel slack (px) so glyph antialiasing / rounding doesn't false-flag a fit. */
const SPILL_EPSILON_PX = 0.5;

export function OrbFitHarness() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [offenders, setOffenders] = useState<Offender[] | null>(null);

  const nodes = matrix.nodes;

  useEffect(() => {
    // Measure AFTER layout+fonts settle: two rAFs push past the paint that applies
    // the fitted font sizes so getBoundingClientRect reflects the real glyph runs.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root) return;
        const cells = root.querySelectorAll<HTMLElement>("[data-fit-cell]");
        const found: Offender[] = [];
        cells.forEach((cell) => {
          // The visual CIRCLE is the round cell itself (rounded-full fills it):
          // center + radius from its bounding rect.
          const cellRect = cell.getBoundingClientRect();
          const cx = cellRect.left + cellRect.width / 2;
          const cy = cellRect.top + cellRect.height / 2;
          const r = Math.min(cellRect.width, cellRect.height) / 2;

          // Real rendered LINES = the leaf text spans (each name line, and the
          // PredictionOrb percent line). Container/flex spans have element children;
          // the aria-hidden ripple spans + the sr-only "why" button carry no text —
          // both are excluded by the leaf-with-text filter, so no harness-only
          // marker is needed on the production components.
          const lineEls = Array.from(
            cell.querySelectorAll<HTMLElement>("span"),
          ).filter(
            (el) =>
              el.childElementCount === 0 &&
              (el.textContent ?? "").trim() !== "",
          );

          for (const lineEl of lineEls) {
            const lineRect = lineEl.getBoundingClientRect();
            // Vertical offset = the line edge FARTHER from center (worst case), so a
            // line straddling the equator is still measured at its widest-needed y.
            const worstY = Math.max(
              Math.abs(lineRect.top - cy),
              Math.abs(lineRect.bottom - cy),
            );
            const halfWidth = lineRect.width / 2;
            // The circle chord half-width available at this line's y.
            const chordHalf = Math.sqrt(Math.max(0, r * r - worstY * worstY));
            const spillsSide = halfWidth > chordHalf + SPILL_EPSILON_PX;
            const spillsTopBottom = worstY > r + SPILL_EPSILON_PX;
            if (spillsSide || spillsTopBottom) {
              found.push({
                name: cell.dataset.fitName ?? "?",
                variant: cell.dataset.fitVariant ?? "?",
                line: (lineEl.textContent ?? "").trim(),
              });
              break; // one spilling line is enough to flag the cell
            }
          }
        });
        setOffenders(found);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [nodes]);

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-y-auto bg-surface p-4 text-white"
    >
      <header className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 bg-surface/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Orb-fit harness (POLISH-01, dev only)</h1>
        <p className="text-sm opacity-70">
          Each rendered line measured against the CIRCLE chord at its y (no clip, no
          rectangular scroll) · {nodes.length} names · orb {config.show.ORB_MIN_DIAMETER}px
          &amp; {REPRESENTATIVE_SOLVED_PX}px · center {config.show.ORB_CENTER_DIAMETER}px
        </p>
        <p
          className={`mt-1 text-sm font-semibold ${
            offenders == null
              ? "opacity-70"
              : offenders.length === 0
                ? "text-emerald-400"
                : "text-red-400"
          }`}
          role="status"
        >
          {offenders == null
            ? "Measuring…"
            : offenders.length === 0
              ? "✓ Zero overflow offenders — every name renders fully."
              : `✗ ${offenders.length} overflow offender(s):`}
        </p>
        {offenders && offenders.length > 0 && (
          <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-300">
            {offenders.map((o, i) => (
              <li key={i}>
                {o.variant}: {o.name} — spilled line “{o.line}”
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        {nodes.map((node) => {
          const candidate = toCandidate(node);
          return (
            <div key={node.songId} className="flex flex-col items-center gap-1">
              {ORB_DIAMETERS.map((d) => (
                <div
                  key={d}
                  data-fit-cell
                  data-fit-name={node.songName}
                  data-fit-variant={`orb-${d}`}
                  style={{ width: d, height: d }}
                  className="rounded-full"
                >
                  <PredictionOrb
                    candidate={candidate}
                    layout={orbLayout(node.songId, d)}
                    isWeak={false}
                    onTap={() => {}}
                    onWhy={() => {}}
                  />
                </div>
              ))}
              <div
                data-fit-cell
                data-fit-name={node.songName}
                data-fit-variant="center"
                style={{
                  width: config.show.ORB_CENTER_DIAMETER,
                  height: config.show.ORB_CENTER_DIAMETER,
                }}
                className="rounded-full"
              >
                <CenterNode songName={node.songName} songId={node.songId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
