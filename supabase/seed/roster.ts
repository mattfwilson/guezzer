// Committed, non-secret account roster (SETUP-02 / D-07/D-08).
//
// This file carries ONLY the reviewable, non-secret identity of each account:
// a stable `slug` and a `display_name`. Emails and passwords are NEVER stored
// here — the seed script reads them at run time from environment variables keyed
// by the uppercased slug (`SEED_EMAIL_<SLUG>` / `SEED_PASSWORD_<SLUG>`), so no
// credential ever lands in git (D-08).
//
// Seeded with the owner's real entry plus two placeholders. The placeholders
// exist to prove the seed's idempotency (D-07): running it twice must report
// them as "exists → skip", not error.

export interface RosterEntry {
  slug: string;
  display_name: string;
}

export const roster: RosterEntry[] = [
  { slug: "matt", display_name: "Matt" },
  { slug: "placeholder1", display_name: "Placeholder One" },
  { slug: "placeholder2", display_name: "Placeholder Two" },
];
