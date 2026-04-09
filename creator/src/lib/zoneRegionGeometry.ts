import type { ZonePlanRegion } from "@/types/lore";

export interface ZoneRegionPercentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ZoneRegionLeafletBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Convert a zone region from CRS.Simple coordinates into percentages relative
 * to the source image, suitable for absolutely positioned HTML overlays.
 */
export function regionToPercentRect(
  region: ZonePlanRegion,
  mapWidth: number,
  mapHeight: number,
): ZoneRegionPercentRect {
  if (mapWidth <= 0 || mapHeight <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  return {
    left: (region.x / mapWidth) * 100,
    top: ((mapHeight - region.y - region.h) / mapHeight) * 100,
    width: (region.w / mapWidth) * 100,
    height: (region.h / mapHeight) * 100,
  };
}

/**
 * Convert a zone region from CRS.Simple rectangle metadata into Leaflet bounds.
 */
export function regionToLeafletBounds(
  region: ZonePlanRegion,
): ZoneRegionLeafletBounds {
  return {
    south: region.y,
    west: region.x,
    north: region.y + region.h,
    east: region.x + region.w,
  };
}

export function translateRegionToLocal(
  region: ZonePlanRegion,
  parent: ZonePlanRegion,
): ZonePlanRegion {
  return {
    x: region.x - parent.x,
    y: region.y - parent.y,
    w: region.w,
    h: region.h,
  };
}

export function translateRegionToAbsolute(
  region: ZonePlanRegion,
  parent: ZonePlanRegion,
): ZonePlanRegion {
  return {
    x: region.x + parent.x,
    y: region.y + parent.y,
    w: region.w,
    h: region.h,
  };
}

export function regionContainsPoint(
  region: ZonePlanRegion,
  x: number,
  y: number,
): boolean {
  return (
    x >= region.x &&
    x <= region.x + region.w &&
    y >= region.y &&
    y <= region.y + region.h
  );
}
