import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { stringify } from "yaml";
import { useOpenProject } from "@/lib/useOpenProject";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useVibeStore } from "@/stores/vibeStore";
import { applyTemplate, TEMPLATES } from "@/lib/templates";
import { saveProjectConfig } from "@/lib/saveConfig";
import { zoneFilePath } from "@/lib/projectPaths";
import { addRecentProject, saveArtSubTab } from "@/lib/uiPersistence";
import {
  generateZoneContent,
  createFallbackZone,
  type ZoneGenerationParams,
} from "@/lib/generateZoneContent";
import { roomPrompt, mobPrompt, itemPrompt } from "@/lib/entityPrompts";
import { getNegativePrompt } from "@/lib/arcanumPrompts";
import {
  imageGenerateCommand,
  resolveImageModel,
  requestsTransparentBackground,
  type GeneratedImage,
} from "@/types/assets";
import { YAML_OPTS } from "@/lib/yamlOpts";
import type { WorldFile } from "@/types/world";
import type { OnboardingZoneTemplate } from "@/lib/onboardingZoneTemplates";
import type { OnboardingImageStyle } from "./ArtStyleStep";

type Phase = "project" | "zone" | "art" | "opening" | "done";

interface PhaseInfo {
  id: Phase;
  label: string;
}

const PHASES: PhaseInfo[] = [
  { id: "project", label: "Creating your project folder" },
  { id: "zone", label: "Sketching the first zone" },
  { id: "art", label: "Rendering your first art" },
  { id: "opening", label: "Opening the workspace" },
];

interface GeneratingStepProps {
  imageStyle: OnboardingImageStyle;
  template: OnboardingZoneTemplate;
  onFinished: () => void;
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function joinPath(parent: string, child: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  return parent.endsWith("/") || parent.endsWith("\\")
    ? `${parent}${child}`
    : `${parent}${sep}${child}`;
}

async function createProjectWithRetry(
  parentDir: string,
  baseName: string,
): Promise<{ mudDir: string; projectName: string }> {
  for (let i = 0; i < 20; i++) {
    const projectName = i === 0 ? baseName : `${baseName}_${i + 1}`;
    try {
      const mudDir = await invoke<string>("create_standalone_project", {
        targetDir: parentDir,
        projectName,
      });
      return { mudDir, projectName };
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("already exists")) throw e;
    }
  }
  throw new Error("Could not find an unused project name under the default location.");
}

export function GeneratingStep({ imageStyle, template, onFinished }: GeneratingStepProps) {
  const { openDir } = useOpenProject();
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const [activePhase, setActivePhase] = useState<Phase>("project");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [finishedMessage, setFinishedMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (!settings) return;
    hasStartedRef.current = true;

    const run = async () => {
      let localWarning: string | null = null;
      try {
        // ─── Phase 1: Create project ────────────────────────────
        setActivePhase("project");
        const home = await homeDir();
        const parentDir = joinPath(home, "Arcanum Worlds");
        const baseName = template.id === "custom" ? "my_world" : template.id;
        const { mudDir, projectName } = await createProjectWithRetry(parentDir, baseName);

        const openResult = await openDir(mudDir, "standalone");
        if (!openResult.success) {
          throw new Error(openResult.errors?.join(", ") ?? "Failed to open project");
        }

        // Apply the classic_fantasy config silently — user is picking zone
        // aesthetic here, not rule system.
        const classic = TEMPLATES.find((t) => t.id === "classic_fantasy");
        const baseConfig = useConfigStore.getState().config;
        const project = useProjectStore.getState().project;
        if (baseConfig && classic && project) {
          const merged = applyTemplate(baseConfig, classic.configOverrides);
          useConfigStore.getState().updateConfig(merged);
          await saveProjectConfig(project);
        }

        // ─── Phase 2: Generate the zone ──────────────────────────
        setActivePhase("zone");
        const zoneId = template.id === "custom" ? "first_zone" : template.id;
        const config = useConfigStore.getState().config;
        const statNames = config?.stats?.definitions
          ? Object.values(config.stats.definitions).map((s) => s.id)
          : [];
        const equipmentSlots = config?.equipmentSlots ? Object.keys(config.equipmentSlots) : [];
        const classNames = config?.classes
          ? Object.values(config.classes).map((c) => c.displayName).filter(Boolean)
          : [];

        const genParams: ZoneGenerationParams = {
          zoneName: template.name,
          zoneTheme: template.seedPrompt,
          backgroundContext: template.backgroundContext || undefined,
          worldTheme: template.seedPrompt,
          roomCount: template.roomCount,
          mobCount: template.mobCount,
          itemCount: template.itemCount,
          statNames,
          equipmentSlots,
          classNames,
        };

        let world: WorldFile;
        try {
          world = await generateZoneContent(genParams);
        } catch (e) {
          localWarning = `Hub couldn't generate a zone (${String(e)}). Starting with an empty stub you can edit.`;
          world = createFallbackZone(template.name, template.roomCount);
        }

        // ─── Phase 3: Generate representative art in parallel ───
        setActivePhase("art");
        const provider = imageStyle === "flux" ? "runware" : "openai";
        const modelId = imageStyle === "flux" ? "runware:400@2" : "openai:4@1";
        const resolvedModel = resolveImageModel(provider, modelId);

        const pickedRoomId = pickRandom(Object.keys(world.rooms));
        const pickedMobId = pickRandom(Object.keys(world.mobs ?? {}));
        const pickedItemId = pickRandom(Object.keys(world.items ?? {}));

        interface DefaultJob {
          kind: "room" | "mob" | "item";
          prompt: string;
          assetType: "background" | "mob" | "item";
          width: number;
          height: number;
        }
        const jobs: DefaultJob[] = [];
        if (pickedRoomId && world.rooms[pickedRoomId]) {
          jobs.push({
            kind: "room",
            prompt: roomPrompt(pickedRoomId, world.rooms[pickedRoomId], "gentle_magic"),
            assetType: "background",
            width: 1920,
            height: 1080,
          });
        }
        if (pickedMobId && world.mobs?.[pickedMobId]) {
          jobs.push({
            kind: "mob",
            prompt: mobPrompt(pickedMobId, world.mobs[pickedMobId], "gentle_magic"),
            assetType: "mob",
            width: 512,
            height: 512,
          });
        }
        if (pickedItemId && world.items?.[pickedItemId]) {
          jobs.push({
            kind: "item",
            prompt: itemPrompt(pickedItemId, world.items[pickedItemId], "gentle_magic"),
            assetType: "item",
            width: 256,
            height: 256,
          });
        }

        const results = resolvedModel
          ? await Promise.allSettled(
              jobs.map(async (job) => {
                const image = await invoke<GeneratedImage>(imageGenerateCommand(provider), {
                  prompt: job.prompt,
                  negativePrompt: getNegativePrompt(job.assetType),
                  model: resolvedModel.id,
                  width: job.width,
                  height: job.height,
                  steps: resolvedModel.defaultSteps ?? 4,
                  guidance:
                    "defaultGuidance" in resolvedModel ? resolvedModel.defaultGuidance : null,
                  assetType: job.assetType,
                  autoEnhance: false,
                  transparentBackground:
                    provider === "openai" && requestsTransparentBackground(job.assetType),
                });
                const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
                await acceptAsset(
                  image,
                  job.assetType,
                  job.prompt,
                  { zone: zoneId, entity_type: "default", entity_id: job.kind },
                  `default:${zoneId}:${job.kind}`,
                  true,
                );
                return { kind: job.kind, fileName };
              }),
            )
          : [];

        const imageMap: { room?: string; mob?: string; item?: string } = {};
        let failedCount = 0;
        for (const r of results) {
          if (r.status === "fulfilled") {
            imageMap[r.value.kind] = r.value.fileName;
          } else {
            failedCount++;
          }
        }
        if (failedCount > 0 && !localWarning) {
          localWarning = `${failedCount} of ${results.length} starter images didn't render. You can retry from the Zone Direction panel.`;
        }
        if (localWarning) setWarning(localWarning);

        world = {
          ...world,
          image: {
            ...(world.image ?? {}),
            ...imageMap,
          },
        };

        // ─── Phase 4: Write zone to disk + open workspace ───────
        setActivePhase("opening");
        const project2 = useProjectStore.getState().project;
        if (!project2) throw new Error("Project state was lost during onboarding.");

        await invoke("create_zone_directory", {
          projectDir: project2.mudDir,
          zoneId,
        });
        const filePath = zoneFilePath(project2, zoneId);
        const yaml = stringify(world, YAML_OPTS);
        await writeTextFile(filePath, yaml);
        useZoneStore.getState().loadZone(zoneId, filePath, world);

        if (template.vibeText) {
          await useVibeStore.getState().saveVibe(zoneId, template.vibeText).catch(() => {});
        }

        await loadAssets();
        addRecentProject(project2.mudDir, projectName);
        saveArtSubTab("direction");
        useProjectStore.getState().openTab({
          id: "panel:art",
          kind: "panel",
          panelId: "art",
          label: "Art",
        });

        setActivePhase("done");
        setFinishedMessage(`"${template.name}" is ready to shape.`);
        setTimeout(() => {
          onFinished();
        }, 600);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    void run();
  }, [settings, template, imageStyle, acceptAsset, loadAssets, openDir, onFinished]);

  const activeIndex = PHASES.findIndex((p) => p.id === activePhase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-7 text-text-secondary">
          Hold tight while the hub forges "{template.name}". This takes about a minute — zone layout
          first, then three representative pieces of art.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {PHASES.map((phase, i) => {
          const isDone = activeIndex > i || activePhase === "done";
          const isActive = activePhase === phase.id;
          return (
            <li
              key={phase.id}
              className="flex items-center gap-4 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--chrome-stroke-strong)] bg-bg-secondary">
                {isDone ? (
                  <span className="text-xs text-status-success">✓</span>
                ) : isActive ? (
                  <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                ) : (
                  <span className="text-2xs text-text-muted">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm ${
                    isActive ? "text-text-primary" : isDone ? "text-text-secondary" : "text-text-muted"
                  }`}
                >
                  {phase.label}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {warning && (
        <div className="rounded-2xl border border-status-warning/40 bg-status-warning/5 px-5 py-3 text-xs leading-6 text-text-secondary">
          {warning}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-status-error/40 bg-status-error/5 px-5 py-3">
          <div className="text-2xs uppercase tracking-ui text-status-error">Something went wrong</div>
          <p className="mt-1 text-xs leading-6 text-text-secondary">{error}</p>
        </div>
      )}

      {finishedMessage && (
        <div className="rounded-2xl border border-status-success/40 bg-status-success/5 px-5 py-3 text-xs leading-6 text-text-secondary">
          {finishedMessage}
        </div>
      )}
    </div>
  );
}
