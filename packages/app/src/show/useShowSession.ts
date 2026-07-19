/**
 * The app's FIRST `useLiveQuery` (RESEARCH §Pattern 5, "Reactive restore +
 * tally") — the reactive session layer for Show Mode. Dexie is the single
 * source of truth (SHOW-11 write-through invariant): the active show, its
 * ordered entries, the derived tally, and the current predicted fan all flow
 * straight out of IndexedDB + the frozen core `predict()`. There is NO
 * hand-synced `useState` mirror of the trail/tally — a write-through re-runs
 * the live query, which re-derives everything below.
 *
 * Critical correctness rule (frozen core type): `ShowContext.currentSongId` is
 * a NON-nullable `number` (packages/core/src/domain/types.ts). `null` is an
 * app-only pre-opener state (no current song yet). It must NEVER reach core:
 * `buildShowContext`/`predictFan` are called ONLY inside the
 * `currentSongId !== null` guard below; the pre-opener path returns an empty
 * fan without touching the predictor. The opener is seeded via Search in 04-05.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  currentRunShowSets,
  type FinalizedShowInput,
  type TuningFamily,
} from "@guezzer/core";
import { config as coreConfig } from "@guezzer/core/config";
import { db, getMeta, type TrackedEntry, type TrackedShow } from "../db/db.ts";
import { deriveTally, type Tally } from "./scoring.ts";
import { getMatrixIndex, loadMatrix } from "./matrix.ts";
import { buildShowContext, predictFan } from "./showContext.ts";
import { selectFan } from "./orbitLayout.ts";
import { isWeakFan } from "./confidence.ts";
import type { OrbitCandidate } from "./PredictionOrb.tsx";

/** The current centre song for the CenterNode — name, id (rarity color), + tuning family (null pre-opener). */
export interface CurrentSong {
  songName: string;
  /** The centre song's id — drives the CenterNode rarity-tier color (quick 260717-p4s). */
  songId: number | null;
  tuningFamily: TuningFamily | null;
}

/** Everything the ShowView + OrbitStage render off, all derived from Dexie + core. */
export interface ShowSession {
  /** The single active tracked show, or undefined pre-show (D-03). */
  active: TrackedShow | undefined;
  /** This show's entries ordered by position (empty before the first log). */
  entries: TrackedEntry[];
  /** The combined running hit/miss tally (SHOW-09). */
  tally: Tally;
  /** The current centre song id, or null before the opener is seeded (04-05). */
  currentSongId: number | null;
  /** The centre song's name + tuning family, or null pre-opener. */
  currentSong: CurrentSong | null;
  /** The raw ranked candidates (tuning-enriched), or [] pre-opener. */
  candidates: OrbitCandidate[];
  /** The selected adaptive 5–8 fan (D-12), or [] pre-opener. */
  fan: OrbitCandidate[];
  /** The song ids on screen — the honest hit denominator at log time (D-06). */
  shownFanSongIds: number[];
  /** True when the whole fan softens (top orb below threshold, D-10). */
  isWeakFan: boolean;
  /** False when the bundled matrix failed its schemaVersion guard (T-04-09). */
  matrixOk: boolean;
}

export function useShowSession(): ShowSession {
  // (a) The one active show — reactive restore/auto-resume (SHOW-11/D-03).
  const active = useLiveQuery(() =>
    db.trackedShows.where("status").equals("active").first(),
  );

  // (b) Its entries ordered by position, re-subscribed when the session changes.
  const entries =
    useLiveQuery(
      () =>
        active
          ? db.trackedEntries
              .where("sessionId")
              .equals(active.sessionId)
              .sortBy("position")
          : Promise.resolve<TrackedEntry[]>([]),
      [active?.sessionId],
    ) ?? [];

  // (c) The derived tally — never hand-synced; recomputed only when entries change.
  const tally = useMemo(() => deriveTally(entries), [entries]);

  // (c1) The prior FINALIZED shows of the current run — the cross-night rotation
  // window (PRED-01). `status === "finalized"` inherently EXCLUDES the active
  // in-progress show (its own row is `active`, and its trail is handled by
  // core's `alreadyPlayedFactor`, not rotation — Pitfall 4). Each finalized show
  // projects to a `FinalizedShowInput { date, songIds }` (real songs only) for
  // the pure DOM-free core `currentRunShowSets` grouper. Kept OUTSIDE the
  // `currentSongId !== null` prediction gate — it is independent of the current
  // song and reactive to any show being finalized.
  const finalizedRunInputs =
    useLiveQuery(async () => {
      const shows = await db.trackedShows
        .where("status")
        .equals("finalized")
        .toArray();
      const inputs: FinalizedShowInput[] = [];
      for (const show of shows) {
        const showEntries = await db.trackedEntries
          .where("sessionId")
          .equals(show.sessionId)
          .toArray();
        inputs.push({
          date: show.date,
          songIds: showEntries
            .filter((e) => e.songId != null)
            .map((e) => e.songId as number),
        });
      }
      return inputs;
    }) ?? [];

  // (c2) Owner reset marker (PRED-03) — a single free-form `db.meta` row written
  // by the Settings "start a fresh run" control. When set, `currentRunShowSets`
  // drops every show on/after this boundary out of the window, so a distinct
  // weekend no longer down-weights tonight. `undefined` = never reset.
  const rotationResetDate = useLiveQuery(() =>
    getMeta<string>("rotationRunResetDate"),
  );

  // (c3) The current run's prior-show song sets — the `recentShowSongSets`
  // window that the already-correct core `rotationSuppression` is starved of in
  // live use (RESEARCH §PRED-01). The active show's OWN date anchors the run
  // (never wall-clock), and the reset marker bounds it. Decision logic lives in
  // core (`currentRunShowSets`); the app only supplies Dexie data (CLAUDE.md
  // strict core/UI separation).
  const recentRunShowSets = useMemo(
    () =>
      active
        ? currentRunShowSets(
            finalizedRunInputs,
            active.date,
            { runGapDays: coreConfig.runGapDays },
            rotationResetDate ?? undefined,
          )
        : [],
    [active, finalizedRunInputs, rotationResetDate],
  );

  // The current centre = the last CONFIRMED real song (placeholders excluded).
  // `null` until the opener is seeded (04-05) — the pre-opener state.
  const currentEntry = useMemo(
    () => entries.filter((e) => e.songId != null).at(-1) ?? null,
    [entries],
  );
  const currentSongId = currentEntry?.songId ?? null;

  // (d) Predictions — GATED on a non-null current song AND a loaded matrix.
  // `predictFan`/`buildShowContext` are invoked ONLY past the guard below, so
  // `null` never reaches the frozen core `ShowContext.currentSongId: number`.
  // Recomputes on current-song/entries change, not unconditionally per render.
  const prediction = useMemo(() => {
    const result = loadMatrix();
    const index = result.ok ? getMatrixIndex() : null;

    // The centre song can render (name + colour) even before/without a fan.
    const currentSong: CurrentSong | null = currentEntry
      ? {
          songName: currentEntry.songName,
          songId: currentEntry.songId ?? null,
          tuningFamily:
            index && currentEntry.songId != null
              ? (index.nodeById.get(currentEntry.songId)?.tuningFamily ?? null)
              : null,
        }
      : null;

    // Pre-opener OR unloadable matrix → empty fan, core untouched.
    if (currentSongId === null || !result.ok || !index) {
      return {
        candidates: [] as OrbitCandidate[],
        fan: [] as OrbitCandidate[],
        shownFanSongIds: [] as number[],
        isWeakFan: false,
        currentSong,
      };
    }

    // Past the guard: a real number reaches core. Assemble ShowContext from the
    // persisted trail + the current run's prior-show sets and re-predict
    // (SHOW-03 / PRED-01). `recentRunShowSets` finally feeds the cross-night
    // rotationSuppression (was a hardcoded `[]`); night 1 of a run is `[]`.
    const ctx = buildShowContext(currentSongId, entries, recentRunShowSets);
    const candidates: OrbitCandidate[] = predictFan(result.matrix, ctx).map(
      (c) => ({
        ...c,
        tuningFamily: index.nodeById.get(c.songId)?.tuningFamily ?? null,
      }),
    );
    const fan = selectFan(candidates);

    return {
      candidates,
      fan,
      shownFanSongIds: fan.map((c) => c.songId),
      isWeakFan: isWeakFan(candidates),
      currentSong,
    };
  }, [currentSongId, currentEntry, entries, recentRunShowSets]);

  return {
    active: active ?? undefined,
    entries,
    tally,
    currentSongId,
    currentSong: prediction.currentSong,
    candidates: prediction.candidates,
    fan: prediction.fan,
    shownFanSongIds: prediction.shownFanSongIds,
    isWeakFan: prediction.isWeakFan,
    matrixOk: loadMatrix().ok,
  };
}
