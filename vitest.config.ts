import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest 4: `test.projects` replaces the removed `vitest.workspace.ts` file.
// Two explicit projects (not a `packages/*` glob — a glob fails resolution
// when environments differ, Pitfall 8): core runs under `node`, app runs
// under `jsdom`.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "@guezzer/core",
          root: "packages/core",
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        // Resolve the bundled-artifact aliases (mirrors packages/app/vite.config.ts)
        // so `@matrix`/`@archive`/`@dexAlbums` importers are collectable under
        // Vitest; tests replace the real artifacts with `vi.mock` fixtures.
        resolve: {
          alias: {
            "@matrix": fileURLToPath(
              new URL("./data/normalized/transition-matrix.json", import.meta.url),
            ),
            "@archive": fileURLToPath(
              new URL("./data/normalized/archive.json", import.meta.url),
            ),
            "@dexAlbums": fileURLToPath(
              new URL("./data/normalized/dex-albums.json", import.meta.url),
            ),
          },
        },
        test: {
          name: "@guezzer/app",
          root: "packages/app",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          setupFiles: ["./test/setup.ts"],
        },
      },
    ],
  },
});
