import { useEffect, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import type { ProjectSettings } from "@/types/assets";

const R2_KEYS = [
  "r2_account_id",
  "r2_access_key_id",
  "r2_secret_access_key",
  "r2_bucket",
  "r2_custom_domain",
] as const;

type R2Draft = Pick<ProjectSettings, (typeof R2_KEYS)[number]>;

export function R2SettingsPanel() {
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const saveProjectSettings = useAssetStore((s) => s.saveProjectSettings);
  const projectDir = useProjectStore((s) => s.project?.mudDir);

  const [draft, setDraft] = useState<R2Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectSettings) {
      setDraft({
        r2_account_id: projectSettings.r2_account_id,
        r2_access_key_id: projectSettings.r2_access_key_id,
        r2_secret_access_key: projectSettings.r2_secret_access_key,
        r2_bucket: projectSettings.r2_bucket,
        r2_custom_domain: projectSettings.r2_custom_domain,
      });
    }
  }, [projectSettings]);

  if (!projectDir) {
    return (
      <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4 text-xs text-text-muted">
        Open a world project to configure R2 delivery.
      </div>
    );
  }

  if (!draft) {
    return <div className="text-xs text-text-muted">Loading settings...</div>;
  }

  const dirty =
    !!projectSettings && R2_KEYS.some((k) => draft[k] !== projectSettings[k]);

  const isComplete =
    !!(draft.r2_account_id && draft.r2_access_key_id && draft.r2_secret_access_key && draft.r2_bucket);

  async function handleSave() {
    if (!projectDir || !projectSettings || !draft) return;
    setSaving(true);
    setError(null);
    try {
      await saveProjectSettings(projectDir, { ...projectSettings, ...draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
          Cloudflare R2
        </h3>
        <p className="mb-4 text-2xs text-text-muted">
          Asset CDN for self-hosted MUD deployments. Images, audio, and runtime config are uploaded
          here so the game client can load them. Stored per-project so every world can target a
          different bucket. If you only publish to the hub, you can leave these blank.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="r2-account-id" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Account ID
            </label>
            <input
              id="r2-account-id"
              type="text"
              value={draft.r2_account_id}
              onChange={(e) => setDraft({ ...draft, r2_account_id: e.target.value })}
              placeholder="Cloudflare account ID"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="r2-access-key-id" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                Access Key ID
              </label>
              <input
                id="r2-access-key-id"
                type="text"
                value={draft.r2_access_key_id}
                onChange={(e) => setDraft({ ...draft, r2_access_key_id: e.target.value })}
                placeholder="R2 access key"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
            <div>
              <label htmlFor="r2-secret-access-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                Secret Access Key
              </label>
              <input
                id="r2-secret-access-key"
                type="password"
                value={draft.r2_secret_access_key}
                onChange={(e) => setDraft({ ...draft, r2_secret_access_key: e.target.value })}
                placeholder="R2 secret key"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
          </div>
          <div>
            <label htmlFor="r2-bucket" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Bucket Name
            </label>
            <input
              id="r2-bucket"
              type="text"
              value={draft.r2_bucket}
              onChange={(e) => setDraft({ ...draft, r2_bucket: e.target.value })}
              placeholder="my-assets-bucket"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label htmlFor="r2-custom-domain" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Custom Domain
            </label>
            <input
              id="r2-custom-domain"
              type="text"
              value={draft.r2_custom_domain}
              onChange={(e) => setDraft({ ...draft, r2_custom_domain: e.target.value })}
              placeholder="https://assets.example.com"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Public URL the game client loads images from.
            </p>
          </div>
        </div>

        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-2xs leading-5 ${
            isComplete
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted"
          }`}
        >
          {isComplete
            ? "Credentials look complete. Use Operations → Deployment to publish assets and config."
            : "Credentials incomplete. Publishes to R2 will be skipped in the deployment flow until all four fields are filled."}
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-6 border-t border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="action-button action-button-primary action-button-md focus-ring"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-xs text-status-success">Saved</span>}
          {dirty && !saving && <span className="text-xs text-accent">modified</span>}
          {error && <span className="text-xs text-status-error">{error}</span>}
        </div>
      </div>
    </div>
  );
}
