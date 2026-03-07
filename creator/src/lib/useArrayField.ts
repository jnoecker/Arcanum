import { useCallback } from "react";

/**
 * Provides add / update / remove helpers for an array field on a parent entity.
 *
 * @param items     The current array (may be undefined).
 * @param onUpdate  Callback to persist the updated array. Receives `undefined`
 *                  when the array becomes empty and `clearOnEmpty` is true.
 * @param defaultItem The item appended by `add()`.
 * @param clearOnEmpty When true, calls `onUpdate(undefined)` instead of an
 *                     empty array on the last removal. Default: false.
 */
export function useArrayField<T>(
  items: T[] | undefined,
  onUpdate: (next: T[] | undefined) => void,
  defaultItem: T,
  clearOnEmpty = false,
) {
  const arr = items ?? [];

  const add = useCallback(() => {
    onUpdate([...arr, defaultItem]);
  }, [arr, onUpdate, defaultItem]);

  const update = useCallback(
    (index: number, field: keyof T, value: T[keyof T]) => {
      const next = [...arr];
      next[index] = { ...next[index], [field]: value } as T;
      onUpdate(next);
    },
    [arr, onUpdate],
  );

  const remove = useCallback(
    (index: number) => {
      const next = arr.filter((_, i) => i !== index);
      onUpdate(clearOnEmpty && next.length === 0 ? undefined : next);
    },
    [arr, onUpdate, clearOnEmpty],
  );

  return { add, update, remove } as const;
}
