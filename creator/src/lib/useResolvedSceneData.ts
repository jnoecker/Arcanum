import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { isR2HashPath, isLegacyImagePath } from "@/lib/useImageSrc";
import type { Scene, SceneEntity } from "@/types/story";
import type { ZoneState } from "@/stores/zoneStore";

// ─── Entity info resolution ────────────────────────────────────────

export function resolveEntityInfo(
  entity: SceneEntity,
  zoneState: ZoneState | undefined,
): { name: string; image?: string } {
  if (!zoneState) return { name: entity.entityId };

  if (entity.entityType === "mob" || entity.entityType === "npc") {
    const mob = zoneState.data.mobs?.[entity.entityId];
    if (mob) return { name: mob.name, image: mob.image };
    return { name: entity.entityId };
  }

  if (entity.entityType === "item") {
    const item = zoneState.data.items?.[entity.entityId];
    if (item) return { name: item.displayName, image: item.image };
    return { name: entity.entityId };
  }

  return { name: entity.entityId };
}

// ─── Path resolution ───────────────────────────────────────────────

/** Build candidate file paths for an image reference, mirroring useImageSrc logic. */
export function buildCandidatePaths(
  filePath: string,
  assetsDir: string,
  mudDir: string | undefined,
): string[] {
  if (isR2HashPath(filePath)) {
    if (!assetsDir) return [];
    return [`${assetsDir}\\images\\${filePath}`];
  }

  if (!isLegacyImagePath(filePath)) {
    // Absolute path
    return [filePath];
  }

  // Legacy relative path
  if (!mudDir) return [];
  return [
    `${mudDir}/src/main/resources/world/images/${filePath}`,
    `${mudDir}/src/main/resources/images/${filePath}`,
  ];
}

// ─── Resolved scene data shape ─────────────────────────────────────

interface ResolvedEntity {
  entity: SceneEntity;
  name: string;
  imageSrc?: string;
}

interface ResolvedScene {
  sceneId: string;
  roomImageSrc?: string;
  entities: ResolvedEntity[];
}

// ─── Resolution plan ───────────────────────────────────────────────

interface ResolutionPlan {
  scenes: Array<{
    sceneId: string;
    roomImagePath?: string;
    entities: Array<{
      entity: SceneEntity;
      name: string;
      imagePath?: string;
    }>;
  }>;
  uniquePaths: string[];
}

// ─── Hook ──────────────────────────────────────────────────────────

/**
 * Resolves all scene images (room backgrounds + entity sprites) for a batch of scenes,
 * producing the resolvedSceneData array that CinematicRenderer expects.
 *
 * Uses invoke("read_image_data_url") directly rather than useImageSrc (which is a hook
 * and cannot be called in a loop).
 */
export function useResolvedSceneData(
  scenes: Scene[],
  zoneId: string,
): ResolvedScene[] {
  const zones = useZoneStore((s) => s.zones);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const mudDir = useProjectStore((s) => s.project?.mudDir);

  const [resolvedMap, setResolvedMap] = useState<Map<string, string>>(new Map());

  const zoneState = zones.get(zoneId);

  // Build a resolution plan: for each scene, determine entity info and image paths
  const plan = useMemo((): ResolutionPlan => {
    const pathSet = new Set<string>();
    const scenePlans = scenes.map((scene) => {
      // Room image path
      let roomImagePath: string | undefined;
      if (scene.roomId) {
        const room = zoneState?.data.rooms[scene.roomId];
        if (room?.image) {
          roomImagePath = room.image;
          const candidates = buildCandidatePaths(room.image, assetsDir, mudDir);
          for (const c of candidates) pathSet.add(c);
        }
      }

      // Entity image paths
      const entityPlans = (scene.entities ?? []).map((entity) => {
        const info = resolveEntityInfo(entity, zoneState);
        if (info.image) {
          const candidates = buildCandidatePaths(info.image, assetsDir, mudDir);
          for (const c of candidates) pathSet.add(c);
        }
        return { entity, name: info.name, imagePath: info.image };
      });

      return { sceneId: scene.id, roomImagePath, entities: entityPlans };
    });

    return { scenes: scenePlans, uniquePaths: Array.from(pathSet) };
  }, [scenes, zoneState, assetsDir, mudDir]);

  // Resolve all unique paths via IPC
  useEffect(() => {
    if (plan.uniquePaths.length === 0) {
      setResolvedMap(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const newMap = new Map<string, string>();

      // Resolve each unique path
      const promises = plan.uniquePaths.map(async (path) => {
        try {
          const dataUrl = await invoke<string>("read_image_data_url", { path });
          if (!cancelled) {
            newMap.set(path, dataUrl);
          }
        } catch {
          // Image not found at this path -- skip
        }
      });

      await Promise.all(promises);

      if (!cancelled) {
        setResolvedMap(newMap);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan.uniquePaths]);

  // Build the final resolved scene data array
  const resolvedSceneData = useMemo((): ResolvedScene[] => {
    return plan.scenes.map((scenePlan) => {
      // Resolve room image
      let roomImageSrc: string | undefined;
      if (scenePlan.roomImagePath) {
        const candidates = buildCandidatePaths(scenePlan.roomImagePath, assetsDir, mudDir);
        for (const c of candidates) {
          const resolved = resolvedMap.get(c);
          if (resolved) {
            roomImageSrc = resolved;
            break;
          }
        }
      }

      // Resolve entity images
      const entities: ResolvedEntity[] = scenePlan.entities.map((ep) => {
        let imageSrc: string | undefined;
        if (ep.imagePath) {
          const candidates = buildCandidatePaths(ep.imagePath, assetsDir, mudDir);
          for (const c of candidates) {
            const resolved = resolvedMap.get(c);
            if (resolved) {
              imageSrc = resolved;
              break;
            }
          }
        }
        return { entity: ep.entity, name: ep.name, imageSrc };
      });

      return { sceneId: scenePlan.sceneId, roomImageSrc, entities };
    });
  }, [plan.scenes, resolvedMap, assetsDir, mudDir]);

  return resolvedSceneData;
}
