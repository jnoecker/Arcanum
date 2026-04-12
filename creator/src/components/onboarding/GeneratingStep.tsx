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
import { applyTemplate } from "@/lib/templates";
import { saveProjectConfig } from "@/lib/saveConfig";
import { zoneFilePath } from "@/lib/projectPaths";
import { addRecentProject } from "@/lib/uiPersistence";
import { YAML_OPTS } from "@/lib/yamlOpts";
import { BASE_ACADEMY_ZONE } from "@/lib/baseTemplate/baseZone";
import {
  BASE_STATS,
  BASE_CLASSES,
  BASE_ABILITIES,
  BASE_STATUS_EFFECTS,
  BASE_RACES,
  BASE_PETS,
} from "@/lib/baseTemplate/baseConfig";
import type { ReSkinProgress, ReSkinResults } from "@/lib/baseTemplate/reSkinPipeline";

type Phase = "creating" | "applying" | "ready";

interface PhaseInfo {
  id: Phase;
  label: string;
}

const PHASES: PhaseInfo[] = [
  { id: "creating", label: "Creating your world" },
  { id: "applying", label: "Applying your theme" },
  { id: "ready", label: "Ready!" },
];

interface ReSkinItemInfo {
  key: keyof ReSkinProgress;
  label: string;
}

const RESKIN_ITEMS: ReSkinItemInfo[] = [
  { key: "classesAndAbilities", label: "Classes & Abilities" },
  { key: "races", label: "Races" },
  { key: "rooms", label: "Rooms" },
  { key: "entities", label: "Entities" },
  { key: "artStyle", label: "Art Style" },
];

interface GeneratingStepProps {
  reSkinPromise: Promise<ReSkinResults>;
  reSkinProgress: ReSkinProgress;
  onFinished: () => void;
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "academy";
}

export function GeneratingStep({ reSkinPromise, reSkinProgress, onFinished }: GeneratingStepProps) {
  const { openDir } = useOpenProject();
  const settings = useAssetStore((s) => s.settings);
  const [activePhase, setActivePhase] = useState<Phase>("creating");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (!settings) return;
    hasStartedRef.current = true;

    const run = async () => {
      let localWarning: string | null = null;
      try {
        // ─── Phase 1: Create project + wait for re-skin (parallel) ──
        setActivePhase("creating");
        const home = await homeDir();
        const parentDir = joinPath(home, "Arcanum Worlds");

        // Race a 45-second timeout against the re-skin promise so we
        // never hang indefinitely — fall back to the base template.
        // DeepSeek generates at ~25 tok/s; the largest call can take
        // 4+ minutes. Give the full pipeline 6 minutes before falling back.
        const reSkinWithTimeout = Promise.race([
          reSkinPromise,
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 360_000);
          }),
        ]).catch((e) => {
          localWarning = `Theme re-skin encountered an issue (${String(e)}). Starting with the default academy template.`;
          return null as ReSkinResults | null;
        });

        // Create the project directory immediately while re-skin runs.
        // Use a temporary slug; we'll rename/re-slugify once we know the
        // themed academy name.
        const defaultSlug = "academy";
        const projectPromise = createProjectWithRetry(parentDir, defaultSlug);

        // Wait for both to finish.
        const [reSkinResults, projectResult] = await Promise.all([
          reSkinWithTimeout,
          projectPromise,
        ]);

        if (reSkinResults === null && !localWarning) {
          localWarning = "Theme re-skin timed out. Starting with the default academy template.";
        }

        const zoneData = reSkinResults?.zone ?? BASE_ACADEMY_ZONE;
        const resolvedAcademyName = reSkinResults?.academyName ?? "The Academy";
        setAcademyName(resolvedAcademyName);

        const { mudDir, projectName } = projectResult;

        const openResult = await openDir(mudDir, "standalone");
        if (!openResult.success) {
          throw new Error(openResult.errors?.join(", ") ?? "Failed to open project");
        }

        // ─── Phase 2: Apply re-skinned content ──────────────────
        setActivePhase("applying");

        const baseConfig = useConfigStore.getState().config;
        const project = useProjectStore.getState().project;
        if (!baseConfig || !project) {
          throw new Error("Project state was lost during onboarding.");
        }

        const configOverrides: Record<string, unknown> = {
          stats: { definitions: BASE_STATS },
          classes: reSkinResults?.classes ?? BASE_CLASSES,
          abilities: reSkinResults?.abilities ?? BASE_ABILITIES,
          statusEffects: reSkinResults?.statusEffects ?? BASE_STATUS_EFFECTS,
          races: reSkinResults?.races ?? BASE_RACES,
          pets: reSkinResults?.pets ?? BASE_PETS,
          equipmentSlots: {
            head: { displayName: "Head", order: 1 },
            chest: { displayName: "Chest", order: 2 },
            legs: { displayName: "Legs", order: 3 },
            feet: { displayName: "Feet", order: 4 },
            hands: { displayName: "Hands", order: 5 },
            main_hand: { displayName: "Main Hand", order: 6 },
            off_hand: { displayName: "Off Hand", order: 7 },
            ring: { displayName: "Ring", order: 8 },
            neck: { displayName: "Neck", order: 9 },
          },
        };

        const merged = applyTemplate(baseConfig, configOverrides);
        useConfigStore.getState().updateConfig(merged);
        await saveProjectConfig(project);

        const zoneId = slugify(resolvedAcademyName);
        const zoneToWrite = { ...zoneData, zone: zoneId };
        await invoke("create_zone_directory", {
          projectDir: project.mudDir,
          zoneId,
        });
        const filePath = zoneFilePath(project, zoneId);
        const yaml = stringify(zoneToWrite, YAML_OPTS);
        await writeTextFile(filePath, yaml);
        useZoneStore.getState().loadZone(zoneId, filePath, zoneToWrite);

        if (reSkinResults?.artStyle) {
          try {
            const projectDir = project.mudDir;
            const projectSettings = useAssetStore.getState().projectSettings;
            if (projectSettings && projectDir) {
              await useAssetStore.getState().saveProjectSettings(projectDir, {
                ...projectSettings,
              });
            }
          } catch {
            // Non-critical — art style can be set later
          }
        }

        addRecentProject(project.mudDir, projectName);
        useProjectStore.getState().openTab({
          id: `zone:${zoneId}`,
          kind: "zone",
          label: zoneId,
        });

        if (localWarning) setWarning(localWarning);
        setActivePhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    void run();
  }, [settings, reSkinPromise, openDir, onFinished]);

  const activeIndex = PHASES.findIndex((p) => p.id === activePhase);

  if (activePhase === "ready" && !error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-status-success/40 bg-status-success/10">
            <span className="text-2xl text-status-success">&#10003;</span>
          </div>
          <div className="text-center">
            <h3 className="font-display text-2xl text-text-primary">
              {academyName ? `"${academyName}" is ready` : "Your world is ready"}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Your academy is set up and waiting to be explored.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
          <div className="mb-3 text-2xs uppercase tracking-ui text-text-muted">
            What you can do next
          </div>
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 shrink-0 text-accent">&#9670;</span>
              <span>Explore the academy to learn the MUD features</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 shrink-0 text-accent">&#9670;</span>
              <span>Open the Art panel to generate visuals for your world</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 shrink-0 text-accent">&#9670;</span>
              <span>Customize classes, races, and abilities in the Config panel</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 shrink-0 text-accent">&#9670;</span>
              <span>Build new zones with the Zone Builder</span>
            </li>
          </ul>
        </div>

        {warning && (
          <div className="rounded-2xl border border-status-warning/40 bg-status-warning/5 px-5 py-3 text-xs leading-6 text-text-secondary">
            {warning}
          </div>
        )}

        <button
          onClick={onFinished}
          className="w-full rounded-2xl border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--surface-rgb)/0.18))] px-6 py-4 font-display text-lg text-text-primary transition hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)]"
        >
          Enter Your World
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-7 text-text-secondary">
          Applying your chosen theme to the academy template. This usually takes just a few seconds.
        </p>
      </div>

      {/* Phase progress */}
      <ol className="flex flex-col gap-3">
        {PHASES.map((phase, i) => {
          const isDone = activeIndex > i;
          const isActive = activePhase === phase.id;
          return (
            <li
              key={phase.id}
              className="flex items-center gap-4 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--chrome-stroke-strong)] bg-bg-secondary">
                {isDone ? (
                  <span className="text-xs text-status-success">&#10003;</span>
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

      {/* Re-skin progress detail */}
      <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4">
        <div className="mb-3 text-2xs uppercase tracking-ui text-text-muted">
          Theme re-skin progress
        </div>
        <div className="flex flex-col gap-2">
          {RESKIN_ITEMS.map((item) => {
            const status = reSkinProgress[item.key];
            return (
              <div key={item.key} className="flex items-center gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {status === "done" ? (
                    <span className="text-xs text-status-success">&#10003;</span>
                  ) : status === "failed" ? (
                    <span className="text-xs text-status-error">&#10007;</span>
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    status === "done"
                      ? "text-text-secondary"
                      : status === "failed"
                        ? "text-status-error"
                        : "text-text-primary"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );
}
