/**
 * The comet trail (04-UI-SPEC §Layout region 2, SHOW-08). A fixed-height,
 * horizontally-scrollable strip below the header showing the most recent songs
 * as DIMINISHING nodes — the most recent nearest the orbit (rightmost + largest),
 * older ones smaller — each a SOLID hit (green) / miss (red) dot derived from
 * `entry.outcome` (D-06/D-08, 04-UI-SPEC §Color B2) with a hairline timeline
 * connecting adjacent dots. The visible count FILLS the measured strip width
 * (ResizeObserver): many nodes on a wide desktop, ~`TRAIL_VISIBLE_RECENT` on a
 * narrow phone (also the fallback before the width is measured). The strip NEVER
 * wraps into the orbit fan; it scrolls horizontally instead.
 *
 * Once the set reaches `TRAIL_COMPRESS_AT` (config, 30) songs, the older history
 * collapses into a tappable "+N" chip that opens a scrollable full-setlist
 * sheet (AppMenu overlay idiom). Every node — and the "+N" chip — is ≥44px
 * (`min-h-11 min-w-11`), the venue tap floor. Tapping any node calls
 * `onNodeTap(entry)`, which ShowView routes to the TrailNodeSheet (04-06 Task 3)
 * for edit / delete / rename.
 *
 * Reactive by construction: `entries` flows from `useShowSession`'s live Dexie
 * query, so the trail (and the compression threshold) recompute automatically
 * after any log / undo / edit — no local mirror of setlist state (SHOW-08/11).
 * kglw-origin song names render as React text only — never
 * `dangerouslySetInnerHTML` (T-04-14, ASVS V5).
 */
import { useEffect, useRef, useState } from "react";
import { config } from "../config.ts";
import type { EntryOutcome, TrackedEntry } from "../db/db.ts";

/**
 * Hit/miss ring hexes (04-UI-SPEC §Color B2). Kept beside the trail (mirroring
 * tuningColor.ts) rather than in config.show — these are semantic data colors,
 * not model tunables. Miss reuses the inherited Destructive red by design.
 */
const RING_COLOR: Record<EntryOutcome, string> = {
  hit: "#22C55E", // green — the confirmed song WAS in the shown fan (D-06)
  miss: "#EF4444", // red — logged via Search/??? / off-catalog (D-08)
};

interface CometTrailProps {
  /** The show's entries ordered by position (from useShowSession's live query). */
  entries: TrackedEntry[];
  /** Tapping a node → open the TrailNodeSheet for edit / delete / rename (D-15). */
  onNodeTap: (entry: TrackedEntry) => void;
}

/** Diminishing diameter: oldest (index 0) = MIN, most-recent = MAX; linear by age. */
function nodeDiameter(index: number, count: number): number {
  const { TRAIL_NODE_MIN_DIAMETER: min, TRAIL_NODE_MAX_DIAMETER: max } =
    config.show;
  if (count <= 1) return max;
  return Math.round(min + ((max - min) * index) / (count - 1));
}

/**
 * How many fixed-width nodes fit in `availablePx` of strip: N nodes take
 * `N*slot + (N-1)*gap`, so N ≤ (available + gap) / (slot + gap). Never fewer than
 * `TRAIL_VISIBLE_RECENT` (also the value used before the width is measured, when
 * `availablePx ≤ 0`), so the trail fills a wide desktop yet still shows the recent
 * few on a narrow phone. Pure — the component measures the width and calls this.
 */
export function trailCapacity(availablePx: number): number {
  const { TRAIL_NODE_SLOT_WIDTH: slot, TRAIL_NODE_GAP_PX: gap } = config.show;
  const floor = config.show.TRAIL_VISIBLE_RECENT;
  if (availablePx <= 0) return floor;
  const fit = Math.floor((availablePx + gap) / (slot + gap));
  return Math.max(floor, fit);
}

export function CometTrail({ entries, onNodeTap }: CometTrailProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    TRAIL_COMPRESS_AT,
    TRAIL_NODE_SLOT_WIDTH: slot,
    TRAIL_NODE_GAP_PX: gap,
    TRAIL_NODE_MAX_DIAMETER: maxDot,
  } = config.show;

  // Measure the strip's own width so the visible node count FILLS it (SHOW-08):
  // a wide desktop shows many nodes, a phone the recent few. Mirrors OrbitStage's
  // ResizeObserver container-measuring idiom; jsdom (unit tests) has no layout and
  // no ResizeObserver, so clientWidth stays 0 and trailCapacity falls back to
  // TRAIL_VISIBLE_RECENT — the pre-responsive window.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripWidth, setStripWidth] = useState(0);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setStripWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pre-opener / empty → no strip at all (no empty band above the orbit).
  if (entries.length === 0) return null;

  // Space for nodes = measured strip width, less the px-4 side padding and (once
  // "+N" shows at 30+) a reserved slot for the compression chip.
  const compressActive = entries.length >= TRAIL_COMPRESS_AT;
  const SIDE_PADDING = 32; // px-4 (16px) on each side of the strip
  const chipReserve = compressActive ? slot + gap : 0;
  const capacity = trailCapacity(stripWidth - SIDE_PADDING - chipReserve);

  // Most recent `capacity` in position order (oldest → newest); newest rightmost.
  const visible = entries.slice(-capacity);
  const olderCount = entries.length - visible.length;
  // "+N" compression appears ONLY at 30+ songs (SHOW-08); below that the strip
  // is a pure recent-glance and older history simply isn't shown.
  const showCompress = compressActive && olderCount > 0;

  return (
    <>
      <div
        ref={stripRef}
        className="flex shrink-0 items-end gap-2 overflow-x-auto border-b border-hairline bg-elevated px-4 py-2 [scrollbar-width:none] touch-manipulation"
        style={{ overscrollBehavior: "none" }}
      >
        {showCompress && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-hairline px-3 text-[14px] font-semibold tabular-nums text-text-primary touch-manipulation"
          >
            +{olderCount}
          </button>
        )}

        {/* Nodes region — kept separate from the "+N" chip so the connector
            baseline spans only the dot timeline (not behind the chip). Relative so
            the absolute baseline anchors to it; every dot sits in a fixed
            MAX-tall band, so all dot CENTRES align at one y even as the dots
            diminish, and the hairline reads as one left→right timeline. */}
        {visible.length > 0 && (
          <div
            className="relative flex shrink-0 items-end"
            style={{ gap }}
          >
            {/* Connector baseline — inset by half a node on each side so it spans
                exactly first-dot-centre → last-dot-centre: NO line past the most
                recent (rightmost) orb, only between logged orbs. A lone node
                yields zero width (no connection). */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-px -translate-y-1/2 bg-hairline"
              style={{ top: maxDot / 2, left: slot / 2, right: slot / 2 }}
            />
            {visible.map((entry, i) => {
              const diameter = nodeDiameter(i, visible.length);
              return (
                <button
                  key={entry.id ?? `pos-${entry.position}`}
                  type="button"
                  onClick={() => onNodeTap(entry)}
                  style={{ width: slot }}
                  className="relative flex min-h-11 shrink-0 flex-col items-center justify-start gap-1 touch-manipulation"
                >
                  {/* Fixed MAX-tall band centres the (diminishing) solid dot so
                      the connector passes through every centre at the same y. */}
                  <span
                    className="flex items-center justify-center"
                    style={{ height: maxDot }}
                  >
                    <span
                      data-testid="trail-dot"
                      className="rounded-full"
                      style={{
                        width: diameter,
                        height: diameter,
                        backgroundColor: RING_COLOR[entry.outcome],
                      }}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[14px] leading-tight text-text-muted">
                    {entry.songName}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {expanded && (
        <FullSetlistSheet
          entries={entries}
          onClose={() => setExpanded(false)}
          onNodeTap={(entry) => {
            setExpanded(false);
            onNodeTap(entry);
          }}
        />
      )}
    </>
  );
}

interface FullSetlistSheetProps {
  entries: TrackedEntry[];
  onClose: () => void;
  onNodeTap: (entry: TrackedEntry) => void;
}

/**
 * The scrollable full-setlist sheet behind the "+N" chip (SHOW-08). Lists every
 * entry newest-first with its hit/miss ring + set number; each row taps through
 * to the same TrailNodeSheet edit/delete/rename path. AppMenu overlay idiom.
 */
function FullSetlistSheet({ entries, onClose, onNodeTap }: FullSetlistSheetProps) {
  const ordered = [...entries].reverse(); // newest first

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full setlist"
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[80%] overflow-y-auto rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {ordered.map((entry) => (
          <button
            key={entry.id ?? `pos-${entry.position}`}
            type="button"
            onClick={() => onNodeTap(entry)}
            className="flex min-h-11 w-full items-center gap-3 border-b border-hairline py-2 text-left touch-manipulation"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border-2"
              style={{ borderColor: RING_COLOR[entry.outcome] }}
            />
            <span className="tabular-nums text-[14px] text-text-muted">
              {entry.position}
            </span>
            <span className="flex-1 truncate text-base leading-normal text-text-primary">
              {entry.songName}
            </span>
            <span className="tabular-nums text-[14px] text-text-muted">
              {entry.setNumber}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
