import { defineConfig } from "vitest/config";

// Vitest 4: `test.projects` replaces the removed `vitest.workspace.ts` file.
// Only the core project is configured this phase — the app package has no
// tests yet (a glob over `packages/*` would fail project resolution for a
// package with zero test files). Widen to `packages/*` when app gains tests
// in Phase 3.
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
    ],
  },
});
