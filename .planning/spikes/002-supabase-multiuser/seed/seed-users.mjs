// ── Seed the 5 spike accounts ───────────────────────────────────────────────
// Dependency-free (Node 18+ has global fetch). Uses the GoTrue admin API.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_KEY="eyJ...service_role..."
//   $env:SEED_PASSWORD="pick-a-password"
//   node seed-users.mjs
//
// Usage (bash):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node seed-users.mjs
//
// The service_role key is a SECRET. Only ever pass it via env, never commit it.
// Re-running is safe — existing users are reported and left unchanged.

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables first.");
  process.exit(1);
}

// Pre-determined identities. Passwords come from the SEED_PASSWORD env var, so no
// real password lives in git — set it when you run (see usage note above).
const SEED_PASSWORD = process.env.SEED_PASSWORD || "change-me";

const USERS = [
  { email: "matt@fov.gizz",  password: SEED_PASSWORD, display_name: "Matt" },
  { email: "max@fov.gizz",   password: SEED_PASSWORD, display_name: "Max" },
  { email: "tim@fov.gizz",   password: SEED_PASSWORD, display_name: "Tim" },
  { email: "shawn@fov.gizz", password: SEED_PASSWORD, display_name: "Shawn" },
  { email: "brian@fov.gizz", password: SEED_PASSWORD, display_name: "Brian" },
];

let created = 0;
for (const u of USERS) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: u.email,
      password: u.password,
      email_confirm: true, // no email step — usable immediately
      user_metadata: { display_name: u.display_name },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    created++;
    console.log(`  ✓ created  ${u.email.padEnd(20)} password: ${u.password}`);
  } else if (res.status === 422 || /registered|already|exists/i.test(JSON.stringify(body))) {
    console.log(`  • exists   ${u.email.padEnd(20)} password: ${u.password} (unchanged)`);
  } else {
    console.error(`  ✗ FAILED   ${u.email} → ${res.status} ${JSON.stringify(body)}`);
  }
}

console.log(`\nDone (${created} new). Log in at the demo with any pair above.`);
