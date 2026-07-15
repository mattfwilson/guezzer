/** RED stub — real implementation lands in the GREEN commit (plan 06-11). */
import type { ShareCardData } from "@guezzer/core";

export type ShareCardFile =
  | { ok: true; file: File; previewUrl: string }
  | { ok: false; error: string };

export interface ShareOutcome {
  ok: boolean;
  method: "share" | "download" | "cancelled" | "failed";
}

export function drawShareCard(
  _ctx: CanvasRenderingContext2D,
  _data: ShareCardData,
  _opts: { width: number; height: number },
): void {
  // not implemented
}

export async function buildShareCardFile(_data: ShareCardData): Promise<ShareCardFile> {
  return { ok: false, error: "not implemented" };
}

export async function shareOrDownload(_file: File): Promise<ShareOutcome> {
  return { ok: false, method: "failed" };
}
