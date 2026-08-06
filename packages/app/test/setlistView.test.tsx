import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveArtifact, RarityIndex } from "@guezzer/core";
import { config } from "../src/config.ts";

/**
 * SetlistView's first direct render coverage (plan 21-05, FOUND-04 / D-32 /
 * D-33). The component was previously exercised only indirectly, through
 * `showsList.test.tsx`'s retro drill-in, which asserts set headings and song
 * rows but never the header date.
 *
 * Pinned here — the two converted full-date sites, which are the same string in
 * two places and must not drift apart:
 *
 *  1. The visible header renders "Mon D, YYYY", never raw ISO.
 *  2. The dialog's `aria-label` announces that SAME text (D-33). Before the
 *     conversion it was the bare ISO date, which VoiceOver reads as a number
 *     sequence — the drill-in's only accessible name.
 *  3. The header span keeps `tabular-nums`: "Mon D, YYYY" still has a numeric
 *     day and year, so a column of dates stays optically aligned (UI-SPEC
 *     §Typography).
 *
 * `useLiveQuery` is stubbed so `db.archiveShows.get(showId)` never resolves a
 * fallback cache row and the bundled-archive branch is taken — no Dexie, no
 * fake-indexeddb, no async settling in this file.
 *
 * Phase-22 CR-02: that stub is now CONTROLLABLE, with its default behaviour
 * unchanged. `liveQuery.result` starts (and is reset after every case) at
 * `undefined`, which is exactly what the inline `() => undefined` stub returned,
 * so every case above keeps passing with no change to its body. The three new
 * cases below drive it to the object-wrapped shapes the component now reads:
 * `undefined` = still resolving, `{ row: undefined }` = resolved with no row,
 * `{ row: … }` = resolved from the offline cache.
 *
 * It is held in a `vi.hoisted` object rather than a bare module-level `let`
 * because `vi.mock` factories are hoisted above the module body — a plain `let`
 * would be in its temporal dead zone if the factory ever ran first.
 */
const liveQuery = vi.hoisted(() => ({ result: undefined as unknown }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => liveQuery.result }));

const archive = {
  schemaVersion: 1 as const,
  latestShowDate: "2026-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    {
      id: 4001,
      date: "2026-08-14",
      venue: "Brooklyn Steel",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      sets: [
        { n: "1" as const, songs: [101, 102] },
        { n: "e" as const, songs: [103] },
      ],
    },
  ],
} as unknown as ArchiveArtifact;

const rarity: RarityIndex = new Map();

const { SetlistView } = await import("../src/dex/SetlistView.tsx");

function renderSetlist() {
  return render(
    <SetlistView showId={4001} archive={archive} rarity={rarity} onClose={() => {}} />,
  );
}

afterEach(cleanup);
afterEach(() => {
  liveQuery.result = undefined;
});

describe("SetlistView — full show date (FOUND-04, D-32, D-33)", () => {
  it("renders the header date as 'Mon D, YYYY', never raw ISO", () => {
    renderSetlist();
    expect(screen.getByText("Aug 14, 2026")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-14")).toBeNull();
  });

  it("announces the same formatted date as the dialog's accessible name (D-33)", () => {
    renderSetlist();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Aug 14, 2026");
  });

  it("keeps tabular-nums on the header date span", () => {
    renderSetlist();
    expect(screen.getByText("Aug 14, 2026").className).toContain("tabular-nums");
  });

  it("still renders the venue and the set-grouped rows alongside the date", () => {
    renderSetlist();
    expect(screen.getByText("Brooklyn Steel, Brooklyn")).toBeInTheDocument();
    expect(screen.getAllByTestId("setlist-row").length).toBe(3);
  });
});

/**
 * Phase-22 CR-02 — the pending/unresolvable split (22-VALIDATION, "Carried
 * Limitation from Phase 21").
 *
 * These are POSITIVE rendered-DOM assertions, deliberately, because the Phase-21
 * lesson is that a guard's silence is not coverage: `bottomSpace.test.ts` is a
 * source pattern-matcher, so it can only object to something a surface writes
 * WRONG — it is structurally blind to a surface that omits the thing entirely.
 * That exact gap shipped a real bug in `ArchiveBrowser` (fixed in `61e0b90`).
 * `SetlistView`'s new error state is one of three surfaces 22-VALIDATION names as
 * needing rendered-DOM proof rather than guard silence, so every claim below is
 * an assertion about nodes that actually exist in the document.
 *
 * Every case asks for a `showId` that is NOT in the fixture archive, which is the
 * only way the `resolved == null` branch is reachable at all — the archive-first
 * lookup wins for show 4001 no matter what the cache read returns (which is also
 * why the four cases above, and `sheet.a11y.test.tsx`, are untouched by CR-02).
 *
 * No copy string is hardcoded here: each assertion reads `config.copy.dex`, so
 * rewording the copy cannot silently detach the test from the surface.
 */
describe("SetlistView — pending vs unresolvable (CR-02)", () => {
  const MISSING_SHOW_ID = 999999;

  function renderMissing(onClose: () => void = () => {}) {
    return render(
      <SetlistView
        showId={MISSING_SHOW_ID}
        archive={archive}
        rarity={rarity}
        onClose={onClose}
      />,
    );
  }

  it("holds the frame under an honest name while the cache read is in flight", () => {
    // `undefined` from the hook = the promise has not settled yet.
    liveQuery.result = undefined;
    renderMissing();

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe(config.copy.dex.setlistLoading);
    // The regression assertion for the exact defect: this blank, control-less
    // blocker used to announce itself to VoiceOver as "Back" — the one thing it
    // does not offer.
    expect(dialog.getAttribute("aria-label")).not.toBe(config.copy.dex.albumBack);
  });

  it("renders a labelled, escapable error once the read resolves with no row", () => {
    // `{ row: undefined }` = resolved, and there is genuinely no such row. This is
    // the state the object-wrap exists to make distinguishable.
    liveQuery.result = { row: undefined };
    const onClose = vi.fn();
    renderMissing(onClose);

    // Named for the problem, not for a control it lacks.
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
      config.copy.dex.setlistMissingHeading,
    );
    // The problem and the next step are both on screen.
    expect(screen.getByText(config.copy.dex.setlistMissingHeading)).toBeInTheDocument();
    expect(screen.getByText(config.copy.dex.setlistMissingBody)).toBeInTheDocument();

    // T-22-09: BOTH exits work, in one body — a visible ≥44px Back and Escape.
    const back = screen.getByRole("button", { name: config.copy.dex.albumBack });
    expect(back.className).toContain("min-h-11");
    expect(back.className).toContain("min-w-11");
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("still resolves a post-corpus show from the offline cache row", () => {
    // The object-wrap must not break the fallback path that the bare `cache`
    // value served before: a show absent from the bundle whose setlist rides in
    // `archiveShows`. Names come from the cached row, not the archive songs map.
    liveQuery.result = {
      row: {
        show_id: MISSING_SHOW_ID,
        date: "2026-09-02",
        venueName: "The Fillmore",
        city: "San Francisco",
        sets: [
          {
            n: "1",
            songs: [
              { songId: 501, songName: "Cached Opener" },
              { songId: 502, songName: "Cached Second" },
            ],
          },
          { n: "e", songs: [{ songId: 503, songName: "Cached Encore" }] },
        ],
      },
    };
    renderMissing();

    expect(screen.getByText("Sep 2, 2026")).toBeInTheDocument();
    expect(screen.getByText("The Fillmore, San Francisco")).toBeInTheDocument();
    expect(screen.getAllByTestId("setlist-set-heading").length).toBe(2);
    expect(screen.getAllByTestId("setlist-row").length).toBe(3);
    expect(screen.getByText("Cached Opener")).toBeInTheDocument();
    expect(screen.getByText("Cached Encore")).toBeInTheDocument();
    // Neither new CR-02 branch is reachable once a row resolves.
    expect(screen.queryByText(config.copy.dex.setlistMissingHeading)).toBeNull();
  });
});
