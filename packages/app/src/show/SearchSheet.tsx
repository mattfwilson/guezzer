/**
 * The fuzzy catalog search sheet (04-UI-SPEC §Layout, SHOW-04). Full-screen
 * overlay (AppMenu idiom) with a Body-size (≥16px, no iOS form-zoom) search
 * field over the FULL catalog via the core `searchCatalog` engine — the search
 * lives in core (fuse.js, swappable) and is NEVER re-implemented here.
 *
 * Two jobs, one path (both log a MISS — a search log is never a hit, D-06/D-08):
 *   1. Opener-seed: from the 04-04 pre-opener state `shownFanSongIds` is empty
 *      (nothing predicted it → honest miss, D-08), and the selected real songId
 *      becomes the new `currentSongId`, so `useShowSession` renders the first
 *      prediction fan — closing the slice-1 live loop.
 *   2. Mid-show miss: any song the model missed, logged as fast as tapping a hit
 *      (no confirm; the write-through recenters via useLiveQuery, SHOW-04).
 *
 * A no-match query surfaces the copy.show no-match line + an inline "Log as ???"
 * action reusing the ??? handler (D-14). All kglw-derived song names render as
 * React text only — never `dangerouslySetInnerHTML` (T-04-12, ASVS V5).
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { makeCatalogSearcher, toCatalog } from "@guezzer/core";
import { config } from "../config.ts";
import { loadMatrix } from "./matrix.ts";

/** The minimal payload a selected result hands back to ShowView to log. */
export interface SearchSelection {
  songId: number;
  songName: string;
}

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  /** Selecting a result → log a miss + recenter (seeds the opener pre-opener). */
  onSelect: (selection: SearchSelection) => void;
  /** No-match inline "Log as ???" → the shared instant-placeholder-miss path (D-14). */
  onUnknown: () => void;
  /**
   * Pre-opener recency-weighted opener suggestions (QUICK-260718-1no). When
   * present and the query is empty, they render under a heading BEFORE any
   * typing; selecting one flows through the same `onSelect` path as a fuzzy
   * result. Absent/empty → today's blank empty-query state (mid-show).
   */
  openerSuggestions?: { songId: number; songName: string }[];
}

export function SearchSheet({
  open,
  onClose,
  onSelect,
  onUnknown,
  openerSuggestions,
}: SearchSheetProps) {
  const copy = config.copy.show;
  const [query, setQuery] = useState("");

  // Build the core fuse.js searcher ONCE over the full catalog (sub-ms on 264
  // items). Memoized so the index is not rebuilt per keystroke. The searcher is
  // bounded to the catalog — the query never becomes a regex/DOM/network sink
  // (T-04-11). Matrix is guaranteed loaded here (ShowView gates on matrixOk).
  const searcher = useMemo(() => {
    const result = loadMatrix();
    const nodes = result.ok ? result.matrix.nodes : [];
    return makeCatalogSearcher(toCatalog(nodes));
  }, []);

  if (!open) return null;

  const results = searcher(query);
  const noMatch = query.trim() !== "" && results.length === 0;
  // Pre-opener: with an empty query and suggestions provided, show the top
  // openers before any typing. Typing (non-empty query) always shows fuzzy
  // results; clearing back to empty returns here.
  const showOpenerSuggestions =
    query.trim() === "" && !!openerSuggestions && openerSuggestions.length > 0;

  const reset = () => setQuery("");

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelect = (selection: SearchSelection) => {
    reset();
    onSelect(selection);
  };

  const handleUnknown = () => {
    reset();
    onUnknown();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.searchPlaceholder}
      className="fixed inset-0 flex flex-col bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
    >
      {/* Search field row — Body typography (text-base = 16px) avoids iOS zoom. */}
      <div
        className="flex items-center gap-2 border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <Search size={22} className="text-text-muted" />
        <input
          type="text"
          inputMode="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          className="min-h-11 flex-1 bg-transparent text-base leading-normal text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="button"
          aria-label="Close search"
          onClick={handleClose}
          className="flex min-h-11 min-w-11 items-center justify-center text-text-muted touch-manipulation"
        >
          <X size={22} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Pre-opener suggestions — a heading + the top recency-weighted openers,
            shown before typing. Rows reuse the exact result-row markup so
            selection flows through the unchanged onSelect path (QUICK-260718-1no). */}
        {showOpenerSuggestions && (
          <>
            <p className="px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
              {copy.openerSuggestionsHeading}
            </p>
            {openerSuggestions.map((suggestion) => (
              <button
                key={suggestion.songId}
                type="button"
                onClick={() =>
                  handleSelect({
                    songId: suggestion.songId,
                    songName: suggestion.songName,
                  })
                }
                className="flex min-h-11 w-full items-center border-b border-hairline px-4 py-3 text-left text-base leading-normal text-text-primary touch-manipulation"
              >
                {suggestion.songName}
              </button>
            ))}
          </>
        )}

        {/* Result rows — ≥44px, song name as React text only (never HTML). */}
        {results.map((result) => (
          <button
            key={result.songId}
            type="button"
            onClick={() =>
              handleSelect({ songId: result.songId, songName: result.songName })
            }
            className="flex min-h-11 w-full items-center border-b border-hairline px-4 py-3 text-left text-base leading-normal text-text-primary touch-manipulation"
          >
            {result.songName}
          </button>
        ))}

        {/* No-match → offer logging it as ??? inline (rename later, D-14/D-15). */}
        {noMatch && (
          <div className="px-4 py-6 text-center">
            <p className="text-[20px] font-semibold leading-tight text-text-primary">
              {copy.searchNoMatchHeading}
            </p>
            <p className="mt-2 text-base leading-normal text-text-muted">
              {copy.searchNoMatchBody}
            </p>
            <button
              type="button"
              onClick={handleUnknown}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {copy.unknownCta}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
