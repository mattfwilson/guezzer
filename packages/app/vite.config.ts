import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // CLAUDE.md #4 — NEVER 'autoUpdate' (SW must never swap the app mid-show)
      // devOptions: { enabled: true }, // enable to test SW in `vite dev`; real validation is against `vite build` + `vite preview` (Pitfall 1)
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // NOTE: 'json' is NOT a Workbox default — add it in a later phase when the matrix artifact is precached.
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
