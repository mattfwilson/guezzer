/**
 * One-time album-cover pipeline (D-03, source = Claude's discretion per plan
 * 06-04): MusicBrainz WS/2 release-group search → Cover Art Archive
 * `front-250` thumbnail → sharp resize to 160×160 WebP, committed under
 * `packages/app/src/assets/covers/` with a provenance `covers-manifest.json`.
 *
 * This is the ONLY code in the app package that touches musicbrainz.org /
 * coverartarchive.org. It is a MANUAL, one-command Node script — NEVER wired
 * into CI, a build hook, or the refresh pipeline (CLAUDE.md API etiquette).
 *
 * It mirrors packages/core/src/cli/fetch-corpus.ts's polite-fetch idiom (this
 * is Node, where the User-Agent header is real): a descriptive User-Agent that
 * names the project + owner contact (config.userAgent), an AbortSignal
 * timeout, and STRICTLY SEQUENTIAL pacing — a courtesy delay of at least
 * config.fetchDelayMs (2000ms) between EVERY pair of consecutive requests
 * (MusicBrainz asks for ~1 req/s; 2s is comfortably polite). Per D-07 there is
 * no automatic re-request on failure.
 *
 * Source decision (documented deviation from UI-SPEC §Assets "kglw.net
 * first"): albums.json carries NO image-URL field, so kglw.net covers would
 * require HTML scraping — forbidden by project etiquette. Cover Art Archive is
 * a real JSON/binary API with ready-made 250px thumbnails.
 *
 * Buckets (Covers / Miscellaneous) get NO covers by design — the D-01 card
 * grid renders them with the initials placeholder. Only the studio-discography
 * CARD albums (dex-albums.json `albums[]`) are fetched here.
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { config } from "@guezzer/core/config";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// packages/app/scripts → repo root is three levels up.
const repoRoot = join(scriptDir, "..", "..", "..");
const dexAlbumsPath = join(repoRoot, "data", "normalized", "dex-albums.json");
const coversDir = join(scriptDir, "..", "src", "assets", "covers");
const manifestPath = join(coversDir, "covers-manifest.json");

/** UI-SPEC budget guard: a single committed cover thumbnail must never exceed 25 KB (the accidental-full-res tripwire). */
const MAX_COVER_BYTES = 25 * 1024;
/** Thumbnail edge — D-01 card grid renders covers at ~80px; 160px is 2× for retina. */
const THUMB_SIZE = 160;
/** sharp WebP quality — small, crisp, and well under the 25 KB budget at 160px. */
const WEBP_QUALITY = 70;

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";
const ARTIST = "King Gizzard";

/** Provenance record per committed cover (the fetch-meta.json idiom). */
interface CoverManifestEntry {
  title: string;
  sourceUrl: string;
  mbid: string;
  fetchedAt: string;
}

type CoverManifest = Record<string, CoverManifestEntry>;

interface DexAlbumCard {
  albumUrl: string;
  title: string;
  releaseDate: string;
}

interface DexAlbumsArtifact {
  albums: DexAlbumCard[];
}

interface MbReleaseGroup {
  id: string;
  score?: number;
}

interface MbSearchResponse {
  "release-groups"?: MbReleaseGroup[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** `/albums/nonagon-infinity` → `nonagon-infinity` (the Vite asset slug, D-01). */
function slugForAlbum(albumUrl: string): string {
  return basename(albumUrl);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query MusicBrainz WS/2 for the top-scored release-group matching `title` by
 * King Gizzard; returns the MBID or null when there is no match (A2 fallback —
 * the UI renders the initials placeholder). Fails loudly (throws, endpoint
 * named) on a genuine HTTP error so a rate-limit/outage is diagnosable, never
 * silently swallowed as "no cover".
 */
async function findReleaseGroupMbid(title: string): Promise<string | null> {
  const query = `releasegroup:"${title}" AND artist:"${ARTIST}"`;
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(query)}&fmt=json`;

  const res = await fetch(url, {
    headers: { "User-Agent": config.userAgent },
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
  });
  if (!res.ok) {
    throw new Error(
      `MusicBrainz HTTP ${res.status} for "${title}" — hard failure (D-07 forbids ` +
        `automatic re-requests). Diagnose (rate limit? outage?) and re-run.`,
    );
  }

  const body = (await res.json()) as MbSearchResponse;
  const groups = body["release-groups"] ?? [];
  if (groups.length === 0) return null;
  // MB returns results already ordered by descending score; take the top one.
  return groups[0].id;
}

/**
 * Fetch the Cover Art Archive front-250 thumbnail bytes for a release-group.
 * Returns the { bytes, sourceUrl } or null when no front art exists (CAA
 * answers 404 — an EXPECTED, non-error outcome that falls back to the
 * placeholder). `fetch` follows CAA's redirect to the archive.org blob.
 */
async function fetchCoverArt(
  mbid: string,
): Promise<{ bytes: Buffer; sourceUrl: string } | null> {
  const sourceUrl = `${CAA_BASE}/release-group/${mbid}/front-250`;
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": config.userAgent },
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
    redirect: "follow",
  });
  if (res.status === 404) return null; // no front cover on file — placeholder covers it
  if (!res.ok) {
    // Any other non-OK: treat as "no art available" and skip this album rather
    // than aborting the whole paced run over one flaky release-group.
    console.warn(`  ⚠ CAA HTTP ${res.status} for ${mbid} — skipping (placeholder fallback).`);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, sourceUrl };
}

export interface FetchCoversOptions {
  /** Re-fetch and overwrite covers that already exist on disk. */
  force?: boolean;
}

export interface FetchCoversResult {
  fetched: number;
  skippedExisting: number;
  noMatch: number;
  noArt: number;
}

export async function runFetchCovers(
  options: FetchCoversOptions = {},
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<FetchCoversResult> {
  const artifact = JSON.parse(await readFile(dexAlbumsPath, "utf8")) as DexAlbumsArtifact;
  const cards = artifact.albums;

  await mkdir(coversDir, { recursive: true });

  // Start from any existing manifest so a partial re-run preserves provenance
  // for covers it skips (idempotency — D-05 merge idiom).
  let manifest: CoverManifest = {};
  if (await fileExists(manifestPath)) {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CoverManifest;
  }

  const result: FetchCoversResult = { fetched: 0, skippedExisting: 0, noMatch: 0, noArt: 0 };

  let hasMadeARequest = false;
  const paceNextRequest = async (): Promise<void> => {
    if (hasMadeARequest) {
      await sleep(config.fetchDelayMs);
    }
    hasMadeARequest = true;
  };

  for (const card of cards) {
    const slug = slugForAlbum(card.albumUrl);
    const webpPath = join(coversDir, `${slug}.webp`);

    if (!options.force && (await fileExists(webpPath))) {
      console.log(`  ⏭ ${slug}: cover exists — skipping (pass --force to refetch).`);
      result.skippedExisting += 1;
      continue;
    }

    await paceNextRequest();
    const mbid = await findReleaseGroupMbid(card.title);
    if (mbid === null) {
      console.warn(`  ⚠ ${slug}: no MusicBrainz match for "${card.title}" — placeholder fallback.`);
      delete manifest[slug];
      result.noMatch += 1;
      continue;
    }

    await paceNextRequest();
    const art = await fetchCoverArt(mbid);
    if (art === null) {
      console.warn(`  ⚠ ${slug}: no Cover Art Archive front image — placeholder fallback.`);
      delete manifest[slug];
      result.noArt += 1;
      continue;
    }

    // Re-encode the untrusted external bytes through sharp — never commit the
    // fetched bytes verbatim (T-06-09). Fixed 160×160 square + WebP.
    const webp = await sharp(art.bytes)
      .resize(THUMB_SIZE, THUMB_SIZE)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // FAIL LOUDLY on the accidental-full-res commit (25 KB budget guard).
    if (webp.byteLength > MAX_COVER_BYTES) {
      console.error(
        `${slug}.webp is ${webp.byteLength} bytes — exceeds the ${MAX_COVER_BYTES}-byte ` +
          `(25 KB) budget. Aborting so no full-res asset lands in the repo.`,
      );
      process.exit(1);
    }

    await writeFile(webpPath, webp);
    manifest[slug] = {
      title: card.title,
      sourceUrl: art.sourceUrl,
      mbid,
      fetchedAt: new Date().toISOString(),
    };
    result.fetched += 1;
    console.log(`  ✓ ${slug}: ${(webp.byteLength / 1024).toFixed(1)} KB (${mbid}).`);
  }

  // Stable, key-sorted manifest + trailing newline — makes `git diff` the review mechanism.
  const sorted: CoverManifest = {};
  for (const key of Object.keys(manifest).sort()) {
    sorted[key] = manifest[key];
  }
  await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  return result;
}

function parseArgs(argv: string[]): FetchCoversOptions {
  const options: FetchCoversOptions = {};
  for (const arg of argv) {
    if (arg === "--force") {
      options.force = true;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return options;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runFetchCovers(options);
    console.log(
      `\nCovers: ${result.fetched} fetched, ${result.skippedExisting} already present, ` +
        `${result.noMatch} no-MB-match, ${result.noArt} no-CAA-art.`,
    );
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
