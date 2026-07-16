/**
 * EXPL-01 root of `#/explore` — replaces PlaceholderView. Loads the bundled
 * transition matrix through the existing guarded `loadMatrix()` sentinel and, on
 * success, derives the constellation `{nodes, links}` (the SAME artifact + one
 * pipeline the predictor uses, CLAUDE.md) and hands it to `ConstellationCanvas`.
 *
 * A `loadMatrix().ok === false` (schemaVersion drift / corrupt artifact) renders
 * the calm error state from `config.copy.explore` — mirrors the Phase-4
 * model-load-failure pattern (T-07-03, ASVS V7): it blocks ONLY this view, never
 * a throw that bricks navigation. The AppShell header + BottomTabBar stay usable.
 *
 * Focus/filter/overlay state is owned here from the start (fields consumed by the
 * later Explore slices: focus-dim EXPL-05, rotation toggle EXPL-03, dex overlay
 * DEX-05). This slice wires only the render — the initial node population is the
 * FULL catalog; rotation-as-default and the edge slider arrive in later slices.
 * No Dexie writes (pure read/derive/render).
 */
import { useMemo, useState } from "react";
import { Telescope } from "lucide-react";
import { deriveConstellation } from "@guezzer/core";
import { config } from "../config.ts";
import { loadMatrix } from "../show/matrix.ts";
import { ConstellationCanvas } from "./ConstellationCanvas.tsx";

export function ExploreView() {
  // loadMatrix() is module-memoized — a stable result reference every render, so
  // the useMemo below re-derives the constellation exactly once.
  const result = loadMatrix();

  // Focus/filter/overlay state, owned from the start (consumed by later slices).
  const [focusId, setFocusId] = useState<number | null>(null);
  const [rotationOnly, setRotationOnly] = useState(true);
  const [dexOverlay, setDexOverlay] = useState(true);
  // Silence "declared but unused" until the slices that read/write them land —
  // referencing keeps the forward-looking state intentional, not dead.
  void [focusId, setFocusId, rotationOnly, setRotationOnly, dexOverlay, setDexOverlay];

  // Derive once, keyed on the (stable, memoized) load result. Null unless the
  // matrix loaded — hooks must run unconditionally, so the branch lives inside.
  const graphData = useMemo(
    () => (result.ok ? deriveConstellation(result.matrix) : null),
    [result],
  );

  // Guarded-load failure → the calm error state (never a throw). Split from the
  // success path so the discriminated union narrows cleanly.
  if (!result.ok || !graphData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Telescope size={32} className="mb-4 text-text-muted" aria-hidden />
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {config.copy.explore.errorHeading}
        </h1>
        <p className="mt-2 text-base leading-normal text-text-muted">
          {config.copy.explore.errorBody}
        </p>
      </div>
    );
  }

  return <ConstellationCanvas graphData={graphData} />;
}
