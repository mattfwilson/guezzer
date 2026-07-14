/**
 * UUID v4 that works in INSECURE contexts (debug session:
 * start-show-not-clickable). `crypto.randomUUID` exists only in secure
 * contexts (https / localhost) — on a plain-HTTP LAN address (the standard
 * on-device testing path, e.g. http://192.168.x.x:4173), it is `undefined`,
 * so `startShow()`'s sessionId mint threw a TypeError, the Dexie write never
 * happened, and the Start Show tap silently did nothing on real phones while
 * working on desktop localhost.
 *
 * `crypto.getRandomValues` IS available in insecure contexts everywhere
 * (including iOS Safari), so the fallback derives a spec-compliant v4 UUID
 * from 16 CSPRNG bytes. Native `crypto.randomUUID` is still preferred when
 * present.
 */
export function randomUUID(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
