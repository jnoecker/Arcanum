import type { WorldFile } from "@/types/world";

/** Build a summary of zone content for the vibe generation LLM. */
export function buildVibeInput(world: WorldFile): string {
  const parts: string[] = [];

  parts.push(`Zone: ${world.zone}`);

  if (world.rooms) {
    const roomSummaries = Object.entries(world.rooms).map(([id, room]) => {
      const desc = room.description ? ` — ${room.description}` : "";
      return `  ${room.title ?? id}${desc}`;
    });
    parts.push(`Rooms:\n${roomSummaries.join("\n")}`);
  }

  if (world.mobs) {
    const mobNames = Object.entries(world.mobs).map(
      ([id, mob]) => `  ${mob.name ?? id} (${mob.tier ?? "standard"}, level ${mob.level ?? 1})`,
    );
    parts.push(`Mobs:\n${mobNames.join("\n")}`);
  }

  if (world.items) {
    const itemNames = Object.entries(world.items).map(
      ([id, item]) => `  ${item.displayName ?? id}`,
    );
    parts.push(`Items:\n${itemNames.join("\n")}`);
  }

  if (world.shops) {
    const shopNames = Object.entries(world.shops).map(
      ([id, shop]) => `  ${shop.name ?? id}`,
    );
    parts.push(`Shops:\n${shopNames.join("\n")}`);
  }

  return parts.join("\n\n");
}
