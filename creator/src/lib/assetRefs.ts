import type { AppConfig } from "@/types/config";
import type { WorldFile } from "@/types/world";

const REMOTE_URL_RE = /^(?:https?:)?\/\//i;
const ENGINE_MEDIA_PATH_RE = /^\/(?:images?|videos?|audio)\//i;
const WINDOWS_ABSOLUTE_RE = /^[A-Za-z]:[\\/]/;
const UNC_PATH_RE = /^\\\\/;

export function normalizeAssetRef(value?: string | null): string | undefined {
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (REMOTE_URL_RE.test(trimmed)) return trimmed;
  if (ENGINE_MEDIA_PATH_RE.test(trimmed)) return trimmed;

  if (
    WINDOWS_ABSOLUTE_RE.test(trimmed) ||
    UNC_PATH_RE.test(trimmed) ||
    trimmed.includes("\\") ||
    (trimmed.startsWith("/") && !ENGINE_MEDIA_PATH_RE.test(trimmed))
  ) {
    const fileName = trimmed.split(/[\\/]/).pop()?.trim();
    return fileName || undefined;
  }

  return trimmed;
}

export function normalizeGlobalAssetMap(assets: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(assets)) {
    const ref = normalizeAssetRef(value);
    if (ref) normalized[key] = ref;
  }
  return normalized;
}

export function normalizeConfigAssetRefs(config: AppConfig): AppConfig {
  return {
    ...config,
    abilities: mapEntries(config.abilities, (ability) => ({
      ...ability,
      image: normalizeAssetRef(ability.image),
    })),
    statusEffects: mapEntries(config.statusEffects, (effect) => ({
      ...effect,
      image: normalizeAssetRef(effect.image),
    })),
    classes: mapEntries(config.classes, (cls) => ({
      ...cls,
      image: normalizeAssetRef(cls.image),
    })),
    races: mapEntries(config.races, (race) => ({
      ...race,
      image: normalizeAssetRef(race.image),
    })),
    globalAssets: normalizeGlobalAssetMap(config.globalAssets),
    defaultAssets: normalizeGlobalAssetMap(config.defaultAssets ?? {}),
  };
}

export function normalizeWorldAssetRefs(world: WorldFile): WorldFile {
  const imageDefaults = compactObject({
    room: normalizeAssetRef(world.image?.room),
    mob: normalizeAssetRef(world.image?.mob),
    item: normalizeAssetRef(world.image?.item),
  });
  const audioDefaults = compactObject({
    music: normalizeAssetRef(world.audio?.music),
    ambient: normalizeAssetRef(world.audio?.ambient),
  });

  return {
    ...world,
    image: hasEntries(imageDefaults) ? imageDefaults : undefined,
    audio: hasEntries(audioDefaults) ? audioDefaults : undefined,
    rooms: mapEntries(world.rooms, (room) =>
      compactObject({
        ...room,
        image: normalizeAssetRef(room.image),
        video: normalizeAssetRef(room.video),
        music: normalizeAssetRef(room.music),
        ambient: normalizeAssetRef(room.ambient),
        audio: normalizeAssetRef(room.audio),
      })),
    mobs: mapOptionalEntries(world.mobs, (mob) =>
      compactObject({
        ...mob,
        image: normalizeAssetRef(mob.image),
        video: normalizeAssetRef(mob.video),
      })),
    items: mapOptionalEntries(world.items, (item) =>
      compactObject({
        ...item,
        image: normalizeAssetRef(item.image),
        video: normalizeAssetRef(item.video),
      })),
    shops: mapOptionalEntries(world.shops, (shop) =>
      compactObject({
        ...shop,
        image: normalizeAssetRef(shop.image),
      })),
    gatheringNodes: mapOptionalEntries(world.gatheringNodes, (node) =>
      compactObject({
        ...node,
        image: normalizeAssetRef(node.image),
      })),
    recipes: mapOptionalEntries(world.recipes, (recipe) =>
      compactObject({
        ...recipe,
        image: normalizeAssetRef(recipe.image),
      })),
  };
}

function mapEntries<T>(
  entries: Record<string, T>,
  map: (entry: T) => T,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(entries)) {
    next[key] = map(value);
  }
  return next;
}

function mapOptionalEntries<T>(
  entries: Record<string, T> | undefined,
  map: (entry: T) => T,
): Record<string, T> | undefined {
  if (!entries) return undefined;
  return mapEntries(entries, map);
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const next = {} as T;
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      next[key as keyof T] = entry as T[keyof T];
    }
  }
  return next;
}

function hasEntries(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}
