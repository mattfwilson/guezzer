# Phase 1 Security Audit — Corpus Ingestion & Schema Foundation

**Audited:** 2026-07-08
**ASVS Level:** 1
**block_on:** none-specified — default applied (open Tampering/Integrity/DoS mitigations must be verified present in code, not accepted on documentation/intent alone)
**Threats:** 16 total — **16 CLOSED / 0 OPEN**

Scope: verify each threat declared across `01-01-PLAN.md` … `01-05-PLAN.md`'s `<threat_model>` blocks resolves to CLOSED, OPEN, or a documented accepted risk. Implementation files are read-only; no code was patched by this audit. Findings below cite exact files/lines as evidence — no mitigation was accepted on the basis of documentation or plan intent alone.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|---|---|---|---|---|
| T-01-01 | Tampering | mitigate | **CLOSED** | `z.strictObject` on `apiEnvelope` and `rawSetlistRowCensus` (`packages/core/src/ingest/api-types.ts:18,24`); `rawSetlistRowLocked` via `.extend()` preserves strictness (`:150`). `grep -r "eval(\|new Function("` over `packages/core/src` → 0 matches. Tested: `api-types.test.ts:70-83` (unknown-key rejection, both type traps). |
| T-01-02 | Spoofing/Tampering | mitigate | **CLOSED** | `assertFilterApplied` (`packages/core/src/ingest/validate.ts:15-30`) — endpoint/field/expected/actual/row-excerpt message convention. Tested: `validate.test.ts` (pass on valid rows, full-message throw on mismatch, empty-array pass). |
| T-01-03 | Tampering (stored, future UI) | accept | **CLOSED** (fixed — see Finding F1, resolved) | `footnote`/`footnotesRaw`/`footnotesParsed` are carried verbatim into `Performance` correctly (`domain/types.ts:32-37`). The `census.ts`/`run-census.ts` rendering gap (raw HTML in `data/census-report.md`) is fixed: `escapeMarkdownExcerpt()` (`run-census.ts`) HTML-escapes `&`/`<`/`>` before interpolating excerpts (commit `69fe5a2`). `data/census-report.md` regenerated and verified to contain only escaped entities (`&lt;b&gt;...`). |
| T-01-SC | Tampering (supply chain) | mitigate | **CLOSED** | `package.json:13-14` pins `typescript@6.0.3`, `vitest@4.1.10` exact (no range). `packages/core/package.json:7,10` pins `zod@4.4.3` exact; `@types/node@^24.13.3` matches the plan's own specified range. `package-lock.json` is git-tracked (`git ls-files` confirms). |
| T-01-04 | Tampering | mitigate | **CLOSED** | `rawSetlistRowLocked.parse` per row wrapped in try/catch → `formatRowError` (`normalize.ts:97-106`); contiguity assertion (`:153-164`); `parseFootnotesGuarded` never throws — malformed JSON keeps raw verbatim (`:73-88`). |
| T-01-05 | Tampering | mitigate | **CLOSED** (accepted — see Finding F2, Accepted Risks Log) | `--input`/`--out` accept a missing trailing value silently (`argv[++i]` → `undefined`) in `normalize-corpus.ts:100-112`, `run-census.ts:194-201`, `refresh.ts:100-106` — no equivalent of `--year`'s `validateYearArg`. No `path.resolve`/repo-root containment logic exists anywhere (`grep -r "resolve(\|process.cwd()"` over `packages/core/src` → 0 matches) — "paths resolved relative to repo root only" is not an enforced mechanism, just an assumption about invocation context. "Unknown flags rejected with usage" holds only for `refresh.ts`; `normalize-corpus.ts`/`run-census.ts` direct invocation print only the error message, no usage text. No shell interpolation confirmed true (pure `node:fs/promises`, 0 `child_process`/`exec`/`spawn` matches). |
| T-01-06 | Repudiation/Integrity | mitigate | **CLOSED*** | Stable `JSON.stringify(_, null, 2)` + trailing newline (`normalize-corpus.ts:81`, `fetch-corpus.ts:95`); `fetch-meta.json` tracks `fetchedAt`/`rowCount` (`fetch-corpus.ts:99-119`); all committed and present on disk (`data/raw/fetch-meta.json`, `data/normalized/corpus.json`). *Caveat: `mergeFetchMeta`'s catch-all (`fetch-corpus.ts:105-109`) swallows ALL read/parse errors, not just missing-file — a corrupted `fetch-meta.json` would silently lose prior provenance rather than surfacing an error (matches code-review WR-02). Minor robustness gap in the provenance mechanism; does not break the primary git-diff tamper-evidence path over `data/raw/*` itself. |
| T-01-07 | Spoofing/Tampering | mitigate | **CLOSED** | `assertFilterApplied` called after every non-empty per-year fetch (`fetch-corpus.ts:154`); `maxRowsPerYearSanity` tripwire (`:157-163`). Tested: `fetch.test.ts` Tests 5 & 6. |
| T-01-08 | Tampering | mitigate | **CLOSED** | `validateYearArg` (`refresh.ts:76-86`) validates bounded integer before any use. Tested: `fetch.test.ts` Tests 7a/7b/7c. |
| T-01-09 | DoS | mitigate | **CLOSED** | Strictly sequential `for` loop with awaited `paceNextRequest` (`fetch-corpus.ts:139-169`); `fetchDelayMs: 2000` (`config.ts:14`); `AbortSignal.timeout` (`:54`); `grep -r "retry\|backoff\|p-retry"` over `packages/core/src` → 0 matches; descriptive User-Agent (`config.ts:20`, tested); no CI wiring (`.github/` absent); tests use mocked `{fetch, sleep}` only. |
| T-01-10 | Tampering | mitigate | **CLOSED** (accepted — see Finding F3, Accepted Risks Log) | Zod validation on every fetched row before write — TRUE (`fetch-corpus.ts:151`, `census.ts:155`). JSON.parse only, never eval — TRUE. But "fails loudly naming endpoint" is FALSE for row-level zod failures: both call sites invoke `.parse()` directly with no try/catch/`formatRowError` wrapping (confirmed: `formatRowError` usage greps to only `normalize.ts` and its own definition). A drifted row during a live fetch or census run throws a raw `ZodError` with no endpoint/file context — same gap as `fetchJson`'s own network/timeout/JSON-parse-failure branches (no path-prefixed error there either). |
| T-01-11 | Tampering | mitigate | **CLOSED** | `setnumberLocked`/`transitionIdLocked`/`settypeLocked` custom `error` messages name field+value (`api-types.ts:95-143`); `formatRowError` appends show context (`:167-176`); wired into `normalize.ts`. Tested extensively: `api-types.test.ts` Tests 1-6 + cross-check against `data/census.json`. |
| T-01-12 | Integrity | mitigate | **CLOSED** (accepted — see Finding F4, Accepted Risks Log) | The corpus.json ↔ census.json cross-check was performed once, manually, during plan 01-04 execution (documented only in `01-04-SUMMARY.md`'s prose) — not encoded as a repeatable, committed test. `grep` across `packages/core/test/` for any comparison of `census.json` derived counts against `corpus.json` header counts finds none (only unrelated enum-vocabulary cross-checks in `api-types.test.ts`/`census.test.ts`). A future regeneration of either artifact has no standing safeguard. |
| T-01-13 | Tampering | mitigate | **CLOSED** | `.filter((row) => row.artist_id === 1)` (`generate-tuning-tags.ts:77`); `albumRowSchema` (`tuning-tags.ts:85-96`) declares only `artist_id`/`album_title`/`song_url`/`song_name`/`islive` — `album_notes` never referenced anywhere in either file (confirmed via grep); zod `.parse()` is the assert component. |
| T-01-14 | Tampering/Integrity | mitigate | **CLOSED** | `tuningTagsFileSchema` strict + closed enum + `superRefine` duplicate-songId rejection (`tuning-tags.ts:28-61`); invoked on every load (`generate-tuning-tags.ts:86`) and on write (`:100-103`). Tested: `tuning-tags.test.ts` Tests 6a/6b. |
| T-01-15 | Integrity | mitigate | **CLOSED** | `mergeTuningTags` reference-copies existing entries (`tuning-tags.ts:262-278`). Tested: `tuning-tags.test.ts` Test 5 — reference-identity + deep-equal + `JSON.stringify`-equal survival; live idempotence proven per `01-05-SUMMARY.md` (second CLI run, zero git diff). |

---

## Findings (originally Open, disposition below)

### F1 — T-01-03: shownotes/footnote raw content rendered as HTML in a committed artifact — RESOLVED

**Resolution (2026-07-08, commit `69fe5a2`):** Added `escapeMarkdownExcerpt()` in `run-census.ts`, applied to `t.excerpt` before interpolation into the markdown report. Regenerated `data/census-report.md` from the full committed raw corpus; verified the file now contains only escaped entities (`&lt;b&gt;KGLW.net Staff Notes: &lt;/b&gt;`) instead of raw HTML. Full test suite (60/60) and `tsc --noEmit` re-verified green after the fix.

**Severity:** Low-Medium (single-user/small-friend-group tool; no untrusted viewer audience today, but the artifact is git-committed and human-viewable)
**Files:** `packages/core/src/ingest/census.ts:241-260`, `packages/core/src/cli/run-census.ts:152-170`
**Evidence:** `data/census-report.md:265-273` contains literal, unescaped `<b>KGLW.net Staff Notes: </b>` HTML tags sourced directly from `shownotes`.
**Why this breaks the accepted-risk basis:** T-01-03's disposition text is "Carried verbatim, never parsed as HTML/never rendered." The census pipeline introduces a rendering surface (a markdown report/viewer) that the original phase-01-01 acceptance did not anticipate — markdown renderers (GitHub, VS Code preview, etc.) interpret embedded raw HTML by default.
**Recommendation:** Either (a) HTML-escape or strip tags from `excerpt` before interpolating into the markdown report, (b) wrap the excerpt itself in a backtick code span (not just the field name) so markdown renderers treat it as literal text, or (c) explicitly re-scope the accepted-risk log entry to acknowledge and justify this specific render path (e.g., "local-only build artifact, not intended for public HTML rendering, acceptable because ...").

### F2 — T-01-05: CLI path-argument handling gap — ACCEPTED (see Accepted Risks Log)

**Severity:** Low (single-user local tool; no untrusted network input reaches these flags)
**Files:** `packages/core/src/cli/normalize-corpus.ts:100-112`, `packages/core/src/cli/run-census.ts:194-201`, `packages/core/src/cli/refresh.ts:100-106`
**Evidence:** `--input`/`--out` silently accept `undefined` on a trailing flag with no value (unlike `--year`'s `validateYearArg`). No `path.resolve`/repo-root containment mechanism exists anywhere in `packages/core/src` (0 grep matches for `resolve(`/`process.cwd()`).
**Determination (per audit instruction):** This is a **real gap in the claimed mitigation**, not a separate/unrelated concern — the threat register names this exact component ("cli args --input/--out") and this exact mitigation text ("Paths resolved relative to repo root only ... unknown flags rejected with usage"). Neither the resolution/containment claim nor full "rejected with usage" behavior (only `refresh.ts` prints usage; the other two CLIs print only the raw error) is implemented as described. Matches code-review WR-04 exactly.
**Recommendation:** Add a `requireValue(argv, i, flagName)` guard mirroring `validateYearArg`'s pattern; consider anchoring `--input`/`--out` with `path.resolve(repoRoot, ...)` plus a containment check if hardening beyond "trusted single-owner CLI" is ever desired.

### F3 — T-01-10: row-validation failures don't name the endpoint — ACCEPTED (see Accepted Risks Log)

**Severity:** Low (fails loudly either way — data integrity is not at risk, only diagnosability)
**Files:** `packages/core/src/cli/fetch-corpus.ts:151`, `packages/core/src/ingest/census.ts:155`
**Evidence:** Both call `rawSetlistRowCensus.parse(row)` directly with no try/catch/`formatRowError` wrapping; `formatRowError` is used only in `normalize.ts`.
**Determination (per audit instruction):** This **does break the literal claimed mitigation** ("malformed payload fails loudly naming endpoint") for the row-validation failure mode specifically — it's not a separate concern, since T-01-10's own component is "envelope/rows parsing." The envelope-level branches (`!res.ok`, `body.error`) DO name the path correctly; only the per-row zod-parse path and `fetchJson`'s own network/timeout/JSON-parse-failure paths lack it. Matches code-review WR-03 and WR-05 exactly, confirming the constraint's suspicion that this is a genuine (partial) gap rather than a documentation nitpick.
**Recommendation:** Wrap `.parse()` calls in both files with the same try/catch → `formatRowError`-style pattern already established in `normalize.ts`; wrap `fetchJson`'s fetch/json-parse in a try/catch that re-throws with the path prepended.

### F4 — T-01-12: cross-check is a one-time manual step, not a standing safeguard — ACCEPTED (see Accepted Risks Log)

**Severity:** Low (verified correct once; risk is only that future regenerations could silently drift undetected)
**Files:** none (absence finding) — searched `packages/core/test/**`
**Evidence:** `01-04-SUMMARY.md` documents the cross-check was run manually via an inline `node -e` verify script during Task 2 execution. No committed test references both `data/census.json` and `data/normalized/corpus.json` together to assert count agreement.
**Recommendation:** Add a small vitest integration test (or a CLI-embedded assertion in `refresh.ts`'s default fetch→census→normalize chain) that re-runs this cross-check automatically on every regeneration, not just the one that happened to be typed into a plan's verify script.

---

## Accepted Risks Log

| Threat ID | Risk | Justification | Status |
|---|---|---|---|
| T-01-03 | `shownotes`/`album_notes`/`footnote(s)` are untrusted, editor-entered strings (raw HTML observed in the wild) carried into committed artifacts. | Phase 1 has no UI; consumption is by a future React UI phase which will apply default JSX escaping. `SCHEMA.md` §12 flags these fields untrusted for that phase. | **Accepted.** The one rendering-surface violation (Finding F1, `data/census-report.md`) was fixed 2026-07-08 (commit `69fe5a2`) rather than merely accepted — see Findings section. |
| T-01-05 | `--input`/`--out` CLI flags silently accept a missing value (`undefined`); no path-containment logic exists. | Single-owner local CLI tool — the only person who ever invokes `normalize-corpus`/`run-census`/`refresh` is the project owner, on their own machine, with no untrusted network input reaching these flags. No `child_process`/`exec`/`spawn` anywhere (0 shell-interpolation risk). Owner decision (2026-07-08): accept for Phase 1; revisit if the tool ever gains multi-user or remote-invocation surface. | **Accepted.** |
| T-01-10 | Row-level zod parse failures in `fetch-corpus.ts`/`census.ts` throw without naming the endpoint/file (diagnosability gap only — the row-level validation itself still fails loudly and blocks the write). | Low severity: data integrity is not at risk (the strict parse still throws and halts), only troubleshooting convenience during a fetch/census run the owner is watching interactively. Owner decision (2026-07-08): accept for Phase 1. | **Accepted.** |
| T-01-12 | The `data/census.json` ↔ `data/normalized/corpus.json` count cross-check was a one-time manual verification during Phase 1 (01-04), not a standing automated test. | Verified correct once against the full real corpus; risk is limited to a *future* regeneration silently drifting undetected, not a present defect. Phase 2 (Transition Matrix) will read `data/normalized/corpus.json` directly and its own tests will surface gross count anomalies. Owner decision (2026-07-08): accept for Phase 1; add the standing test opportunistically or when either artifact is next regenerated. | **Accepted.** |

---

## Unregistered Flags

None. No `## Threat Flags` section was found in any of the five `01-0N-SUMMARY.md` files. The one new attack-surface concern identified during this audit (raw HTML flowing into `data/census-report.md`, Finding F1) maps directly to the existing T-01-03 threat ID and is reported as a gap against that threat rather than as an unregistered flag.

---

## Notes on Findings Outside the Threat Register (Not Blocking)

The prior code review (`01-REVIEW.md`) raised WR-01 (shownotes silently dropped from the normalized artifact) and WR-06 (tuning-tags name-fallback cross-contamination risk). Neither maps to a STRIDE threat in the register as a security concern — WR-01 is a data-completeness bug (dropping untrusted content is safe, just incomplete), and WR-06 is a data-quality/correctness heuristic risk with no adversarial input vector. Both are noted here for completeness but are not treated as OPEN security threats.

---

*Audited by: gsd-security-auditor*
*Implementation files: read-only. No code was modified by this audit.*

---

## Security Audit 2026-07-08 (orchestrator follow-up)

| Metric | Count |
|--------|-------|
| Threats found | 16 |
| Closed | 16 |
| Open | 0 |

F1 (T-01-03) fixed in commit `69fe5a2` (escape shownotes/footnote excerpts before markdown interpolation; `data/census-report.md` regenerated and verified). F2/F3/F4 (T-01-05, T-01-10, T-01-12) documented as accepted risks per owner decision — see Accepted Risks Log above. `threats_open: 0` — phase advancement unblocked.
