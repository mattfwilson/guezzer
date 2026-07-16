/**
 * EXPL-03 / EXPL-04: the Explore filter panel — the "shape the sky" controls that
 * expand upward out of `ExploreFilterFab`. A compact secondary-surface card (md
 * padding, hairline border, opening upward) with exactly three ≥44px control rows
 * top→bottom (07-UI-SPEC §Layout region 3):
 *
 *   1. Rotation | Full catalog segmented toggle (accent gold on the ACTIVE half
 *      ONLY — reserved-use precedent, same idiom as Phase-6's Albums|Shows) plus
 *      a muted helper line under Rotation. Rotation is the opening default (D-03/
 *      D-12); N is config-only (`ROTATION_WINDOW_SHOWS`) — there is deliberately
 *      NO second slider for the rotation window.
 *   2. Edge-count slider ("played together ≥ X times", range 1–10, default 2).
 *      Changes fire IMMEDIATELY — the slider is a pure render-pass edge filter in
 *      the canvas, no simulation reheat (D-07/D-09). A tabular-nums readout tracks
 *      the thumb.
 *   3. The dex-overlay switch (DEX-05/D-10) — now wired live: ExploreView owns the
 *      `dexOverlay`/`onDexOverlayChange` state, so the switch is fully interactive
 *      and toggles the sky overlay. It only falls back to a disabled/inert row when
 *      a parent omits the handler (`overlayReserved`), which no current caller does.
 *
 * NO scrim wraps this (the graph stays live while sliding, D-09) — that lives in
 * `ExploreFilterFab`. Every control is DOM + keyboard/AT operable with a gold
 * focus-visible ring. No hardcoded copy: every string is read from
 * `config.copy.explore`; every bound from `config.explore` (single-config-file).
 */
import { config } from "../config.ts";

export type ExploreView = "rotation" | "full";

interface ExploreFilterPanelProps {
  /** Active view — Rotation (opening default) or Full catalog. */
  view: ExploreView;
  /** Switch the drawn node population (render draw-gate; positions never churn). */
  onViewChange: (view: ExploreView) => void;
  /** Current edge-count threshold (links with count < this are hidden). */
  edgeThreshold: number;
  /** Live edge-slider handler — applied immediately in the render pass. */
  onEdgeThresholdChange: (threshold: number) => void;
  /**
   * The dex-overlay switch state + handler (DEX-05/D-10). ExploreView passes both
   * live, so the switch is interactive. Kept optional only for the fallback: if a
   * parent omits `onDexOverlayChange`, the row renders disabled/inert.
   */
  dexOverlay?: boolean;
  onDexOverlayChange?: (on: boolean) => void;
}

export function ExploreFilterPanel({
  view,
  onViewChange,
  edgeThreshold,
  onEdgeThresholdChange,
  dexOverlay,
  onDexOverlayChange,
}: ExploreFilterPanelProps) {
  const copy = config.copy.explore;
  const { EDGE_SLIDER_MIN, EDGE_SLIDER_MAX, ROTATION_WINDOW_SHOWS } = config.explore;
  const overlayReserved = onDexOverlayChange == null;

  return (
    <div
      role="group"
      aria-label={copy.filterFabAria}
      // Secondary surface, md padding, hairline border, opening upward. Width is
      // capped so the panel never spans the sky it is describing (D-09).
      className="mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-hairline bg-elevated p-4 shadow-lg"
    >
      {/* 1. Rotation | Full catalog segmented toggle — accent ONLY on the active
             half (reserved accent use, §Color). Same idiom as DexView's segment. */}
      <div className="flex gap-1 rounded-md border border-hairline bg-surface p-1">
        {(["rotation", "full"] as const).map((v) => {
          const active = view === v;
          const label = v === "rotation" ? copy.toggleRotation : copy.toggleFull;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(v)}
              className={`flex min-h-11 flex-1 items-center justify-center rounded text-[14px] font-semibold touch-manipulation focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-accent/20 text-text-primary" : "text-text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Rotation helper — N interpolated from config, never hardcoded. */}
      <p className="mt-1 text-[12px] leading-tight text-text-muted">
        {copy.rotationHelper(ROTATION_WINDOW_SHOWS)}
      </p>

      {/* 2. Edge-count slider — "played together ≥ X". Live: fires immediately as
             a render-pass edge filter, no reheat (D-07). Row ≥44px tall. */}
      <div className="mt-4 flex min-h-11 flex-col justify-center">
        <div className="flex items-baseline justify-between">
          <label htmlFor="explore-edge-slider" className="text-[14px] font-semibold text-text-primary">
            {copy.edgeSliderLabel(edgeThreshold)}
          </label>
          <span className="text-[14px] text-text-muted tabular-nums">{edgeThreshold}</span>
        </div>
        <input
          id="explore-edge-slider"
          type="range"
          min={EDGE_SLIDER_MIN}
          max={EDGE_SLIDER_MAX}
          step={1}
          value={edgeThreshold}
          onChange={(e) => onEdgeThresholdChange(Number(e.target.value))}
          aria-valuetext={copy.edgeSliderLabel(edgeThreshold)}
          className="mt-2 h-11 w-full cursor-pointer accent-accent touch-manipulation focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {/* 3. Dex-overlay switch — wired live (DEX-05/D-10): toggles the sky overlay.
             Only disabled/inert in the fallback where a parent omits the handler
             (`overlayReserved`); the label always reads (My dex overlay). */}
      <div className="mt-4 flex min-h-11 items-center justify-between">
        <span className={`text-[14px] font-semibold ${overlayReserved ? "text-text-muted" : "text-text-primary"}`}>
          {copy.overlaySwitch}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={dexOverlay ?? false}
          disabled={overlayReserved}
          onClick={() => onDexOverlayChange?.(!(dexOverlay ?? false))}
          className={`relative h-6 w-11 shrink-0 rounded-full border border-hairline transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            dexOverlay ? "bg-accent/30" : "bg-surface"
          } ${overlayReserved ? "opacity-40" : ""}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-text-primary transition-transform ${
              dexOverlay ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
