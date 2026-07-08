/**
 * Raw kglw.net API row shapes — the executable pair of docs/SCHEMA.md (D-09).
 *
 * Stage 1 (this file, current): census-mode schemas. Keys are validated
 * STRICTLY (unknown keys hard-fail — catches API drift), but enum-ish
 * fields (`settype`, `setnumber`, `transition_id`, flag numbers) stay
 * structurally loose (`z.string()`, `z.number().int()`) because the
 * full-corpus census (plan 01-04) is what discovers the real vocabulary —
 * locking enums now would be circular (Pitfall 2).
 *
 * Stage 2 — locked schemas (added post-census in plan 01-04): after
 * data/census-report.md resolves the open unknowns in docs/SCHEMA.md §13,
 * a second schema layer will use locked z.literal-based unions that hard-fail
 * on novel values (D-11). Not present yet.
 */
import { z } from "zod";

export const apiEnvelope = z.strictObject({
  error: z.boolean(),
  error_message: z.string(),
  data: z.array(z.unknown()),
});

export const rawSetlistRowCensus = z.strictObject({
  uniqueid: z.string(),
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  showtime: z.unknown(), // never populated in samples — permissive (docs/SCHEMA.md §2)
  showtitle: z.string(),
  artist: z.string(),
  song_id: z.number().int(),
  songname: z.string(),
  artist_id: z.number().int(),
  permalink: z.string(),
  settype: z.string(), // loose until census locks allowlist (docs/SCHEMA.md §10)
  setnumber: z.string(), // loose until census locks vocabulary (docs/SCHEMA.md §3, §7)
  position: z.number().int().positive(),
  tracktime: z.string().nullable(),
  transition_id: z.number().int(), // loose until census locks 1..6 (docs/SCHEMA.md §4)
  transition: z.string(), // display string — never string-parsed, switch on transition_id only
  footnote: z.string(),
  footnotes: z.string().nullable(), // double-encoded JSON string (docs/SCHEMA.md §8)
  isjamchart: z.number(), // 0/1 flag, not boolean
  jamchart_notes: z.string().nullable(),
  venue_id: z.number().int(),
  shownotes: z.string(), // untrusted content — carry verbatim, never render (docs/SCHEMA.md §12)
  showyear: z.number().int(), // NUMBER, not string (verified trap)
  showorder: z.number().int(),
  opener: z.string(),
  tour_id: z.number().int(),
  tourname: z.string(),
  soundcheck: z.string(),
  isverified: z.number(), // 0/1 flag, not boolean
  slug: z.string(),
  isoriginal: z.number(), // 0/1 flag, not boolean
  original_artist: z.string(),
  venuename: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  timezone: z.unknown(), // never populated in samples — permissive (docs/SCHEMA.md §2)
  isreprise: z.number(), // 0/1 flag, not boolean — unreliable (docs/SCHEMA.md §5, D-14)
  isjam: z.number(), // 0/1 flag, not boolean
  css_class: z.string().nullable(),
  isrecommended: z.number().nullable(),
});

export type RawSetlistRow = z.infer<typeof rawSetlistRowCensus>;
