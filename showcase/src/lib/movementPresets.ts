// ─── Movement Preset Library ─────────────────────────────────────
// Predefined entrance and exit animation paths for scene entities.
// Standalone copy for showcase — no creator imports.

export interface MovementPreset {
  id: string;
  label: string;
  path: string; // SVG d attribute relative to final position (0,0)
  duration: number; // seconds
}

export const ENTRANCE_PRESETS: MovementPreset[] = [
  { id: "enter-from-left", label: "Enter from left", path: "M -200 0 C -100 0 -40 0 0 0", duration: 1.0 },
  { id: "enter-from-right", label: "Enter from right", path: "M 200 0 C 100 0 40 0 0 0", duration: 1.0 },
  { id: "enter-from-bottom", label: "Enter from bottom", path: "M 0 150 C 0 80 0 30 0 0", duration: 1.2 },
  { id: "rise-from-shadows", label: "Rise from shadows", path: "M 0 60 C 0 40 -10 20 0 0", duration: 1.5 },
  { id: "fade-in-place", label: "Fade in place", path: "", duration: 0.8 },
];

export const EXIT_PRESETS: MovementPreset[] = [
  { id: "exit-stage-left", label: "Exit stage left", path: "M 0 0 C -40 0 -100 0 -200 0", duration: 0.8 },
  { id: "exit-stage-right", label: "Exit stage right", path: "M 0 0 C 40 0 100 0 200 0", duration: 0.8 },
  { id: "fade-out", label: "Fade out", path: "", duration: 0.6 },
];

export function getEntrancePreset(id: string | undefined): MovementPreset | undefined {
  if (!id) return undefined;
  return ENTRANCE_PRESETS.find((p) => p.id === id);
}

export function getExitPreset(id: string | undefined): MovementPreset | undefined {
  if (!id) return undefined;
  return EXIT_PRESETS.find((p) => p.id === id);
}
