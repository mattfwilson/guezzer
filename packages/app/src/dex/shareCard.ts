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
import type { RarityTier, ShareCardData } from "@guezzer/core";
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

    const fileName = data.scope === "show" ? "guezzer-show.png" : "guezzer-dex.png";
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
