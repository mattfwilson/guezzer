/**
 * The share-card preview bottom-sheet (SHAR-02, D-18/D-19, plan 06-11). Opened
 * from the DexHeader and RecapView Share CTAs. It self-sources the live dex via
 * `useDexStats` and, the INSTANT it opens, assembles the card numbers in core
 * (`buildShareStats`) and builds the PNG File up front (`buildShareCardFile`) —
 * so the File already exists before the share tap (RESEARCH Pitfall 7, iOS
 * transient activation). The Share button then calls `shareOrDownload` with the
 * ALREADY-BUILT file: no async work sits between the tap and `navigator.share`.
 *
 * Every failure path is calm and never touches app state (T-06-27): a build
 * failure shows "Couldn't build the card."; the Web-Share-unsupported fallback
 * downloads the PNG and shows "Card saved to your downloads."; a user cancel is
 * silent. Shares the EndShowDialog bottom-sheet idiom.
 */
import { CircleCheck, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { buildShareStats, type ShareCardData } from "@guezzer/core";
import { config } from "../config.ts";
import { Sheet } from "../components/Sheet.tsx";
import { buildShareCardFile, shareOrDownload, type ShareCardFile } from "./shareCard.ts";
import { useDexStats } from "./useDexStats.ts";

interface ShareCardSheetProps {
  /** Whether the preview sheet is shown. */
  open: boolean;
  /** Dismiss — the host clears its share state. */
  onClose: () => void;
  /**
   * Pre-built PER-SHOW card data (RecapView passes the `buildRecapShareStats`
   * result). When present the sheet builds the File from it; when ABSENT the
   * sheet self-sources the LIFETIME dex exactly as before (DexHeader path).
   */
  data?: ShareCardData;
}

/** Post-share status the sheet surfaces (share/cancel are silent → null). */
type ShareStatus = null | "saved" | "failed";

export function ShareCardSheet({ open, onClose, data }: ShareCardSheetProps) {
  const copy = config.copy.share;
  const stats = useDexStats();
  const [build, setBuild] = useState<ShareCardFile | null>(null);
  const [status, setStatus] = useState<ShareStatus>(null);

  const dex = stats.dex;
  const archive = stats.archive;
  // Per-show data is ready immediately; the lifetime path waits on the live dex.
  const selfSource = data == null;
  const ready = !selfSource || (stats.ready && dex != null && archive != null);

  // On open, assemble the card numbers in core + build the File immediately
  // (Pitfall 7: the File must exist before the tap). Revoke the preview URL on
  // close/unmount so object URLs never leak.
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    let builtUrl: string | null = null;

    setStatus(null);
    setBuild(null);
    void (async () => {
      // Prefer the pre-built per-show data; else self-source the lifetime card.
      const cardData: ShareCardData = data ?? buildShareStats(dex!, archive!);
      const result = await buildShareCardFile(cardData);
      if (cancelled) {
        if (result.ok) URL.revokeObjectURL(result.previewUrl);
        return;
      }
      if (result.ok) builtUrl = result.previewUrl;
      setBuild(result);
    })();

    return () => {
      cancelled = true;
      if (builtUrl != null) URL.revokeObjectURL(builtUrl);
    };
  }, [open, ready, data, dex, archive]);

  // Share tap — call shareOrDownload with the file captured from state. NO async
  // work precedes the navigator.share call inside it (the Pitfall-7 contract).
  const handleShare = async () => {
    if (build == null || !build.ok) return;
    const outcome = await shareOrDownload(build.file);
    if (outcome.method === "download") setStatus("saved");
    else if (!outcome.ok) setStatus("failed");
    else setStatus(null); // share / cancelled — silent.
  };

  const buildFailed = build != null && !build.ok;

  return (
    <Sheet open={open} onClose={onClose} modal variant="bottom-sheet" ariaLabel={copy.sheetLabel}>
      {/* Header row: title left, the accent share-ICON button upper-right
          (mirrors the DexHeader share-icon pattern). The share action lives
          here now; the primary full-width control below is Close. The icon stays
          disabled until the File is built so the tap always has an already-built
          file (Pitfall 7). */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.sheetLabel}
        </p>
        {!buildFailed && (
          <button
            type="button"
            disabled={build == null || !build.ok}
            onClick={() => void handleShare()}
            aria-label={copy.cta}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent touch-manipulation disabled:opacity-50"
          >
            <Share2 size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Preview / build-failure / hold frame. */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {buildFailed ? (
          <div className="flex flex-col gap-1 py-6 text-center">
            <p className="text-base font-semibold leading-tight text-text-primary">
              {copy.failureHeading}
            </p>
            <p className="text-base leading-normal text-text-muted">{copy.failureBody}</p>
          </div>
        ) : build != null && build.ok ? (
          <img
            src={build.previewUrl}
            alt={copy.sheetLabel}
            className="max-h-[52vh] w-auto rounded-md border border-hairline"
          />
        ) : (
          // Still building the File — a calm hold frame (4:5 aspect).
          <div
            aria-hidden="true"
            className="aspect-[4/5] w-40 rounded-md border border-hairline bg-surface"
          />
        )}

        {/* Post-share success (download fallback) — muted, non-blocking. */}
        {status === "saved" && (
          <p className="flex items-center gap-2 text-base leading-normal text-text-muted">
            <CircleCheck size={16} className="shrink-0" aria-hidden="true" />
            <span>{copy.savedToDownloads}</span>
          </p>
        )}
        {status === "failed" && (
          <p className="text-base leading-normal text-text-muted">{copy.failureHeading}</p>
        )}
      </div>

      {/* Primary full-width control — now CLOSE (the share action moved to the
          upper-right icon button). */}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
      >
        {copy.close}
      </button>
    </Sheet>
  );
}
