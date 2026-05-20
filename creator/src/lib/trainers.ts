// ─── Trainer class helpers ────────────────────────────────────────
//
// Trainers in Arcanum are mobs with `role: "trainer"` and a `trainerClasses`
// list. On save we synthesize the server's `trainers:` map from these mobs
// (one entry per spawn room). On load we merge any incoming `trainers:` map
// back onto the matching mob and drop the standalone map. These helpers keep
// the class-list shape consistent across editors and serializers.

import type { MobFile, WorldFile, SpawnEntry } from "@/types/world";

/**
 * Return the ordered list of class IDs this trainer mob teaches.
 * Returns `[]` when the mob has no trainer config — validation catches
 * trainer mobs with an empty list as an error.
 */
export function getTrainerClasses(mob: MobFile): string[] {
  return (mob.trainerClasses ?? []).filter((c) => c && c.trim().length > 0);
}

/** First class this trainer mob teaches, or undefined when none are set. */
export function getTrainerPrimaryClass(mob: MobFile): string | undefined {
  return getTrainerClasses(mob)[0];
}

/** True when the trainer mob teaches two or more classes. */
export function isMultiClassTrainer(mob: MobFile): boolean {
  return getTrainerClasses(mob).length >= 2;
}

/**
 * Produce the `trainerClasses` patch needed to set a mob's class list.
 * Dedupes, trims, and collapses an empty result to `undefined` so we don't
 * leave dead `trainerClasses: []` in YAML.
 */
export function setTrainerClasses(classList: string[]): Partial<MobFile> {
  const cleaned = classList.map((c) => c.trim()).filter((c) => c.length > 0);
  const deduped: string[] = [];
  for (const c of cleaned) {
    if (!deduped.includes(c)) deduped.push(c);
  }
  return { trainerClasses: deduped.length > 0 ? deduped : undefined };
}

/** True if the mob is configured as a trainer (role + at least one class). */
export function isTrainerMob(mob: MobFile): boolean {
  return mob.role === "trainer" && getTrainerClasses(mob).length > 0;
}

/** Return [mobId, mob] for every mob in the zone with role=trainer. */
export function listTrainerMobs(world: WorldFile): Array<[string, MobFile]> {
  if (!world.mobs) return [];
  return Object.entries(world.mobs).filter(([, m]) => m.role === "trainer");
}

/** Return [mobId, mob] for trainer mobs whose spawns include the given room. */
export function listTrainerMobsInRoom(
  world: WorldFile,
  roomId: string,
): Array<[string, MobFile]> {
  return listTrainerMobs(world).filter(([, m]) =>
    (m.spawns ?? []).some((s: SpawnEntry) => s.room === roomId),
  );
}
