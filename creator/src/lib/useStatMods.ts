import { useCallback } from "react";
import type { StatMap } from "@/types/world";

/**
 * Shared state logic for stat modifier maps (StatMap).
 * Used by RaceStatMods and StatModsEditor.
 *
 * - `updateMod`: sets a value, or removes the key if value is 0
 * - `addMod`: adds a key with value 1
 * - `removeMod`: removes a key
 * - All operations call `onChange(undefined)` when the map becomes empty.
 */
export function useStatMods(
  statMods: StatMap | undefined,
  onChange: (mods: StatMap | undefined) => void,
) {
  const mods = statMods ?? {};

  const commit = useCallback(
    (next: StatMap) => {
      onChange(Object.keys(next).length > 0 ? next : undefined);
    },
    [onChange],
  );

  const updateMod = useCallback(
    (statId: string, value: number) => {
      const next = { ...mods };
      if (value === 0) {
        delete next[statId];
      } else {
        next[statId] = value;
      }
      commit(next);
    },
    [mods, commit],
  );

  const addMod = useCallback(
    (statId: string) => {
      commit({ ...mods, [statId]: 1 });
    },
    [mods, commit],
  );

  const removeMod = useCallback(
    (statId: string) => {
      const next = { ...mods };
      delete next[statId];
      commit(next);
    },
    [mods, commit],
  );

  return { mods, updateMod, addMod, removeMod } as const;
}
