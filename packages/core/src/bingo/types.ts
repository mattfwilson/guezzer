/**
 * Gizz-bingo core contract: the serializable `BingoCard` JSON shape, the
 * string-literal unions, the marking types, and the zod schema that Phase-15
 * import validation will reject malformed cards against (T-14-01).
 *
 * Pure core: zero I/O, no Dexie/DOM, no `Date.now()`/`Math.random()`. Every
 * closed vocabulary is a `values as const` tuple + derived string-literal
 * union — never an `enum` (erasable-syntax-only, Node native `.ts` execution).
 * Mirrors the `tuning-tags.ts` / `archive-types.ts` `schemaVersion: 1` header
 * discipline and the paired `z.strictObject` + `z.infer` idiom.
 *
 * D-21: `seed` is an explicit `string` (NOT a number) — a reshuffle is a new
 * seed string. D-24: `bingoEventValues` omits the mid-song transition event
 * (not trail-derivable). Phase-15 persistence fields
 * (cardId/sessionId/generatedAt/lockedAt) are
 * deliberately absent — the Dexie row wraps this pure `BingoCard`, core mints
 * no ids.
 */
import { z } from "zod";

/** D-02/D-03: the three card difficulty vibes. Closed vocabulary, not extensible. */
export const bingoVibeValues = ["chill", "balanced", "glory"] as const;
export type BingoVibe = (typeof bingoVibeValues)[number];

/**
 * D-24: trail-derivable board events. The mid-song transition event is
 * excluded (not derivable from the trail contract), as are covers/encore/
 * set-2. Closed vocabulary.
 */
export const bingoEventValues = [
  "opener",
  "microtonal",
  "marathonJam",
  "bustOut",
  "neverCaught",
] as const;
export type BingoEvent = (typeof bingoEventValues)[number];

/** The four win shapes detectWins can report over a marked card. */
export const bingoWinKindValues = ["line", "corners", "x", "blackout"] as const;
export type BingoWinKind = (typeof bingoWinKindValues)[number];

/**
 * One resolved board square, discriminated on `kind`. `free` carries no
 * payload (the pre-marked center); `song`/`album`/`event` carry their resolved
 * identity + a display `label` frozen at deal time.
 */
export type BingoSquareDef =
  | { kind: "free" }
  | { kind: "song"; songId: number; label: string }
  | { kind: "album"; albumUrl: string; label: string }
  | { kind: "event"; event: BingoEvent; label: string };

/**
 * The serializable card artifact (RESEARCH §"BingoCard serializable JSON
 * shape"). `squares` is length 16, row-major, with exactly one `{kind:"free"}`
 * at `freeIndex`. `seed` is a string (D-21); `corpusVersion` scopes the
 * deal's determinism to a corpus snapshot.
 */
export interface BingoCard {
  schemaVersion: 1;
  seed: string;
  vibe: BingoVibe;
  corpusVersion: string;
  freeIndex: number;
  squares: BingoSquareDef[];
}

/**
 * D-06: sentinel `markedByPosition` for the pre-marked free cell — it is
 * marked from the start with no trail position responsible for it. Every
 * other marked square records the trail `position` that consumed it.
 */
export const FREE_SENTINEL = -1;

/**
 * One square after marking: the frozen `def`, its board `index` (0..15), and
 * the trail `position` that marked it (`FREE_SENTINEL` for the free cell,
 * `null` while still unmarked).
 */
export interface MarkedSquare {
  def: BingoSquareDef;
  index: number;
  markedByPosition: number | null;
}

/** The result of the pure marking fold over a trail. */
export interface MarkedCard {
  squares: MarkedSquare[];
  markedCount: number;
}

/** One detected win: its shape + the board indices forming it. */
export interface Win {
  kind: BingoWinKind;
  indices: number[];
}

/**
 * Discriminated square schema (mirrors archive-types.ts's strictObject
 * discipline). `z.discriminatedUnion("kind", ...)` keeps Phase-15 import
 * validation exhaustive — an unknown `kind` or a leaked extra key hard-fails.
 */
const bingoSquareDefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("free") }),
  z.strictObject({
    kind: z.literal("song"),
    songId: z.number().int(),
    label: z.string(),
  }),
  z.strictObject({
    kind: z.literal("album"),
    albumUrl: z.string(),
    label: z.string(),
  }),
  z.strictObject({
    kind: z.literal("event"),
    event: z.enum(bingoEventValues),
    label: z.string(),
  }),
]);

/**
 * T-14-01 mitigation: the trust-boundary contract Phase-15 rejects malformed
 * cards against. `z.strictObject` fails on any unexpected key; the
 * `superRefine` enforces the two structural invariants the type system can't
 * (16 squares; exactly one `free` at `freeIndex`) — mirrors tuning-tags.ts.
 */
export const bingoCardSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    seed: z.string(),
    vibe: z.enum(bingoVibeValues),
    corpusVersion: z.string(),
    freeIndex: z.number().int(),
    squares: z.array(bingoSquareDefSchema),
  })
  .superRefine((card, ctx) => {
    if (card.squares.length !== 16) {
      ctx.addIssue({
        code: "custom",
        message: `BingoCard.squares must have length 16 — got ${card.squares.length}.`,
        path: ["squares"],
      });
    }
    const freeIndices = card.squares.flatMap((square, index) =>
      square.kind === "free" ? [index] : [],
    );
    if (freeIndices.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `BingoCard must contain exactly one {kind:"free"} square — got ${freeIndices.length}.`,
        path: ["squares"],
      });
    } else if (freeIndices[0] !== card.freeIndex) {
      ctx.addIssue({
        code: "custom",
        message: `The single {kind:"free"} square is at index ${freeIndices[0]} but freeIndex is ${card.freeIndex} — they must match.`,
        path: ["squares", freeIndices[0], "kind"],
      });
    }
  });

/**
 * `z.infer`-derived alias, cross-checked structurally against the hand-written
 * `BingoCard` at compile time (the assignment below fails to typecheck if the
 * schema and interface ever drift).
 */
export type BingoCardParsed = z.infer<typeof bingoCardSchema>;

// Compile-time bidirectional structural cross-check: schema output <-> interface.
const _cardSchemaMatchesInterface: (card: BingoCard) => BingoCardParsed = (card) => card;
const _interfaceMatchesCardSchema: (card: BingoCardParsed) => BingoCard = (card) => card;
void _cardSchemaMatchesInterface;
void _interfaceMatchesCardSchema;
