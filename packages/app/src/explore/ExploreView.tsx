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
import { useCallback, useMemo, useState } from "react";
import { Telescope } from "lucide-react";
import {
  deriveConstellation,
  rankOutgoing,
  rotationSongIds,
  type ConstellationNode,
} from "@guezzer/core";
import { config } from "../config.ts";
import { loadArchive } from "../dex/archive-loader.ts";
import { useDexStats } from "../dex/useDexStats.ts";
import { loadMatrix } from "../show/matrix.ts";
import { ConstellationCanvas } from "./ConstellationCanvas.tsx";
import { ExploreFilterFab } from "./ExploreFilterFab.tsx";
import { NodeSheet, type SheetBar } from "./NodeSheet.tsx";

export function ExploreView() {
  // loadMatrix() is module-memoized — a stable result reference every render, so
  // the useMemo below re-derives the constellation exactly once.
  const result = loadMatrix();

  // Focus is live (tap-to-focus + chain-hop). View + edge-threshold are live this
  // slice (07-05); the dex-overlay state stays forward-scaffold for 07-06.
  const [focusId, setFocusId] = useState<number | null>(null);
  // Rotation is the OPENING DEFAULT (D-03/D-12): the last-N-shows active sky.
  const [view, setView] = useState<"rotation" | "full">("rotation");
  // Edge-count slider default (D-07): ≥2 kills the misleading one-play edges.
  const [edgeThreshold, setEdgeThreshold] = useState<number>(
    config.explore.EDGE_COUNT_THRESHOLD_DEFAULT,
  );
  // Filter panel open? Owned HERE (not the FAB) so a canvas tap can collapse it
  // without a scrim — the graph must stay live while sliding (D-09).
  const [filterOpen, setFilterOpen] = useState(false);
  // Dex overlay is ON by default (D-10): the constellation opens as the Pokédex
  // made spatial. The switch (07-06 Task 2, via the filter panel) toggles it.
  const [dexOverlay, setDexOverlay] = useState(true);
  // Silence "declared but unused" until the Task-2 filter switch wires setter.
  void setDexOverlay;

  // The live dex — the SINGLE derivation path (useLiveQuery inside re-renders on a
  // Dex mark, recoloring the sky with zero second pipeline). Never blocks the
  // constellation: a not-ready / errored dex degrades to the neutral view (D-10),
  // so the overlay is only *active* once the derivation is genuinely ready.
  const dexStats = useDexStats();
  const dexReady = dexStats.ready && dexStats.error == null && dexStats.dex != null;
  const dexOverlayActive = dexOverlay && dexReady;
  const sightingsFor = useCallback(
    (songId: number): number =>
      dexReady && dexStats.dex
        ? dexStats.dex.perSong.get(songId)?.sightings ?? 0
        : 0,
    [dexReady, dexStats.dex],
  );

  // Derive once, keyed on the (stable, memoized) load result. Null unless the
  // matrix loaded — hooks must run unconditionally, so the branch lives inside.
  const graphData = useMemo(
    () => (result.ok ? deriveConstellation(result.matrix) : null),
    [result],
  );

  // Rotation node set (EXPL-03/D-05): the distinct songIds of the last N shows,
  // from the guarded, memoized archive loader (reused verbatim). A load failure
  // or empty archive → an empty Set (the honest "Nothing in rotation" state).
  // loadArchive() returns a stable cached reference, so this derives once.
  const archiveResult = loadArchive();
  const rotationSet = useMemo(
    () =>
      archiveResult.ok
        ? rotationSongIds(
            archiveResult.archive,
            config.explore.ROTATION_WINDOW_SHOWS,
          )
        : new Set<number>(),
    [archiveResult],
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

  // Rotation draw-gate (Pitfall 6, from 07-04): pass the rotation set as
  // visibleNodeIds — a pure render draw-gate. Full view passes null (everything
  // visible). The canvas ALWAYS unions in the focus + neighbors, so a chain-hop
  // to a filter-hidden song never lands the camera on empty space. graphData is
  // never rebuilt, so frozen fx/fy survive every toggle (the sky stays stable).
  const visibleNodeIds = view === "rotation" ? rotationSet : null;

  // Rotation view with an empty archive → the honest empty state (D-08). The FAB
  // stays available so the user can switch to Full catalog.
  const rotationEmpty = view === "rotation" && rotationSet.size === 0;

  // Any canvas tap collapses the filter panel (no scrim to catch it, D-09) and
  // applies the focus/clear.
  const handleFocus = (songId: number | null) => {
    setFilterOpen(false);
    setFocusId(songId);
  };

  return (
    <>
      <ConstellationCanvas
        graphData={graphData}
        focusId={focusId}
        onFocus={handleFocus}
        visibleNodeIds={visibleNodeIds}
        edgeThreshold={edgeThreshold}
        overlay={dexOverlayActive}
        sightingsFor={sightingsFor}
      />

      {/* Rotation-empty corpus edge case — a calm overlay, not an error. The
          canvas stays mounted beneath so switching to Full needs no remount. */}
      {rotationEmpty && (
        <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center px-4 text-center">
          <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
            {config.copy.explore.rotationEmptyHeading}
          </h2>
          <p className="mt-2 text-base leading-normal text-text-muted">
            {config.copy.explore.rotationEmptyBody}
          </p>
        </div>
      )}

      <ExploreFilterFab
        open={filterOpen}
        onOpenChange={setFilterOpen}
        view={view}
        onViewChange={setView}
        edgeThreshold={edgeThreshold}
        onEdgeThresholdChange={setEdgeThreshold}
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
