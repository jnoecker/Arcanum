import type { WorldFile } from "@/types/world";
import { buildToneDirective, buildVisualStyleDirective } from "./loreGeneration";

// Sampling caps. The vibe brief only needs a representative slice of the
// zone — too much input dilutes the LLM's attention and the brief drifts
// generic. First-N is deterministic; if a zone needs richer sampling later
// we can switch to evenly-spaced or stratified-by-tier.
const ROOM_SAMPLE_LIMIT = 12;
const MOB_SAMPLE_LIMIT = 6;
const ITEM_SAMPLE_LIMIT = 6;

/**
 * System prompt for the vibe generator. Produces a rich Markdown brief with
 * an explicit named-color-plus-hex palette, which the image-prompt pipeline
 * uses as primary palette authority (see arcanumPrompts.ts::buildZoneVibeBlock).
 *
 * Deliberately NOT locked to any particular style. The world's visualStyle is
 * passed as soft context — the broader register — but each zone owns its own
 * micro-aesthetic. A pastel world can have a single bruised-purple zone.
 */
export const VIBE_SYSTEM_PROMPT = `You are an art director composing a short, evocative art-direction brief for a specific zone in a fantasy MUD. The brief drives all AI-generated art for the zone — rooms, mobs, items, scenes — so it must be specific enough that an image model can produce coherent results from any single asset.

Output a Markdown brief with this exact shape:

# <Zone Title> — Atmosphere & Visual Identity

<A single paragraph of 3–5 sentences. Name actual material qualities ("quilted velvet", "fogged brass", "lichen-mottled stone"), name atmospheric phenomena ("phosphorescent mist", "ambient source-ambiguous glow"), and pin down the emotional register a player experiences in this zone. Be evocative AND specific — concrete sensory detail, not generic fantasy filler.>

**Palette:** <Name1> (<#hex1>), <Name2> (<#hex2>), <Name3> (<#hex3>), with accent <Name4> (<#hex4>)

**Light:** <One sentence on the character of light — where it comes from, how it diffuses, what it pools or shadows, what surfaces it catches.>

**Forbidden:** <comma-separated list of elements that would clash with this zone — competing palettes, wrong textures, aesthetics that don't belong.>

Rules:
- The Palette line MUST include 3–5 named anchor colors WITH hex codes. Image models read hex codes literally — this is the single most load-bearing line in the brief.
- Pull textures and material qualities directly from the world's content. If rooms mention "quilted padding", that texture should appear in your brief.
- The world's overall visual style (if provided below) is the BROADER register, not a hard constraint. Each zone is its own micro-aesthetic. A pastel-overall world can have a single zone that is dark and bruised when the descriptions warrant it.
- Avoid generic fantasy filler ("magical", "mystical", "ancient ruins", "ethereal"). Reach for specific sensory language.
- If room descriptions are sparse, the prose paragraph may be vaguer — but the Palette and Forbidden lines still need to be concrete. Infer from zone name, mob names, and item names if needed.
- Output ONLY the Markdown brief. No commentary, no preamble, no closing remarks.`;

interface DescribedEntry {
  label: string;
  description?: string;
}

function formatEntries(label: string, entries: DescribedEntry[], totalCount: number): string {
  const lines = entries.map((e) =>
    e.description ? `- ${e.label}: ${e.description}` : `- ${e.label}`,
  );
  const tail = totalCount > entries.length ? `\n(...${totalCount - entries.length} more)` : "";
  return `${label} (${totalCount} total):\n${lines.join("\n")}${tail}`;
}

/**
 * Build a summary of the zone for the vibe LLM. Includes:
 * - Zone ID
 * - World visual style + tone as soft context (broader register, not hard constraint)
 * - Up to N full room descriptions
 * - Up to M full mob descriptions
 * - Up to K full item descriptions
 *
 * Names alone aren't enough — the LLM needs the texture and material language
 * that lives inside descriptions to pick concrete palette anchors.
 */
export function buildVibeInput(world: WorldFile): string {
  const parts: string[] = [];

  parts.push(`Zone ID: ${world.zone}`);

  const visualStyle = buildVisualStyleDirective();
  if (visualStyle) {
    parts.push(
      `World visual style (broader register — the zone may diverge for narrative reasons):\n${visualStyle}`,
    );
  }
  const tone = buildToneDirective();
  if (tone) {
    parts.push(`World tone:\n${tone}`);
  }

  if (world.rooms) {
    const entries = Object.entries(world.rooms);
    const sampled = entries.slice(0, ROOM_SAMPLE_LIMIT);
    const blocks: DescribedEntry[] = sampled.map(([id, room]) => ({
      label: room.title?.trim() || id,
      description: room.description?.trim() || undefined,
    }));
    if (blocks.length > 0) {
      parts.push(formatEntries("Rooms", blocks, entries.length));
    }
  }

  if (world.mobs) {
    const entries = Object.entries(world.mobs);
    const sampled = entries.slice(0, MOB_SAMPLE_LIMIT);
    const blocks: DescribedEntry[] = sampled.map(([id, mob]) => ({
      label: mob.name?.trim() || id,
      description: mob.description?.trim() || undefined,
    }));
    if (blocks.length > 0) {
      parts.push(formatEntries("Mobs", blocks, entries.length));
    }
  }

  if (world.items) {
    const entries = Object.entries(world.items);
    const sampled = entries.slice(0, ITEM_SAMPLE_LIMIT);
    const blocks: DescribedEntry[] = sampled.map(([id, item]) => ({
      label: item.displayName?.trim() || id,
      description: item.description?.trim() || undefined,
    }));
    if (blocks.length > 0) {
      parts.push(formatEntries("Items", blocks, entries.length));
    }
  }

  if (world.shops) {
    const shopNames = Object.entries(world.shops).map(([id, shop]) => `- ${shop.name ?? id}`);
    if (shopNames.length > 0) {
      parts.push(`Shops:\n${shopNames.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}
