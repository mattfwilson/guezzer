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

/** System-font stack (05/06-UI-SPEC) — no web-font download; matches the app chrome. */
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Chrome-only card colors (06-UI-SPEC §Color) — contract hexes only. Tier hues
 *  come from the shared `config.dex.tierColors` map (no local duplicate). */
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

/**
 * `drawShareCard(ctx, data, { width, height })` — paints the fixed portrait
 * card. Pure draw: reads only `data` (pre-assembled in core) + config copy;
 * creates no canvas and does no arithmetic beyond layout positioning.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  opts: { width: number; height: number },
): void {
  const { width, height } = opts;
  const cardCopy = config.copy.share.card;
  const tierWord = config.copy.dex.tierLabels as Record<RarityTier, string>;
  const cx = width / 2;

  // Dominant-surface background (§Color A) — full bleed.
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, width, height);

  // Wordmark (fixed brand gold — decoupled from the legendary tier, now orange).
  centerText(ctx, cardCopy.wordmark, cx, height * 0.13, 68, config.share.wordmarkGold);

  // Completion % hero (Display — the collection's biggest number).
  centerText(ctx, `${data.completionPct}%`, cx, height * 0.34, 240, COLOR.primary);

  // {caught}/{total} caught + show count.
  centerText(ctx, cardCopy.caught(data.caught, data.total), cx, height * 0.42, 52, COLOR.muted);
  centerText(ctx, cardCopy.shows(data.showCount), cx, height * 0.47, 46, COLOR.muted);

  // Rarest catch + tier word (tier in its ramp color; Legendary → orange).
  if (data.rarestCatch != null) {
    centerText(ctx, cardCopy.rarestLabel, cx, height * 0.58, 40, COLOR.muted);
    centerText(ctx, data.rarestCatch.songName, cx, height * 0.63, 56, COLOR.primary);
    centerText(
      ctx,
      tierWord[data.rarestCatch.tier],
      cx,
      height * 0.67,
      44,
      config.dex.tierColors[data.rarestCatch.tier],
    );
  }

  // Tier breakdown — segmented so each tier keeps its ramp color (Legendary orange).
  if (data.tierBreakdown.length > 0) {
    drawTierBreakdown(ctx, data.tierBreakdown, cx, height * 0.78, tierWord);
  }

  // Latest show (date · venue) — honest, muted footer stat.
  if (data.latestShow != null) {
    const venue = data.latestShow.venue;
    const line = venue ? `${data.latestShow.date} · ${venue}` : data.latestShow.date;
    centerText(ctx, cardCopy.latestLabel, cx, height * 0.87, 38, COLOR.muted);
    centerText(ctx, line, cx, height * 0.91, 44, COLOR.primary);
  }
}

/**
 * Draw the `3 Legendary · 12 Rare · …` breakdown centered on `centerX`, each
 * tier segment in its ramp color (from the shared `config.dex.tierColors`) and
 * the ` · ` separators muted. Uses measureText to lay the segments out
 * left-to-right from a centered origin.
 */
function drawTierBreakdown(
  ctx: CanvasRenderingContext2D,
  breakdown: Array<{ tier: RarityTier; count: number }>,
  centerX: number,
  y: number,
  tierWord: Record<RarityTier, string>,
): void {
  const size = 44;
  const sep = "  ·  ";
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const segments = breakdown.map((b) => `${b.count} ${tierWord[b.tier]}`);
  const totalWidth = segments.reduce((sum, seg, i) => {
    const sepWidth = i > 0 ? ctx.measureText(sep).width : 0;
    return sum + sepWidth + ctx.measureText(seg).width;
  }, 0);

  let x = centerX - totalWidth / 2;
  breakdown.forEach((b, i) => {
    if (i > 0) {
      ctx.fillStyle = COLOR.muted;
      ctx.fillText(sep, x, y);
      x += ctx.measureText(sep).width;
    }
    const seg = segments[i];
    ctx.fillStyle = config.dex.tierColors[b.tier];
    ctx.fillText(seg, x, y);
    x += ctx.measureText(seg).width;
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

    const fileObj = new File([blob], "guezzer-dex.png", { type: "image/png" });
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

  // Fallback: anchor download (exportDownload.ts idiom — revoke in finally).
  try {
    const url = URL.createObjectURL(file);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { ok: true, method: "download" };
  } catch {
    return { ok: false, method: "failed" };
  }
}
