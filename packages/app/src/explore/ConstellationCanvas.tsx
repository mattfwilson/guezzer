/**
 * EXPL-01 / EXPL-06: the single force-directed constellation component (CLAUDE.md
 * "single component, one pipeline"). Wraps `<ForceGraph2D>` (react-force-graph-2d,
 * canvas engine) fed by the pure-core `deriveConstellation` `{nodes, links}` — the
 * SAME matrix artifact the predictor consumes. This is the app's first non-DOM
 * (canvas) view; every later Explore slice (ranked bars, filters, dex overlay)
 * layers onto this render surface.
 *
 * Responsibilities kept deliberately narrow this slice:
 *  - Measure the container (ResizeObserver) and pass width/height to ForceGraph2D
 *    (RESEARCH Pitfall 2 — it defaults to window dims and overflows `<main>`).
 *  - Draw every node through ONE `nodeCanvasObject` (mode 'replace'): tuning-color
 *    fill (§B1), zoom-gated + top-K-at-rest label (D-15), `ctx.fillText` only —
 *    never innerHTML, so kglw-derived song names cannot inject (T-07-02).
 *  - Enforce the 22px screen-space tap floor via `nodePointerAreaPaint` regardless
 *    of visual radius (44px equivalence, SHOW-02 orb-floor analog).
 *  - Settle-and-freeze (EXPL-06): `cooldownTicks` + `onEngineStop` fixes fx/fy on
 *    every node so pan/zoom never reheats and labels never jitter permanently.
 *
 * All geometry/physics constants come from `config.explore` (single-config-file
 * ethos, CLAUDE.md) — no magic numbers here. The `fgRef` is held for the camera
 * control (centerAt/zoom) that chain-hop focus needs in a later slice.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import type {
  ConstellationData,
  ConstellationLink,
  ConstellationNode,
} from "@guezzer/core";
import { config } from "../config.ts";
import { tuningColor } from "../show/tuningColor.ts";

/** System font stack (inherited, 07-UI-SPEC §Typography) — also the canvas font. */
const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Neutral edge stroke — text-muted (#A1A1AA) at 20% opacity (§B3, never tuning-colored). */
const EDGE_COLOR = "rgba(161, 161, 170, 0.2)";

/** Zoom-revealed labels at rest render in text-muted (§Color, §B4). */
const LABEL_COLOR = "#a1a1aa";

/** Fully-typed node/link the canvas callbacks receive after the engine augments them with x/y/fx/fy. */
type FgNode = NodeObject<ConstellationNode>;
type FgLink = LinkObject<ConstellationNode, ConstellationLink>;
type FgMethods = ForceGraphMethods<FgNode, FgLink>;

/**
 * Visual node radius: `NODE_RADIUS_MIN + sqrt(playCount)`, clamped to
 * `NODE_RADIUS_MAX` (world units, §Layout region 2). The hit area is decoupled
 * from this in `nodePointerAreaPaint` so small stars never tap small.
 */
function radiusFor(playCount: number): number {
  const { NODE_RADIUS_MIN, NODE_RADIUS_MAX } = config.explore;
  return Math.min(NODE_RADIUS_MAX, NODE_RADIUS_MIN + Math.sqrt(playCount));
}

/** Ellipsize a canvas label at LABEL_MAX_CHARS (focused node is exempt — no focus this slice). */
function ellipsize(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function ConstellationCanvas({
  graphData,
}: {
  /** The pure-core-derived `{nodes, links}` — owned by the graph once passed (Pitfall 1). */
  graphData: ConstellationData;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Held for camera control (centerAt/zoom) the chain-hop focus needs in a later slice.
  const fgRef = useRef<FgMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // OrbitStage's ResizeObserver container-sizing pattern (Pitfall 2): measure the
  // real px box and feed width/height to ForceGraph2D so the canvas never defaults
  // to window dims and overflows under the BottomTabBar.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Top-K-by-playCount label set computed ONCE (memoized off graphData), never per
  // draw call. These biggest nodes carry labels even at rest (D-15).
  const topKIds = useMemo(() => {
    const k = config.explore.LABEL_AT_REST_TOP_K;
    return new Set(
      [...graphData.nodes]
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, k)
        .map((n) => n.id),
    );
  }, [graphData]);

  const nodeCanvasObject = (
    node: FgNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    if (node.x == null || node.y == null) return;
    const r = radiusFor(node.playCount);

    // 1. Node fill — tuning-family data color (§B1), null → neutral fallback.
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = tuningColor(node.tuningFamily);
    ctx.fill();

    // 2. Zoom-gated label (D-15): drawn past the zoom threshold OR for the top-K
    //    biggest nodes at rest. Constant screen-space size via fontPx/globalScale.
    const showLabel =
      globalScale >= config.explore.LABEL_ZOOM_THRESHOLD || topKIds.has(node.id);
    if (showLabel) {
      const fontPx = 12 / globalScale;
      ctx.font = `${fontPx}px ${FONT_STACK}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = LABEL_COLOR;
      // fillText only — canvas text is inherently non-executing (T-07-02).
      ctx.fillText(
        ellipsize(node.name, config.explore.LABEL_MAX_CHARS),
        node.x,
        node.y + r + 2 / globalScale,
      );
    }
  };

  // Pointer-area floor independent of visual radius: at least NODE_HIT_MIN_RADIUS_PX
  // screen-space (÷ globalScale → world) so every node clears the 44px tap target.
  const nodePointerAreaPaint = (
    node: FgNode,
    color: string,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    if (node.x == null || node.y == null) return;
    const hitR = Math.max(
      radiusFor(node.playCount),
      config.explore.NODE_HIT_MIN_RADIUS_PX / globalScale,
    );
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, hitR, 0, 2 * Math.PI);
    ctx.fill();
  };

  return (
    <div
      ref={stageRef}
      role="img"
      aria-label={`Song transition constellation — ${graphData.nodes.length} songs shown`}
      className="relative flex-1 touch-none select-none overflow-hidden bg-surface"
      style={{ overscrollBehavior: "none" }}
    >
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D<ConstellationNode, ConstellationLink>
          ref={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#0c0c10"
          // Node draw: one replace-mode callback owns fill + label (§Color/§Typography).
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          // Directed, count-weighted neutral edges (§B3). Width clamps to 4px max.
          linkColor={() => EDGE_COLOR}
          linkWidth={(l: FgLink) =>
            Math.min(4, 0.5 + Math.sqrt(l.count ?? 0) * 0.5)
          }
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={0.9}
          linkDirectionalArrowColor={() => EDGE_COLOR}
          // Settle-and-freeze physics (EXPL-06). On stop, fix every node so pan/zoom
          // never reheats and labels never jitter permanently.
          cooldownTicks={config.explore.COOLDOWN_TICKS}
          d3AlphaDecay={config.explore.ALPHA_DECAY}
          d3VelocityDecay={config.explore.VELOCITY_DECAY}
          onEngineStop={() => {
            for (const raw of graphData.nodes) {
              const n = raw as FgNode;
              n.fx = n.x;
              n.fy = n.y;
            }
          }}
        />
      )}
    </div>
  );
}
