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
