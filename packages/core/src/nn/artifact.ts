/**
 * "Max's predictor" artifact loader (owner's setlist-predictor transformer,
 * exported by that repo's `export_web.py`). ONE self-contained JSON carries
 * the config, the vocab (each song token stamped with its kglw.net songId —
 * the SAME id space the transition matrix uses, so there is no name matching
 * anywhere), every weight tensor as base64 little-endian float32, and the
 * golden test vectors the TS forward pass is gated on (test/nn/golden.test.ts).
 *
 * Validation is zod at the trust boundary (the artifact is committed data,
 * but the schema failing loudly at load beats silently wrong predictions at a
 * show — the corpus-ingestion ethos). Decoding uses only atob/DataView —
 * available in browsers AND Node ≥20, keeping core Node-testable with zero
 * dependencies (CLAUDE.md core-purity constraint).
 */
import { z } from "zod";

const tensorSchema = z.object({
  shape: z.array(z.number().int().positive()),
  /** base64 little-endian float32, C-order (numpy tobytes). */
  data: z.string().min(1),
});

const vocabEntrySchema = z.object({
  token: z.string().min(1),
  id: z.number().int().nonnegative(),
  /** kglw.net song id — absent on structure tokens and context-only names ("Unknown"). */
  songId: z.number().int().positive().optional(),
});

const goldenCaseSchema = z.object({
  tokens: z.array(z.number().int().nonnegative()).min(2),
  /** Full expected last-position distribution (one case carries it). */
  expectedFull: z.array(z.number()).optional(),
  /** Top-10 expected (id, prob) pairs (the other cases). */
  expectedTop: z.array(z.object({ id: z.number().int(), prob: z.number() })).optional(),
});

export const nnArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string(),
  exportedAt: z.string(),
  config: z.object({
    vocabSize: z.number().int().positive(),
    maxLen: z.number().int().positive(),
    dModel: z.number().int().positive(),
    nHeads: z.number().int().positive(),
    nLayers: z.number().int().positive(),
    dFf: z.number().int().positive(),
  }),
  vocab: z.array(vocabEntrySchema).min(1),
  weights: z.record(z.string(), tensorSchema),
  golden: z.array(goldenCaseSchema),
});

export type NnArtifact = z.infer<typeof nnArtifactSchema>;
export type NnConfig = NnArtifact["config"];

/** One decoded tensor: flat row-major float32 + its shape. */
export interface NnTensor {
  shape: number[];
  data: Float32Array;
}

/** Per-block decoded weights (PyTorch names → resolved tensors). */
export interface NnBlock {
  ln1w: NnTensor;
  ln1b: NnTensor;
  /** Packed QKV projection [3d, d] / [3d] (nn.MultiheadAttention in_proj). */
  inProjW: NnTensor;
  inProjB: NnTensor;
  outProjW: NnTensor;
  outProjB: NnTensor;
  ln2w: NnTensor;
  ln2b: NnTensor;
  ff0w: NnTensor;
  ff0b: NnTensor;
  ff3w: NnTensor;
  ff3b: NnTensor;
}

/** The fully-decoded, ready-to-run model. */
export interface NnModel {
  config: NnConfig;
  /** Token id → vocab entry (name + optional songId). */
  entryById: Map<number, { token: string; songId?: number }>;
  /** Token string → token id (structure tokens + song names). */
  idByToken: Map<string, number>;
  /** kglw songId → token id (song tokens that carry an id). */
  tokenBySongId: Map<number, number>;
  tokEmb: NnTensor;
  posEmb: NnTensor;
  blocks: NnBlock[];
  lnFw: NnTensor;
  lnFb: NnTensor;
}

function decodeTensor(raw: { shape: number[]; data: string }, name: string): NnTensor {
  const binary = atob(raw.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const expected = raw.shape.reduce((a, b) => a * b, 1);
  if (bytes.length !== expected * 4) {
    throw new Error(`nn artifact: tensor ${name} byte length ${bytes.length} != 4*${expected}`);
  }
  // DataView with explicit little-endian — correct on any host byte order.
  const view = new DataView(bytes.buffer);
  const data = new Float32Array(expected);
  for (let i = 0; i < expected; i++) data[i] = view.getFloat32(i * 4, true);
  return { shape: raw.shape, data };
}

function tensor(artifact: NnArtifact, name: string, shape: number[]): NnTensor {
  const raw = artifact.weights[name];
  if (!raw) throw new Error(`nn artifact: missing tensor ${name}`);
  if (raw.shape.length !== shape.length || raw.shape.some((s, i) => s !== shape[i])) {
    throw new Error(
      `nn artifact: tensor ${name} shape [${raw.shape}] != expected [${shape}]`,
    );
  }
  return decodeTensor(raw, name);
}

/**
 * Decode a schema-validated artifact into a ready-to-run model. Throws on any
 * structural mismatch (missing tensor, wrong shape, bad byte length) — the
 * caller treats a throw as "predictor unavailable", never a crash surface.
 */
export function decodeNnModel(artifact: NnArtifact): NnModel {
  const { vocabSize, maxLen, dModel, nLayers, dFf } = artifact.config;

  const entryById = new Map<number, { token: string; songId?: number }>();
  const idByToken = new Map<string, number>();
  const tokenBySongId = new Map<number, number>();
  for (const entry of artifact.vocab) {
    entryById.set(entry.id, { token: entry.token, songId: entry.songId });
    idByToken.set(entry.token, entry.id);
    if (entry.songId !== undefined) tokenBySongId.set(entry.songId, entry.id);
  }

  const blocks: NnBlock[] = [];
  for (let i = 0; i < nLayers; i++) {
    const p = `blocks.${i}`;
    blocks.push({
      ln1w: tensor(artifact, `${p}.ln1.weight`, [dModel]),
      ln1b: tensor(artifact, `${p}.ln1.bias`, [dModel]),
      inProjW: tensor(artifact, `${p}.attn.in_proj_weight`, [3 * dModel, dModel]),
      inProjB: tensor(artifact, `${p}.attn.in_proj_bias`, [3 * dModel]),
      outProjW: tensor(artifact, `${p}.attn.out_proj.weight`, [dModel, dModel]),
      outProjB: tensor(artifact, `${p}.attn.out_proj.bias`, [dModel]),
      ln2w: tensor(artifact, `${p}.ln2.weight`, [dModel]),
      ln2b: tensor(artifact, `${p}.ln2.bias`, [dModel]),
      ff0w: tensor(artifact, `${p}.ff.0.weight`, [dFf, dModel]),
      ff0b: tensor(artifact, `${p}.ff.0.bias`, [dFf]),
      ff3w: tensor(artifact, `${p}.ff.3.weight`, [dModel, dFf]),
      ff3b: tensor(artifact, `${p}.ff.3.bias`, [dModel]),
    });
  }

  return {
    config: artifact.config,
    entryById,
    idByToken,
    tokenBySongId,
    tokEmb: tensor(artifact, "tok_emb.weight", [vocabSize, dModel]),
    posEmb: tensor(artifact, "pos_emb.weight", [maxLen, dModel]),
    blocks,
    lnFw: tensor(artifact, "ln_f.weight", [dModel]),
    lnFb: tensor(artifact, "ln_f.bias", [dModel]),
  };
}

/** Parse + decode in one step; null on ANY failure (tolerant tier — the app degrades to matrix-only). */
export function loadNnModel(raw: unknown): NnModel | null {
  const parsed = nnArtifactSchema.safeParse(raw);
  if (!parsed.success) return null;
  try {
    return decodeNnModel(parsed.data);
  } catch {
    return null;
  }
}
