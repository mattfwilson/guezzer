/**
 * D-21 seeded card generator: `deal(seed, vibe, ctx, dexSnapshot, corpusVersion,
 * cfg) -> BingoCard`. A PURE function — every random choice is drawn from the
 * string-seeded PRNG stream `mulberry32(xmur3(`${seed} ${vibe} ${corpusVersion}`)())`,
 * never the wall clock or a global entropy source (Anti-Pattern 3 / T-14-08).
 * Same inputs → byte-identical card; a new seed OR a new vibe → a different card.
 *
 * The card is drawn from the v1 auto-mark catalog only — song / album / opener /
 * microtonal / marathonJam / bustOut / neverCaught — and NEVER a "segue" event
 * (D-24: not trail-derivable). Every square def is self-contained and frozen at
 * deal time (song carries songId+label, album carries albumUrl+label) so a later
 * corpus refresh never has to regenerate it (Anti-Pattern 4 / T-14-10).
 *
 * Completeness is guaranteed: exactly 16 squares, exactly one `{kind:"free"}` at
 * `cfg.bingo.freeIndex`, no holes — even when the jam/album rosters are empty
 * (falls back to song squares, then to always-resolvable opener event squares).
 * The result is returned via `bingoCardSchema.parse` so a shape drift fails
 * loudly at generation time (T-14-09).
 *
 * Mirrors `dex/albums.ts` (config-allowlist → Set selection + zod-validate-
 * before-return) and `derive-dex.ts` module discipline: one exported fn, `config`
 * injected with a default, zero I/O, no Dexie/DOM types, no app row imports (D-22).
 */
import { config } from "../config.ts";
import { mulberry32, xmur3 } from "./prng.ts";
import type { BingoContext } from "./context.ts";
import {
  bingoCardSchema,
  type BingoCard,
  type BingoEvent,
  type BingoSquareDef,
  type BingoVibe,
} from "./types.ts";

/** The v1 auto-mark square kinds, in a fixed order for deterministic selection. */
const SQUARE_KINDS = [
  "song",
  "album",
  "opener",
  "microtonal",
  "marathonJam",
  "bustOut",
  "neverCaught",
] as const;
type SquareKind = (typeof SQUARE_KINDS)[number];

/** The five catalog EVENT kinds (a subset of SQUARE_KINDS); song/album are not events. */
const EVENT_KINDS: readonly BingoEvent[] = [
  "opener",
  "microtonal",
  "marathonJam",
  "bustOut",
  "neverCaught",
];

/**
 * Safe default per-kind selection weights used until the Plan-06 calibration
 * gate fills real `cfg.bingo.vibes[vibe].mix` weights — chosen only so a card
 * still deals with a sane variety. Weights are relative; event kinds are drawn
 * at most once each (they are board singletons — a card never has two "opener"
 * squares), the remaining slots fill with song squares.
 */
const DEFAULT_MIX: Readonly<Record<SquareKind, number>> = {
  song: 6,
  album: 2,
  opener: 1,
  microtonal: 1,
  marathonJam: 1,
  bustOut: 2,
  neverCaught: 2,
};

/** Every dealt card has 16 squares; 15 are fillable, one is the free center. */
const TOTAL_SQUARES = 16;

/** Human-readable frozen labels for the five generic event squares. */
const EVENT_LABELS: Readonly<Record<BingoEvent, string>> = {
  opener: "Show Opener",
  microtonal: "Microtonal Song",
  marathonJam: "Marathon Jam",
  bustOut: "Bust-Out",
  neverCaught: "Never Caught",
};

/** eraPlayRate entries sorted by base rate desc, then songId asc (stable, D-25). */
function songsByEraRate(ctx: BingoContext): number[] {
  return [...ctx.eraPlayRate.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([songId]) => songId);
}

/** Song squares from top recent-era base-rate songs (D-25 — NOT the predictor). */
function buildSongSquares(ctx: BingoContext): BingoSquareDef[] {
  return songsByEraRate(ctx).map((songId) => ({
    kind: "song",
    songId,
    label: `Song ${songId}`,
  }));
}

/**
 * Album squares from `cfg.bingo.albumSquarePool ∩ ctx.albumSongIds` (config
 * allowlist → Set, albums.ts idiom). Ships EMPTY pre-Plan-06 → no album squares.
 */
function buildAlbumSquares(ctx: BingoContext, cfg: typeof config): BingoSquareDef[] {
  const pool = new Set<string>(cfg.bingo.albumSquarePool);
  return [...ctx.albumSongIds.keys()]
    .filter((albumUrl) => pool.has(albumUrl))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((albumUrl) => ({ kind: "album", albumUrl, label: albumUrl }));
}

/**
 * The never-caught label hint (D-13/D-14): the highest-base-rate song NOT in the
 * frozen caught snapshot. This is the ONLY use of `dexSnapshot` at deal time — the
 * actual match is resolved at MARK time from the caught snapshot, so this is a
 * cosmetic hint, never a correctness input.
 */
function neverCaughtLabel(ctx: BingoContext, dexSnapshot: ReadonlySet<number>): string {
  const hint = songsByEraRate(ctx).find((songId) => !dexSnapshot.has(songId));
  return hint === undefined ? EVENT_LABELS.neverCaught : `Never Caught: Song ${hint}`;
}

/** One frozen singleton def per event kind (each may appear at most once on a card). */
function buildEventSquares(
  ctx: BingoContext,
  dexSnapshot: ReadonlySet<number>,
): Record<BingoEvent, BingoSquareDef> {
  const label = (event: BingoEvent): string =>
    event === "neverCaught" ? neverCaughtLabel(ctx, dexSnapshot) : EVENT_LABELS[event];
  return Object.fromEntries(
    EVENT_KINDS.map((event): [BingoEvent, BingoSquareDef] => [
      event,
      { kind: "event", event, label: label(event) },
    ]),
  ) as Record<BingoEvent, BingoSquareDef>;
}

/** Weighted pick over the currently-active kinds, consuming one `rand()` draw. */
function weightedPick(
  kinds: readonly SquareKind[],
  mix: Record<SquareKind, number>,
  draw: number,
): SquareKind {
  const total = kinds.reduce((sum, kind) => sum + mix[kind], 0);
  let x = draw * total;
  for (const kind of kinds) {
    x -= mix[kind];
    if (x < 0) return kind;
  }
  return kinds[kinds.length - 1];
}

/**
 * Fisher–Yates shuffle in place, driven entirely by the injected stream so board
 * placement is reproducible for identical inputs.
 */
function shuffleInPlace<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * `deal(seed, vibe, ctx, dexSnapshot, corpusVersion, cfg) -> BingoCard`. Pure,
 * deterministic, schema-validated. See the module header for the invariants.
 */
export function deal(
  seed: string,
  vibe: BingoVibe,
  ctx: BingoContext,
  dexSnapshot: ReadonlySet<number>,
  corpusVersion: string,
  cfg: typeof config = config,
): BingoCard {
  // D-21: the seed string scopes determinism to (seed, vibe, corpusVersion).
  const seedStr = `${seed} ${vibe} ${corpusVersion}`;
  const rand = mulberry32(xmur3(seedStr)());

  const freeIndex = cfg.bingo.freeIndex;
  const fillCount = TOTAL_SQUARES - 1;

  // Per-vibe mixture weights (real weights land in Plan 06; default until then).
  const rawMix = cfg.bingo.vibes[vibe].mix as Record<string, number>;
  const mix: Record<SquareKind, number> =
    Object.keys(rawMix).length > 0 ? (rawMix as Record<SquareKind, number>) : DEFAULT_MIX;

  // Remaining candidate defs per kind. Song/album drain distinct items; each event
  // kind is a one-shot singleton so no card ever carries a duplicate event square.
  const eventDefs = buildEventSquares(ctx, dexSnapshot);
  const remaining: Record<SquareKind, BingoSquareDef[]> = {
    song: buildSongSquares(ctx),
    album: buildAlbumSquares(ctx, cfg),
    opener: [eventDefs.opener],
    microtonal: [eventDefs.microtonal],
    marathonJam: [eventDefs.marathonJam],
    bustOut: [eventDefs.bustOut],
    neverCaught: [eventDefs.neverCaught],
  };

  // Weighted selection without replacement until we hit fillCount or run dry.
  const chosen: BingoSquareDef[] = [];
  while (chosen.length < fillCount) {
    const active = SQUARE_KINDS.filter((kind) => mix[kind] > 0 && remaining[kind].length > 0);
    if (active.length === 0) break;
    const kind = weightedPick(active, mix, rand());
    chosen.push(remaining[kind].shift()!);
  }

  // Completeness guarantee: top up any shortfall with song squares (cycled if the
  // catalog is tiny), falling back to the always-resolvable opener event square so
  // a card is NEVER blank even when every roster is empty (T-14 never-blank).
  const allSongs = buildSongSquares(ctx);
  const filler: BingoSquareDef[] = allSongs.length > 0 ? allSongs : [eventDefs.opener];
  for (let i = 0; chosen.length < fillCount; i++) {
    chosen.push(filler[i % filler.length]);
  }
  chosen.length = fillCount;

  // Deterministic Fisher–Yates placement of the 15 fillable squares into the 15
  // non-free board positions; the free cell is pinned at freeIndex (D-06).
  const positions: number[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) if (i !== freeIndex) positions.push(i);
  shuffleInPlace(positions, rand);

  const squares: BingoSquareDef[] = new Array<BingoSquareDef>(TOTAL_SQUARES);
  squares[freeIndex] = { kind: "free" };
  for (let i = 0; i < fillCount; i++) squares[positions[i]] = chosen[i];

  const card: BingoCard = {
    schemaVersion: 1,
    seed,
    vibe,
    corpusVersion,
    freeIndex,
    squares,
  };

  // Validate through the strict schema before returning (T-14-09) — a hole,
  // wrong length, or a misplaced free cell fails here, never reaches Phase-15.
  return bingoCardSchema.parse(card);
}
