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
import {
  deriveConstellation,
  rankOutgoing,
  type ConstellationNode,
} from "@guezzer/core";
import { config } from "../config.ts";
import { loadMatrix } from "../show/matrix.ts";
import { ConstellationCanvas } from "./ConstellationCanvas.tsx";
import { NodeSheet, type SheetBar } from "./NodeSheet.tsx";

export function ExploreView() {
  // loadMatrix() is module-memoized — a stable result reference every render, so
  // the useMemo below re-derives the constellation exactly once.
  const result = loadMatrix();

  // Focus is live this slice (tap-to-focus + chain-hop). Filter/overlay state is
  // still forward-scaffold — consumed by the rotation toggle (07-05) and dex
  // overlay (07-06) slices.
  const [focusId, setFocusId] = useState<number | null>(null);
  const [rotationOnly, setRotationOnly] = useState(true);
  const [dexOverlay, setDexOverlay] = useState(true);
  // Silence "declared but unused" until the slices that read/write them land —
  // referencing keeps the forward-looking state intentional, not dead.
  void [rotationOnly, setRotationOnly, dexOverlay, setDexOverlay];

  // Derive once, keyed on the (stable, memoized) load result. Null unless the
  // matrix loaded — hooks must run unconditionally, so the branch lives inside.
  const graphData = useMemo(
    () => (result.ok ? deriveConstellation(result.matrix) : null),
    [result],
  );

  // songId → node (name / playCount / tuningFamily) for the sheet header + bar
  // target resolution. Every matrix edge target is a matrix node, so every bar
  // resolves here.
  const nodeById = useMemo(() => {
    const m = new Map<number, ConstellationNode>();
    if (graphData) for (const n of graphData.nodes) m.set(n.id, n);
    return m;
  }, [graphData]);

  // Ranked outgoing bars for the focused node — the COMPLETE raw history straight
  // off the matrix (D-01/D-03), NEVER the drawn/filtered links and NEVER predict().
  // Null unless a node is focused. Chain-hop re-runs this for the new focus.
  const ranked = useMemo(
    () => (result.ok && focusId != null ? rankOutgoing(result.matrix, focusId) : null),
    [result, focusId],
  );

  // Resolve each bar's target name + tuning family (bar fill) from the node map.
  const sheetBars = useMemo<SheetBar[]>(() => {
    if (!ranked) return [];
    return ranked.bars.map((bar) => {
      const target = nodeById.get(bar.songId);
      return {
        bar,
        targetName: target?.name ?? "",
        targetTuningFamily: target?.tuningFamily ?? "other",
      };
    });
  }, [ranked, nodeById]);

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

  // The focused node (for the sheet header); undefined when nothing is focused.
  const focusNode = focusId != null ? nodeById.get(focusId) : undefined;

  return (
    <>
      <ConstellationCanvas
        graphData={graphData}
        focusId={focusId}
        onFocus={setFocusId}
      />
      {focusId != null && focusNode && ranked && (
        <NodeSheet
          songName={focusNode.name}
          playCount={focusNode.playCount}
          total={ranked.total}
          bars={sheetBars}
          onSelect={setFocusId}
          onClose={() => setFocusId(null)}
        />
      )}
    </>
  );
}
