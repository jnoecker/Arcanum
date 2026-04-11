import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useLoreStore, selectArticleCount } from "@/stores/loreStore";
import { useToastStore } from "@/stores/toastStore";
import { exportShowcaseData } from "@/lib/exportShowcase";
import type { HubPublishProgress, HubPublishResult } from "@/types/assets";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";

// ─── Props ───────────────────────────────────────────────────────────

interface PublishHubDialogProps {
  onClose: () => void;
}

// Slug validation mirrors the Rust side (hub.rs::is_valid_slug).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────────────

export function PublishHubDialog({ onClose }: PublishHubDialogProps) {
  const project = useProjectStore((s) => s.project);
  const settings = useAssetStore((s) => s.settings);
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const saveProjectSettings = useAssetStore((s) => s.saveProjectSettings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const articleCount = useLoreStore(selectArticleCount);
  const showToast = useToastStore((s) => s.show);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // Local form state — initialised from project settings, saved back on publish.
  const [slug, setSlug] = useState("");
  const [listed, setListed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<HubPublishProgress | null>(null);
  const [result, setResult] = useState<HubPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (projectSettings) {
      setSlug(projectSettings.hub_world_slug);
      setListed(projectSettings.hub_world_listed);
      setDisplayName(projectSettings.hub_world_display_name);
      setTagline(projectSettings.hub_world_tagline);
    }
  }, [projectSettings]);

  // Subscribe to progress events from the Rust backend.
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<HubPublishProgress>("hub-publish-progress", (e) => {
      setProgress(e.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const hubConfigured = !!(settings?.hub_api_url && settings?.hub_api_key);
  const slugValid = SLUG_RE.test(slug);
  const hasLore = articleCount > 0;
  const canPublish =
    !!project && hubConfigured && slugValid && hasLore && !running && !result;

  const percentage = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress]);

  const handlePublish = async () => {
    if (!project || !projectSettings) return;
    setError(null);
    setResult(null);
    setProgress(null);
    setRunning(true);
    try {
      // Persist the current form back to project settings first so a
      // future publish remembers it.
      await saveProjectSettings(project.mudDir, {
        ...projectSettings,
        hub_world_slug: slug,
        hub_world_listed: listed,
        hub_world_display_name: displayName,
        hub_world_tagline: tagline,
      });

      const lore = useLoreStore.getState().lore;
      if (!lore) throw new Error("No lore loaded");

      // Build the showcase payload against the self-hosted custom
      // domain — the Rust backend will rewrite image URLs to the hub
      // subdomain, but needs the originals to locate the files.
      const selfHostedBase = settings?.r2_custom_domain?.replace(/\/+$/, "") ?? "";
      const data = exportShowcaseData(lore, selfHostedBase);
      const showcaseJson = JSON.stringify(data);

      const res = await invoke<HubPublishResult>("publish_to_hub", {
        request: {
          showcase_json: showcaseJson,
          slug,
          listed,
          display_name: displayName || null,
          tagline: tagline || null,
        },
      });
      setResult(res);
      showToast(
        {
          variant: "ember",
          kicker: "Hub updated",
          message: `Published to ${res.slug}.hub — ${res.images_uploaded} new, ${res.images_reused} reused.`,
          glyph: "\u2726",
        },
        3600,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="publish-hub-title"
      title="Publish to Arcanum Hub"
      subtitle="Uploads compressed lore and images to the central showcase site. Your self-hosted deploy is untouched."
      widthClassName="max-w-2xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <ActionButton onClick={onClose} variant="ghost">
            {result ? "Close" : "Cancel"}
          </ActionButton>
          {!result && (
            <ActionButton onClick={() => void handlePublish()} disabled={!canPublish} variant="primary">
              {running ? (
                <span className="flex items-center gap-1.5">
                  <Spinner />
                  Publishing
                </span>
              ) : (
                "Publish to Hub"
              )}
            </ActionButton>
          )}
        </div>
      }
    >
      {!hubConfigured && (
        <div className="mb-4 rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-xs text-status-warning">
          Hub API URL and API key are not configured. Open <strong>Settings → Services</strong> and fill in the Arcanum Hub section.
        </div>
      )}

      {!hasLore && (
        <div className="mb-4 rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-xs text-status-warning">
          This project has no lore articles yet. The hub is for published lore, not zone data.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="hub-dialog-slug" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
            World slug
          </label>
          <input
            id="hub-dialog-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="mystara"
            disabled={running}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <p className="mt-1 text-2xs text-text-muted">
            Your world will live at{" "}
            <code className="font-mono text-accent/70">{slug || "<slug>"}.arcanum-hub.com</code>
            {slug && !slugValid && (
              <span className="ml-2 text-status-error">(invalid — 3-32 chars, a-z0-9-)</span>
            )}
          </p>
        </div>

        <div>
          <label htmlFor="hub-dialog-display-name" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
            Display name
          </label>
          <input
            id="hub-dialog-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Defaults to world setting name"
            disabled={running}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>

        <div>
          <label htmlFor="hub-dialog-tagline" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
            Tagline (hub landing page)
          </label>
          <input
            id="hub-dialog-tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One-line description"
            disabled={running}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>

        <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
            disabled={running}
            className="accent-accent"
          />
          List this world on the hub's public directory
        </label>
      </div>

      {/* ─── Progress ──────────────────────────────────────────── */}
      {running && progress && (
        <div className="mt-5 rounded-lg border border-border-active bg-status-info/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-2xs text-text-secondary">
            <span className="uppercase tracking-wider">{progress.phase}</span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-bg-primary">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="mt-2 truncate text-2xs text-text-muted">{progress.label}</p>
        </div>
      )}

      {/* ─── Result ────────────────────────────────────────────── */}
      {result && (
        <div className="mt-5 rounded-lg border border-status-success/40 bg-status-success/10 px-4 py-3 text-xs text-status-success">
          <div className="mb-1 font-display uppercase tracking-wider">Published</div>
          <div className="text-text-primary">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-accent/80"
            >
              {result.url}
            </a>
          </div>
          <div className="mt-2 text-text-muted">
            {result.images_uploaded} uploaded, {result.images_reused} reused,{" "}
            {result.images_failed} failed — {formatBytes(result.bytes_uploaded)} transferred
          </div>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-status-warning">
                {result.errors.length} warning{result.errors.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1 list-disc pl-5 text-text-muted">
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 10 && (
                  <li className="text-text-muted/70">
                    …and {result.errors.length - 10} more
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ─── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="mt-5 rounded-lg border border-status-error/40 bg-status-error/10 px-4 py-3 text-xs text-status-error">
          {error}
        </div>
      )}
    </DialogShell>
  );
}
