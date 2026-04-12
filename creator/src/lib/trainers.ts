// ─── Trainer class helpers ────────────────────────────────────────
//
// The MUD supports both single-class trainers (`class: WARRIOR`) and
// multi-class trainers (`classes: [WARRIOR, ROGUE]`). When the loader
// sees both, `classes` wins — this matches the server's WorldLoader
// precedence rule. These helpers centralize that logic so every call
// site stays consistent.

import type { TrainerFile } from "@/types/world";

/**
 * Return the ordered list of class IDs this trainer teaches. If the trainer
 * has a populated `classes` array it wins; otherwise we fall back to the
 * legacy single `class` string (wrapped in a list). Returns `[]` when
 * neither field is set — validation catches that as an error.
 */
export function getTrainerClasses(trainer: TrainerFile): string[] {
  if (trainer.classes && trainer.classes.length > 0) {
    return trainer.classes.filter((c) => c && c.trim().length > 0);
  }
  if (trainer.class && trainer.class.trim().length > 0) {
    return [trainer.class];
  }
  return [];
}

/** First class this trainer teaches, or undefined when none are set. */
export function getTrainerPrimaryClass(trainer: TrainerFile): string | undefined {
  return getTrainerClasses(trainer)[0];
}

/** True when the trainer teaches two or more classes. */
export function isMultiClassTrainer(trainer: TrainerFile): boolean {
  return getTrainerClasses(trainer).length >= 2;
}

/**
 * Produce the class-field patch needed to set a trainer's class list.
 * Returns the minimal shape the MUD expects:
 *   - 0 classes → both fields cleared (validation will flag it)
 *   - 1 class   → legacy `class: X`, `classes` cleared
 *   - 2+ classes → `classes: [...]`, `class` cleared
 *
 * This keeps existing single-class trainers in legacy format unless the
 * author explicitly adds a second class, which minimizes YAML churn.
 */
export function setTrainerClasses(classList: string[]): Partial<TrainerFile> {
  const cleaned = classList.map((c) => c.trim()).filter((c) => c.length > 0);
  const deduped: string[] = [];
  for (const c of cleaned) {
    if (!deduped.includes(c)) deduped.push(c);
  }

  if (deduped.length === 0) {
    return { class: undefined, classes: undefined };
  }
  if (deduped.length === 1) {
    return { class: deduped[0], classes: undefined };
  }
  return { class: undefined, classes: deduped };
}
