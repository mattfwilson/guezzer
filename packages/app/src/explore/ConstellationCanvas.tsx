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
import {
  topKEdgesPerNode,
  type ConstellationData,
  type ConstellationLink,
  type ConstellationNode,
} from "@guezzer/core";
import { config } from "../config.ts";
import { tuningColor } from "../show/tuningColor.ts";
import { ExploreBackground } from "./ExploreBackground.tsx";
import { useVisibleViewportHeight } from "./useVisibleViewportHeight.ts";
// Depth draw-pass color helpers (quick task 260717-ual). The format-agnostic
// parseColor / mixColor / fadeToward / sphereGradient live in depthColor.ts so the
// spike-001 bug #1 blend (hex AND rgb() inputs, never NaN) is unit-tested in
// isolation; the canvas draw pass below consumes them.
import { fadeToward, lerp, sphereGradient } from "./depthColor.ts";

/** System font stack (inherited, 07-UI-SPEC §Typography) — also the canvas font. */
const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Neutral edge stroke — text-muted (#A1A1AA), alpha varies with focus state (§B3). */
const rgbaMuted = (alpha: number) => `rgba(161, 161, 170, ${alpha})`;

/** Base edge stroke opacity — text-muted at 20% (§B3, never tuning-colored). The
 *  depth pass modulates this base by the edge's endpoint-avg z (quick task 260717-ual). */
const EDGE_BASE_OPACITY = 0.2;

/** Focus state: neighborhood edges lift to 70% opacity, same hue (§B3/§B4). */
const EDGE_HIGHLIGHT_COLOR = rgbaMuted(0.7);

/** Zoom-revealed labels at rest render in text-muted (§Color, §B4). */
const LABEL_COLOR = "#a1a1aa";

/** Focused-node selection ring — accent gold, reserved use (§Color reserved list). */
const FOCUS_RING_COLOR = "#F2C14E";

/** Focused node + neighbor labels render in text-primary (§Color, §Typography). */
const FOCUS_LABEL_COLOR = "#F5F5F7";

/** hit-green (§B2) — caught sighting ring + count pill; reused, never re-derived. */
const SIGHTING_RING_COLOR = "#22C55E";

/** Dark surface (#0C0C10) — the count-pill text on the green fill (clears 4.5:1). */
const SIGHTING_COUNT_TEXT = "#0C0C10";

/**
 * Depth-fade target (#0C0C10) — the far end of the synthetic-z axis fades node
 * base colors toward the deep-space surface (quick task 260717-ual). Same value as
 * SIGHTING_COUNT_TEXT / the wrapper's bg-surface; named separately so the depth
 * pass reads intent, not a re-derived literal (single-config ethos).
 */
const DEPTH_SURFACE = "#0C0C10";

/**
 * Desaturate a `#RRGGBB` fill to its grayscale-luminance equivalent (§B4 dex-dim
 * silhouette). Rec-601 luma so the unseen star keeps its relative brightness but
 * loses all tuning hue — "dim = dex", unambiguous against the caught full-color
 * sky. Non-hex input (never expected from `tuningColor`) falls through unchanged.
 */
function grayscaleOf(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `rgb(${luma}, ${luma}, ${luma})`;
}

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
  focusId,
  onFocus,
  visibleNodeIds,
  topK,
  overlay = false,
  sightingsFor,
}: {
  /** The pure-core-derived `{nodes, links}` — owned by the graph once passed (Pitfall 1). */
  graphData: ConstellationData;
  /** The currently-focused song id, or null when nothing is focused (EXPL-05/D-13). */
  focusId: number | null;
  /** Tap a node → focus it; tap empty canvas → clear (passes null). */
  onFocus: (songId: number | null) => void;
  /**
   * DEX-05/D-10 dex overlay — ON by default in ExploreView (the constellation
   * opens as the Pokédex made spatial). When ON, caught songs keep full tuning
   * color + a green sighting ring, unseen songs render as `DEX_DIM_OPACITY`
   * grayscale silhouettes. When OFF, every node is neutral full tuning color
   * (dim = data, not dex). A PURE render-pass flag — toggling it never rebuilds
   * `graphData` and never reheats (`useDexStats`/`useLiveQuery` already re-renders
   * on a Dex mark, recoloring the sky live with zero second derivation).
   */
  overlay?: boolean;
  /**
   * Live sightings accessor from `useDexStats` (`dex.perSong.get(id)?.sightings`),
   * the SINGLE dex derivation path. `> 0` → caught. Only read when `overlay` is
   * ON; omitted/undefined behaves as "no sightings" so the canvas degrades to the
   * neutral view if the dex derivation ever errors (never blocks the sky).
   */
  sightingsFor?: (songId: number) => number;
  /**
   * Slice-3 seam (Pitfall 6): the filtered node population to draw. `null`/omitted
   * draws the full catalog. The focused node + its neighbors are ALWAYS drawn
   * regardless of this set ("visible = filtered ∪ {focus, neighbors}"), so a
   * chain-hop never lands the camera on empty space. The 07-05 Rotation view
   * passes its rotation songId Set here — a pure DRAW-GATE that never rebuilds
   * `graphData`, so frozen fx/fy survive every toggle (the sky stays stable).
   */
  visibleNodeIds?: ReadonlySet<number> | null;
  /**
   * EXPL-04 top-K-per-node declutter slider (D-07/D-08): draw only each song's K
   * highest-count OUT edges (degree-aware `topKEdgesPerNode`), NOT a global count
   * gate. A pure RENDER-PASS filter — nodes are untouched, so a node whose edges
   * are all sparsified out stays a free-floating star. A focused node ALWAYS
   * reveals its FULL real neighborhood past this gate (focus exemption below).
   * `null`/omitted → no sparsification (full truth). Changing K never rebuilds
   * `graphData` and never reheats the simulation: the derived kept-link identity
   * Set is memoized and the `linkVisibility` predicate reads it per-link, so the
   * links array is never re-created and frozen fx/fy survive (EXPL-06).
   */
  topK?: number | null;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Held for camera control (centerAt/zoom) the chain-hop focus needs in a later slice.
  const fgRef = useRef<FgMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // UX-04: gate the onEngineStop zoomToFit so it fires ONLY on the FIRST settle per
  // graphData change (a genuine Rotation ↔ Full-catalog view switch), never on the
  // inert reheats a resize/filter triggers. The camera belongs to the user — a
  // resize is not a request to reframe. Reset to true only when graphData rebuilds
  // (Pitfall 4: filters like topK/overlay/visibleNodeIds provably never rebuild
  // graphData, only a view change does — so the reset key is strictly [graphData]).
  const firstSettleRef = useRef(true);

  // UX-04: remembers the (focusId, graphData) the focus-camera effect last FRAMED, so
  // that effect can tell a genuine new-focus / view-switch (re-frame at FOCUS_ZOOM_K,
  // unchanged behavior) apart from a pure container resize of the SAME focused node
  // (pan-only, and only when the node has actually left the viewport).
  const focusFrameKeyRef = useRef<{
    focusId: number;
    graphData: ConstellationData;
  } | null>(null);

  // A11Y-03: the SAME shared visible-viewport source the NodeSheet peek + FAB lift
  // read. The container ResizeObserver already catches element-box resizes (address-
  // bar collapse, orientation, Android keyboard that reflows the layout box), but
  // the iOS on-screen keyboard shrinks ONLY `visualViewport` — the constellation
  // box is unchanged — so `size.height` alone would miss it and the camera would
  // snap off the focused node. Threading this into the focus-camera effect's deps
  // (below) re-frames the focused node on ANY visible-viewport change.
  const visibleViewportHeight = useVisibleViewportHeight();

  // Nebula motion-parallax (quick task 260717-ual): the DAMPED graph transform the
  // sky follows, sourced from `<ForceGraph2D onZoom>` (interaction-driven only —
  // respects force-graph's autoPauseRedraw / EXPL-06). null until the first
  // pan/zoom → the nebula renders static (byte-identical to before). Setting this is
  // a pure sibling CSS transform: it never rebuilds graphData, never reheats d3, and
  // never touches fx/fy.
  const [bgParallax, setBgParallax] = useState<{
    x: number;
    y: number;
    k: number;
  } | null>(null);

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

  // Spread the sky (07-03 device spike): d3-force's tight defaults (charge ~-30,
  // link distance ~30) clump ~264 nodes into an unreadable ball. Push the charge
  // repulsion and link rest-length out — from config, no magic numbers — so edges
  // and connections are legible. Configured imperatively via the sim's forces (the
  // library exposes no charge/link-distance props) and reheated so it takes effect
  // on the first settle. Once onEngineStop pins fx/fy, later reheats are inert, so
  // a resize never reshuffles the frozen layout.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge") as
      | { strength(s: number): unknown }
      | undefined;
    charge?.strength(config.explore.CHARGE_STRENGTH);
    const link = fg.d3Force("link") as
      | { distance(d: number): unknown }
      | undefined;
    link?.distance(config.explore.LINK_DISTANCE);
    fg.d3ReheatSimulation();
  }, [graphData, size.width, size.height]);

  // UX-04: a genuine view switch (Rotation ↔ Full catalog) rebuilds graphData and
  // legitimately warrants a fresh fit — arm the first-settle gate. Keyed STRICTLY on
  // [graphData] (never [size] or a filter dep, Pitfall 4): the spacing effect above
  // reheats on size changes too, but its async onEngineStop must NOT re-fit then.
  // Timing is safe: onEngineStop fires after cooldownTicks, i.e. after this reset
  // effect has already run, so the flag is reliably true before the first post-change
  // settle.
  useEffect(() => {
    firstSettleRef.current = true;
  }, [graphData]);

  // Node ids that carry at least one edge — the "main grouping" the on-load camera
  // frames. Uses the immutable fromId/toId copies, never the post-tick-mutated
  // source/target (Pitfall 1). Free-floating stars (common once the edge slider
  // hides weak edges in a later slice) are excluded so they never drag the fit out.
  const connectedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const l of graphData.links) {
      ids.add(l.fromId);
      ids.add(l.toId);
    }
    return ids;
  }, [graphData]);

  // Declutter kept-link identity Set (EXPL-04/EXPL-06): each source song's K
  // highest-count OUT edges, keyed by the immutable "fromId->toId" string so
  // membership is stable across the library mutating source/target post-tick
  // (Pitfall 1). `topK == null` → null (no sparsification, full truth). Memoized
  // on [graphData, topK] so toggling K recomputes ONLY this derived Set — the node
  // objects and their frozen fx/fy are never rebuilt, so the sim never reheats.
  const keptLinkSet = useMemo(() => {
    if (topK == null) return null;
    return new Set(
      topKEdgesPerNode(graphData.links, topK).map((l) => `${l.fromId}->${l.toId}`),
    );
  }, [graphData, topK]);

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

  // Focus neighborhood (EXPL-05/D-13): the set of node ids with an in/out edge to
  // the focused node. Computed from the immutable fromId/toId copies — NEVER the
  // post-tick-mutated source/target (Pitfall 1). Empty when nothing is focused.
  const neighborIds = useMemo(() => {
    const ids = new Set<number>();
    if (focusId == null) return ids;
    for (const l of graphData.links) {
      if (l.fromId === focusId) ids.add(l.toId);
      else if (l.toId === focusId) ids.add(l.fromId);
    }
    return ids;
  }, [graphData, focusId]);

  // Depth lookup (quick task 260717-ual): songId → synthetic z (0..1, 1=nearest),
  // derived in pure core (`deriveConstellation`). Keyed on the immutable node id so
  // the depth-weighted edge pass can read BOTH endpoints' z by fromId/toId (Pitfall
  // 1 — never the post-tick-mutated source/target). Memoized off graphData; pure
  // render data, so building it never rebuilds graphData or reheats the sim.
  const nodeZById = useMemo(() => {
    const m = new Map<number, number>();
    for (const n of graphData.nodes) m.set(n.id, n.z);
    return m;
  }, [graphData]);

  // Per-edge depth = the average z of its two endpoints (missing → 0 = far). Drives
  // the subtle depth width/opacity weighting layered under the count width + focus
  // tint. Reads the immutable fromId/toId copies (Pitfall 1).
  const edgeZ = (l: FgLink): number => {
    const zf = nodeZById.get(l.fromId) ?? 0;
    const zt = nodeZById.get(l.toId) ?? 0;
    return (zf + zt) / 2;
  };

  // Visible-set rule (Pitfall 6): a node is drawn if it's in the filtered set OR
  // it's the focus / a neighbor (temporary filter exemption while focused, D-03).
  // `visibleNodeIds == null` (this slice) → everything visible. The focus node
  // object always survives in graphData, so its frozen x/y is always camera-able.
  const isNodeVisible = (id: number): boolean =>
    visibleNodeIds == null ||
    visibleNodeIds.has(id) ||
    id === focusId ||
    neighborIds.has(id);

  // Focus-dim (§B4): focused node + neighborhood keep full opacity; everything
  // else drops to FOCUS_DIM_OPACITY (0.12). No focus → everything full.
  const isInNeighborhood = (id: number): boolean =>
    focusId == null || id === focusId || neighborIds.has(id);

  // Chain-hop / focus camera (D-13/D-16): ease the focused node into the upper 60%
  // of the viewport (above the 40% peek sheet) at FOCUS_ZOOM_K. prefers-reduced-
  // motion → instant jump (0ms). The on-load zoomToFit (onEngineStop) is untouched;
  // this only fires while a node is focused.
  useEffect(() => {
    if (focusId == null) {
      focusFrameKeyRef.current = null;
      return;
    }
    const fg = fgRef.current;
    if (!fg) return;
    const node = graphData.nodes.find((n) => n.id === focusId) as
      | FgNode
      | undefined;
    if (!node || node.x == null || node.y == null) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const ms = reduced ? 0 : config.explore.FOCUS_CAMERA_DURATION_MS;

    // Distinguish a genuine (re)frame — a new focus or a view switch (graphData) —
    // from a pure container-resize re-run of the SAME focused node (UX-04). Only the
    // latter is gated on the off-screen test; the former keeps the original behavior.
    const prev = focusFrameKeyRef.current;
    const isFreshFrame =
      prev == null || prev.focusId !== focusId || prev.graphData !== graphData;
    focusFrameKeyRef.current = { focusId, graphData };

    if (isFreshFrame) {
      // Initial focus / chain-hop (D-13/D-16, unchanged): frame at FOCUS_ZOOM_K with
      // the node in the upper 60% (above the 40%-peek NodeSheet). `size.height` /
      // `visibleViewportHeight` in the deps (A11Y-03) also re-issue this move on an
      // iOS keyboard show/hide, which changes visualViewport but not the container box.
      const k = config.explore.FOCUS_ZOOM_K;
      const offsetWorld =
        ((0.5 - config.explore.FOCUS_TARGET_TOP_FRACTION) * size.height) / k;
      fg.zoom(k, ms);
      fg.centerAt(node.x, node.y + offsetWorld, ms);
      return;
    }

    // UX-04 resize path: a container resize (address-bar collapse / orientation /
    // keyboard) re-ran this effect for the SAME focused node. The camera belongs to
    // the user — do NOT reframe. Pan back ONLY if the node has actually left the
    // viewport, and keep the user's CURRENT zoom `k` (pan-only, never FOCUS_ZOOM_K —
    // Open Question 3 / Pitfall 5). A still-visible focus is left untouched.
    const margin = config.explore.FOCUS_OFFSCREEN_MARGIN_PX;
    const screen = fg.graph2ScreenCoords(node.x, node.y);
    const offscreen =
      screen.x < -margin ||
      screen.y < -margin ||
      screen.x > size.width + margin ||
      screen.y > size.height + margin;
    if (!offscreen) return;
    const k = fg.zoom();
    const offsetWorld =
      ((0.5 - config.explore.FOCUS_TARGET_TOP_FRACTION) * size.height) / k;
    fg.centerAt(node.x, node.y + offsetWorld, ms);
  }, [focusId, graphData, size.width, size.height, visibleViewportHeight]);

  const nodeCanvasObject = (
    node: FgNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    if (node.x == null || node.y == null) return;
    const focused = node.id === focusId;
    const neighbor = focusId != null && neighborIds.has(node.id);

    // Depth (quick task 260717-ual): synthetic z ∈ [0,1] (1 = nearest), pure-core
    // derived. VISUAL radius is scaled by z (near advances, far recedes) — the hit
    // area in nodePointerAreaPaint keeps the UNSCALED radiusFor so the 22px tap floor
    // is never shrunk by depth. `depthAlpha` and the color-fade toward the surface
    // give near/far contrast even under the uniform dex-dim veil (spike finding #2).
    const dz = config.explore.depth;
    const z = node.z;
    const r = radiusFor(node.playCount) * lerp(dz.DEPTH_RADIUS_FAR, dz.DEPTH_RADIUS_NEAR, z);
    const depthAlpha = lerp(dz.DEPTH_OPACITY_FAR, dz.DEPTH_OPACITY_NEAR, z);

    // Dex-overlay state (DEX-05/§B4). Only meaningful when `overlay` is ON; OFF →
    // caught/unseen both false, so every node stays neutral full tuning color
    // (dim = data, not dex). `sightingsFor` is the single dex path (useDexStats).
    const sightings = overlay && sightingsFor ? sightingsFor(node.id) : 0;
    const caught = overlay && sightings > 0;
    const unseen = overlay && sightings === 0;

    // Two-dim contract (§B4): focus-dim (0.12 outside the focused neighborhood)
    // and dex-dim (0.35 unseen silhouette) combine by the MINIMUM opacity, NEVER
    // by multiplication — an unseen non-neighbor reads at 0.12, not 0.35 × 0.12,
    // so the two states never compound into an illegible mud. globalAlpha carries
    // the resolved dim through every draw below (fill, rings, count, label).
    const focusAlpha = isInNeighborhood(node.id)
      ? 1
      : config.explore.FOCUS_DIM_OPACITY;
    const dexAlpha = unseen ? config.explore.DEX_DIM_OPACITY : 1;
    ctx.save();
    // D-D: fold depth into the existing dim contract by a GENTLE multiply, clamped
    // to DEPTH_ALPHA_FLOOR so a far + focus-dimmed node never fully vanishes (the
    // spike's naked-multiply risk). Radius scaling + color-fade are NOT alpha-gated,
    // so near/far contrast still reads under the uniform dex-dim veil.
    ctx.globalAlpha = Math.max(
      dz.DEPTH_ALPHA_FLOOR,
      Math.min(focusAlpha, dexAlpha) * depthAlpha,
    );

    // 1. Node fill — a spherical-shaded ball (offset highlight → base → rim shadow)
    //    over the depth-faded base color. The base is full tuning color (§B1) when
    //    caught / overlay OFF, or a grayscale-luminance silhouette when unseen under
    //    the overlay (dex-dim); EITHER is then faded toward the surface #0C0C10 by
    //    depth ((1-z)·DEPTH_FADE_MAX) so far stars recede in BOTH paths (spike finding
    //    #2). Preserves the tuning HUE — only shaded/scaled/faded.
    const baseColor = tuningColor(node.tuningFamily);
    const rawBase = unseen ? grayscaleOf(baseColor) : baseColor;
    const depthBase = fadeToward(rawBase, DEPTH_SURFACE, (1 - z) * dz.DEPTH_FADE_MAX);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = sphereGradient(ctx, node.x, node.y, r, depthBase);
    ctx.fill();

    // 2. Sighting ring (§B2): a caught node wears a 1.5px screen-space green ring
    //    just outside its fill — the "you've caught this live" signal. Unseen
    //    nodes get no ring (their dimmed silhouette is the whole statement).
    if (caught) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 1.5 / globalScale, 0, 2 * Math.PI);
      ctx.lineWidth = 1.5 / globalScale;
      ctx.strokeStyle = SIGHTING_RING_COLOR;
      ctx.stroke();
    }

    // 3. Focus ring (§Color reserved list): a 2px screen-space gold stroke on the
    //    focused node only — the constellation's one-active-selection signal.
    if (focused) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2 / globalScale, 0, 2 * Math.PI);
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = FOCUS_RING_COLOR;
      ctx.stroke();
    }

    // 4. Sighting count (D-11): draw the number inside a small green pill above a
    //    caught node ONLY past COUNT_ZOOM_THRESHOLD — no 264-badge soup at rest.
    //    Reuses the 07-03-verified zoom gate (same globalScale mechanism labels
    //    use). fillText only — canvas text is inherently non-executing (T-07-02).
    if (caught && globalScale >= config.explore.COUNT_ZOOM_THRESHOLD) {
      const label = String(sightings);
      const fontPx = 11 / globalScale;
      ctx.font = `600 ${fontPx}px ${FONT_STACK}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const padX = 4 / globalScale;
      const padY = 2 / globalScale;
      const textW = ctx.measureText(label).width;
      const pillW = textW + padX * 2;
      const pillH = fontPx + padY * 2;
      const cx = node.x;
      const cy = node.y - r - pillH / 2 - 2 / globalScale;
      const rad = pillH / 2;
      // Rounded-rect pill via arcTo (roundRect isn't universally available).
      ctx.beginPath();
      ctx.moveTo(cx - pillW / 2 + rad, cy - pillH / 2);
      ctx.arcTo(cx + pillW / 2, cy - pillH / 2, cx + pillW / 2, cy + pillH / 2, rad);
      ctx.arcTo(cx + pillW / 2, cy + pillH / 2, cx - pillW / 2, cy + pillH / 2, rad);
      ctx.arcTo(cx - pillW / 2, cy + pillH / 2, cx - pillW / 2, cy - pillH / 2, rad);
      ctx.arcTo(cx - pillW / 2, cy - pillH / 2, cx + pillW / 2, cy - pillH / 2, rad);
      ctx.closePath();
      ctx.fillStyle = SIGHTING_RING_COLOR;
      ctx.fill();
      ctx.fillStyle = SIGHTING_COUNT_TEXT;
      ctx.fillText(label, cx, cy);
    }

    // 5. Label moved to a dedicated TOP pass (drawNodeLabel via onRenderFramePost,
    //    quick task 260718-12j): react-force-graph-2d paints nodes one-at-a-time, so
    //    a label drawn here could be overpainted by a LATER node's orb fill or sit
    //    below edge lines. Drawing every label AFTER all links/arrows/nodes render
    //    guarantees labels always paint on top. Blocks 1-4 stay in the node pass.
    ctx.restore();
  };

  // Label top pass (quick task 260718-12j): drawn from onRenderFramePost AFTER every
  // link, arrow, and node, in the same world transform, so labels never get
  // overpainted. Because onRenderFramePost iterates ALL nodes manually (it does NOT
  // get the `nodeVisibility` filter the node pass benefits from), this replicates the
  // exact per-node state the node pass computed: the visibility gate, depth radius,
  // combined focus/dex/depth alpha, and the zoom/top-K/focus-forced showLabel gate.
  // Font/color/ellipsize/fillText are byte-identical to the old inline block.
  const drawNodeLabel = (
    node: FgNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    if (node.x == null || node.y == null) return;
    // Replicate the nodeVisibility gate the node pass got for free — never relabel a
    // filtered-out node (rotation view / declutter leave hidden nodes in graphData).
    if (!isNodeVisible(node.id)) return;

    const focused = node.id === focusId;
    const neighbor = focusId != null && neighborIds.has(node.id);

    // Depth-scaled radius for the label y-offset — SAME formula as the node pass.
    const dz = config.explore.depth;
    const z = node.z;
    const r = radiusFor(node.playCount) * lerp(dz.DEPTH_RADIUS_FAR, dz.DEPTH_RADIUS_NEAR, z);
    const depthAlpha = lerp(dz.DEPTH_OPACITY_FAR, dz.DEPTH_OPACITY_NEAR, z);

    // Combined alpha computed EXACTLY as the node pass does (focus-dim ∧ dex-dim by
    // MIN, then depth multiply, clamped to DEPTH_ALPHA_FLOOR).
    const sightings = overlay && sightingsFor ? sightingsFor(node.id) : 0;
    const unseen = overlay && sightings === 0;
    const focusAlpha = isInNeighborhood(node.id)
      ? 1
      : config.explore.FOCUS_DIM_OPACITY;
    const dexAlpha = unseen ? config.explore.DEX_DIM_OPACITY : 1;

    // Label gate identical to the pre-change block (§B4/D-15).
    const forced = focused || neighbor;
    const showLabel =
      forced ||
      globalScale >= config.explore.LABEL_ZOOM_THRESHOLD ||
      topKIds.has(node.id);
    if (!showLabel) return;

    ctx.save();
    ctx.globalAlpha = Math.max(
      dz.DEPTH_ALPHA_FLOOR,
      Math.min(focusAlpha, dexAlpha) * depthAlpha,
    );
    // The focused node + its neighbors are ALWAYS labeled regardless of zoom
    // (§B4/D-15), in text-primary semibold; the focused node shows its FULL name
    // (ellipsis-exempt). Constant screen size via fontPx/scale.
    const fontPx = (forced ? 14 : 12) / globalScale;
    ctx.font = `${forced ? "600 " : ""}${fontPx}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = forced ? FOCUS_LABEL_COLOR : LABEL_COLOR;
    const text = focused
      ? node.name
      : ellipsize(node.name, config.explore.LABEL_MAX_CHARS);
    // fillText only — canvas text is inherently non-executing (T-07-02).
    ctx.fillText(text, node.x, node.y + r + 2 / globalScale);
    ctx.restore();
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

  // Edge tint by focus state (§B3/§B4): no focus → base 20%; focus → edges on the
  // focused node lift to 70%, every other edge dims to FOCUS_DIM_OPACITY. Reads
  // the immutable fromId/toId (Pitfall 1), shared by stroke + directional arrow.
  // Depth (quick task 260717-ual): in the NO-FOCUS base case, the 20% opacity is
  // subtly modulated by the edge's endpoint-avg z so near edges advance and far
  // edges recede. Focus highlight/dim precedence still WINS — depth only shapes the
  // resting sky, never overrides the focus contract.
  const edgeColor = (l: FgLink): string => {
    if (focusId == null) {
      const mul = lerp(
        config.explore.depth.DEPTH_EDGE_OPACITY_FAR,
        config.explore.depth.DEPTH_EDGE_OPACITY_NEAR,
        edgeZ(l),
      );
      return rgbaMuted(EDGE_BASE_OPACITY * mul);
    }
    const touchesFocus = l.fromId === focusId || l.toId === focusId;
    return touchesFocus
      ? EDGE_HIGHLIGHT_COLOR
      : rgbaMuted(config.explore.FOCUS_DIM_OPACITY);
  };

  // The actually-drawn population for the a11y label — the filter draw-gate hides
  // some nodes (rotation view / edge slider leave free-floating stars), so the
  // full catalog count would over-report. Counts the same set `nodeVisibility`
  // draws (filtered ∪ {focus, neighbors}); cheap linear scan, render-only.
  let shownCount = graphData.nodes.length;
  if (visibleNodeIds != null) {
    shownCount = 0;
    for (const n of graphData.nodes) if (isNodeVisible(n.id)) shownCount += 1;
  }

  return (
    <div
      ref={stageRef}
      role="img"
      aria-label={`Song transition constellation — ${shownCount} songs shown`}
      className="relative flex-1 touch-none select-none overflow-hidden bg-surface"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Decorative galaxy nebula behind the constellation (quick task 260717-sjg).
          FIRST child of the `relative` wrapper + `absolute inset-0` → sits behind the
          canvas in z-order. aria-hidden + pointer-events-none, so it never intercepts
          the canvas's pan/zoom/tap. Requires the transparent `backgroundColor` below —
          the wrapper KEEPS `bg-surface` (#0C0C10) as the opaque base so nothing flashes. */}
      <ExploreBackground parallax={bgParallax ?? undefined} />
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D<ConstellationNode, ConstellationLink>
          ref={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          // Transparent canvas fill (quick task 260717-sjg): react-force-graph-2d
          // otherwise clears the canvas OPAQUELY every frame, hiding the DOM nebula
          // behind it. The wrapper's `bg-surface` provides the base #0C0C10, so the
          // constellation still reads on dark where there are no blooms.
          backgroundColor="rgba(0, 0, 0, 0)"
          // Node draw: replace-mode callback owns fill + rings + count pill (§Color).
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          // Label TOP pass (quick task 260718-12j): runs AFTER all links, arrows, and
          // nodes render, in the same world transform, so labels always paint on top
          // and are never overpainted by a later node's orb fill or hidden under edges.
          // Iterates ALL nodes; drawNodeLabel replicates the node pass's visibility +
          // alpha + gating so the set/styling is byte-identical to the old inline block.
          onRenderFramePost={(ctx, globalScale) => {
            for (const raw of graphData.nodes) {
              drawNodeLabel(raw as FgNode, ctx, globalScale);
            }
          }}
          // Slice-3 filter seam (Pitfall 6): draw only the visible population; the
          // focus + neighbors are always exempt so a chain-hop never hits a gap.
          // This slice passes no filter → every node visible.
          nodeVisibility={(n: FgNode) => isNodeVisible(n.id)}
          // Draw an edge only when BOTH endpoints are visible AND it survives the
          // top-K-per-node declutter — UNLESS it touches the focused node, in which
          // case it's always drawn (full-neighborhood reveal, EXPL-05). The focus
          // exemption lives in the predicate, not the memoized Set, so focusing never
          // rebuilds the derived kept-set. Pure render pass — the node array is
          // untouched, so a node whose every edge is sparsified out still draws as a
          // free-floating star (D-08). No graphData rebuild, no reheat.
          linkVisibility={(l: FgLink) =>
            isNodeVisible(l.fromId) &&
            isNodeVisible(l.toId) &&
            (keptLinkSet == null ||
              keptLinkSet.has(`${l.fromId}->${l.toId}`) ||
              l.fromId === focusId ||
              l.toId === focusId)
          }
          // Bow reciprocal A→B / B→A pairs to opposite sides so they no longer
          // overlap on one straight line (deterministic sign by endpoint-id order);
          // non-reciprocal edges share the same gentle curve. Directional arrows
          // render along the curved path natively — linkDirectionalArrow* untouched.
          linkCurvature={(l: FgLink) =>
            l.fromId < l.toId
              ? config.explore.LINK_CURVATURE
              : -config.explore.LINK_CURVATURE
          }
          // Nebula parallax (quick task 260717-ual): on pan/zoom, translate + scale
          // the DOM nebula by a DAMPED fraction of the graph transform so the sky
          // moves slower than the constellation. Fires ONLY during interaction
          // (autoPauseRedraw / EXPL-06) — a pure sibling state set: no graphData
          // rebuild, no d3 reheat, fx/fy untouched. Damping keeps it a distant backdrop.
          onZoom={(t: { k: number; x: number; y: number }) =>
            setBgParallax({
              x: t.x * config.explore.background.PARALLAX_TRANSLATE_DAMP,
              y: t.y * config.explore.background.PARALLAX_TRANSLATE_DAMP,
              k: 1 + (t.k - 1) * config.explore.background.PARALLAX_ZOOM_DAMP,
            })
          }
          // Tap a node → focus it (D-13); tap empty canvas → clear focus + dim.
          onNodeClick={(n: FgNode) => onFocus(n.id)}
          onBackgroundClick={() => onFocus(null)}
          // Freeze-and-explore, not rearrange: disable node dragging so a finger on
          // an orb never grabs it. This also hands multi-touch straight to d3-zoom,
          // so pinch-to-zoom works cleanly (node-drag was intercepting the gesture
          // on touch). A tap still fires onNodeClick — tap behaviour is unchanged.
          enableNodeDrag={false}
          // Directed, count-weighted neutral edges (§B3). Width clamps to 4px max.
          // On focus, edges touching the focused node lift to 70% (EDGE_HIGHLIGHT);
          // all other edges drop to FOCUS_DIM_OPACITY, same hue (§B4).
          linkColor={edgeColor}
          // Count-based width (§B3) layered with a SUBTLE depth weight (quick task
          // 260717-ual): near edges (high endpoint-avg z) advance slightly wider,
          // far edges recede. Kept gentle so the count hierarchy still dominates.
          linkWidth={(l: FgLink) =>
            Math.min(4, 0.5 + Math.sqrt(l.count ?? 0) * 0.5) *
            lerp(
              config.explore.depth.DEPTH_EDGE_WIDTH_FAR,
              config.explore.depth.DEPTH_EDGE_WIDTH_NEAR,
              edgeZ(l),
            )
          }
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={0.9}
          linkDirectionalArrowColor={edgeColor}
          // Settle-and-freeze physics (EXPL-06). On stop, fix every node so pan/zoom
          // never reheats and labels never jitter permanently.
          cooldownTicks={config.explore.COOLDOWN_TICKS}
          d3AlphaDecay={config.explore.ALPHA_DECAY}
          d3VelocityDecay={config.explore.VELOCITY_DECAY}
          onEngineStop={() => {
            // Settle-and-freeze (EXPL-06): pin EVERY node on EVERY stop, unconditionally
            // — this must keep running on resize-driven reheats or the layout unfreezes.
            for (const raw of graphData.nodes) {
              const n = raw as FgNode;
              n.fx = n.x;
              n.fy = n.y;
            }
            // Frame the connected main grouping cleanly on load (D-15 reads at this
            // rest zoom). Falls back to fitting all nodes if there are no edges.
            // Also honours the active filter (07-05): the default Rotation view
            // frames its ~56 visible nodes, not the whole catalog.
            //
            // UX-04: gate on firstSettleRef so this fires ONLY on the first settle per
            // graphData change (a real view switch). Pure size changes / filter toggles
            // still reheat and re-fire onEngineStop, but skip zoomToFit — preserving the
            // user's exact pan/zoom instead of yanking back to fit-all.
            if (firstSettleRef.current) {
              firstSettleRef.current = false;
              fgRef.current?.zoomToFit(
                config.explore.ZOOM_TO_FIT_DURATION_MS,
                config.explore.ZOOM_TO_FIT_PADDING_PX,
                (n: FgNode) =>
                  (connectedIds.size === 0 || connectedIds.has(n.id)) &&
                  isNodeVisible(n.id),
              );
            }
          }}
        />
      )}
    </div>
  );
}
