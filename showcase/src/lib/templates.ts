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
};

/** Accent color per template for card borders, badges, and visual coding. */
export const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "#a897d2",
  character: "#a897d2",
  location: "#8caec9",
  organization: "#bea873",
  item: "#a3c48e",
  species: "#c4956a",
  event: "#bea873",
  language: "#95a0bf",
  profession: "#d4c8a0",
  ability: "#b88faa",
  freeform: "#95a0bf",
};
