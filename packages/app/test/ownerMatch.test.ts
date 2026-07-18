import { describe, expect, it } from "vitest";
import { isTypedNameMine } from "../src/settings/ownerMatch.ts";

/**
 * `isTypedNameMine` — the pure "It's mine → restore" decision extracted from
 * `SettingsView.resolveNamePrompt` (commit e08ceee). Mirrors `classifyImport`'s
 * flat one-`it`-per-edge unit-test style. No DB, no DOM, no mocks — a pure
 * function over three strings.
 *
 * The file-owner leg (PWA-05 / WARNING-1) is the evicted-DB hardening: with the
 * local owner unset, typing the backup file's own owner name must still reach
 * the merge path.
 */
describe("isTypedNameMine — the typed-name 'it's mine' decision", () => {
  it("true when the typed name matches the LOCAL owner", () => {
    expect(isTypedNameMine("Matt", "Matt", null)).toBe(true);
  });

  it("true when the typed name matches the FILE owner with the local owner unset (PWA-05/WARNING-1)", () => {
    expect(isTypedNameMine("Matt", null, "Matt")).toBe(true);
    // A blank local owner (evicted-DB "") is treated the same as null.
    expect(isTypedNameMine("Matt", "", "Matt")).toBe(true);
  });

  it("case- and whitespace-insensitive on BOTH legs", () => {
    expect(isTypedNameMine("  matt  ", "MATT", null)).toBe(true);
    expect(isTypedNameMine("MATT", null, "  matt ")).toBe(true);
  });

  it("an empty or whitespace-only typed name is NEVER mine, even against an empty file owner", () => {
    expect(isTypedNameMine("", null, "")).toBe(false);
    expect(isTypedNameMine("   ", "Matt", "Matt")).toBe(false);
  });

  it("false when the typed name matches neither the local nor the file owner", () => {
    expect(isTypedNameMine("Alice", "Matt", "Matt")).toBe(false);
  });

  it("a null/undefined file owner never matches (no file-owner leg to hit)", () => {
    expect(isTypedNameMine("Matt", null, null)).toBe(false);
    expect(isTypedNameMine("Matt", null, undefined)).toBe(false);
  });
});
