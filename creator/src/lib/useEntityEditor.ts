import { useCallback, useMemo } from "react";
import type { WorldFile } from "@/types/world";

/**
 * Shared setup for zone entity editors. Returns the resolved entity,
 * a `patch` callback, a `handleDelete` callback, and room options.
 */
export function useEntityEditor<T>(
  world: WorldFile,
  entityId: string,
  getEntity: (world: WorldFile) => T | undefined,
  updateFn: (world: WorldFile, id: string, patch: Partial<T>) => WorldFile,
  deleteFn: (world: WorldFile, id: string) => WorldFile,
  onWorldChange: (world: WorldFile) => void,
  onDelete: () => void,
) {
  const entity = getEntity(world);

  const patch = useCallback(
    (p: Partial<T>) => onWorldChange(updateFn(world, entityId, p)),
    [world, entityId, onWorldChange, updateFn],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(deleteFn(world, entityId));
    onDelete();
  }, [world, entityId, onWorldChange, onDelete, deleteFn]);

  const rooms = useMemo(
    () => Object.keys(world.rooms).map((r) => ({ value: r, label: r })),
    [world.rooms],
  );

  return { entity, patch, handleDelete, rooms } as const;
}
