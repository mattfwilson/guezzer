/**
 * GizzMap group crypto (owner-approved design, exploration 2026-07-21): the
 * relay stores ONLY ciphertext it cannot read. One human-shareable group
 * secret (QR/link between the ≤5 friends) derives TWO independent values via
 * PBKDF2-SHA256 (512 bits, split):
 *
 *   - bits   0–255 → the AES-256-GCM group key (never leaves the device)
 *   - bits 256–511 → the relay TOKEN (hex) — the capability URL path segment
 *
 * The relay sees the token but can never recover the key from it (PBKDF2
 * output bits are computationally independent), so URLs/server logs never
 * expose plaintext locations. Uses only Web Crypto + btoa/atob globals —
 * available in both browsers and Node ≥20, keeping core Node-testable with
 * zero dependencies (CLAUDE.md core-purity constraint).
 *
 * Envelope format is AES-GCM with a random 12-byte IV per message, both
 * base64. Decryption is TOLERANT (null, never a throw): a friend on a stale
 * build or a corrupted row must degrade to "no data", not brick the map —
 * mirrors the pollLatest never-throw tier.
 */

/** An encrypted relay payload — the ONLY shape the relay ever stores. */
export interface EncryptedEnvelope {
  /** 12-byte AES-GCM IV, base64. */
  iv: string;
  /** Ciphertext + GCM tag, base64. */
  data: string;
}

/**
 * CryptoKey named structurally off the runtime global rather than the lib
 * type: core compiles with `"lib": ["ES2023"]` (no DOM), where @types/node
 * exposes `CryptoKey` as a value but not a type name — deriving it from
 * `crypto.subtle.importKey`'s return resolves correctly under BOTH core's
 * Node lib and the app's DOM lib.
 */
export type GroupCryptoKey = Awaited<
  ReturnType<typeof globalThis.crypto.subtle.importKey>
>;

/** The two independent values derived from the shared group secret. */
export interface GroupKeys {
  /** 64-hex-char relay capability token (URL path segment). */
  token: string;
  /** AES-256-GCM key for envelope encrypt/decrypt. */
  key: GroupCryptoKey;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Return type pinned to Uint8Array<ArrayBuffer> (never ArrayBufferLike): the
// DOM lib's crypto.subtle params reject a possibly-SharedArrayBuffer view.
function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive the relay token + AES key from the shared group secret. Deterministic
 * for a given (secret, salt, iterations) — every friend derives identical
 * values, which IS the join mechanism. Parameters live in config.map
 * (KEY_DERIVE_ITERATIONS / KEY_DERIVE_SALT); they are passed in rather than
 * imported so the function stays a pure capability (and the relay package,
 * which never derives keys, needs no config import path).
 */
export async function deriveGroupKeys(
  secret: string,
  options: { iterations: number; salt: string },
): Promise<GroupKeys> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(options.salt),
        iterations: options.iterations,
        hash: "SHA-256",
      },
      material,
      512,
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    bits.slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return { token: toHex(bits.slice(32)), key };
}

/** Encrypt any JSON-serializable value into a relay envelope (fresh random IV per call). */
export async function encryptJson(
  key: GroupCryptoKey,
  value: unknown,
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

/**
 * Decrypt a relay envelope back to JSON. Returns null on ANY failure (bad
 * base64, wrong key, GCM auth failure, non-JSON plaintext) — tolerant tier,
 * callers zod-validate the decrypted value before trusting its shape.
 */
export async function decryptJson(
  key: GroupCryptoKey,
  envelope: EncryptedEnvelope,
): Promise<unknown | null> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.data),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    return null;
  }
}
