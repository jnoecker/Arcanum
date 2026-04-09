import { useEffect, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import {
  deployRuntimeAchievements,
  deployRuntimeConfig,
  deployRuntimeZones,
  exportRuntimeBundle,
  openValidationResults,
  publishCuratedAssets,
  publishGlobalAssets,
  publishPlayerSprites,
  runWorkspaceValidation,
  saveWorkspace,
} from "@/lib/runtimeHandoff";
import type { ExportResult, SyncProgress, SyncScope } from "@/types/assets";

type StepStatus = "idle" | "running" | "success" | "warning" | "error";
type StepKey =
  | "save"
  | "gitCommit"
  | "validate"
  | "export"
  | "assets"
  | "globals"
  | "sprites"
  | "config"
  | "achievements"
  | "zones";

interface StepState {
  status: StepStatus;
  detail: string;
  errors: string[];
}

const EXPORT_DIR_KEY = "arcanum-runtime-export-dir";

const STATUS_STYLES: Record<StepStatus, string> = {
  idle: "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary",
  running: "border-border-active bg-status-info/15 text-text-primary",
  success: "border-status-success/30 bg-status-success/10 text-status-success",
  warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  error: "border-status-error/30 bg-status-error/10 text-status-error",
};

function formatSyncResult(result: SyncProgress, noun: string): string {
  const parts = [`${result.uploaded} ${noun} uploaded`];
  if (result.skipped > 0) parts.push(`${result.skipped} already synced`);
  if (result.failed > 0) parts.push(`${result.failed} failed`);
  return parts.join(" | ");
}

function StepCard({
  title,
  description,
  state,
  actionLabel,
  disabled,
  onAction,
  children,
}: {
  title: string;
  description: string;
  state: StepState;
  actionLabel: string;
  disabled?: boolean;
  onAction: () => Promise<unknown> | void;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-text-primary">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-2xs uppercase tracking-ui ${STATUS_STYLES[state.status]}`}>
          {state.status}
        </span>
      </div>

      {children && <div className="mt-3">{children}</div>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void onAction()}
          disabled={disabled || state.status === "running"}
          className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.status === "running" ? "Working..." : actionLabel}
        </button>
        <p className="text-xs text-text-secondary">{state.detail}</p>
      </div>

      {state.errors.length > 0 && (
        <div className="mt-3 rounded-2xl border border-status-error/20 bg-[var(--chrome-fill)] p-3 text-2xs text-status-error">
          {state.errors.slice(0, 5).map((error, index) => (
            <div key={index}>{error}</div>
          ))}
          {state.errors.length > 5 && <div>...and {state.errors.length - 5} more</div>}
        </div>
      )}
    </section>
  );
}

export function RuntimeHandoffStudio() {
  const project = useProjectStore((s) => s.project);
  const config = useConfigStore((s) => s.config);
  const configDirty = useConfigStore((s) => s.dirty);
  const zones = useZoneStore((s) => s.zones);
  const assets = useAssetStore((s) => s.assets);
  const settings = useAssetStore((s) => s.settings);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const [syncScope, setSyncScope] = useState<SyncScope>("approved");
  const [exportDir, setExportDir] = useState(() => {
    try {
      return window.localStorage.getItem(EXPORT_DIR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [runningAll, setRunningAll] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [deployCommitMsg, setDeployCommitMsg] = useState(() =>
    `Deploy: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  );
  const [exportingLocal, setExportingLocal] = useState(false);
  const [localExportResult, setLocalExportResult] = useState<ExportResult | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    save: { status: "idle", detail: "Save config and unsaved zones to the project folder.", errors: [] },
    gitCommit: { status: "idle", detail: "Commit and push project changes to git.", errors: [] },
    validate: { status: "idle", detail: "Run config and zone validation before publishing.", errors: [] },
    export: { status: "idle", detail: "Export a server bundle to a local MUD directory.", errors: [] },
    assets: { status: "idle", detail: "Upload approved gallery assets to R2.", errors: [] },
    globals: { status: "idle", detail: "Upload global asset files to R2.", errors: [] },
    sprites: { status: "idle", detail: "Upload player sprite files to R2.", errors: [] },
    config: { status: "idle", detail: "Upload runtime config to R2.", errors: [] },
    achievements: { status: "idle", detail: "Upload achievements.yaml to R2.", errors: [] },
    zones: { status: "idle", detail: "Upload zone YAML files to R2.", errors: [] },
  });

  useEffect(() => {
    void loadSettings();
    void loadAssets();
  }, [loadAssets, loadSettings]);

  useEffect(() => {
    try {
      if (exportDir) {
        window.localStorage.setItem(EXPORT_DIR_KEY, exportDir);
      }
    } catch {
      // ignore
    }
  }, [exportDir]);

  const dirtyZones = useMemo(
    () => Array.from(zones.values()).filter((zone) => zone.dirty).length,
    [zones],
  );
  const curatedAssetCount = useMemo(
    () => assets.filter((asset) => asset.is_active).length,
    [assets],
  );
  const unsyncedCuratedAssetCount = useMemo(
    () => assets.filter((asset) => asset.is_active && asset.sync_status !== "synced").length,
    [assets],
  );
  const globalAssetCount = Object.keys(config?.globalAssets ?? {}).length;
  const hasR2 = !!(settings?.r2_account_id && settings?.r2_bucket && settings?.r2_access_key_id);
  const isStandalone = project?.format === "standalone";
  const hasPat = !!settings?.github_pat;

  const setStepState = (key: StepKey, next: Partial<StepState>) => {
    setSteps((current) => ({
      ...current,
      [key]: { ...current[key], ...next },
    }));
  };

  const runSaveStep = async () => {
    if (!project) return;
    setStepState("save", {
      status: "running",
      detail: "Saving config and dirty zones to the world folder...",
      errors: [],
    });
    try {
      const result = await saveWorkspace(project);
      const details: string[] = [];
      details.push(result.configSaved || result.resourcesUpdated ? "config saved" : "config already current");
      details.push(`${result.savedZones.length} zone${result.savedZones.length !== 1 ? "s" : ""} saved`);
      setStepState("save", {
        status: "success",
        detail: details.join(" | "),
        errors: [],
      });
    } catch (error) {
      setStepState("save", {
        status: "error",
        detail: "Save failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runGitCommitStep = async () => {
    if (!project || !isStandalone) return;
    setStepState("gitCommit", { status: "running", detail: "Committing changes...", errors: [] });
    try {
      // Check if it's a repo
      const status = await invoke<{ is_repo: boolean; has_remote: boolean }>("git_repo_status", { path: project.mudDir });
      if (!status.is_repo) {
        setStepState("gitCommit", { status: "warning", detail: "Not a git repository. Skipped.", errors: [] });
        return;
      }
      const msg = deployCommitMsg.trim() || `Deploy: ${new Date().toISOString().slice(0, 16)}`;
      const result = await invoke<string>("git_commit", { path: project.mudDir, message: msg });
      // Push if remote + PAT configured
      if (status.has_remote && hasPat) {
        const pushResult = await invoke<string>("git_push", { path: project.mudDir });
        setStepState("gitCommit", { status: "success", detail: `${result} | ${pushResult}`, errors: [] });
      } else {
        const note = status.has_remote ? " (push skipped — no PAT)" : " (no remote configured)";
        setStepState("gitCommit", { status: "success", detail: result + note, errors: [] });
      }
    } catch (error) {
      setStepState("gitCommit", { status: "warning", detail: String(error), errors: [] });
    }
  };

  const runValidateStep = async (openPanel = false) => {
    setStepState("validate", {
      status: "running",
      detail: "Validating config and every loaded zone...",
      errors: [],
    });
    try {
      const summary = runWorkspaceValidation();
      if (openPanel || summary.errorCount > 0 || summary.warningCount > 0) {
        openValidationResults();
      }

      const status: StepStatus =
        summary.errorCount > 0 ? "error" : summary.warningCount > 0 ? "warning" : "success";
      setStepState("validate", {
        status,
        detail:
          summary.errorCount > 0 || summary.warningCount > 0
            ? `${summary.errorCount} errors | ${summary.warningCount} warnings across ${summary.zonesWithIssues} section${summary.zonesWithIssues !== 1 ? "s" : ""}`
            : "No validation issues found.",
        errors: [],
      });
      return summary;
    } catch (error) {
      setStepState("validate", {
        status: "error",
        detail: "Validation failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runExportStep = async () => {
    if (!exportDir) {
      setStepState("export", {
        status: "warning",
        detail: "Choose a MUD checkout directory before exporting.",
        errors: [],
      });
      return;
    }

    setStepState("export", {
      status: "running",
      detail: "Exporting application.yaml and world files...",
      errors: [],
    });
    try {
      const result = await exportRuntimeBundle(exportDir);
      setStepState("export", {
        status: result.errors.length > 0 ? "warning" : "success",
        detail: `Exported config + ${result.zonesExported} zone${result.zonesExported !== 1 ? "s" : ""} to ${result.outputDir}`,
        errors: result.errors,
      });
    } catch (error) {
      setStepState("export", {
        status: "error",
        detail: "Runtime export failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runAssetsStep = async () => {
    setStepState("assets", {
      status: "running",
      detail: `Syncing ${syncScope === "approved" ? "approved" : "all"} curated assets to R2...`,
      errors: [],
    });
    try {
      const result = await publishCuratedAssets(syncScope);
      setStepState("assets", {
        status: result.failed > 0 ? "warning" : "success",
        detail: formatSyncResult(result, "assets"),
        errors: result.errors,
      });
    } catch (error) {
      setStepState("assets", {
        status: "error",
        detail: "Asset publish failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runGlobalsStep = async () => {
    setStepState("globals", {
      status: "running",
      detail: "Publishing global asset keys to R2...",
      errors: [],
    });
    try {
      const result = await publishGlobalAssets();
      setStepState("globals", {
        status: result.failed > 0 ? "warning" : "success",
        detail: formatSyncResult(result, "globals"),
        errors: result.errors,
      });
    } catch (error) {
      setStepState("globals", {
        status: "error",
        detail: "Global asset publish failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runSpritesStep = async () => {
    setStepState("sprites", {
      status: "running",
      detail: "Publishing player sprites to R2...",
      errors: [],
    });
    try {
      const result = await publishPlayerSprites();
      setStepState("sprites", {
        status: result.failed > 0 ? "warning" : "success",
        detail: formatSyncResult(result, "sprites"),
        errors: result.errors,
      });
    } catch (error) {
      setStepState("sprites", {
        status: "error",
        detail: "Sprite publish failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runConfigStep = async () => {
    if (!project) return;
    setStepState("config", {
      status: "running",
      detail: "Uploading runtime config to R2...",
      errors: [],
    });
    try {
      const url = await deployRuntimeConfig(project);
      setStepState("config", {
        status: "success",
        detail: `Runtime config deployed to ${url}`,
        errors: [],
      });
    } catch (error) {
      setStepState("config", {
        status: "error",
        detail: "Runtime config deploy failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runAchievementsStep = async () => {
    setStepState("achievements", {
      status: "running",
      detail: "Uploading achievements.yaml to R2...",
      errors: [],
    });
    try {
      const url = await deployRuntimeAchievements();
      setStepState("achievements", {
        status: "success",
        detail: `Achievements deployed to ${url}`,
        errors: [],
      });
    } catch (error) {
      setStepState("achievements", {
        status: "error",
        detail: "Achievements deploy failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const runZonesStep = async () => {
    if (!project) return;
    setStepState("zones", {
      status: "running",
      detail: "Uploading zone YAML files to R2...",
      errors: [],
    });
    try {
      const result = await deployRuntimeZones(project);
      setStepState("zones", {
        status: result.failed > 0 ? "warning" : "success",
        detail: formatSyncResult(result, "zones"),
        errors: result.errors,
      });
    } catch (error) {
      setStepState("zones", {
        status: "error",
        detail: "Zone deploy failed.",
        errors: [String(error)],
      });
      throw error;
    }
  };

  const handleChooseExportDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setExportDir(selected as string);
    }
  };

  const handleExportLocal = async () => {
    const dir = await open({ directory: true, title: "Choose images export directory" });
    if (!dir) return;
    setExportingLocal(true);
    setLocalExportResult(null);
    try {
      const result = await invoke<ExportResult>("export_assets_to_dir", { targetDir: dir });
      setLocalExportResult(result);
    } catch (e) {
      setLocalExportResult({ total: 0, copied: 0, skipped: 0, errors: [String(e)] });
    } finally {
      setExportingLocal(false);
    }
  };

  const handleRunAll = async () => {
    if (!project) return;

    setRunningAll(true);
    setWorkflowMessage(null);
    try {
      await runSaveStep();
      if (isStandalone) {
        await runGitCommitStep();
      }
      const summary = await runValidateStep(true);
      if (summary.errorCount > 0) {
        setWorkflowMessage("Stopped after validation errors. Fix them, then try again.");
        return;
      }

      if (hasR2) {
        await runAssetsStep();
        await runGlobalsStep();
        await runSpritesStep();
        await runConfigStep();
        await runAchievementsStep();
        await runZonesStep();
      } else {
        setWorkflowMessage("R2 credentials are incomplete, so the workflow stopped after local save and validation.");
      }
    } catch (error) {
      setWorkflowMessage(`Workflow stopped: ${String(error)}`);
    } finally {
      setRunningAll(false);
    }
  };

  if (!project || !config) {
    return (
      <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5 text-sm text-text-secondary">
        Open a world project before using the deployment pipeline.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-4 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Handoff</p>
            <h3 className="mt-2 font-display text-2xl text-text-primary">Publish to live server</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Save, validate, export, publish, and deploy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleRunAll()}
              disabled={runningAll}
              className="rounded-full border border-[var(--border-accent-subtle)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.26),rgb(var(--surface-rgb)/0.18))] px-4 py-2 text-xs font-medium text-text-primary transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {runningAll ? "Publishing..." : "Publish all"}
            </button>
            <button
              onClick={openValidationResults}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
            >
              Open validation
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
            <p className="text-2xs uppercase tracking-ui text-text-muted">Project</p>
            <p className="mt-2 text-sm text-text-primary">{project.mudDir}</p>
            <p className="mt-2 text-xs text-text-secondary">
              {zones.size} loaded zone{zones.size !== 1 ? "s" : ""} | {dirtyZones} dirty
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
            <p className="text-2xs uppercase tracking-ui text-text-muted">R2 delivery</p>
            <p className="mt-2 text-sm text-text-primary">{settings?.r2_bucket || "No bucket configured"}</p>
            <p className="mt-2 text-xs text-text-secondary">
              {settings?.r2_custom_domain || "No custom domain"} | {hasR2 ? "ready" : "credentials incomplete"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
            <p className="text-2xs uppercase tracking-ui text-text-muted">Curated assets</p>
            <p className="mt-2 text-sm text-text-primary">{curatedAssetCount} active assets</p>
            <p className="mt-2 text-xs text-text-secondary">{unsyncedCuratedAssetCount} not yet synced to R2</p>
          </div>
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
            <p className="text-2xs uppercase tracking-ui text-text-muted">Config state</p>
            <p className="mt-2 text-sm text-text-primary">{configDirty ? "Config has unsaved edits" : "Config is clean"}</p>
            <p className="mt-2 text-xs text-text-secondary">{globalAssetCount} registered global asset keys</p>
          </div>
        </div>

        {workflowMessage && (
          <div className="mt-3 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3 text-sm text-text-secondary">
            {workflowMessage}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <StepCard
          title="1. Save project"
          description="Save all config and zone data to the project folder."
          state={steps.save}
          actionLabel="Save world"
          onAction={runSaveStep}
        />

        {isStandalone && (
          <StepCard
            title="1b. Commit &amp; push"
            description="Commit project changes to git and push to remote."
            state={steps.gitCommit}
            actionLabel="Commit &amp; push"
            onAction={runGitCommitStep}
          >
            <input
              type="text"
              value={deployCommitMsg}
              onChange={(e) => setDeployCommitMsg(e.target.value)}
              placeholder="Commit message"
              className="w-full rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </StepCard>
        )}

        <StepCard
          title="2. Validate runtime data"
          description="Run config and zone validation before anything gets exported or published."
          state={steps.validate}
          actionLabel="Validate now"
          onAction={() => runValidateStep(true)}
        />

        <StepCard
          title="3. Export runtime bundle"
          description="Export a complete server bundle to a local MUD directory."
          state={steps.export}
          actionLabel="Export runtime bundle"
          onAction={runExportStep}
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={exportDir}
              onChange={(event) => setExportDir(event.target.value)}
              placeholder="Choose a MUD checkout directory"
              className="min-w-[18rem] flex-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <button
              onClick={() => void handleChooseExportDir()}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
            >
              Choose folder
            </button>
          </div>
        </StepCard>

        <StepCard
          title="4. Publish curated assets"
          description="Upload approved art and media to R2."
          state={steps.assets}
          actionLabel="Sync curated assets"
          disabled={!hasR2}
          onAction={runAssetsStep}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <span>Scope</span>
              <select
                value={syncScope}
                onChange={(event) => setSyncScope(event.target.value as SyncScope)}
                className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1.5 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
              >
                <option value="approved">Approved only</option>
                <option value="all">Everything</option>
              </select>
            </div>
            <button
              onClick={() => void handleExportLocal()}
              disabled={exportingLocal}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-40"
            >
              {exportingLocal ? "Exporting..." : "Export images locally"}
            </button>
          </div>
          {localExportResult && (
            <div className="mt-2 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3 text-xs text-text-secondary">
              Exported {localExportResult.copied} images ({localExportResult.skipped} already present, {localExportResult.errors.length} errors)
              {localExportResult.errors.length > 0 && (
                <ul className="mt-1 text-status-error">
                  {localExportResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </StepCard>

        <StepCard
          title="5. Publish explicit global assets"
          description="Upload global asset files to R2."
          state={steps.globals}
          actionLabel="Publish globals"
          disabled={!hasR2}
          onAction={runGlobalsStep}
        />

        <StepCard
          title="6. Publish player sprites"
          description="Deploy the player sprite atlas files."
          state={steps.sprites}
          actionLabel="Publish sprites"
          disabled={!hasR2}
          onAction={runSpritesStep}
        />

        <StepCard
          title="7. Deploy runtime config"
          description="Upload the assembled runtime config the MUD server pulls from R2."
          state={steps.config}
          actionLabel="Deploy config"
          disabled={!hasR2}
          onAction={runConfigStep}
        />

        <StepCard
          title="8. Deploy achievements"
          description="Upload achievements.yaml to R2."
          state={steps.achievements}
          actionLabel="Deploy achievements"
          disabled={!hasR2}
          onAction={runAchievementsStep}
        />

        <StepCard
          title="9. Deploy zone YAML"
          description="Upload zone files to R2."
          state={steps.zones}
          actionLabel="Deploy zones"
          disabled={!hasR2}
          onAction={runZonesStep}
        />
      </div>
    </div>
  );
}
