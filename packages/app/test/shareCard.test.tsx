import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareCardData } from "@guezzer/core";
import { config } from "../src/config.ts";
import { buildShareCardFile, drawShareCard, shareOrDownload } from "../src/dex/shareCard.ts";

// The ShareCardSheet render tests below drive `useDexStats`, which bundle-imports
// the archive + album artifacts through the `@archive` / `@dexAlbums` aliases —
// stub them with tiny schemaVersion-1 fixtures so the sheet reaches its build step.
vi.mock("@archive", () => ({
  default: {
    schemaVersion: 1,
    latestShowDate: "2019-02-01",
    songs: { "101": "Rattlesnake" },
    shows: [
      {
        id: 8001,
        date: "2019-01-01",
        venue: "V1",
        city: "C1",
        state: null,
        country: "US",
        sets: [{ n: "1", songs: [101] }],
      },
    ],
  },
}));
vi.mock("@dexAlbums", () => ({
  default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } },
}));

const { ShareCardSheet } = await import("../src/dex/ShareCardSheet.tsx");
const { db } = await import("../src/db/db.ts");

/**
 * Share-card contract (SHAR-02, D-18/D-19, RESEARCH Pitfalls 7-8, plan 06-11).
 * All card NUMBERS come from core `buildShareStats` (tested in core); here we
 * pin the app draw + Web-Share/download flow:
 *  - `drawShareCard` is a pure (ctx, data) draw — asserted against a recorded
 *    mock ctx (jsdom has no canvas — Pitfall 8): the #0C0C10 background fillRect,
 *    the hero percentage string, the orange Legendary tier-breakdown segment, and
 *    the brand-gold wordmark (decoupled from the legendary tier hue).
 *  - `buildShareCardFile` returns a calm { ok: false } when getContext is null
 *    (the jsdom default — the natural never-throw test, T-06-27).
 *  - `shareOrDownload` gates on canShare: share when supported, anchor download
 *    when absent, and a silent "cancelled" on an AbortError.
 */

function sampleData(): ShareCardData {
  return {
    scope: "collection",
    completionPct: 42,
    caught: 111,
    total: 264,
    showCount: 7,
    rarestCatch: { songName: "Work This Time", tier: "legendary" },
    // Six rows, fixed order [debut … legendary], 0 where none.
    tierBreakdown: [
      { tier: "debut", count: 0 },
      { tier: "common", count: 96 },
      { tier: "uncommon", count: 0 },
      { tier: "rare", count: 12 },
      { tier: "epic", count: 0 },
      { tier: "legendary", count: 3 },
    ],
    latestShow: { date: "2026-07-13", venue: "Red Rocks" },
  };
}

/** A per-show recap card — the songs-caught hero + show-scoped tier rows. */
function showData(): ShareCardData {
  return {
    scope: "show",
    songsCaught: 18,
    show: { date: "2026-07-13", venue: "Red Rocks" },
    rarestCatch: { songName: "Work This Time", tier: "legendary" },
    tierBreakdown: [
      { tier: "debut", count: 1 },
      { tier: "common", count: 9 },
      { tier: "uncommon", count: 3 },
      { tier: "rare", count: 3 },
      { tier: "epic", count: 1 },
      { tier: "legendary", count: 1 },
    ],
  };
}

interface RecordedCall {
  fn: string;
  args: unknown[];
  fillStyle: string;
}

function makeMockCtx() {
  const calls: RecordedCall[] = [];
  const ctx = {
    fillStyle: "" as string,
    font: "" as string,
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    fillRect(...args: unknown[]) {
      calls.push({ fn: "fillRect", args, fillStyle: String(this.fillStyle) });
    },
    fillText(...args: unknown[]) {
      calls.push({ fn: "fillText", args, fillStyle: String(this.fillStyle) });
    },
    measureText(text: string) {
      return { width: text.length * 12 } as TextMetrics;
    },
    save() {},
    restore() {},
  };
  return { ctx, calls };
}

const file = () => new File(["png-bytes"], "guezzer-dex.png", { type: "image/png" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ShareCardSheet — <Sheet> migration (A11Y-01, 08-03)", () => {
  beforeEach(async () => {
    await db.attendedShows.clear();
    await db.trackedShows.clear();
    await db.trackedEntries.clear();
    await db.archiveShows.clear();
  });
  afterEach(cleanup);

  it("V7: renders the calm build-failure branch (getContext null in jsdom) without throwing", async () => {
    // jsdom has no canvas backend → buildShareCardFile resolves { ok: false },
    // so the sheet must surface the failure copy — never throw (T-08-08).
    render(<ShareCardSheet open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(config.copy.share.failureHeading)).toBeTruthy();
    });
  });

  it("A11Y-01: Escape dismisses the bottom-sheet (onClose)", () => {
    const onClose = vi.fn();
    render(<ShareCardSheet open onClose={onClose} />);

    // The sheet chrome (title) renders immediately, before the async build.
    expect(screen.getAllByText(config.copy.share.sheetLabel).length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("drawShareCard — pure (ctx, data) canvas draw (Pitfall 8)", () => {
  it("paints the #0C0C10 background, the hero %, the orange Legendary row, and the gold wordmark", () => {
    const { ctx, calls } = makeMockCtx();

    drawShareCard(ctx as unknown as CanvasRenderingContext2D, sampleData(), {
      width: config.share.CARD_WIDTH,
      height: config.share.CARD_HEIGHT,
    });

    // Background: a full-bleed fillRect drawn in the dominant #0C0C10.
    const bg = calls.find((c) => c.fn === "fillRect");
    expect(bg).toBeTruthy();
    expect(bg?.fillStyle.toUpperCase()).toBe("#0C0C10");

    // Lifetime card keeps its completion-% hero.
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]).includes("42%"))).toBe(true);

    // Tier breakdown: the Legendary row label follows the tier map — now orange (§B3).
    const legendary = calls.find(
      (c) => c.fn === "fillText" && String(c.args[0]).includes("Legendary"),
    );
    expect(legendary).toBeTruthy();
    expect(legendary?.fillStyle.toUpperCase()).toBe("#FB923C");

    // Wordmark: fixed brand gold, decoupled from the (now orange) legendary tier.
    const wordmark = calls.find(
      (c) => c.fn === "fillText" && String(c.args[0]) === config.copy.share.card.wordmark,
    );
    expect(wordmark).toBeTruthy();
    expect(wordmark?.fillStyle.toUpperCase()).toBe("#F2C14E");
  });

  it("draws the six-tier VERTICAL box in fixed order with right-aligned tier-colored counts", () => {
    const { ctx, calls } = makeMockCtx();

    drawShareCard(ctx as unknown as CanvasRenderingContext2D, sampleData(), {
      width: config.share.CARD_WIDTH,
      height: config.share.CARD_HEIGHT,
    });

    const tierWord = config.copy.dex.tierLabels;
    const debutWord = config.copy.dex.debutBadge;
    const tierColors = config.dex.tierColors;

    // All six tier labels present, in the fixed least→most-rare order. Use
    // findLastIndex so the box's Legendary row is picked, not the earlier
    // rarest-catch tier word (which also renders "Legendary").
    const labelOrder = [debutWord, tierWord.common, tierWord.uncommon, tierWord.rare, tierWord.epic, tierWord.legendary];
    const drawnLabelIdx = labelOrder.map((label) =>
      calls.findLastIndex((c) => c.fn === "fillText" && String(c.args[0]) === label),
    );
    expect(drawnLabelIdx.every((i) => i >= 0)).toBe(true);
    // Monotonic increasing draw order = the rows render top→bottom in fixed order.
    for (let i = 1; i < drawnLabelIdx.length; i++) {
      expect(drawnLabelIdx[i]).toBeGreaterThan(drawnLabelIdx[i - 1]);
    }

    // Each label draws in its own tier hue (debut neutral gray, legendary orange).
    const debut = calls.find((c) => c.fn === "fillText" && String(c.args[0]) === debutWord);
    expect(debut?.fillStyle.toUpperCase()).toBe(tierColors.debut.toUpperCase());

    // The legendary COUNT ("3") draws right-aligned (textAlign "right") in the legendary hue.
    const legendaryCount = calls.find(
      (c) => c.fn === "fillText" && String(c.args[0]) === "3" && c.fillStyle.toUpperCase() === "#FB923C",
    );
    expect(legendaryCount).toBeTruthy();
  });

  it("per-show card draws the songs-caught COUNT hero (no %) and its own tier rows", () => {
    const { ctx, calls } = makeMockCtx();

    drawShareCard(ctx as unknown as CanvasRenderingContext2D, showData(), {
      width: config.share.CARD_WIDTH,
      height: config.share.CARD_HEIGHT,
    });

    // Hero is the songs-caught count "18" — NOT a percentage.
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]) === "18")).toBe(true);
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]).includes("%"))).toBe(false);
    // The show caption + footer label render.
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]) === config.copy.share.card.songsCaughtLabel)).toBe(true);
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]) === config.copy.share.card.showLabel)).toBe(true);
    // The vertical box still renders every tier label (shared renderer).
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]) === config.copy.dex.tierLabels.epic)).toBe(true);
  });
});

describe("buildShareCardFile — never-throw file build (T-06-27)", () => {
  it("returns a calm { ok: false } when the 2D context is unavailable (jsdom)", async () => {
    // jsdom has no canvas backend → getContext('2d') yields null.
    const result = await buildShareCardFile(sampleData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(config.copy.share.failureHeading);
  });
});

describe("shareOrDownload — canShare-gated share vs download vs cancelled", () => {
  it("shares via navigator.share when canShare accepts the file", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { canShare, share });

    const result = await shareOrDownload(file());

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, method: "share" });
  });

  it("falls back to an anchor download when Web Share is unsupported", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("navigator", {});
      const createObjectURL = vi.fn(() => "blob:mock");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

      const result = await shareOrDownload(file());

      expect(createObjectURL).toHaveBeenCalled();
      // SAFE-02 (D-06): the revoke is now DEFERRED via triggerDownload — it must
      // NOT fire on the click tick, only after OBJECT_URL_REVOKE_DELAY_MS.
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(result).toEqual({ ok: true, method: "download" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats an AbortError (user cancel) as a silent success", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("navigator", { canShare: () => true, share });

    const result = await shareOrDownload(file());

    expect(result).toEqual({ ok: true, method: "cancelled" });
  });
});
