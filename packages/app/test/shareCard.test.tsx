import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareCardData } from "@guezzer/core";
import { config } from "../src/config.ts";
import { buildShareCardFile, drawShareCard, shareOrDownload } from "../src/dex/shareCard.ts";

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
    completionPct: 42,
    caught: 111,
    total: 264,
    showCount: 7,
    rarestCatch: { songName: "Work This Time", tier: "legendary" },
    tierBreakdown: [
      { tier: "legendary", count: 3 },
      { tier: "rare", count: 12 },
      { tier: "common", count: 96 },
    ],
    latestShow: { date: "2026-07-13", venue: "Red Rocks" },
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

describe("drawShareCard — pure (ctx, data) canvas draw (Pitfall 8)", () => {
  it("paints the #0C0C10 background, the hero %, the orange Legendary segment, and the gold wordmark", () => {
    const { ctx, calls } = makeMockCtx();

    drawShareCard(ctx as unknown as CanvasRenderingContext2D, sampleData(), {
      width: config.share.CARD_WIDTH,
      height: config.share.CARD_HEIGHT,
    });

    // Background: a full-bleed fillRect drawn in the dominant #0C0C10.
    const bg = calls.find((c) => c.fn === "fillRect");
    expect(bg).toBeTruthy();
    expect(bg?.fillStyle.toUpperCase()).toBe("#0C0C10");

    // Hero completion percentage rendered as text.
    expect(calls.some((c) => c.fn === "fillText" && String(c.args[0]).includes("42%"))).toBe(true);

    // Tier breakdown: the Legendary segment follows the tier map — now orange (§B3).
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
    vi.stubGlobal("navigator", {});
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const result = await shareOrDownload(file());

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, method: "download" });
  });

  it("treats an AbortError (user cancel) as a silent success", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("navigator", { canShare: () => true, share });

    const result = await shareOrDownload(file());

    expect(result).toEqual({ ok: true, method: "cancelled" });
  });
});
