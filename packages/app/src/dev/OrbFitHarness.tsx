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
 * rendered cell's `scrollWidth/scrollHeight` against its `clientWidth/clientHeight`
 * and lists any OVERFLOW offenders on-screen. Zero offenders = every name renders
 * fully at real sizes.
 *
 * Device flow (memory: device-uat-hosting): serve over the cloudflared HTTPS tunnel
 * (`--http-host-header localhost`), open `#/dev/orb-fit` on the iPhone, confirm the
 * banner reads zero offenders (watch the 44-char outlier
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
}

export function OrbFitHarness() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [offenders, setOffenders] = useState<Offender[] | null>(null);

  const nodes = matrix.nodes;

  useEffect(() => {
    // Measure AFTER layout+fonts settle: two rAFs push past the paint that applies
    // the fitted font sizes so scrollWidth/scrollHeight reflect the real glyph runs.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root) return;
        const cells = root.querySelectorAll<HTMLElement>("[data-fit-cell]");
        const found: Offender[] = [];
        cells.forEach((el) => {
          if (
            el.scrollWidth > el.clientWidth ||
            el.scrollHeight > el.clientHeight
          ) {
            found.push({
              name: el.dataset.fitName ?? "?",
              variant: el.dataset.fitVariant ?? "?",
            });
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
          {nodes.length} real catalog names · orb {config.show.ORB_MIN_DIAMETER}px &amp;{" "}
          {REPRESENTATIVE_SOLVED_PX}px · center {config.show.ORB_CENTER_DIAMETER}px
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
                {o.variant}: {o.name}
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
                  style={{ width: d, height: d, overflow: "hidden" }}
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
                  overflow: "hidden",
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
