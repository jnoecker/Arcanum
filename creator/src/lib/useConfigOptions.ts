import { useMemo } from "react";

interface ConfigEntry {
  displayName: string;
  order?: number;
}

interface Option {
  value: string;
  label: string;
}

/**
 * Build dropdown options from a config map with optional fallback.
 * Sorts by `order` field when present, falls back to displayName alpha sort.
 */
export function useConfigOptions(
  configMap: Record<string, ConfigEntry> | undefined,
  fallback: Option[] = [],
): Option[] {
  return useMemo(() => {
    if (configMap && Object.keys(configMap).length > 0) {
      return Object.entries(configMap)
        .sort(([, a], [, b]) =>
          a.order !== undefined && b.order !== undefined
            ? a.order - b.order
            : a.displayName.localeCompare(b.displayName),
        )
        .map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return fallback;
  }, [configMap, fallback]);
}
