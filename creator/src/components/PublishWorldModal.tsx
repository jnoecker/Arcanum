import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useToastStore } from "@/stores/toastStore";
import {
  deployRuntimeAchievements,
  deployRuntimeConfig,
  deployRuntimeZones,
  openValidationResults,
  publishCuratedAssets,
  publishGlobalAssets,
  publishPlayerSprites,
  runWorkspaceValidation,
  saveWorkspace,
} from "@/lib/runtimeHandoff";
import type { SyncProgress } from "@/types/assets";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";

const DiffModal = lazy(() => import("./ui/DiffModal").then((m) => ({ default: m.DiffModal })));

type StepStatus = "idle" | "running" | "success" | "warning" | "error" | "skipped";

type StepKey =
  | "save"
  | "diff"
  | "validate"
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

const STEP_ORDER: { key: StepKey; title: string; idleDetail: string }[] = [
  { key: "save", title: "Save workspace", idleDetail: "Save config and unsaved zones to disk." },
  { key: "diff", title: "Review diff", idleDetail: "Inspect pending changes before uploading." },
  { key: "validate", title: "Validate", idleDetail: "Run config and zone validation." },
  { key: "assets", title: "Publish assets", idleDetail: "Upload approved gallery assets to R2." },
  { key: "globals", title: "Publish globals", idleDetail: "Upload global asset keys to R2." },
  { key: "sprites", title: "Publish sprites", idleDetail: "Upload player sprites to R2." },
  { key: "config", title: "Deploy config", idleDetail: "Upload runtime config to R2." },
  { key: "achievements", title: "Deploy achievements", idleDetail: "Upload achievements.yaml to R2." },
  { key: "zones", title: "Deploy zones", idleDetail: "Upload zone YAML files to R2." },
];

const STATUS_STYLES: Record<StepStatus, string> = {
  idle: "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted",
  running: "border-border-active bg-status-info/15 text-text-primary",
  success: "border-status-success/30 bg-status-success/10 text-status-success",
  warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  error: "border-status-error/30 bg-status-error/10 text-status-error",
  skipped: "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted/70",
};

const STATUS_LABELS: Record<StepStatus, string> = {
  idle: "pending",
  running: "running",
  success: "done",
  warning: "warning",
  error: "failed",
  skipped: "skipped",
};

function formatSyncResult(result: SyncProgress, noun: string): string {
  const parts = [`${result.uploaded} ${noun} uploaded`];
  if (result.skipped > 0) parts.push(`${result.skipped} already synced`);
  if (result.failed > 0) parts.push(`${result.failed} failed`);
  return parts.join(" | ");
}

function initialSteps(): Record<StepKey, StepState> {
  const out = {} as Record<StepKey, StepState>;
  for (const { key, idleDetail } of STEP_ORDER) {
    out[key] = { status: "idle", detail: idleDetail, errors: [] };
  }
  return out;
}

interface PublishWorldModalProps {
  onClose: () => void;
}

export function PublishWorldModal({ onClose }: PublishWorldModalProps) {
  const project = useProjectStore((s) => s.project);
  const config = useConfigStore((s) => s.config);
  const configDirty = useConfigStore((s) => s.dirty);
  const zones = useZoneStore((s) => s.zones);
  const settings = useAssetStore((s) => s.settings);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const showToast = useToastStore((s) => s.show);

  const [steps, setSteps] = useState<Record<StepKey, StepState>>(initialSteps);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffResolver, setDiffResolver] = useState<((ok: boolean) => void) | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const dirtyZoneCount = useMemo(
    () => [...zones.values()].filter((z) => z.dirty).length,
    [zones],
  );
  const hasPending = dirtyZoneCount > 0 || configDirty;
  const hasR2 = !!(settings?.r2_account_id && settings?.r2_bucket && settings?.r2_access_key_id);
  const canPublish = !!project && !!config && hasR2 && !running && !finished;

  useEffect(() => {
    void loadSettings();
    void loadAssets();
  }, [loadAssets, loadSettings]);

  const setStep = (key: StepKey, next: Partial<StepState>) => {
    setSteps((current) => ({
      ...current,
      [key]: { ...current[key], ...next },
    }));
  };

  const awaitDiffReview = (): Promise<boolean> => {
    if (!hasPending) {
      return Promise.resolve(true);
    }
    setShowDiff(true);
    return new Promise<boolean>((resolve) => {
      setDiffResolver(() => resolve);
    });
  };

  const handleDiffConfirm = () => {
    setShowDiff(false);
    diffResolver?.(true);
    setDiffResolver(null);
  };

  const handleDiffCancel = () => {
    setShowDiff(false);
    diffResolver?.(false);
    setDiffResolver(null);
  };

  const runAll = async () => {
    if (!project || !config) return;

    setRunning(true);
    setFinished(false);
    setWorkflowMessage(null);
    setSteps(initialSteps());

    try {
      // ── 1. Save ────────────────────────────────────────────────────
      setStep("save", { status: "running", detail: "Saving config and dirty zones..." });
      try {
        const result = await saveWorkspace(project);
        const details: string[] = [];
        details.push(result.configSaved || result.resourcesUpdated ? "config saved" : "config already current");
        details.push(`${result.savedZones.length} zone${result.savedZones.length !== 1 ? "s" : ""} saved`);
        setStep("save", { status: "success", detail: details.join(" | "), errors: [] });
      } catch (error) {
        setStep("save", { status: "error", detail: "Save failed.", errors: [String(error)] });
        throw error;
      }

      // ── 2. Diff review ────────────────────────────────────────────
      if (hasPending) {
        setStep("diff", { status: "running", detail: "Waiting for diff review..." });
        const approved = await awaitDiffReview();
        if (!approved) {
          setStep("diff", { status: "warning", detail: "Diff review cancelled.", errors: [] });
          setWorkflowMessage("Publish cancelled during diff review.");
          return;
        }
        setStep("diff", { status: "success", detail: "Changes approved.", errors: [] });
      } else {
        setStep("diff", { status: "skipped", detail: "No pending changes to review.", errors: [] });
      }

      // ── 3. Validate ───────────────────────────────────────────────
      setStep("validate", { status: "running", detail: "Validating workspace..." });
      try {
        const summary = runWorkspaceValidation();
        if (summary.errorCount > 0) {
          openValidationResults();
          setStep("validate", {
            status: "error",
            detail: `${summary.errorCount} errors | ${summary.warningCount} warnings`,
            errors: [],
          });
          setWorkflowMessage("Stopped after validation errors. Fix them, then try again.");
          return;
        }
        setStep("validate", {
          status: summary.warningCount > 0 ? "warning" : "success",
          detail:
            summary.warningCount > 0
              ? `No errors | ${summary.warningCount} warnings`
              : "No validation issues found.",
          errors: [],
        });
      } catch (error) {
        setStep("validate", { status: "error", detail: "Validation failed.", errors: [String(error)] });
        throw error;
      }

      // ── 4. Assets ─────────────────────────────────────────────────
      setStep("assets", { status: "running", detail: "Syncing approved curated assets to R2..." });
      try {
        const result = await publishCuratedAssets("approved");
        setStep("assets", {
          status: result.failed > 0 ? "warning" : "success",
          detail: formatSyncResult(result, "assets"),
          errors: result.errors,
        });
      } catch (error) {
        setStep("assets", { status: "error", detail: "Asset publish failed.", errors: [String(error)] });
        throw error;
      }

      // ── 5. Globals ────────────────────────────────────────────────
      setStep("globals", { status: "running", detail: "Publishing global asset keys to R2..." });
      try {
        const result = await publishGlobalAssets();
        setStep("globals", {
          status: result.failed > 0 ? "warning" : "success",
          detail: formatSyncResult(result, "globals"),
          errors: result.errors,
        });
      } catch (error) {
        setStep("globals", { status: "error", detail: "Global asset publish failed.", errors: [String(error)] });
        throw error;
      }

      // ── 6. Sprites ────────────────────────────────────────────────
      setStep("sprites", { status: "running", detail: "Publishing player sprites to R2..." });
      try {
        const result = await publishPlayerSprites();
        setStep("sprites", {
          status: result.failed > 0 ? "warning" : "success",
          detail: formatSyncResult(result, "sprites"),
          errors: result.errors,
        });
      } catch (error) {
        setStep("sprites", { status: "error", detail: "Sprite publish failed.", errors: [String(error)] });
        throw error;
      }

      // ── 7. Config ─────────────────────────────────────────────────
      setStep("config", { status: "running", detail: "Uploading runtime config to R2..." });
      try {
        const url = await deployRuntimeConfig(project);
        setStep("config", { status: "success", detail: `Runtime config deployed to ${url}`, errors: [] });
      } catch (error) {
        setStep("config", { status: "error", detail: "Runtime config deploy failed.", errors: [String(error)] });
        throw error;
      }

      // ── 8. Achievements ───────────────────────────────────────────
      setStep("achievements", { status: "running", detail: "Uploading achievements.yaml to R2..." });
      try {
        const url = await deployRuntimeAchievements();
        setStep("achievements", { status: "success", detail: `Achievements deployed to ${url}`, errors: [] });
      } catch (error) {
        setStep("achievements", {
          status: "error",
          detail: "Achievements deploy failed.",
          errors: [String(error)],
        });
        throw error;
      }

      // ── 9. Zones ──────────────────────────────────────────────────
      setStep("zones", { status: "running", detail: "Uploading zone YAML files to R2..." });
      try {
        const result = await deployRuntimeZones(project);
        setStep("zones", {
          status: result.failed > 0 ? "warning" : "success",
          detail: formatSyncResult(result, "zones"),
          errors: result.errors,
        });
      } catch (error) {
        setStep("zones", { status: "error", detail: "Zone deploy failed.", errors: [String(error)] });
        throw error;
      }

      setFinished(true);
      setWorkflowMessage("World published.");
      showToast(
        {
          variant: "ember",
          kicker: "World published",
          message: "Assets, config, and zones are live on R2.",
          glyph: "\u2726",
        },
        3200,
      );
    } catch (error) {
      setWorkflowMessage(`Workflow stopped: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  };

  const preflightBlocker = useMemo(() => {
    if (!project) return "Open a world project before publishing.";
    if (!config) return "Config hasn't loaded yet.";
    if (!hasR2) return "R2 credentials are incomplete. Configure them in project settings before publishing.";
    return null;
  }, [project, config, hasR2]);

  return (
    <>
      <DialogShell
        dialogRef={trapRef}
        titleId="publish-world-dialog-title"
        title="Publish World"
        subtitle="Save, validate, review, and deploy assets, config, and zones to R2 in one pass."
        widthClassName="max-w-3xl"
        onClose={running ? undefined : onClose}
        status={
          hasPending ? (
            <span className="rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1 text-2xs text-status-warning">
              {dirtyZoneCount > 0 && `${dirtyZoneCount} unsaved zone${dirtyZoneCount !== 1 ? "s" : ""}`}
              {dirtyZoneCount > 0 && configDirty && " | "}
              {configDirty && "config modified"}
            </span>
          ) : null
        }
        footer={
          <>
            <ActionButton
              onClick={onClose}
              variant="ghost"
              disabled={running}
            >
              {finished ? "Close" : "Cancel"}
            </ActionButton>
            <ActionButton
              onClick={() => void runAll()}
              disabled={!canPublish}
              variant="primary"
            >
              {running ? (
                <span className="flex items-center gap-1.5">
                  <Spinner />
                  Publishing
                </span>
              ) : finished ? (
                "Published"
              ) : (
                "Publish everything"
              )}
            </ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {preflightBlocker && (
            <div
              role="alert"
              className="rounded-3xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning"
            >
              {preflightBlocker}
            </div>
          )}

          {workflowMessage && (
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3 text-sm text-text-secondary">
              {workflowMessage}
            </div>
          )}

          <ol className="flex flex-col gap-2">
            {STEP_ORDER.map(({ key, title }, index) => {
              const state = steps[key];
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] font-display text-2xs text-text-muted"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm text-text-primary">{title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-3xs uppercase tracking-wide-ui ${STATUS_STYLES[state.status]}`}
                      >
                        {STATUS_LABELS[state.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{state.detail}</p>
                    {state.errors.length > 0 && (
                      <div className="mt-2 rounded-xl border border-status-error/20 bg-status-error/10 p-2 text-2xs text-status-error">
                        {state.errors.slice(0, 3).map((e, i) => (
                          <div key={i}>{e}</div>
                        ))}
                        {state.errors.length > 3 && <div>...and {state.errors.length - 3} more</div>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </DialogShell>

      <Suspense>
        {showDiff && <DiffModal onConfirm={handleDiffConfirm} onCancel={handleDiffCancel} />}
      </Suspense>
    </>
  );
}
