import type { Scene, SceneTemplate } from "@/types/story";

// ─── Scene template preset definitions ──────────────────────────────

export interface SceneTemplatePreset {
  id: SceneTemplate;
  label: string;
  badgeColor: string;
  defaultTitle: string;
  defaultNarration: string; // TipTap JSON string
}

/** Three built-in scene template presets (per D-11, STORY-07). */
export const SCENE_TEMPLATE_PRESETS: Record<SceneTemplate, SceneTemplatePreset> = {
  establishing_shot: {
    id: "establishing_shot",
    label: "Establishing Shot",
    badgeColor: "#8caec9",
    defaultTitle: "The Scene Opens",
    defaultNarration: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The air itself seems to hold its breath as the vista unfolds before you \u2014 ancient stones bathed in twilight, the faint hum of forgotten enchantments carried on the wind. This place remembers what mortal minds have long abandoned.",
            },
          ],
        },
      ],
    }),
  },

  encounter: {
    id: "encounter",
    label: "Encounter",
    badgeColor: "#c4956a",
    defaultTitle: "A Confrontation",
    defaultNarration: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A shadow detaches from the gloom, and the silence shatters. Steel whispers against leather as intent crystallises in the space between heartbeats. Whatever comes next, the world will not be as it was before.",
            },
          ],
        },
      ],
    }),
  },

  discovery: {
    id: "discovery",
    label: "Discovery",
    badgeColor: "#a3c48e",
    defaultTitle: "What Lies Hidden",
    defaultNarration: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Beneath the dust of ages, something stirs \u2014 a gleam of knowing, a whisper of truth too long buried. The veil parts, and what was hidden reveals itself to those bold enough to look.",
            },
          ],
        },
      ],
    }),
  },
};

/** Set of all default template titles, used by isSceneEmpty to detect unchanged titles. */
const DEFAULT_TITLES = new Set(
  Object.values(SCENE_TEMPLATE_PRESETS).map((p) => p.defaultTitle),
);

/** Returns a Partial<Scene> patch with the template's default title, narration, and template type. */
export function applyTemplate(template: SceneTemplate): Partial<Scene> {
  const preset = SCENE_TEMPLATE_PRESETS[template];
  return {
    title: preset.defaultTitle,
    narration: preset.defaultNarration,
    template,
  };
}

/**
 * Returns true if the scene has no meaningful custom content.
 * A scene is "empty" if its title is blank or matches a default template title,
 * and it has no narration or dmNotes.
 * Used by the UI to decide whether to show a confirmation dialog before applying a template (per D-13).
 */
export function isSceneEmpty(scene: Scene): boolean {
  const titleIsEmpty = !scene.title || DEFAULT_TITLES.has(scene.title);
  const hasNarration = !!scene.narration;
  const hasDmNotes = !!scene.dmNotes;
  return titleIsEmpty && !hasNarration && !hasDmNotes;
}
