/**
 * Pure-TS forward pass for the owner's setlist transformer (2-layer pre-LN
 * decoder, packed-QKV MultiheadAttention, exact-erf GELU, tied embedding
 * head) — a faithful port of setlist-predictor's model.py running on the
 * decoded NnArtifact weights. No dependencies, no I/O, Node-testable.
 *
 * FIDELITY IS GATED, NOT ASSUMED: test/nn/golden.test.ts replays the
 * artifact's PyTorch-generated golden vectors through this implementation
 * and asserts the distributions match within 1e-4 — the port is only
 * trustworthy while that test is green (backtest-report ethos).
 *
 * Semantics matched to PyTorch defaults deliberately:
 *  - Linear: y = x @ W^T + b (weights stored [out, in], row-major)
 *  - LayerNorm eps 1e-5
 *  - nn.GELU() is the EXACT erf form, not the tanh approximation
 *  - attention scores scaled by 1/sqrt(headDim), causal mask strictly upper
 *  - dropout layers are identity (the checkpoint runs in eval mode)
 * JS doubles carry more precision than torch float32, so the port's error
 * vs the checkpoint is dominated by fp32 rounding in the weights themselves.
 */
import type { NnModel, NnTensor } from "./artifact.ts";

const LN_EPS = 1e-5;

/** Abramowitz & Stegun 7.1.26 erf approximation — |error| ≤ 1.5e-7, far inside the golden gate's 1e-4 tolerance. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/** Exact GELU (PyTorch nn.GELU default): 0.5·x·(1 + erf(x/√2)). */
function gelu(x: number): number {
  return 0.5 * x * (1 + erf(x / Math.SQRT2));
}

/** In-place LayerNorm over the last dim of a [T, d] buffer. */
function layerNorm(
  x: Float64Array,
  T: number,
  d: number,
  weight: NnTensor,
  bias: NnTensor,
  out: Float64Array,
): void {
  for (let t = 0; t < T; t++) {
    const off = t * d;
    let mean = 0;
    for (let i = 0; i < d; i++) mean += x[off + i];
    mean /= d;
    let variance = 0;
    for (let i = 0; i < d; i++) {
      const diff = x[off + i] - mean;
      variance += diff * diff;
    }
    variance /= d;
    const inv = 1 / Math.sqrt(variance + LN_EPS);
    for (let i = 0; i < d; i++) {
      out[off + i] = (x[off + i] - mean) * inv * weight.data[i] + bias.data[i];
    }
  }
}

/**
 * y[T, dOut] = x[T, dIn] @ W[dOut, dIn]^T + b — PyTorch Linear semantics.
 * `wRowOffset` lets the packed in_proj matrix serve as three stacked Linears.
 */
function linear(
  x: Float64Array,
  T: number,
  dIn: number,
  w: Float32Array,
  wRowOffset: number,
  b: Float32Array | null,
  bOffset: number,
  dOut: number,
  out: Float64Array,
): void {
  for (let t = 0; t < T; t++) {
    const xOff = t * dIn;
    const yOff = t * dOut;
    for (let o = 0; o < dOut; o++) {
      const wOff = (wRowOffset + o) * dIn;
      let sum = b ? b[bOffset + o] : 0;
      for (let i = 0; i < dIn; i++) sum += x[xOff + i] * w[wOff + i];
      out[yOff + o] = sum;
    }
  }
}

/**
 * Full forward pass: token ids → softmax next-token distribution at the LAST
 * position. Throws if `tokens` exceeds maxLen — the tokenizer truncates
 * before calling (never silently here, where a clipped context would be an
 * invisible correctness bug).
 */
export function nnForwardProbs(model: NnModel, tokens: number[]): Float32Array {
  const { dModel: d, nHeads, maxLen, vocabSize, dFf } = model.config;
  const T = tokens.length;
  if (T === 0) throw new Error("nn forward: empty token sequence");
  if (T > maxLen) throw new Error(`nn forward: ${T} tokens > maxLen ${maxLen}`);
  const headDim = d / nHeads;
  const scale = 1 / Math.sqrt(headDim);

  // x = tokEmb[token] + posEmb[position]
  const x = new Float64Array(T * d);
  for (let t = 0; t < T; t++) {
    const tokOff = tokens[t] * d;
    const posOff = t * d;
    if (tokens[t] < 0 || tokens[t] >= vocabSize) {
      throw new Error(`nn forward: token id ${tokens[t]} outside vocab`);
    }
    for (let i = 0; i < d; i++) {
      x[t * d + i] = model.tokEmb.data[tokOff + i] + model.posEmb.data[posOff + i];
    }
  }

  const h = new Float64Array(T * d);
  const qkv = new Float64Array(T * 3 * d);
  const attnMix = new Float64Array(T * d);
  const attnOut = new Float64Array(T * d);
  const ffHidden = new Float64Array(T * dFf);
  const ffOut = new Float64Array(T * d);
  const scores = new Float64Array(T);

  for (const block of model.blocks) {
    // h = LN1(x); packed qkv = h @ inProjW^T + inProjB  (rows: [q | k | v])
    layerNorm(x, T, d, block.ln1w, block.ln1b, h);
    linear(h, T, d, block.inProjW.data, 0, block.inProjB.data, 0, 3 * d, qkv);

    // Causal multi-head attention. qkv rows are [q(d) | k(d) | v(d)] per t.
    for (let head = 0; head < nHeads; head++) {
      const qBase = head * headDim;
      const kBase = d + head * headDim;
      const vBase = 2 * d + head * headDim;
      for (let t = 0; t < T; t++) {
        // scores over j ≤ t (strict upper triangle masked out)
        let maxScore = -Infinity;
        for (let j = 0; j <= t; j++) {
          let dot = 0;
          for (let i = 0; i < headDim; i++) {
            dot += qkv[t * 3 * d + qBase + i] * qkv[j * 3 * d + kBase + i];
          }
          const s = dot * scale;
          scores[j] = s;
          if (s > maxScore) maxScore = s;
        }
        let denom = 0;
        for (let j = 0; j <= t; j++) {
          scores[j] = Math.exp(scores[j] - maxScore);
          denom += scores[j];
        }
        for (let i = 0; i < headDim; i++) {
          let mixed = 0;
          for (let j = 0; j <= t; j++) {
            mixed += (scores[j] / denom) * qkv[j * 3 * d + vBase + i];
          }
          attnMix[t * d + qBase + i] = mixed;
        }
      }
    }
    // out_proj + residual
    linear(attnMix, T, d, block.outProjW.data, 0, block.outProjB.data, 0, d, attnOut);
    for (let i = 0; i < T * d; i++) x[i] += attnOut[i];

    // FF: x += Linear2(GELU(Linear1(LN2(x))))
    layerNorm(x, T, d, block.ln2w, block.ln2b, h);
    linear(h, T, d, block.ff0w.data, 0, block.ff0b.data, 0, dFf, ffHidden);
    for (let i = 0; i < T * dFf; i++) ffHidden[i] = gelu(ffHidden[i]);
    linear(ffHidden, T, dFf, block.ff3w.data, 0, block.ff3b.data, 0, d, ffOut);
    for (let i = 0; i < T * d; i++) x[i] += ffOut[i];
  }

  // Final LN at the last position only, then the tied head: logits = h · tokEmb[v].
  const last = new Float64Array(d);
  const lastNormed = new Float64Array(d);
  for (let i = 0; i < d; i++) last[i] = x[(T - 1) * d + i];
  layerNorm(last, 1, d, model.lnFw, model.lnFb, lastNormed);

  const logits = new Float64Array(vocabSize);
  let maxLogit = -Infinity;
  for (let v = 0; v < vocabSize; v++) {
    const off = v * d;
    let sum = 0;
    for (let i = 0; i < d; i++) sum += lastNormed[i] * model.tokEmb.data[off + i];
    logits[v] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }
  let denom = 0;
  for (let v = 0; v < vocabSize; v++) {
    logits[v] = Math.exp(logits[v] - maxLogit);
    denom += logits[v];
  }
  const probs = new Float32Array(vocabSize);
  for (let v = 0; v < vocabSize; v++) probs[v] = logits[v] / denom;
  return probs;
}
