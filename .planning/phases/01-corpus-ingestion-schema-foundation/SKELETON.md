# Walking Skeleton — Guezzer

**Phase:** 1
**Generated:** 2026-07-08

## Capability Proven End-to-End

One documented CLI command (`pnpm refresh --normalize-only --input data/samples`) runs the full validate → normalize → write-artifact pipeline on real committed kglw.net data and produces the versioned `data/normalized/corpus.json` artifact, with a passing vitest test proving the output.

(This phase is core-only data ingestion — no UI, no browser, no DB by design. "End-to-end" here means the entire data pipeline stack: raw JSON → zod boundary validation → artist/settype filtering → setnumber-grouped domain model → versioned artifact, all runnable from Node with zero build step. The UI stack gets its own skeleton treatment in Phase 3.)

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language/runtime | TypeScript 6.0.3 (typecheck-only) + Node ≥24.12 native type stripping | Zero build step for CLIs; `erasableSyntaxOnly` + `.ts` import extensions; TS 7 blocked by typescript-eslint peer range (`<6.1.0`) — locked in CLAUDE.md |
| Workspace | pnpm workspaces via corepack: `packages/core` + `packages/app` (stub) | Compile-time core purity: core tsconfig has no DOM lib, core package.json has no React — importing browser APIs from core is a build error, not a review catch |
| Validation boundary | zod 4.4.3 strict objects in `core/ingest` (anti-corruption layer) | Two-stage: census-mode (enum-loose, key-strict) → locked enums post-census (D-10/D-11); the only module that knows raw API field names |
| Test runner | Vitest 4.1.10, root `vitest.config.ts` with `test.projects`, core in `node` env | `vitest.workspace.ts` removed in v4; core purity means no jsdom anywhere in Phase 1 |
| Configuration | Single `packages/core/src/config.ts` for ALL constants | CLAUDE.md hard constraint — apiBase, pacing, year bounds, settype allowlist, sentinel song IDs, microtonal seed albums |
| Data storage | Committed static JSON: `data/raw/` (per-year source of truth, D-05/D-06) + `data/normalized/corpus.json` (schemaVersion-headed artifact, D-08) | No backend ever; git diff is the review mechanism; normalizer re-runnable with zero API traffic |
| API etiquette | Sequential fetch, 2s delay, descriptive UA, no retries, no CI fetches; tests use injected mock fetch | Volunteer-run fan site (D-07/P11) |
| CLI surface | `pnpm refresh` with `--all / --year N / --fetch-only / --census-only / --normalize-only` | The "one documented command" (DATA-02); flag surface declared from day one |
| Error UX convention | Every hard failure names endpoint/field, expected vs actual value, and an example show (id + date) | Set in Phase 1 (`assertFilterApplied`, `formatRowError`), copied by all later phases |
| Domain model | `NormalizedCorpus` (schemaVersion 1) → `NormalizedShow` → `SetSection` (setnumber-grouped) → `Performance` (positional) | Structure from `setnumber` + `position` ONLY, never `transition_id`; sandwiches are plain positional repeats (D-14) |

## Stack Touched in Phase 1

- [ ] Project scaffold (pnpm workspace, TS 6.0.3, vitest projects config, .gitattributes)
- [ ] Schema documentation (`docs/SCHEMA.md`) written from real endpoint samples BEFORE extraction code
- [ ] Ingestion boundary — zod census-mode schemas + `assertFilterApplied` on real committed samples
- [ ] Pipeline — one real read (raw JSON) AND one real write (versioned corpus.json) via the documented CLI command
- [ ] Test proof — vitest asserts the artifact (25 shows from sample data; full corpus after plan 01-04)
- [ ] Local full-stack run command documented: `pnpm refresh --normalize-only --input data/samples`

(No routing/UI/deployment rows: intentionally out of scope for a core-only data phase; Phase 3 owns the installable PWA shell.)

## Out of Scope (Deferred to Later Slices)

- Transition matrix construction, set-boundary edge exclusion (DATA-05), all scoring — Phase 2
- jamcharts normalization (raw fetched + committed in Phase 1; consumed for MODL-05 in Phase 2)
- Any React/Vite/PWA/browser code — Phase 3 (`packages/app` is a stub)
- `latest.json` live polling — Phase 5
- Tease semantics beyond verbatim carry-through (MODL-V2-03)
- Reprise detection/linking — permanently out (D-14: positional occurrences only)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: `corpus.json` → transition matrix artifact + predictor + CLI backtest trust gate
- Phase 3: installable offline-first PWA shell (`packages/app` becomes real; core imported as workspace dep)
- Phase 4: Show Mode — the live one-thumb loop consuming the predictor
- Phase 5: polite `latest` polling + JSON export/import
- Phase 6: Pokédex/stats derived from attendance + corpus
- Phase 7: constellation fed from the same matrix JSON
