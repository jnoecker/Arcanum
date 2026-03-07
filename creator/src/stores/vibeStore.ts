import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface VibeState {
  vibes: Map<string, string>;
  loading: Set<string>;

  loadVibe: (zoneId: string) => Promise<string>;
  saveVibe: (zoneId: string, vibe: string) => Promise<void>;
  generateVibe: (zoneId: string, worldContext: string) => Promise<string>;
  getVibe: (zoneId: string) => string;
}

export const useVibeStore = create<VibeState>((set, get) => ({
  vibes: new Map(),
  loading: new Set(),

  loadVibe: async (zoneId) => {
    const cached = get().vibes.get(zoneId);
    if (cached !== undefined) return cached;

    set((s) => ({ loading: new Set(s.loading).add(zoneId) }));
    try {
      const vibe = await invoke<string>("load_zone_vibe", { zoneId });
      set((s) => {
        const vibes = new Map(s.vibes);
        vibes.set(zoneId, vibe);
        const loading = new Set(s.loading);
        loading.delete(zoneId);
        return { vibes, loading };
      });
      return vibe;
    } catch {
      set((s) => {
        const loading = new Set(s.loading);
        loading.delete(zoneId);
        return { loading };
      });
      return "";
    }
  },

  saveVibe: async (zoneId, vibe) => {
    await invoke("save_zone_vibe", { zoneId, vibeText: vibe });
    set((s) => {
      const vibes = new Map(s.vibes);
      vibes.set(zoneId, vibe);
      return { vibes };
    });
  },

  generateVibe: async (zoneId, worldContext) => {
    const systemPrompt = `You are an atmosphere designer for a MUD (text-based RPG) game. Given a zone's content (rooms, mobs, items), generate a concise "zone vibe" — a 2-4 sentence atmospheric description that captures the zone's mood, color palette, lighting, and feeling. This vibe will be injected into image generation prompts to ensure visual coherence across all assets in the zone.

Focus on:
- Dominant colors and lighting quality
- Atmospheric elements (mist, dust, glow, shadows)
- Emotional tone (foreboding, serene, mysterious, vibrant)
- Material textures (stone, wood, crystal, organic)

Output ONLY the vibe text — no explanation, no formatting, no preamble.`;

    const vibe = await invoke<string>("llm_complete", {
      systemPrompt,
      userPrompt: worldContext,
    });

    await get().saveVibe(zoneId, vibe);
    return vibe;
  },

  getVibe: (zoneId) => {
    return get().vibes.get(zoneId) ?? "";
  },
}));
