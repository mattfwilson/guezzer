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
      },
      manifest: {
        name: "Guezzer",
        short_name: "Guezzer",
        description: "Predict the next King Gizzard song, live.",
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
