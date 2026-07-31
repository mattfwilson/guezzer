import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // no git available at build time — fall back to 'unknown', build still succeeds
}

const buildDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      // Bundle-import the build-frozen transition matrix (RESEARCH Pitfall 4).
      // Repo-root artifact lives outside packages/app; aliasing avoids an ugly
      // "../../../data/..." import and Vite fs.allow friction. It rides the JS
      // bundle, so the existing `**/*.js` Workbox glob precaches it — NO `json`
      // glob edit is needed (offline-complete on first load).
      "@matrix": fileURLToPath(
        new URL("../../data/normalized/transition-matrix.json", import.meta.url),
      ),
      // Phase-6 dex artifacts (plan 06-05) — same @matrix idiom. Both ride the
      // JS bundle (JSON module), so the existing `**/*.js` Workbox glob
      // precaches them; NO `json` glob edit is needed (offline-complete).
      "@archive": fileURLToPath(
        new URL("../../data/normalized/archive.json", import.meta.url),
      ),
      "@dexAlbums": fileURLToPath(
        new URL("../../data/normalized/dex-albums.json", import.meta.url),
      ),
      // GizzMap calibration artifact (control points → georef fit) — same
      // @matrix idiom: rides the JS bundle, precached by the `**/*.js` glob.
      "@festivalMap": fileURLToPath(
        new URL("../../data/festival-maps/field-of-vision-2026.json", import.meta.url),
      ),
      // "Max's predictor" transformer artifact (weights + vocab + golden
      // vectors, exported by setlist-predictor/src/export_web.py). Same
      // idiom, but DYNAMICALLY imported (show/nnModel.ts) so the 2.4 MB
      // artifact becomes its own lazy JS chunk — still precached by the
      // `**/*.js` glob, never parsed on first paint.
      "@nnModel": fileURLToPath(
        new URL("../../data/nn/setlist-transformer.json", import.meta.url),
      ),
      // FOV 2026 schedule artifact (owner-transcribed poster) — @matrix idiom:
      // rides the JS bundle, precached by the `**/*.js` glob.
      "@schedule": fileURLToPath(
        new URL("../../data/schedule/fov-2026.json", import.meta.url),
      ),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // CLAUDE.md #4 — NEVER 'autoUpdate' (SW must never swap the app mid-show)
      // devOptions: { enabled: true }, // enable to test SW in `vite dev`; real validation is against `vite build` + `vite preview` (Pitfall 1)
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webp}"],
        // NOTE: 'webp' precaches the 29 hashed album-cover assets (~195 KB total,
        // within the 350 KB cover budget guarded by test/coversManifest.test.ts) so
        // the dex shelf renders offline (06-12 gap 1). 'json' is still intentionally
        // excluded — the matrix/archive/dex artifacts ride the JS bundle.
        //
        // clientsClaim makes the FIRST-installed SW control the already-open page,
        // so the app is offline-complete on first load (core value) — without it,
        // first-session fetches bypass the SW and precached covers 404 offline.
        // Safe with registerType 'prompt': skipWaiting stays false, so an UPDATED
        // SW still waits for user approval before activating (never mid-show).
        clientsClaim: true,
        // "Max's predictor" transformer chunk (2.37 MB, its own lazy JS
        // asset) exceeds Workbox's 2 MB default cap, which HARD-FAILS the
        // build. Offline-complete-on-first-load is the core value, so raise
        // the cap rather than exclude the model from precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: "Gizz With Friends",
        short_name: "Gizz With Friends",
        description: "Gizz With Friends — predict the next King Gizzard song, live, together.",
        theme_color: "#0C0C10",
        background_color: "#0C0C10",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
