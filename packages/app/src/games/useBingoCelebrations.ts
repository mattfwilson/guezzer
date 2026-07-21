/**
 * BINGO-05 celebration driver (plan 16-05) — the App-level hook that turns live
 * bingo-board progress into fire-once celebrations. It re-derives the LOCKED
 * card's board over the still-growing trail (the SAME `deriveLiveBoard` +
 * `detectWins` the replay uses, so `live == replay == catch-up`), diffs the
 * result against a per-session `useRef` memo, and fires `showBingoCelebration`
 * ONLY on 0→1 transitions.
 *
 * The transition logic lives in the PURE `nextCelebrations` reducer (exported +
 * unit-tested in isolation) so the fire-once + ≤2-supernova-budget rules are
 * provable without a DOM. The hook is a thin liveQuery→derive→diff→emit shell,
 * mirroring `useDexStats` / `useShowSession` (Dexie is the single source of
 * truth; every number is derived, never stored).
 *
 * RESEARCH Pitfall 3 (fire on the transition, not on presence): on the FIRST
 * derivation for a session — a reload, a tab switch, or a catch-up that lands
 * many marks at once — the memo is SEEDED from the current board with the events
 * discarded, so an in-progress board never replays a burst of stamps or an
 * already-won supernova. Only subsequent changes fire.
 *
 * The caught-set fed to `deriveLiveBoard` is the card's FROZEN `caughtSnapshot`
 * (stamped at lock, D-08/D-12), NOT the live dex — that is what makes the live
 * board byte-identical to the eventual replay (the `neverCaught` square can't
 * drift mid-show as tonight's songs land in the dex).
 */
import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { MarkedCard, Win } from "@guezzer/core";
import { db } from "../db/db.ts";
import {
  showBingoCelebration,
  type BingoBadgeKind,
  type BingoSupernovaKind,
} from "../components/BingoCelebration.tsx";
import { deriveLiveBoard } from "./bingoReplay.ts";
import { getBingoContext } from "./bingoContext.ts";

/** Core FREE_SENTINEL (types.ts:74) — not exported from the barrel; pinned here. */
const FREE_SENTINEL = -1;

/**
 * A celebration to fire on this transition. `mark` carries the board index + the
 * trail position that lit it (the hook resolves the song name + square label);
 * `badge`/`supernova` carry only the closed kind vocabulary.
 */
export type CelebrationEvent =
  | { tier: "mark"; index: number; position: number }
  | { tier: "badge"; kind: BingoBadgeKind }
  | { tier: "supernova"; kind: BingoSupernovaKind };

/**
 * The per-session diff memo — everything the reducer needs to distinguish a 0→1
 * edge from steady-state presence. `markedIndices` are the REAL marked squares
 * (the free cell's `FREE_SENTINEL` is excluded — it is pre-marked, never a mark
 * event); `lineCount` tracks how many line wins have been seen (the first is the
 * supernova, the rest are badges); `cornersSeen`/`xSeen` gate their one-shot
 * badges; `supernovasFired` is the ≤2/show budget (first line + blackout only).
 */
export interface CelebrationMemo {
  markedIndices: Set<number>;
  lineCount: number;
  cornersSeen: boolean;
  xSeen: boolean;
  supernovasFired: Set<BingoSupernovaKind>;
}

/** A pristine memo (nothing marked, nothing won) for a fresh session. */
export function initialCelebrationMemo(): CelebrationMemo {
  return {
    markedIndices: new Set(),
    lineCount: 0,
    cornersSeen: false,
    xSeen: false,
    supernovasFired: new Set(),
  };
}

/** Count of `line`-kind wins in a detectWins result (rows/cols/diagonals). */
function countLines(wins: readonly Win[]): number {
  return wins.filter((w) => w.kind === "line").length;
}

/**
 * The PURE celebration reducer. Diffs the current derived board + wins against
 * the previous memo and returns the celebrations to fire on this 0→1 edge, plus
 * the next memo. No I/O, no wall-clock, no React — the whole fire-once +
 * budget contract is provable here (unit-tested in isolation).
 *
 * Emission order is deterministic: marks (ascending board index) first, then
 * the win tiers (first line → supernova; subsequent lines → badge; corners; X;
 * blackout → supernova), each only on its 0→1 transition and within the
 * ≤2-supernova/show budget.
 */
export function nextCelebrations(
  prev: CelebrationMemo,
  marked: MarkedCard,
  wins: readonly Win[],
): { events: CelebrationEvent[]; memo: CelebrationMemo } {
  const events: CelebrationEvent[] = [];

  // ── Marks: any real square (position ≥ 0) newly present since last time. ──
  const markedIndices = new Set<number>();
  for (const square of marked.squares) {
    const pos = square.markedByPosition;
    if (pos === null || pos === FREE_SENTINEL) continue; // free/unmarked never a mark event
    markedIndices.add(square.index);
    if (!prev.markedIndices.has(square.index)) {
      events.push({ tier: "mark", index: square.index, position: pos });
    }
  }
  events.sort((a, b) =>
    a.tier === "mark" && b.tier === "mark" ? a.index - b.index : 0,
  );

  // ── Lines: first-ever line is the supernova; every subsequent line a badge. ──
  const lineCount = countLines(wins);
  const supernovasFired = new Set(prev.supernovasFired);
  if (lineCount > prev.lineCount) {
    const newLines = lineCount - prev.lineCount;
    let remaining = newLines;
    // The very first line of the whole session → the "First line!" supernova.
    if (prev.lineCount === 0 && !supernovasFired.has("firstLine")) {
      events.push({ tier: "supernova", kind: "firstLine" });
      supernovasFired.add("firstLine");
      remaining -= 1;
    }
    // Any further new lines this transition → the "Another line!" badge (once).
    if (remaining > 0) {
      events.push({ tier: "badge", kind: "anotherLine" });
    }
  }

  // ── Four-corners + X: one-shot badges on their 0→1 transition. ──
  const hasCorners = wins.some((w) => w.kind === "corners");
  const cornersSeen = prev.cornersSeen || hasCorners;
  if (hasCorners && !prev.cornersSeen) {
    events.push({ tier: "badge", kind: "fourCorners" });
  }
  const hasX = wins.some((w) => w.kind === "x");
  const xSeen = prev.xSeen || hasX;
  if (hasX && !prev.xSeen) {
    events.push({ tier: "badge", kind: "x" });
  }

  // ── Blackout: the second (and final) supernova, budget-guarded. ──
  const hasBlackout = wins.some((w) => w.kind === "blackout");
  if (hasBlackout && !supernovasFired.has("blackout")) {
    events.push({ tier: "supernova", kind: "blackout" });
    supernovasFired.add("blackout");
  }

  return {
    events,
    memo: { markedIndices, lineCount, cornersSeen, xSeen, supernovasFired },
  };
}

/**
 * App-level driver. Mount ONCE (in `App`, alongside `<BingoCelebration/>`).
 * Subscribes to the active session's LOCKED card + its live trail, re-derives the
 * board, and fires celebrations on 0→1 transitions via the reducer above. Renders
 * nothing — it only drives the module emitter.
 */
export function useBingoCelebrations(): void {
  const active = useLiveQuery(() =>
    db.trackedShows.where("status").equals("active").first(),
  );
  const sessionId = active?.sessionId;

  const card = useLiveQuery(
    () => (sessionId ? db.bingoCards.get(sessionId) : undefined),
    [sessionId],
  );
  const entries = useLiveQuery(
    () =>
      sessionId
        ? db.trackedEntries.where("sessionId").equals(sessionId).toArray()
        : [],
    [sessionId],
  );

  // Per-session diff memo. Reset (via the sessionId guard) when the show changes.
  const memoRef = useRef<{ sessionId: string | null; memo: CelebrationMemo }>({
    sessionId: null,
    memo: initialCelebrationMemo(),
  });

  useEffect(() => {
    // Gate: a locked card, a resolved trail, and a ready marking context. A
    // schemaVersion drift degrades getBingoContext() to null (calm no-op).
    if (!sessionId || !card || card.lockedAt == null || entries === undefined) {
      return;
    }
    const ctxResult = getBingoContext();
    if (!ctxResult) return;

    const board = deriveLiveBoard(
      card.card,
      entries,
      ctxResult.ctx,
      // FROZEN caught-set (D-08/D-12) — never the live dex, so replay matches live.
      new Set(card.caughtSnapshot),
    );

    // First derivation for this session → SEED silently (Pitfall 3): compute the
    // memo from the current board but DISCARD the events, so an in-progress board
    // (reload / tab switch / catch-up) never replays a burst of celebrations.
    if (memoRef.current.sessionId !== sessionId) {
      const { memo } = nextCelebrations(
        initialCelebrationMemo(),
        board.marked,
        board.wins,
      );
      memoRef.current = { sessionId, memo };
      return;
    }

    const { events, memo } = nextCelebrations(
      memoRef.current.memo,
      board.marked,
      board.wins,
    );
    memoRef.current = { sessionId, memo };

    for (const ev of events) {
      if (ev.tier === "mark") {
        const square = board.marked.squares[ev.index];
        const squareLabel = labelOf(square?.def);
        const song = board.songNameByPosition.get(ev.position) ?? squareLabel;
        showBingoCelebration({ tier: "mark", song, square: squareLabel });
      } else {
        showBingoCelebration(ev);
      }
    }
  }, [sessionId, card, entries]);
}

/** A square's display label — the free cell reads the verbatim "Free" copy. */
function labelOf(def: MarkedCard["squares"][number]["def"] | undefined): string {
  if (!def) return "";
  return def.kind === "free" ? "" : def.label;
}
