import type { ArticleTemplate } from "@/types/showcase";

export const TEMPLATE_LABELS: Record<ArticleTemplate, string> = {
  world_setting: "World Setting",
  character: "Character",
  location: "Location",
  organization: "Organization",
  item: "Item",
  species: "Species",
  event: "Event",
  language: "Language",
  profession: "Profession",
  ability: "Ability",
  freeform: "Freeform",
  story: "Story",
};

/** Accent color per template for card borders, badges, and visual coding. */
export const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "var(--color-template-world)",
  character: "var(--color-template-character)",
  location: "var(--color-template-location)",
  organization: "var(--color-template-organization)",
  item: "var(--color-template-item)",
  species: "var(--color-template-species)",
  event: "var(--color-template-event)",
  language: "var(--color-template-language)",
  profession: "var(--color-template-profession)",
  ability: "var(--color-template-ability)",
  freeform: "var(--color-template-freeform)",
  story: "var(--color-accent)",
};
