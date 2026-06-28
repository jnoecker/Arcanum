/**
 * Stable, fast, non-cryptographic hash of a string → 8-char hex.
 *
 * Used to fingerprint the entity context an asset was rendered from, so batch
 * art can flag entities whose description changed since their last render. A
 * collision merely misses a "changed" flag (never corrupts data), so FNV-1a is
 * more than sufficient and avoids pulling in async SubtleCrypto.
 */
export function contentHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
