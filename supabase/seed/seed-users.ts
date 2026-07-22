// Idempotent GoTrue admin account seed (SETUP-02 / D-06/D-07/D-08).
//
// Dependency-free Node-native TypeScript — runs directly under Node ≥ 24.12
// type-stripping. Erasable syntax only (types via `interface`/`type`; no
// non-erasable declarations or parameter-properties), exactly like
// packages/app/scripts/fetch-covers.ts. Uses the global `fetch` and the GoTrue
// admin API; no `@supabase/supabase-js`, no `tsx`, no build step.
//
// Run (loads .env via Node, never a dotenv dependency):
//   node --env-file=.env supabase/seed/seed-users.ts
// (wired as the root `seed:accounts` npm script.)
//
// Secrets: the service_role key and every per-person password are read from
// `process.env` ONLY — never the Vite client env (that would bundle them into
// the shipped client). The committed roster (./roster.ts) carries no secrets;
// emails and passwords come from env keyed by the uppercased slug (D-08).
//
// Idempotency (D-06): re-running is safe. A duplicate email answers with a
// specific `email_exists`/`user_already_exists` code (current GoTrue) or an
// "already registered" message (older builds) — ONLY those precise signals are
// treated as "exists → skip". A bare HTTP 422 (e.g. `weak_password`) or an
// unrelated "... does not exist" error is a genuine failure, not a skip.

import { pathToFileURL } from "node:url";
import { roster } from "./roster.ts";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

interface SeedResult {
  created: number;
  skipped: number;
  failed: number;
}

async function seedUsers(): Promise<SeedResult> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first " +
        "(loaded via `node --env-file=.env`).",
    );
    process.exit(1);
  }

  const result: SeedResult = { created: 0, skipped: 0, failed: 0 };

  for (const person of roster) {
    const slug = person.slug.toUpperCase();
    const email = process.env[`SEED_EMAIL_${slug}`];
    const password = process.env[`SEED_PASSWORD_${slug}`];
    if (!email || !password) {
      console.warn(
        `⚠ missing SEED_EMAIL_${slug} / SEED_PASSWORD_${slug} for slug "${person.slug}" — skipping.`,
      );
      result.skipped += 1;
      continue;
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // D-06: no email step — usable immediately
        user_metadata: { display_name: person.display_name },
      }),
    });

    const body: unknown = await res.json().catch(() => ({}));
    const bodyText = JSON.stringify(body);
    // D-06 idempotency: treat ONLY a genuine "already registered" signal as a
    // skip. Match GoTrue's specific duplicate-email codes / message — NOT a
    // blanket 422 (which also covers `weak_password`) or a bare `exists`
    // substring (which also appears in unrelated "... does not exist" errors).
    // Otherwise a real creation failure is silently counted as a skip. WR-01/WR-02.
    const isDuplicate =
      /"(error_)?code"\s*:\s*"(email_exists|user_already_exists)"/i.test(bodyText) ||
      /already\s+(been\s+)?registered/i.test(bodyText);
    if (res.ok) {
      result.created += 1;
      console.log(`✓ created  ${email}`);
    } else if (isDuplicate) {
      result.skipped += 1;
      console.log(`• exists   ${email} (unchanged)`);
    } else {
      result.failed += 1;
      console.error(`✗ FAILED   ${email} → ${res.status} ${bodyText}`);
    }
  }

  console.log(`\nDone (${result.created} new).`);
  return result;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await seedUsers();
    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
