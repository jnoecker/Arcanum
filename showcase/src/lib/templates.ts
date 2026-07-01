import type { ArticleTemplate } from "@/types/showcase";

export const TEMPLATE_LABELS: Record<ArticleTemplate, string> = {
  world_setting: "World Setting",
  character: "Character",
  location: "Location",
  organization: "Organization",
  item: "Item",
  ancestry: "Ancestry",
  bestiary: "Bestiary",
  event: "Event",
  language: "Language",
  class: "Class",
  occupation: "Occupation",
  talent: "Talent",
  creature_power: "Creature Power",
  freeform: "Freeform",
  story: "Story",
  species: "Species",
  profession: "Profession",
  ability: "Ability",
};

/** Accent color per template for card borders, badges, and visual coding. */
export const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "var(--color-template-world)",
  character: "var(--color-template-character)",
  location: "var(--color-template-location)",
  organization: "var(--color-template-organization)",
  item: "var(--color-template-item)",
  ancestry: "var(--color-template-species)",
  bestiary: "var(--color-template-species)",
  event: "var(--color-template-event)",
  language: "var(--color-template-language)",
  class: "var(--color-template-profession)",
  occupation: "var(--color-template-profession)",
  talent: "var(--color-template-ability)",
  creature_power: "var(--color-template-ability)",
  freeform: "var(--color-template-freeform)",
  story: "var(--color-accent)",
  species: "var(--color-template-species)",
  profession: "var(--color-template-profession)",
  ability: "var(--color-template-ability)",
};
