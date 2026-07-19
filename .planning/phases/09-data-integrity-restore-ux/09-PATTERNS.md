# Phase 9: Data Integrity & Restore UX - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9 (every target has an in-repo analog; no RESEARCH.md fallback needed)

## File Classification

| New/Modified File | Change | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `packages/core/src/domain/types.ts` | modify (add `shownotes` to `NormalizedShow`) | model | transform | `Performance.footnote` field in same file | exact (same file, same "carried verbatim, untrusted" doc convention) |
| `packages/core/src/ingest/normalize.ts` | modify (carry shownotes, add stats counter) | service (pure normalizer) | transform (raw rows → domain) | its own `settype` consistency check (structure) + `showsExcludedBySettype` stats (reporting) + `parseFootnotesGuarded` (tolerance ethos) | exact (self-analog) |
| `packages/core/src/cli/normalize-corpus.ts` | modify (print new stat) | config/CLI | file-I/O + batch | `formatNormalizeSummary` in same file | exact |
| `packages/core/test/normalize.test.ts` | modify (shownotes end-to-end test) | test | transform | existing fixture tests + synthetic `makeRow` tests in same file | exact |
| `packages/core/test/fixtures/*.json` + `.meta.json` | possibly new fixture (planner may reuse existing) | test fixture | n/a | `2022-rr1010-multiset.json` + `.meta.json` | exact |
| `data/normalized/corpus.json` | regenerate (planner's discretion, D-05) | build artifact | batch | produced by `runNormalizeCorpus`; reviewed via `git diff` | exact |
| `packages/app/src/settings/importPicker.ts` (or sibling helper file) | modify (extract `isMine` decision as pure fn — Claude's discretion) | utility (pure decision fn) | request-response | `classifyImport` in same file | exact |
| `packages/app/src/settings/SettingsView.tsx` | modify (only if helper extracted — `resolveNamePrompt` delegates) | component | request-response | its own `resolveNamePrompt` → `classifyImport` call-site style in `handleImport` | exact (self-analog) |
| `packages/app/test/settingsOwner.test.tsx` + `packages/app/test/importFork.test.ts` | modify (typed-name evicted-DB merge coverage) | test | event-driven (component) / CRUD (Dexie) | existing tests in the same two files | exact |

## Pattern Assignments

### DATA-06 — `packages/core/src/domain/types.ts` (model, transform)

**Analog:** the `footnote` field on `Performance` — the existing "carried verbatim, untrusted" field convention (`packages/core/src/domain/types.ts` lines 36–37):

```typescript
  /** Plain display footnote string (never JSON-wrapped) — carried verbatim, untrusted content (docs/SCHEMA.md §12). */
  footnote: string;
```

**Where the new field goes:** `NormalizedShow` (lines 64–73). It sits show-level, next to the other first-row-denormalized fields (`tourName`, `venue`). Add `shownotes: string;` with the same §12 doc-comment style. Type is `string`, NOT `string | null` — the raw schema is `shownotes: z.string()` (never null in the API), and D-02 says empty string is carried as `""`, never coerced.

**Do NOT bump:** `NormalizedCorpus.schemaVersion: 1` (lines 80–87) stays literal `1` per D-04 — additive field, all `schemaVersion === 1` guards keep working.

---

### DATA-06 — `packages/core/src/ingest/normalize.ts` (normalizer, transform)

Three self-analogs inside this file. **Read carefully — one is an anti-pattern for this feature.**

**1. Show-level field carry (COPY THIS):** the `firstRow` denormalization block, lines 218–234:

```typescript
    const firstRow = showRows[0];
    normalizedShows.push({
      showId,
      date: showDate,
      showOrder: firstRow.showorder,
      ...
      tourId: firstRow.tour_id,
      tourName: firstRow.tourname,
      sets,
    });
```

**CRITICAL SUBTLETY:** `firstRow` is `showRows[0]` — *unsorted input order*, not position order. D-01 says **position-1 row wins**. Use `sortedRows[0]` (the position-sorted copy built at line 154) for the shownotes value, i.e. `shownotes: sortedRows[0].shownotes`. Note `sortedRows` is currently declared inside the loop after the settype check — the shownotes carry must read it after that declaration (or hoist).

**2. Within-show consistency detection (COPY THE DETECTION, NOT THE THROW):** the `settype` mixed-value check, lines 140–146:

```typescript
    const settypesInShow = new Set(showRows.map((row) => row.settype));
    if (settypesInShow.size > 1) {
      throw new Error(
        `Show ${showId} (${showDate}) has mixed settype values across its rows: ` + ...
      );
    }
```

For shownotes: same `Set` construction (`new Set(showRows.map((row) => row.shownotes))`, `.size > 1`), but **record in stats instead of throwing** (D-01: prose is non-structural, never break a corpus refresh). This is the fail-loud vs. carry-tolerant split named in CONTEXT.md — settype is the structural side; shownotes joins footnotes on the tolerant side.

**3. Stats-counter shape (COPY THIS):** `NormalizeStats` (lines 22–31) and the `showsExcludedBySettype` accumulation pattern (line 130 init, lines 148–151 push):

```typescript
export interface NormalizeStats {
  totalRowsValidated: number;
  nonKglwRowsExcluded: number;
  /** Shows dropped because their settype is not in config.settypeAllowlist (D-16). */
  showsExcludedBySettype: Array<{ showId: number; showDate: string; settype: string }>;
  showsIncluded: number;
}
```

Add the D-01 disagreement counter as one more field. The existing precedent carries identifying context (`showId`, `showDate`) per entry, not a bare count — mirror that (e.g. `showsWithShownotesDisagreement: Array<{ showId: number; showDate: string }>`) so build output can name offending shows. A plain `number` is also defensible; the array form matches the established struct better. Populate it in the same per-show loop, then include it in the `stats` object literal at lines 252–257.

**4. Tolerance ethos reference (D-15, spirit only):** `parseFootnotesGuarded` (lines 73–88) — "NEVER throws" on malformed prose. Shownotes needs no parsing at all (verbatim byte-for-byte, D-02: no trim, no HTML strip, `\r\n` preserved, `""` stays `""`), so there is no guarded parse to write — the ethos just means: no validation, no transformation, no throw.

---

### DATA-06 — `packages/core/src/cli/normalize-corpus.ts` (CLI, file-I/O)

**Analog:** `formatNormalizeSummary`, lines 86–94 — the existing stats-printing pattern:

```typescript
export function formatNormalizeSummary(result: NormalizeCorpusCliResult): string {
  const { corpus, stats } = result;
  const excludedSettypes =
    stats.showsExcludedBySettype.map((show) => show.settype).join(", ") || "none";
  return (
    `Normalized ${corpus.showCount} shows, ${corpus.songCount} distinct songs, latest show ${corpus.latestShowDate}. ` +
    `Excluded ${stats.nonKglwRowsExcluded} non-KGLW rows and ${stats.showsExcludedBySettype.length} shows by settype (${excludedSettypes}).`
  );
}
```

Append the disagreement count to this string ("D-01: visible in build output"). No other CLI change — the artifact write (line 81) already serializes whatever `normalizeCorpus` returns with stable 2-space JSON + trailing LF:

```typescript
  await writeFile(options.outPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
```

**Regeneration invariant (planner's discretion per CONTEXT):** `packages/core/src/cli/build-archive.ts` lines 22 (`MAX_ARCHIVE_BYTES = 250 * 1024`) and 76–81 (the fail-loud budget guard) are why shownotes must never reach `deriveArchive` output (D-06). `deriveArchive` reads only specific `NormalizedShow` fields, so an added field is ignored — if corpus.json is regenerated, re-running `build-archive.ts` and `build-model.ts` must produce byte-identical committed outputs (`git diff` is the review mechanism), and the archive-budget guard proves D-06 automatically.

---

### DATA-06 — `packages/core/test/normalize.test.ts` (test, transform)

Two analog styles in this one file — the end-to-end test likely wants both.

**1. Real-fixture end-to-end style** (fixture import lines 9–16, Fixture E test lines 222–235):

```typescript
import fixture2022Rr1010Multiset from "./fixtures/2022-rr1010-multiset.json" with { type: "json" };
...
  it("Fixture E (2022-rr1010-multiset): 2 sets split exactly at position 13/14 ...", () => {
    const { corpus } = normalizeCorpus(fixture2022Rr1010Multiset);
    expect(corpus.shows.length).toBe(1);
    const show = corpus.shows[0];
    ...
```

Existing fixtures **already carry real shownotes prose** — verified: `2022-rr1010-multiset.json` rows contain the Red Rocks tease narration ("An I In Heaven? was teased prior to Magenta Mountain…", the exact §12 example with embedded `\r\n`), and `2013-encore.json` has 10 shownotes values. The verbatim end-to-end assertion can be raw→domain exact equality against the fixture row's own value: `expect(corpus.shows[0].shownotes).toBe((fixture[0] as { shownotes: string }).shownotes)` — no new fixture strictly required. If the planner wants a dedicated fixture anyway, the `.meta.json` companion pattern is `packages/core/test/fixtures/2022-rr1010-multiset.meta.json`:

```json
{
  "sourceFile": "data/samples/rr1010.json",
  "showId": 1678309429,
  "showdate": "2022-10-10",
  "why": "Red Rocks 2022-10-10 marathon show — ..."
}
```

**2. Synthetic-row style for the disagreement case** (lines 18–23 and Test 7, lines 139–156):

```typescript
const baseRow = { ...rr1010.data[0] };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}
...
    const rows = [
      makeRow({ show_id: 999001, showdate: "2020-01-01", position: 1, setnumber: "1" }),
      makeRow({ show_id: 999001, showdate: "2020-01-01", position: 2, setnumber: "1" }),
      ...
    ];
```

Use `makeRow({ ..., shownotes: "A" })` vs `shownotes: "B"` rows in one show to assert: (a) position-1 value wins on the domain object, (b) the stats counter records the show, (c) no throw. Also cover D-02 edges synthetically: `shownotes: ""` carried as `""`, and a value with `\r\n` + HTML anchors preserved byte-for-byte (the `baseRow` from `rr1010.data[0]` already has such a value).

Note the existing describe-block naming convention: `"normalizeCorpus — synthetic edge cases"` / `"Test N: <behavior sentence>"`.

---

### PWA-05 — `packages/app/src/settings/importPicker.ts` (pure decision helper, request-response)

**The logic under test** — `resolveNamePrompt` in `packages/app/src/settings/SettingsView.tsx` lines 117–137 (behavior landed in commit `e08ceee`; do not change it, extract/test it):

```typescript
  const resolveNamePrompt = () => {
    if (namePrompt == null) return;
    const answer = promptName.trim();
    const a = answer.toLowerCase();
    const localOwner = (ownerName ?? "").trim().toLowerCase();
    // "It's mine → restore" if the typed name matches the local owner OR the FILE's
    // own owner. The file-owner match is the WARNING-1 hardening: on an evicted-DB
    // reinstall the local owner is unknown ("") ...
    const fileOwner = namePrompt.envelope.owner?.trim().toLowerCase();
    const isMine =
      answer !== "" &&
      ((localOwner !== "" && a === localOwner) || (fileOwner != null && a === fileOwner));
    if (isMine) {
      mergeFile(namePrompt.file);
    } else {
      setCompareEnvelope({ ...namePrompt.envelope, owner: answer || null });
    }
    setNamePrompt(null);
    setPromptName("");
  };
```

**Extraction analog (CONTEXT says "mirrors classifyImport's style"):** `classifyImport` in `packages/app/src/settings/importPicker.ts` lines 51–81 — a pure exported function, no DB/DOM touch, doc-commented with its fork semantics, nullable-string inputs handled by trim+lowercase:

```typescript
export function classifyImport(
  rawJson: string,
  localOwnerName: string | null,
): ImportClassification {
  ...
  const fileOwner = envelope.owner?.trim();
  if (!fileOwner) return { kind: "unowned", envelope };
  const local = localOwnerName?.trim().toLowerCase();
  if (!local) return { kind: "unowned", envelope };
  if (local === fileOwner.toLowerCase()) return { kind: "mine", rawJson };
  return { kind: "friend", envelope };
}
```

Extracted helper shape to mirror: e.g. `export function isTypedNameMine(typedName: string, localOwnerName: string | null, fileOwner: string | null | undefined): boolean` living in `importPicker.ts` next to `classifyImport` (or a sibling module), with `resolveNamePrompt` delegating to it. **Caution:** `settingsOwner.test.tsx` mocks the whole `importPicker.ts` module (see below) — if the helper lands in `importPicker.ts`, the existing `vi.mock` factory must gain the real (or re-exported) helper or the SettingsView tests break. Putting it in its own file (e.g. `settings/ownerMatch.ts`) sidesteps that; either way is consistent with the analog. CONTEXT explicitly allows component-only testing if extraction fights the code.

---

### PWA-05 — `packages/app/test/settingsOwner.test.tsx` (component test, event-driven)

**Analog:** the existing prompt tests in the same file. The wiring to copy verbatim:

**Module mock + hoisted envelope** (lines 16–35) — this is how the "Whose dex is this?" prompt is driven without a native picker:

```tsx
const { pickAndImportMock, unownedEnvelope } = vi.hoisted(() => ({
  pickAndImportMock: vi.fn(),
  unownedEnvelope: {
    schemaVersion: 2,
    exportedAt: "2026-07-14T00:00:00.000Z",
    owner: null,
    meta: [], attendedShows: [], archiveShows: [], trackedShows: [], trackedEntries: [],
  },
}));

vi.mock("../src/settings/importPicker.ts", () => ({
  openBackupFilePicker: (onFile: (file: File) => void) =>
    onFile(new File(["{}"], "backup.json", { type: "application/json" })),
  classifyImport: () => ({ kind: "unowned", envelope: unownedEnvelope }),
  pickAndImport: (...args: unknown[]) => pickAndImportMock(...args),
}));
```

**For the PWA-05 gap test**, the mocked classifier must return an **owned** envelope (`owner: "Matt"`) with kind `unowned` (the evicted-DB WARNING-1 shape) while the local `ownerName` meta row stays unset (`clearTables()` already guarantees that, lines 134–140).

**Prompt-open helper + the two existing resolution tests** (lines 156–208) — the new test is the third route: type the FILE's owner name, click confirm, assert merge:

```tsx
  async function openPrompt(): Promise<HTMLInputElement> {
    render(<SettingsView />);
    fireEvent.click(screen.getByText(config.copy.settings.importCta));
    return (await screen.findByPlaceholderText(
      compareCopy.namePromptPlaceholder,
    )) as HTMLInputElement;
  }

  it("'It's mine — merge it' routes to the restore/merge path", async () => {
    await openPrompt();
    fireEvent.click(screen.getByText(compareCopy.namePromptMine));
    expect(pickAndImportMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(config.copy.settings.importSuccessHeading)).toBeTruthy(),
    );
  });

  it("name-submit opens the read-only compare view with the typed name", async () => {
    const input = await openPrompt();
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(screen.getByText(compareCopy.namePromptConfirm));
    await waitFor(() =>
      expect(screen.getByText(compareCopy.banner("Alice"))).toBeTruthy(),
    );
    expect(pickAndImportMock).not.toHaveBeenCalled();
  });
```

New test = the first test's merge assertions triggered by the second test's typed-name interaction (`fireEvent.change` with the file owner's name + click `namePromptConfirm`), asserting `pickAndImportMock` **was** called and the success heading renders. Case/whitespace variants (`"  matt  "` vs file owner `"Matt"`) belong in the pure-helper unit tests, with one representative case at component level.

---

### PWA-05 — `packages/app/test/importFork.test.ts` (Dexie integration test, CRUD)

**Analog:** the same file's real-DB (fake-indexeddb) tests — this is where "merges the backup without dropping local data" is proven with an unmocked `pickAndImport`.

**DB reset + envelope factory** (lines 22–55):

```typescript
async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
  await db.open();
}

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    exportedAt: "2026-07-14T00:00:00.000Z",
    owner: null,
    meta: [], attendedShows: [], archiveShows: [], trackedShows: [], trackedEntries: [],
    ...over,
  };
}
```

**Snapshot-comparison proof style** (lines 94–112, the D-17 zero-writes proof) — invert it for the union-merge proof: seed local rows, run the real merge, assert local rows still present PLUS file rows added:

```typescript
    await setMeta("ownerName", "Matt");
    await db.attendedShows.put({ show_id: 111, showDate: "2020-01-01" });
    const before = await snapshot();
    ...
    const after = await snapshot();
    expect(after).toEqual(before);
```

**Real merge-path commit style** (lines 114–151) — the `File` construction + `pickAndImport` + Dexie readback to copy:

```typescript
    const file = new File([mineJson], "mine.json", { type: "application/json" });
    const outcome = await pickAndImport(file);
    expect(outcome.ok).toBe(true);
    expect(await db.trackedShows.get("s-mine")).toBeDefined();
```

The PWA-05 union test: seed local data but **no** `ownerName` meta row (evicted DB), build an `envelope({ owner: "Matt", attendedShows: [...] })` file, drive the (extracted-helper or classify) decision to `mine`-equivalent, run real `pickAndImport`, then assert both the seeded local rows and the file's rows exist afterward. The existing test at line 77 already covers `classifyImport` returning `unowned` for this input — the new coverage is the *typed-name → merge* leg and the union outcome.

**Extracted-helper unit tests** should mirror the `classifyImport` describe block's flat style (lines 61–92): one `it` per edge (match local owner, match file owner with local unset, case/whitespace insensitivity, empty answer never mine, no-match → not mine).

## Shared Patterns

### Verbatim-untrusted prose convention (DATA-06)
**Source:** `docs/SCHEMA.md` §12 (lines 196–198) + `packages/core/src/ingest/api-types.ts` line 46
**Apply to:** the `shownotes` field everywhere it appears (domain type doc comment, normalizer, tests)

```typescript
  shownotes: z.string(), // untrusted content — carry verbatim, never render (docs/SCHEMA.md §12)
```

§12: "carried verbatim through ingestion and normalization, and never interpreted as HTML or rendered without escaping … never use `dangerouslySetInnerHTML`." Ingestion-side validation is **already done** — only normalization drops the field today.

### Fail-loud vs. carry-tolerant split (DATA-06)
**Source:** `normalize.ts` — settype throw (lines 141–146, structural: DO NOT copy for shownotes) vs. `parseFootnotesGuarded` never-throw (lines 73–88, prose: copy the ethos)
**Apply to:** the D-01 disagreement handling — detect like settype, report like `showsExcludedBySettype`, never throw like footnotes.

### Erasable-syntax core convention
**Source:** `packages/core/src/domain/types.ts` header comment (lines 9–11)
**Apply to:** any new core types — string-literal unions / interfaces only, no `enum`/`namespace` (`erasableSyntaxOnly`). Core stays React/DOM-free.

### Doc-comment density
**Source:** every file above
**Apply to:** all new/modified code — this codebase annotates each non-obvious decision with the decision ID (D-01, WARNING-1, etc.) inline. New code should cite D-01/D-02/D-06 and PWA-05 the same way.

### App-test environment wiring
**Source:** `packages/app/test/setup.ts` — `fake-indexeddb/auto`, `@testing-library/jest-dom/vitest`, centralized `matchMedia` stub
**Apply to:** both PWA-05 test files — the environment is already fully wired; no setup changes needed. Component tests run under the Vitest jsdom project, core tests under node (root `vitest.config.ts` `projects`).

## No Analog Found

None — every file in this phase has an exact or self-analog. This is a hardening phase on existing code paths.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Metadata

**Analog search scope:** `packages/core/src` (ingest, domain, cli), `packages/core/test` (+ fixtures), `packages/app/src/settings`, `packages/app/test`, `docs/SCHEMA.md`
**Files scanned:** 12 read in full (all ≤ 330 lines), plus fixture-content greps
**Pattern extraction date:** 2026-07-18
