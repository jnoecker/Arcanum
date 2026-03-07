/**
 * Normalize an ID following WorldLoader rules:
 * 1. Trim whitespace
 * 2. If blank, return null (invalid)
 * 3. If contains ":", use as-is
 * 4. Otherwise prefix with "<zone>:"
 */
export function normalizeId(zone: string, rawId: string): string | null {
  const trimmed = rawId.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes(":")) return trimmed;
  return `${zone}:${trimmed}`;
}

/**
 * Extract the local part of an ID (after the last ":").
 * Used for deriving item keywords when not explicitly set.
 */
export function localPart(id: string): string {
  const idx = id.lastIndexOf(":");
  return idx >= 0 ? id.substring(idx + 1) : id;
}
