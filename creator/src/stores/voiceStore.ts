import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import type { SyncProgress } from "@/types/assets";
import {
  DEFAULT_ELEVENLABS_MODEL,
  lineKey,
  resolveVoiceSettings,
  type DialogueLine,
  type ElevenLabsVoice,
  type LineClip,
  type VoiceClip,
  type VoiceMap,
  type VoiceSettings,
  type VoiceStatusQuery,
  type VoiceStatusResult,
  type VoiceUploadJob,
} from "@/types/voiceover";

/** Max parallel ElevenLabs calls. Kept at 2 because free/starter plans cap
 *  concurrent requests low (2–3) and over-cap calls 429; the backend also
 *  retries transient 429/5xx with backoff. */
const SYNTH_CONCURRENCY = 2;

const EMPTY_MAP: VoiceMap = {
  defaultVoiceId: "",
  modelId: DEFAULT_ELEVENLABS_MODEL,
  assignments: {},
  defaultSettings: {},
  settings: {},
};

/** Drop generated results for a mob's lines so changed voice/settings show as
 *  needing regeneration. lineKey is `${zone} ${templateKey} ${nodeId}`. */
function pruneResultsForMob(
  results: Map<string, LineState>,
  templateKey: string,
): Map<string, LineState> {
  const next = new Map(results);
  for (const key of results.keys()) {
    if (key.split(" ")[1] === templateKey) next.delete(key);
  }
  return next;
}

/** Merge a settings patch, dropping any field set back to undefined so a
 *  per-field reset truly clears the override (rather than storing undefined). */
function mergeSettings(base: VoiceSettings, patch: Partial<VoiceSettings>): VoiceSettings {
  const next: VoiceSettings = { ...base, ...patch };
  for (const k of Object.keys(next) as (keyof VoiceSettings)[]) {
    if (next[k] === undefined) delete next[k];
  }
  return next;
}

export type LineStatus = "idle" | "generating" | "done" | "error";

export interface LineState {
  status: LineStatus;
  clip?: LineClip;
  error?: string;
}

interface VoiceStore {
  voiceMap: VoiceMap;
  /** True once the voice map has been read from disk, so remounts don't
   *  reload and clobber unsaved in-memory edits. */
  mapLoaded: boolean;
  voices: ElevenLabsVoice[];
  loadingVoices: boolean;
  voicesError: string | null;
  /** voiceId → that voice's own ElevenLabs default settings (slider baseline). */
  voiceDefaults: Record<string, VoiceSettings>;
  /** lineKey → generation state. */
  results: Map<string, LineState>;
  generating: boolean;
  publishing: boolean;
  lastPublish: SyncProgress | null;

  loadVoiceMap: () => Promise<void>;
  saveVoiceMap: () => Promise<void>;
  rehydrate: (lines: DialogueLine[]) => Promise<void>;
  ensureClipDataUrl: (key: string) => Promise<string | undefined>;
  setDefaultVoice: (voiceId: string) => void;
  setModel: (modelId: string) => void;
  setAssignment: (templateKey: string, voiceId: string) => void;
  resolveVoiceId: (templateKey: string) => string;
  setDefaultSettings: (patch: Partial<VoiceSettings>) => void;
  setMobSettings: (templateKey: string, patch: Partial<VoiceSettings>) => void;
  clearMobSettings: (templateKey: string) => void;
  clearDefaultSettings: () => void;

  fetchVoices: () => Promise<void>;
  fetchVoiceDefaults: (voiceId: string) => Promise<void>;

  synthesizeLine: (line: DialogueLine) => Promise<void>;
  generateAll: (lines: DialogueLine[]) => Promise<void>;
  publishToR2: (lines: DialogueLine[]) => Promise<SyncProgress | null>;
  reset: () => void;
}

function projectDir(): string | undefined {
  return useProjectStore.getState().project?.mudDir;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  voiceMap: EMPTY_MAP,
  mapLoaded: false,
  voices: [],
  loadingVoices: false,
  voicesError: null,
  voiceDefaults: {},
  results: new Map(),
  generating: false,
  publishing: false,
  lastPublish: null,

  loadVoiceMap: async () => {
    // Only read from disk once per session — remounting the panel must not
    // overwrite in-memory edits with the (older) saved file.
    if (get().mapLoaded) return;
    const dir = projectDir();
    if (!dir) return;
    try {
      const map = await invoke<VoiceMap>("load_voice_map", { projectDir: dir });
      set({
        voiceMap: {
          defaultVoiceId: map.defaultVoiceId ?? "",
          modelId: map.modelId || DEFAULT_ELEVENLABS_MODEL,
          assignments: map.assignments ?? {},
          defaultSettings: map.defaultSettings ?? {},
          settings: map.settings ?? {},
        },
        mapLoaded: true,
      });
    } catch (e) {
      console.error("Failed to load voice map", e);
    }
  },

  saveVoiceMap: async () => {
    const dir = projectDir();
    if (!dir) return;
    await invoke("save_voice_map", { projectDir: dir, map: get().voiceMap });
  },

  rehydrate: async (lines) => {
    const { voiceMap } = get();
    const queries: VoiceStatusQuery[] = lines.map((line) => ({
      key: lineKey(line.zone, line.templateKey, line.nodeId),
      text: line.text,
      voiceId: voiceMap.assignments[line.templateKey] || voiceMap.defaultVoiceId,
      modelId: voiceMap.modelId || DEFAULT_ELEVENLABS_MODEL,
      voiceSettings: resolveVoiceSettings(voiceMap, line.templateKey),
    }));
    if (!queries.length) return;
    let statuses: VoiceStatusResult[];
    try {
      statuses = await invoke<VoiceStatusResult[]>("voice_clip_status", { queries });
    } catch {
      return;
    }
    set((s) => {
      const results = new Map(s.results);
      for (const st of statuses) {
        const cur = results.get(st.key);
        // Only fill lines we don't already have richer state for, so we never
        // clobber an in-progress, freshly-generated, or errored entry.
        if (st.present && (!cur || cur.status === "idle")) {
          results.set(st.key, {
            status: "done",
            clip: { cacheHash: st.cacheHash, textSha8: st.textSha8 },
          });
        }
      }
      return { results };
    });
  },

  ensureClipDataUrl: async (key) => {
    const cur = get().results.get(key);
    if (!cur?.clip) return undefined;
    if (cur.clip.dataUrl) return cur.clip.dataUrl;
    try {
      const dataUrl = await invoke<string>("read_voice_clip", {
        cacheHash: cur.clip.cacheHash,
      });
      set((s) => {
        const results = new Map(s.results);
        const c = results.get(key);
        if (c?.clip) results.set(key, { ...c, clip: { ...c.clip, dataUrl } });
        return { results };
      });
      return dataUrl;
    } catch {
      return undefined;
    }
  },

  setDefaultVoice: (voiceId) =>
    set((s) => ({ voiceMap: { ...s.voiceMap, defaultVoiceId: voiceId } })),

  setModel: (modelId) =>
    set((s) => ({ voiceMap: { ...s.voiceMap, modelId } })),

  setAssignment: (templateKey, voiceId) =>
    set((s) => {
      const assignments = { ...s.voiceMap.assignments };
      if (voiceId) {
        assignments[templateKey] = voiceId;
      } else {
        delete assignments[templateKey];
      }
      return {
        voiceMap: { ...s.voiceMap, assignments },
        results: pruneResultsForMob(s.results, templateKey),
      };
    }),

  resolveVoiceId: (templateKey) => {
    const { voiceMap } = get();
    return voiceMap.assignments[templateKey] || voiceMap.defaultVoiceId;
  },

  setDefaultSettings: (patch) =>
    set((s) => ({
      voiceMap: {
        ...s.voiceMap,
        defaultSettings: mergeSettings(s.voiceMap.defaultSettings, patch),
      },
    })),

  clearDefaultSettings: () =>
    set((s) => ({ voiceMap: { ...s.voiceMap, defaultSettings: {} } })),

  setMobSettings: (templateKey, patch) =>
    set((s) => {
      const settings = { ...s.voiceMap.settings };
      const merged = mergeSettings(settings[templateKey] ?? {}, patch);
      if (Object.keys(merged).length === 0) {
        delete settings[templateKey];
      } else {
        settings[templateKey] = merged;
      }
      return {
        voiceMap: { ...s.voiceMap, settings },
        results: pruneResultsForMob(s.results, templateKey),
      };
    }),

  clearMobSettings: (templateKey) =>
    set((s) => {
      const settings = { ...s.voiceMap.settings };
      delete settings[templateKey];
      return {
        voiceMap: { ...s.voiceMap, settings },
        results: pruneResultsForMob(s.results, templateKey),
      };
    }),

  fetchVoices: async () => {
    set({ loadingVoices: true, voicesError: null });
    try {
      const voices = await invoke<ElevenLabsVoice[]>("elevenlabs_list_voices");
      set({ voices, loadingVoices: false });
    } catch (e) {
      set({ loadingVoices: false, voicesError: String(e) });
    }
  },

  fetchVoiceDefaults: async (voiceId) => {
    if (!voiceId || get().voiceDefaults[voiceId] !== undefined) return;
    // Reserve the slot up front so concurrent callers don't double-fetch.
    set((s) => ({ voiceDefaults: { ...s.voiceDefaults, [voiceId]: {} } }));
    try {
      const settings = await invoke<VoiceSettings>("elevenlabs_voice_settings", { voiceId });
      set((s) => ({ voiceDefaults: { ...s.voiceDefaults, [voiceId]: settings } }));
    } catch {
      // Leave the empty placeholder so sliders fall back to the generic baseline.
    }
  },

  synthesizeLine: async (line) => {
    const key = lineKey(line.zone, line.templateKey, line.nodeId);
    const voiceId = get().resolveVoiceId(line.templateKey);
    if (!voiceId) {
      set((s) => {
        const results = new Map(s.results);
        results.set(key, { status: "error", error: "No voice assigned (set a default or per-mob voice)." });
        return { results };
      });
      return;
    }

    set((s) => {
      const results = new Map(s.results);
      results.set(key, { ...results.get(key), status: "generating" });
      return { results };
    });

    try {
      const vc = await invoke<VoiceClip>("elevenlabs_synthesize", {
        text: line.text,
        voiceId,
        modelId: get().voiceMap.modelId || DEFAULT_ELEVENLABS_MODEL,
        voiceSettings: resolveVoiceSettings(get().voiceMap, line.templateKey),
      });
      set((s) => {
        const results = new Map(s.results);
        results.set(key, {
          status: "done",
          clip: { cacheHash: vc.cacheHash, textSha8: vc.textSha8, dataUrl: vc.dataUrl },
        });
        return { results };
      });
    } catch (e) {
      set((s) => {
        const results = new Map(s.results);
        results.set(key, { status: "error", error: String(e) });
        return { results };
      });
    }
  },

  generateAll: async (lines) => {
    if (get().generating) return;
    set({ generating: true });
    try {
      const queue = [...lines];
      const worker = async () => {
        for (;;) {
          const line = queue.shift();
          if (!line) return;
          await get().synthesizeLine(line);
        }
      };
      const pool = Array.from(
        { length: Math.min(SYNTH_CONCURRENCY, queue.length) },
        () => worker(),
      );
      await Promise.all(pool);
    } finally {
      set({ generating: false });
    }
  },

  publishToR2: async (lines) => {
    if (get().publishing) return null;
    set({ publishing: true, lastPublish: null });
    try {
      const { results } = get();
      const jobs: VoiceUploadJob[] = [];
      for (const line of lines) {
        const state = results.get(lineKey(line.zone, line.templateKey, line.nodeId));
        if (state?.status === "done" && state.clip) {
          jobs.push({
            zone: line.zone,
            templateKey: line.templateKey,
            nodeId: line.nodeId,
            textSha8: state.clip.textSha8,
            cacheHash: state.clip.cacheHash,
          });
        }
      }
      const progress = await invoke<SyncProgress>("deploy_voices_to_r2", { jobs });
      set({ lastPublish: progress, publishing: false });
      return progress;
    } catch (e) {
      const progress: SyncProgress = {
        total: 0,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        errors: [String(e)],
      };
      set({ lastPublish: progress, publishing: false });
      return progress;
    }
  },

  reset: () =>
    set({ results: new Map(), lastPublish: null }),
}));
