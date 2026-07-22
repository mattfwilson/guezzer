/**
 * The single, app-layer Supabase client (D-14 / SETUP-04).
 *
 * This file is the ONLY place `createClient` is called anywhere in the repo —
 * the 17-02 core-purity test asserts `createClient`/`@supabase` never appears
 * under `packages/core`. Every downstream v2.0 phase (18 auth, 19 progress,
 * 20 presence) imports the `supabase` singleton from here.
 *
 * It reads ONLY the two public `VITE_`-prefixed vars (D-09/D-10) — the anon key
 * and project URL are public by design (inlined into the bundle is fine). Never
 * the Node runtime env, never a non-`VITE_` secret. Vite loads these from
 * `packages/app/.env.local` (the app package root — do not change `envDir`).
 *
 * Kept minimal this phase: no custom auth options. Offline-session tuning is
 * Phase 18.
 */
import { createClient } from "@supabase/supabase-js";

// WR-04: fail fast with an actionable message if the public env vars are
// missing/empty, instead of createClient throwing an opaque library-internal
// error ("supabaseUrl is required") at module-import time — which would crash
// the entire app boot pointing at the library, not the misconfiguration. This
// also narrows the `string | undefined` values to `string` before createClient.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to packages/app/.env.local and fill in the public Supabase values.",
  );
}

export const supabase = createClient(url, anonKey);
