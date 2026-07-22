import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SETUP-04 / D-12 — Core-purity static-scan guard.
 *
 * Fails if `packages/core/src` ever imports the Supabase client or reaches for
 * an unambiguous browser DOM / transport global. The Supabase client + all
 * DOM/network access belong in the app layer (packages/app) only; core stays a
 * pure, Node-runnable, DOM-free module (CLAUDE.md architecture constraint).
 *
 * TWO LOAD-BEARING EXCEPTIONS (do not "tighten" the ban to include these — each
 * would red the existing suite with a false positive):
 *
 *   (1) `fetch` is NOT banned. Core legitimately uses the global `fetch` in four
 *       Node CLIs — live/poll-latest.ts, cli/fetch-corpus.ts, map/relay-client.ts,
 *       and dex/recent-shows.ts. "No network in core" was always about the
 *       *browser* Supabase client, not Node's global fetch. Banning `fetch`
 *       instantly false-positives those four files.
 *
 *   (2) There is NO bare `/\bwindow\./` rule. model/predict.ts declares a LOCAL
 *       array variable named `window` and calls `window.filter(...)` — a bare
 *       window ban would falsely flag it. The real DOM-window risk is already
 *       covered by the Supabase specifiers + the other DOM globals below; if
 *       window-DOM detection is ever wanted, use only specific forms like
 *       /window\.location/, /window\.document/, /window\.addEventListener/ that
 *       cannot match `.filter`.
 */

const SRC_DIR = fileURLToPath(new URL("../src/", import.meta.url));
const PKG_JSON = fileURLToPath(new URL("../package.json", import.meta.url));

// FORBIDDEN in packages/core/src. See the two exceptions in the header comment:
// NO `fetch` ban, NO bare `window.` ban.
const FORBIDDEN: RegExp[] = [
  // Supabase client specifiers + factory (the primary boundary — D-12/D-14).
  /@supabase\//,
  /supabase-js/,
  /\bcreateClient\b/,
  // Unambiguous browser DOM / transport globals.
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bnavigator\./,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
];

/** Recursively collect every `.ts` file under `dir` (deterministic; Windows-safe). */
async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files.sort();
}

describe("core purity (SETUP-04)", () => {
  it("packages/core/src imports no Supabase client and no browser DOM/transport global", async () => {
    const files = await collectTsFiles(SRC_DIR);
    // Sanity: the scan actually found source to scan (guards a silent no-op pass).
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(text, `${file} violates core purity: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("packages/core has no @supabase/* dependency (structural hardening)", async () => {
    const pkg = JSON.parse(await readFile(PKG_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];
    const supabaseDeps = allDeps.filter((name) => name.startsWith("@supabase/") || name === "supabase");
    expect(supabaseDeps, `core must not depend on Supabase: ${supabaseDeps.join(", ")}`).toEqual([]);
  });
});
