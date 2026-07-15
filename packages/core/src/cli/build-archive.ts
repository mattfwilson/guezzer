/**
 * Thin CLI wrapper around the pure `deriveArchive` function: read the committed
 * normalized corpus, derive the compact offline archive, and write the
 * versioned artifact. Mirrors cli/build-model.ts's structure exactly (exported
 * run fn, isMain guard, deterministic output, stable 2-space JSON + trailing
 * newline).
 *
 * The derivation is pure and order-stable, so two runs against the same
 * committed corpus emit a byte-identical artifact — `git diff` is the review
 * mechanism. A fail-loud guard trips if the output exceeds the A6 bundle
 * budget (250 KB) so the archive can never silently bloat the app bundle.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import { deriveArchive } from "../dex/archive.ts";
import type { ArchiveArtifact } from "../dex/archive-types.ts";

/** A6 bundle-budget tripwire — the archive rides the JS bundle, so keep it small. */
const MAX_ARCHIVE_BYTES = 250 * 1024;

/**
 * Serialize the archive with 2-space-indented structure but the numeric
 * `songs` arrays collapsed onto one line. Full 2-space pretty-print of this
 * artifact is ~365 KB (one line per song id × ~15k performances) — over the A6
 * budget; a minified single line is ~147 KB but destroys `git diff`
 * readability. This hybrid keeps every show a readable block (date/venue/sets
 * visible) while the song-id arrays stay compact — ~155 KB, well under budget,
 * and still fully deterministic. The collapse only touches arrays of pure
 * integers (the `songs` lists — no other archive array is number-only), and
 * the caller asserts the result round-trips to the same object.
 */
function serializeArchive(artifact: ArchiveArtifact): string {
  const pretty = JSON.stringify(artifact, null, 2);
  const collapsed = pretty.replace(/\[[\d\s,]*?\]/g, (match) => {
    const nums = match.match(/\d+/g) ?? [];
    return `[${nums.join(", ")}]`;
  });
  return `${collapsed}\n`;
}

export interface BuildArchiveCliOptions {
  corpusPath: string;
  outPath: string;
}

export interface BuildArchiveCliResult {
  artifact: ArchiveArtifact;
  byteLength: number;
}

function defaultOptions(): BuildArchiveCliOptions {
  return {
    corpusPath: config.corpusArtifactPath,
    outPath: config.dex.archiveArtifactPath,
  };
}

export async function runBuildArchive(
  options: Partial<BuildArchiveCliOptions> = {},
): Promise<BuildArchiveCliResult> {
  const opts: BuildArchiveCliOptions = { ...defaultOptions(), ...options };

  const corpus = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
  const artifact = deriveArchive(corpus);

  const serialized = serializeArchive(artifact);
  // Safety: the compact serializer must round-trip to the identical object —
  // a regex-collapse bug can never silently corrupt the committed artifact.
  if (JSON.stringify(JSON.parse(serialized)) !== JSON.stringify(artifact)) {
    throw new Error("Archive serialization did not round-trip — refusing to write a corrupt artifact.");
  }
  const byteLength = Buffer.byteLength(serialized, "utf8");
  if (byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(
      `Archive artifact is ${(byteLength / 1024).toFixed(1)} KB, exceeding the ` +
        `${(MAX_ARCHIVE_BYTES / 1024).toFixed(0)} KB A6 bundle budget. Investigate before committing.`,
    );
  }

  await mkdir(dirname(opts.outPath), { recursive: true });
  await writeFile(opts.outPath, serialized, "utf8");

  return { artifact, byteLength };
}

export function formatBuildArchiveSummary(result: BuildArchiveCliResult): string {
  const { artifact, byteLength } = result;
  return (
    `Built archive: ${artifact.shows.length} shows, ${Object.keys(artifact.songs).length} songs, ` +
    `latestShowDate ${artifact.latestShowDate}, ${(byteLength / 1024).toFixed(1)} KB.`
  );
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await runBuildArchive();
    console.log(formatBuildArchiveSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
