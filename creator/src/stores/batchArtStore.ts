import { create } from "zustand";
import type { BatchTarget } from "@/lib/batchArt";
import {
  collectTargets,
  runBatchArtGeneration,
  applyImageToWorld,
} from "@/lib/batchArt";
import { buildAudioMetaIndex } from "@/lib/audioLibrary";
import { useAssetStore } from "./assetStore";
import { useVibeStore } from "./vibeStore";
import { useZoneStore } from "./zoneStore";
import { useToastStore } from "./toastStore";

export interface BatchArtJob {
  zoneId: string;
  targets: BatchTarget[];
  concurrency: number;
  running: boolean;
  bgRemoval: { done: number; total: number } | null;
}

interface BatchArtStore {
  /** The active or just-finished job. Persists across panel close + navigation. */
  job: BatchArtJob | null;
  /** Whether the full setup/progress dialog is on screen (vs. the compact pill). */
  panelOpen: boolean;

  /**
   * Open the batch art dialog for a zone. Seeds the target list from the zone's
   * live data unless a job is already running, in which case it just re-surfaces
   * the running job (only one batch runs at a time).
   */
  openSetup: (zoneId: string) => void;
  showPanel: () => void;
  closePanel: () => void;
  /** Discard a finished job and close. No-op while a job is still running. */
  dismiss: () => void;

  toggleTarget: (idx: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectMissing: () => void;
  setConcurrency: (n: number) => void;

  /** Kick off generation for the checked targets. Runs in the background. */
  start: () => void;
  /** Signal the running job to stop after in-flight work settles. */
  abort: () => void;
}

// Module-scoped so the abort signal survives store updates and is shared by
// every concurrent worker, mirroring the original component ref.
const abortRef = { current: false };

export const useBatchArtStore = create<BatchArtStore>((set, get) => ({
  job: null,
  panelOpen: false,

  openSetup: (zoneId) => {
    const current = get().job;
    if (current?.running) {
      // A batch is already in flight — surface it rather than starting another.
      set({ panelOpen: true });
      return;
    }

    const zone = useZoneStore.getState().zones.get(zoneId);
    if (!zone) return;
    const audioMeta = buildAudioMetaIndex(useAssetStore.getState().assets);
    const targets = collectTargets(zone.data, audioMeta);
    const concurrency = useAssetStore.getState().settings?.batch_concurrency ?? 5;

    set({
      job: { zoneId, targets, concurrency, running: false, bgRemoval: null },
      panelOpen: true,
    });
  },

  showPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),

  dismiss: () =>
    set((s) => (s.job?.running ? s : { job: null, panelOpen: false })),

  toggleTarget: (idx) =>
    set((s) =>
      s.job && !s.job.running
        ? {
            job: {
              ...s.job,
              targets: s.job.targets.map((t, i) =>
                i === idx ? { ...t, checked: !t.checked } : t,
              ),
            },
          }
        : s,
    ),

  selectAll: () =>
    set((s) =>
      s.job && !s.job.running
        ? { job: { ...s.job, targets: s.job.targets.map((t) => ({ ...t, checked: true })) } }
        : s,
    ),

  selectNone: () =>
    set((s) =>
      s.job && !s.job.running
        ? { job: { ...s.job, targets: s.job.targets.map((t) => ({ ...t, checked: false })) } }
        : s,
    ),

  selectMissing: () =>
    set((s) =>
      s.job && !s.job.running
        ? {
            job: {
              ...s.job,
              targets: s.job.targets.map((t) => ({ ...t, checked: !t.hasExisting })),
            },
          }
        : s,
    ),

  setConcurrency: (n) =>
    set((s) => (s.job && !s.job.running ? { job: { ...s.job, concurrency: n } } : s)),

  start: () => {
    const job = get().job;
    if (!job || job.running) return;

    const { zoneId, targets, concurrency } = job;
    const zone = useZoneStore.getState().zones.get(zoneId);
    if (!zone) return;

    const asset = useAssetStore.getState();
    const settings = asset.settings;
    const vibe = useVibeStore.getState().vibes.get(zoneId) ?? "";
    const imageProvider = settings?.image_provider ?? "deepinfra";

    abortRef.current = false;
    set({ job: { ...job, running: true, bgRemoval: null }, panelOpen: true });

    runBatchArtGeneration(
      targets,
      zone.data,
      zoneId,
      asset.artStyle,
      vibe,
      imageProvider,
      settings?.image_model,
      concurrency,
      abortRef,
      {
        onTargetUpdate: (idx, update) =>
          set((s) =>
            s.job
              ? {
                  job: {
                    ...s.job,
                    targets: s.job.targets.map((t, i) =>
                      i === idx ? { ...t, ...update } : t,
                    ),
                  },
                }
              : s,
          ),
        // Write each image into the zone's *live* data so a backgrounded batch
        // never clobbers concurrent edits, and avoid undo-stack flooding.
        applyImage: (kind, id, fileName) => {
          const zs = useZoneStore.getState();
          const cur = zs.zones.get(zoneId)?.data;
          if (!cur) return;
          zs.setZoneDataSilent(zoneId, applyImageToWorld(cur, kind, id, fileName));
        },
        onBgRemovalProgress: (done, total) =>
          set((s) => (s.job ? { job: { ...s.job, bgRemoval: { done, total } } } : s)),
        // reload=false: skip the per-image manifest reload (O(n²) on big zones —
        // it OOMs the WebView). The whole batch refreshes once on completion.
        acceptAsset: (image, assetType, enhancedPrompt, context, variantGroup, isActive) =>
          asset.acceptAsset(
            image,
            assetType,
            enhancedPrompt,
            context,
            variantGroup,
            isActive,
            false,
          ),
      },
      settings?.auto_remove_bg,
    )
      .catch(() => {})
      .finally(() => {
        useAssetStore.getState().loadAssets().catch(() => {});
        set((s) => (s.job ? { job: { ...s.job, running: false, bgRemoval: null } } : s));

        const finished = get().job;
        if (finished) {
          const done = finished.targets.filter((t) => t.status === "done").length;
          const errors = finished.targets.filter((t) => t.status === "error").length;
          useToastStore.getState().show(
            {
              kicker: "Batch Art",
              message: `${done} image${done === 1 ? "" : "s"} generated${
                errors ? `, ${errors} failed` : ""
              }`,
              variant: "ember",
            },
            4000,
          );
          // Auto-clear the job once the user has moved on, but keep it if the
          // panel is still open so they can review per-target results.
          if (!get().panelOpen) set({ job: null });
        }
      });
  },

  abort: () => {
    abortRef.current = true;
  },
}));
