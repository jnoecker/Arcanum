import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import type { SyncProgress } from "@/types/assets";
import {
  DEFAULT_ELEVENLABS_MODEL,
  lineKey,
  type DialogueLine,
  type ElevenLabsVoice,
  type VoiceClip,
  type VoiceMap,
  type VoiceUploadJob,
} from "@/types/voiceover";

/** Max parallel ElevenLabs calls — kept low to respect provider concurrency limits. */
const SYNTH_CONCURRENCY = 3;

const EMPTY_MAP: VoiceMap = {
  defaultVoiceId: "",
  modelId: DEFAULT_ELEVENLABS_MODEL,
  assignments: {},
};

export type LineStatus = "idle" | "generating" | "done" | "error";

export interface LineState {
  status: LineStatus;
  clip?: VoiceClip;
  error?: string;
}

interface VoiceStore {
  voiceMap: VoiceMap;
  voices: ElevenLabsVoice[];
  loadingVoices: boolean;
  voicesError: string | null;
  /** lineKey → generation state. */
  results: Map<string, LineState>;
  generating: boolean;
  publishing: boolean;
  lastPublish: SyncProgress | null;

  loadVoiceMap: () => Promise<void>;
  saveVoiceMap: () => Promise<void>;
  setDefaultVoice: (voiceId: string) => void;
  setModel: (modelId: string) => void;
  setAssignment: (templateKey: string, voiceId: string) => void;
  resolveVoiceId: (templateKey: string) => string;

  fetchVoices: () => Promise<void>;

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
  voices: [],
  loadingVoices: false,
  voicesError: null,
  results: new Map(),
  generating: false,
  publishing: false,
  lastPublish: null,

  loadVoiceMap: async () => {
    const dir = projectDir();
    if (!dir) return;
    try {
      const map = await invoke<VoiceMap>("load_voice_map", { projectDir: dir });
      set({
        voiceMap: {
          defaultVoiceId: map.defaultVoiceId ?? "",
          modelId: map.modelId || DEFAULT_ELEVENLABS_MODEL,
          assignments: map.assignments ?? {},
        },
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
      return { voiceMap: { ...s.voiceMap, assignments } };
    }),

  resolveVoiceId: (templateKey) => {
    const { voiceMap } = get();
    return voiceMap.assignments[templateKey] || voiceMap.defaultVoiceId;
  },

  fetchVoices: async () => {
    set({ loadingVoices: true, voicesError: null });
    try {
      const voices = await invoke<ElevenLabsVoice[]>("elevenlabs_list_voices");
      set({ voices, loadingVoices: false });
    } catch (e) {
      set({ loadingVoices: false, voicesError: String(e) });
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
      const clip = await invoke<VoiceClip>("elevenlabs_synthesize", {
        text: line.text,
        voiceId,
        modelId: get().voiceMap.modelId || DEFAULT_ELEVENLABS_MODEL,
      });
      set((s) => {
        const results = new Map(s.results);
        results.set(key, { status: "done", clip });
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
