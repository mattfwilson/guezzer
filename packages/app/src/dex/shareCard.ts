/**
 * The share-card render + Web-Share/download flow (SHAR-02, D-18/D-19, plan
 * 06-11). Three pure-ish pieces, each guarded so a canvas/share failure surfaces
 * a calm state and NEVER throws into React or touches app data (T-06-27):
 *
 *  - `drawShareCard(ctx, data, opts)` — the fixed 1080×1350 layout drawn onto a
 *    2D context. It takes the context (never creates one) so jsdom tests can
 *    assert the draw against a recorded mock ctx (RESEARCH Pitfall 8). It does no
 *    stat math — every number is pre-assembled in core `buildShareStats`.
 *  - `buildShareCardFile(data)` — creates the canvas, guards a null getContext,
 *    draws, and resolves the PNG File + an objectURL preview. Called the instant
 *    the preview sheet OPENS, so the File already exists before any share tap
 *    (RESEARCH Pitfall 7 — iOS transient activation).
 *  - `shareOrDownload(file)` — canShare-gated: `navigator.share` with the
 *    ALREADY-BUILT file (no async work between the tap and the call), else the
 *    exportDownload.ts anchor idiom; an AbortError (user cancel) is silent.
 */
import type { BingoShareCard, BingoWinKind, RarityTier, ShareCardData } from "@guezzer/core";
import { config } from "../config.ts";
import { triggerDownload } from "../settings/triggerDownload.ts";
import { rarityColor } from "./rarityStyle.ts";

/** System-font stack (05/06-UI-SPEC) — no web-font download; matches the app chrome. */
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Chrome-only card colors (06-UI-SPEC §Color) — contract hexes only. Tier hues
 *  come from the shared `rarityColor` primitive (no local duplicate). */
const COLOR = {
  bg: "#0C0C10",
  primary: "#F5F5F7",
  muted: "#A1A1AA",
} as const;

/**
 * Data-semantic bingo-board hexes (16-UI-SPEC §Color) drawn ONLY on the bingo
 * trophy branch: a marked square is caught-green `#22C55E` with a near-black
 * label; an unmarked square is elevated `#17171F` with a `#2A2A34` edge/label.
 * Win badges reuse the recap replay gold `#F2C14E` (the earned-payoff accent).
 * Color is reinforcement only — the win WORD + free label always render, never
 * color alone (WCAG 1.4.1 / 16-UI-SPEC). */
const BINGO = {
  markedFill: "#22C55E",
  markedLabel: "#0C0C10",
  unmarkedFill: "#17171F",
  unmarkedEdge: "#2A2A34",
  badgeFill: "#F2C14E",
  badgeText: "#0C0C10",
} as const;

/** The pre-built share result — a File ready to hand to the OS + a preview URL. */
export type ShareCardFile =
  | { ok: true; file: File; previewUrl: string }
  | { ok: false; error: string };

/** The outcome of a share attempt — never a thrown error (T-06-27). */
export interface ShareOutcome {
  ok: boolean;
  method: "share" | "download" | "cancelled" | "failed";
}

/** Draw one horizontally-centered line of text at `y`, returning nothing. */
function centerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, centerX, y);
}

/** Left-aligned text at `x` (used by the vertical tier rows). */
function leftText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

/** Right-aligned text ending at `x` (used by the tier counts). */
function rightText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

/**
 * `drawShareCard(ctx, data, { width, height })` — paints the fixed portrait
 * card for either the LIFETIME collection or a PER-SHOW recap (branch on
 * `data.scope`). Pure draw: reads only `data` (pre-assembled in core) + config
 * copy; creates no canvas and does no arithmetic beyond layout positioning.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  opts: { width: number; height: number },
): void {
  const { width, height } = opts;
  const cardCopy = config.copy.share.card;
  const tierWord = config.copy.dex.tierLabels as Record<RarityTier, string>;
  const debutWord = config.copy.dex.debutBadge;
  const cx = width / 2;

  // Dominant-surface background (§Color A) — full bleed.
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, width, height);

  // Wordmark (fixed brand gold — decoupled from the legendary tier, now orange).
  centerText(ctx, cardCopy.wordmark, cx, height * 0.10, 68, config.share.wordmarkGold);

  if (data.scope === "bingo") {
    // Phase-16 Plan 06 (BINGO-08): the bingo TROPHY — the final 4×4 board + win
    // badges + date · venue, on the SAME galaxy bg + wordmark already painted
    // above. A clean visual brag ("my card from KGLW at X"), NOT the per-square
    // "which song lit it" detail (that stays the in-app replay payoff, D-22).
    drawBingoShareCard(ctx, data, { width, height });
    return;
  }

  if (data.scope === "collection") {
    // Completion % hero (Display — the collection's biggest number).
    centerText(ctx, `${data.completionPct}%`, cx, height * 0.30, 240, COLOR.primary);
    // {caught}/{total} caught — now a real HEADING (matches the GizzDex header weight).
    centerText(ctx, cardCopy.caught(data.caught, data.total), cx, height * 0.39, 110, COLOR.primary);
    // Show count caption.
    centerText(ctx, cardCopy.shows(data.showCount), cx, height * 0.435, 46, COLOR.muted);
  } else {
    // Per-show hero: the songs-caught COUNT is the dominant Display number (no
    // percentage — one show has no completion denominator).
    centerText(ctx, String(data.songsCaught), cx, height * 0.30, 240, COLOR.primary);
    centerText(ctx, cardCopy.songsCaughtLabel, cx, height * 0.375, 56, COLOR.muted);
  }

  // Rarest catch + tier word (tier in its ramp color; Legendary → orange).
  if (data.rarestCatch != null) {
    centerText(ctx, cardCopy.rarestLabel, cx, height * 0.50, 40, COLOR.muted);
    centerText(ctx, data.rarestCatch.songName, cx, height * 0.55, 56, COLOR.primary);
    centerText(
      ctx,
      tierWord[data.rarestCatch.tier],
      cx,
      height * 0.59,
      44,
      rarityColor(data.rarestCatch.tier),
    );
  }

  // Vertical six-row tier box (shared by both cards) — one row per tier in the
  // fixed order, label left / count right, both in the tier's ramp color.
  drawTierBreakdown(ctx, data.tierBreakdown, {
    leftX: width * 0.17,
    rightX: width * 0.83,
    top: height * 0.65,
    rowStep: height * 0.045,
    size: 40,
    tierWord,
    debutWord,
  });

  // Footer: honest muted date · venue — the latest attended night (collection)
  // or the show this recap card is for (show).
  const footer =
    data.scope === "collection"
      ? data.latestShow != null
        ? { label: cardCopy.latestLabel, date: data.latestShow.date, venue: data.latestShow.venue }
        : null
      : { label: cardCopy.showLabel, date: data.show.date, venue: data.show.venue };
  if (footer != null) {
    const line = footer.venue ? `${footer.date} · ${footer.venue}` : footer.date;
    centerText(ctx, footer.label, cx, height * 0.955, 38, COLOR.muted);
    centerText(ctx, line, cx, height * 0.99, 44, COLOR.primary);
  }
}

/**
 * Draw the VERTICAL six-row tier breakdown: one row per tier in the fixed order
 * the core supplies (Debut Candidate → Legendary), the tier LABEL left-aligned
 * and the caught COUNT right-aligned, both in that tier's ramp color (from the
 * shared `rarityColor` primitive — Legendary orange, debut neutral gray). All
 * six rows always render so the layout stays aligned and stable.
 */
function drawTierBreakdown(
  ctx: CanvasRenderingContext2D,
  breakdown: Array<{ tier: RarityTier | "debut"; count: number }>,
  opts: {
    leftX: number;
    rightX: number;
    top: number;
    rowStep: number;
    size: number;
    tierWord: Record<RarityTier, string>;
    debutWord: string;
  },
): void {
  const { leftX, rightX, top, rowStep, size, tierWord, debutWord } = opts;
  breakdown.forEach((row, i) => {
    const y = top + i * rowStep;
    const color = rarityColor(row.tier);
    const label = row.tier === "debut" ? debutWord : tierWord[row.tier];
    leftText(ctx, label, leftX, y, size, color);
    rightText(ctx, String(row.count), rightX, y, size, color);
  });
}

/** Trace a rounded-rect path (no fill/stroke) — arcs only, so it renders on every
 *  2D context regardless of `roundRect` support. The radius is clamped to half the
 *  smaller side so a small cell never self-overlaps. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Ellipsize `text` so it fits `maxWidth` at the CURRENT `ctx.font` (used for a
 *  single long word or an over-long final wrapped line). */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/** Greedy word-wrap `text` into at most `maxLines` lines that each fit `maxWidth`
 *  at the current font; the final line is ellipsized when words are dropped or a
 *  single word overflows. Pure over the passed context's `measureText`. */
function wrapLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  for (const word of words) {
    const trial = current === "" ? word : `${current} ${word}`;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      continue;
    }
    if (current !== "") lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      current = "";
      truncated = true;
      break;
    }
  }
  if (current !== "") {
    if (lines.length < maxLines) lines.push(current);
    else truncated = true;
  }
  const fitted = lines.map((line) => truncateToWidth(ctx, line, maxWidth));
  if (truncated && fitted.length > 0) {
    const last = fitted.length - 1;
    fitted[last] = truncateToWidth(ctx, `${fitted[last]}…`, maxWidth);
  }
  return fitted;
}

/** Draw a centered row (wrapping to further rows when a row overflows `maxWidth`)
 *  of gold win-badge pills — glyph + WORD, so the badge never reads by color
 *  alone. Returns nothing; positions are laid out from `top`. */
function drawWinBadges(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  centerX: number,
  top: number,
  maxWidth: number,
): void {
  const padX = 24;
  const gapX = 16;
  const gapY = 16;
  const badgeH = 60;
  const font = 34;
  ctx.font = `700 ${font}px ${FONT_STACK}`;
  const items = labels.map((label) => ({ label, w: ctx.measureText(label).width + padX * 2 }));

  // Greedy row packing so a full four-win board never overruns the card edge.
  const rows: { items: typeof items; w: number }[] = [];
  let row: typeof items = [];
  let rowW = 0;
  for (const item of items) {
    const add = (row.length === 0 ? 0 : gapX) + item.w;
    if (rowW + add > maxWidth && row.length > 0) {
      rows.push({ items: row, w: rowW });
      row = [item];
      rowW = item.w;
    } else {
      row.push(item);
      rowW += add;
    }
  }
  if (row.length > 0) rows.push({ items: row, w: rowW });

  rows.forEach((r, ri) => {
    let x = centerX - r.w / 2;
    const y = top + ri * (badgeH + gapY);
    for (const item of r.items) {
      roundRectPath(ctx, x, y, item.w, badgeH, badgeH / 2);
      ctx.fillStyle = BINGO.badgeFill;
      ctx.fill();
      ctx.font = `700 ${font}px ${FONT_STACK}`;
      ctx.fillStyle = BINGO.badgeText;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, x + item.w / 2, y + badgeH / 2);
      x += item.w + gapX;
    }
  });
}

/**
 * `drawBingoShareCard(ctx, data, { width, height })` — paint the Gizz-Bingo
 * trophy branch of `drawShareCard`: the final 4×4 board (marked/unmarked stamps +
 * the distinctly-marked free center), a row of win badges (or the honest no-win
 * line), and the show date · venue — all on the galaxy bg + wordmark the caller
 * already painted. Pure draw: every value is pre-assembled in core
 * `buildBingoShareCard`; names go through canvas `fillText` (inert re XSS,
 * T-16-12). No cover art, no per-square "lit by" detail (D-22).
 */
function drawBingoShareCard(
  ctx: CanvasRenderingContext2D,
  data: BingoShareCard,
  opts: { width: number; height: number },
): void {
  const { width, height } = opts;
  const cx = width / 2;
  const recapCopy = config.copy.recap;
  const winWord = recapCopy.bingoWinLabels as Record<BingoWinKind, string>;

  // 4×4 board geometry (row-major, index 0..15), centered under the wordmark.
  const boardMargin = width * 0.1;
  const boardSize = width - boardMargin * 2;
  const gap = 16;
  const cell = (boardSize - gap * 3) / 4;
  const boardLeft = boardMargin;
  const boardTop = height * 0.155;
  const radius = cell * 0.1;
  const labelSize = 24;
  const lineHeight = labelSize * 1.15;

  data.squares.forEach((square, i) => {
    const rowIndex = Math.floor(i / 4);
    const colIndex = i % 4;
    const x = boardLeft + colIndex * (cell + gap);
    const y = boardTop + rowIndex * (cell + gap);

    // Marked → caught-green fill; unmarked → elevated fill + hairline edge.
    roundRectPath(ctx, x, y, cell, cell, radius);
    ctx.fillStyle = square.marked ? BINGO.markedFill : BINGO.unmarkedFill;
    ctx.fill();
    if (!square.marked) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = BINGO.unmarkedEdge;
      ctx.stroke();
    }

    // Label: the free center draws its distinct free WORD; every other cell its
    // frozen square label. Wrapped + ellipsized to stay inside the cell.
    const text = square.isFree ? recapCopy.bingoFreeLabel : square.label;
    ctx.font = `600 ${labelSize}px ${FONT_STACK}`;
    const lines = wrapLabel(ctx, text, cell - 20, 3);
    ctx.fillStyle = square.marked ? BINGO.markedLabel : BINGO.unmarkedEdge;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const blockTop = y + cell / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, li) => ctx.fillText(line, x + cell / 2, blockTop + li * lineHeight));
  });

  // Win badges (glyph + word) — or the honest no-win line — below the board.
  const badgeTop = boardTop + boardSize + height * 0.03;
  if (data.wins.length > 0) {
    drawWinBadges(
      ctx,
      data.wins.map((kind) => `★ ${winWord[kind]}`),
      cx,
      badgeTop,
      width * 0.9,
    );
  } else {
    centerText(ctx, recapCopy.bingoNoWin, cx, badgeTop + 44, 44, COLOR.muted);
  }

  // Footer: honest muted "This show" label + the show's own date · venue — the
  // same footer slots the per-show recap card uses.
  const line = data.show.venue ? `${data.show.date} · ${data.show.venue}` : data.show.date;
  centerText(ctx, config.copy.share.card.showLabel, cx, height * 0.955, 38, COLOR.muted);
  centerText(ctx, line, cx, height * 0.99, 44, COLOR.primary);
}

/** Promisified canvas.toBlob (PNG). Resolves null if the encode is unavailable. */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * `buildShareCardFile(data)` — build the PNG File + preview URL up front (before
 * any share tap, Pitfall 7). Never throws: a null getContext, a missing toBlob,
 * or any encode failure returns `{ ok: false, error }` with the calm UI copy.
 */
export async function buildShareCardFile(data: ShareCardData): Promise<ShareCardFile> {
  try {
    const { CARD_WIDTH, CARD_HEIGHT } = config.share;
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (ctx == null) return { ok: false, error: config.copy.share.failureHeading };

    drawShareCard(ctx, data, { width: CARD_WIDTH, height: CARD_HEIGHT });

    const blob = await canvasToBlob(canvas);
    if (blob == null) return { ok: false, error: config.copy.share.failureHeading };

    const fileName =
      data.scope === "show"
        ? "guezzer-show.png"
        : data.scope === "bingo"
          ? "guezzer-bingo.png"
          : "guezzer-dex.png";
    const fileObj = new File([blob], fileName, { type: "image/png" });
    // NOT a leak / NOT centralized: previewUrl is released by ShareCardSheet's
    // effect cleanup (see ShareCardSheet L62-83), not by the download path, so
    // it must NOT route through triggerDownload's deferred revoke (RESEARCH
    // §SAFE-02). Do not "fix" this — it is intentionally left as-is.
    const previewUrl = URL.createObjectURL(blob);
    return { ok: true, file: fileObj, previewUrl };
  } catch {
    // Never throw (T-06-27): render/build failure is a calm UI state, not a crash.
    return { ok: false, error: config.copy.share.failureHeading };
  }
}

interface ShareCapableNavigator {
  canShare?: (data?: { files?: File[] }) => boolean;
  share?: (data: { files?: File[] }) => Promise<void>;
}

/**
 * `shareOrDownload(file)` — hand the ALREADY-BUILT file to the OS share sheet
 * when Web Share supports files, else fall back to the exportDownload.ts anchor
 * idiom. Called directly from the share tap with a file captured from state, so
 * no async work sits between the tap and `navigator.share` (Pitfall 7). A user
 * cancel (AbortError) is a silent success; every other failure is calm.
 */
export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  const nav = navigator as Navigator & ShareCapableNavigator;

  if (
    typeof nav.canShare === "function" &&
    typeof nav.share === "function" &&
    nav.canShare({ files: [file] })
  ) {
    try {
      // Synchronous with the tap — preserves iOS transient activation (Pitfall 7).
      await nav.share({ files: [file] });
      return { ok: true, method: "share" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: true, method: "cancelled" }; // user dismissed — normal.
      }
      return { ok: false, method: "failed" };
    }
  }

  // Fallback: the single shared anchor-download helper (SAFE-02, D-07) — it
  // defers the object-URL revoke so iOS Safari can begin the download (D-06).
  try {
    triggerDownload(file, file.name);
    return { ok: true, method: "download" };
  } catch {
    return { ok: false, method: "failed" };
  }
}
