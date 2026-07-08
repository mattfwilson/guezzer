/**
 * Thin CLI wrapper (DATA-04, D-01..D-04) around the pure
 * `deriveCatalogFromCorpus` / `generateTuningTags` / `mergeTuningTags`
 * trio: read the committed normalized corpus + albums.json + any existing
 * data/tuning-tags.json, generate album-derived defaults, merge
 * append-only, write the result, and print an additions summary.
 *
 * Never invoked from CI or a build step — a manually-run refresh action
 * alongside cli/refresh.ts (CLAUDE.md: fetch/build-time only, D-05 spirit).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import {
  albumRowSchema,
  deriveCatalogFromCorpus,
  generateTuningTags,
  mergeTuningTags,
  tuningTagsFileSchema,
  type AlbumRow,
  type TuningTagsFile,
} from "../ingest/tuning-tags.ts";

export interface GenerateTuningTagsCliOptions {
  corpusPath: string;
  albumsPath: string;
  tagsPath: string;
}

export interface GenerateTuningTagsCliResult {
  file: TuningTagsFile;
  added: string[];
}

/** Accepts either a bare row array or a `{ data: [...] }` envelope — tolerates both committed data shapes (matches normalize-corpus.ts's convention). */
function extractRows(parsed: unknown, fileName: string): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "data" in parsed &&
    Array.isArray((parsed as { data: unknown }).data)
  ) {
    return (parsed as { data: unknown[] }).data;
  }
  throw new Error(
    `${fileName}: expected either a bare row array or an API envelope ({ error, error_message, data }) — got neither.`,
  );
}

function defaultOptions(): GenerateTuningTagsCliOptions {
  return {
    corpusPath: config.corpusArtifactPath,
    albumsPath: join(config.dataRawDir, "albums.json"),
    tagsPath: config.tuningTagsPath,
  };
}

export async function runGenerateTuningTags(
  options: Partial<GenerateTuningTagsCliOptions> = {},
): Promise<GenerateTuningTagsCliResult> {
  const opts: GenerateTuningTagsCliOptions = { ...defaultOptions(), ...options };

  const corpusRaw = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;

  const albumsParsed: unknown = JSON.parse(await readFile(opts.albumsPath, "utf8"));
  const allAlbumRows: AlbumRow[] = z
    .array(albumRowSchema)
    .parse(extractRows(albumsParsed, opts.albumsPath));
  // T-01-13 mitigation: only artist_id === 1 (KGLW) rows ever reach the
  // generator — side-project album rows never contribute a family default.
  const kglwAlbumRows = allAlbumRows.filter((row) => row.artist_id === 1);

  // T-01-14 mitigation: an existing hand-edited file is zod-validated on
  // every load — a corrupt hand-edit hard-fails loudly here rather than
  // silently feeding Phase 2 a garbage entry. No existing file (first run)
  // starts from an empty entries array.
  let existing: TuningTagsFile = { schemaVersion: 1, entries: [] };
  try {
    const existingRaw = await readFile(opts.tagsPath, "utf8");
    existing = tuningTagsFileSchema.parse(JSON.parse(existingRaw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  const catalog = deriveCatalogFromCorpus(corpusRaw);
  const generated = generateTuningTags(catalog, kglwAlbumRows);
  const { merged, added } = mergeTuningTags(existing.entries, generated);

  // T-01-15 mitigation (D-04 live proof): the merge above never rewrites an
  // existing entry — validate the final shape before writing so a bug here
  // would hard-fail instead of silently corrupting the committed file.
  const file: TuningTagsFile = tuningTagsFileSchema.parse({
    schemaVersion: 1,
    entries: merged,
  });

  await mkdir(dirname(opts.tagsPath), { recursive: true });
  await writeFile(opts.tagsPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  return { file, added };
}

export function formatGenerateTuningTagsSummary(result: GenerateTuningTagsCliResult): string {
  const needsReviewCount = result.file.entries.filter((entry) => entry.needsReview).length;
  const addedSummary = result.added.length > 0 ? result.added.join(", ") : "none";
  return (
    `tuning-tags: ${result.file.entries.length} total entries, ${result.added.length} added ` +
    `(${addedSummary}), ${needsReviewCount} needsReview.`
  );
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await runGenerateTuningTags();
    console.log(formatGenerateTuningTagsSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
