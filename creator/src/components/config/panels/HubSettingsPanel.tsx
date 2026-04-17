import { useEffect, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { ProjectSettings, Settings } from "@/types/assets";
import { HubAccountStatus } from "./HubAccountStatus";

type HubAccountDraft = Pick<Settings, "hub_api_url" | "hub_api_key" | "use_hub_ai">;
type HubWorldDraft = Pick<
  ProjectSettings,
  "hub_world_slug" | "hub_world_display_name" | "hub_world_tagline" | "hub_world_listed"
>;

const HUB_ACCOUNT_KEYS = ["hub_api_url", "hub_api_key", "use_hub_ai"] as const;
const HUB_WORLD_KEYS = [
  "hub_world_slug",
  "hub_world_display_name",
  "hub_world_tagline",
  "hub_world_listed",
] as const;

export function HubSettingsPanel() {
  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const saveProjectSettings = useAssetStore((s) => s.saveProjectSettings);
  const projectDir = useProjectStore((s) => s.project?.mudDir);

  const [account, setAccount] = useState<HubAccountDraft | null>(null);
  const [world, setWorld] = useState<HubWorldDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setAccount({
        hub_api_url: settings.hub_api_url,
        hub_api_key: settings.hub_api_key,
        use_hub_ai: settings.use_hub_ai,
      });
    }
  }, [settings]);

  useEffect(() => {
    if (projectSettings) {
      setWorld({
        hub_world_slug: projectSettings.hub_world_slug,
        hub_world_display_name: projectSettings.hub_world_display_name,
        hub_world_tagline: projectSettings.hub_world_tagline,
        hub_world_listed: projectSettings.hub_world_listed,
      });
    }
  }, [projectSettings]);

  // Tier auto-detection from the key prefix. The hub issues
  // `hubk_full_…` for full-tier keys and `hubk_pub_…` for publish-only
  // keys; legacy `hub_…` keys from before the tier feature are
  // grandfathered as full. The prefix is a UX hint only — the hub
  // enforces the authoritative tier on every /ai/* call.
  const keyIsPublishOnly = account?.hub_api_key.startsWith("hubk_pub_") ?? false;

  // If a publish-only key is entered, force the "use hub AI" flag off
  // in the draft so saving doesn't persist an impossible combination.
  useEffect(() => {
    if (account && keyIsPublishOnly && account.use_hub_ai) {
      setAccount({ ...account, use_hub_ai: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyIsPublishOnly]);

  if (!account) {
    return <div className="text-xs text-text-muted">Loading settings...</div>;
  }

  const accountDirty =
    !settings || HUB_ACCOUNT_KEYS.some((k) => account[k] !== settings[k]);
  const worldDirty =
    !!(projectSettings && world) &&
    HUB_WORLD_KEYS.some((k) => world[k] !== projectSettings[k]);

  async function handleSave() {
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      if (accountDirty) {
        await saveSettings({ ...(settings as Settings), ...account });
      }
      if (worldDirty && projectDir && world && projectSettings) {
        await saveProjectSettings(projectDir, { ...projectSettings, ...world });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const hasPendingChanges = accountDirty || worldDirty;
  const slug = world?.hub_world_slug ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Account status ──────────────────────────────────── */}
      <section>
        <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-text-primary">
          Account
        </h3>
        <HubAccountStatus
          apiKey={settings?.hub_api_key ?? ""}
          apiUrl={(settings?.hub_api_url || "https://api.arcanum-hub.com").trim()}
        />
      </section>

      {/* ─── Connection ──────────────────────────────────────── */}
      <section className="border-t border-border-default pt-5">
        <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
          Connection
        </h3>
        <p className="mb-4 text-2xs text-text-muted">
          Your API key and the hub URL. Sign up in the onboarding flow, or paste an existing key below
          if you already have one.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="hub-api-url" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Hub API URL
            </label>
            <input
              id="hub-api-url"
              type="text"
              value={account.hub_api_url}
              onChange={(e) => setAccount({ ...account, hub_api_url: e.target.value })}
              placeholder="https://api.arcanum-hub.com"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Base URL of the hub API. Leave blank to disable hub publishing entirely.
            </p>
          </div>
          <div>
            <label htmlFor="hub-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Hub API Key
            </label>
            <input
              id="hub-api-key"
              type="password"
              value={account.hub_api_key}
              onChange={(e) => setAccount({ ...account, hub_api_key: e.target.value })}
              placeholder="hubk_full_..."
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {keyIsPublishOnly && (
              <p className="mt-1 text-2xs text-warm-pale">
                Publish-only key detected. AI routing is unavailable for this tier —
                the hub will reject `/ai/*` calls. Publish still works normally.
              </p>
            )}
          </div>
          {AI_ENABLED && (
            <label
              className={`mt-2 flex items-start gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-2 text-xs text-text-secondary ${
                keyIsPublishOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={account.use_hub_ai && !keyIsPublishOnly}
                disabled={keyIsPublishOnly}
                onChange={(e) => setAccount({ ...account, use_hub_ai: e.target.checked })}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="text-text-primary">Use Arcanum Hub for AI generation</span>
                <span className="mt-1 block text-2xs text-text-muted/80">
                  Route image generation (FLUX.2, GPT Image), prompt enhancement (DeepSeek), and
                  vision analysis (Claude) through the hub. You won't need any other provider keys,
                  and usage counts against your playtest quota.
                </span>
              </span>
            </label>
          )}
        </div>
      </section>

      {/* ─── This world ──────────────────────────────────────── */}
      {projectDir && world && (
        <section className="border-t border-border-default pt-5">
          <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
            This world on the hub
          </h3>
          <p className="mb-4 text-2xs text-text-muted">
            Controls how this project appears when you publish it. Stored per-project.
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="hub-world-slug" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                World slug
              </label>
              <input
                id="hub-world-slug"
                type="text"
                value={world.hub_world_slug}
                onChange={(e) =>
                  setWorld({
                    ...world,
                    hub_world_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder="mystara"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
              <p className="mt-1 text-2xs text-text-muted">
                3–32 chars. Your world will live at{" "}
                <code className="font-mono text-accent/70">{(slug || "<slug>") + ".arcanum-hub.com"}</code>.
              </p>
            </div>
            <div>
              <label htmlFor="hub-world-display-name" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                Display name
              </label>
              <input
                id="hub-world-display-name"
                type="text"
                value={world.hub_world_display_name}
                onChange={(e) => setWorld({ ...world, hub_world_display_name: e.target.value })}
                placeholder="Defaults to the lore world name"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
            <div>
              <label htmlFor="hub-world-tagline" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                Tagline
              </label>
              <input
                id="hub-world-tagline"
                type="text"
                value={world.hub_world_tagline}
                onChange={(e) => setWorld({ ...world, hub_world_tagline: e.target.value })}
                placeholder="One-line pitch shown on the hub index"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
            <label className="mt-1 flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={world.hub_world_listed}
                onChange={(e) => setWorld({ ...world, hub_world_listed: e.target.checked })}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="text-text-primary">List on the public hub index</span>
                <span className="mt-0.5 block text-2xs text-text-muted/80">
                  Unlisted worlds still work by direct URL — they just don't appear in the landing directory.
                </span>
              </span>
            </label>
          </div>
        </section>
      )}

      {/* ─── Save bar ─────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 border-t border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasPendingChanges || saving}
            className="action-button action-button-primary action-button-md focus-ring"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-xs text-status-success">Saved</span>}
          {hasPendingChanges && !saving && (
            <span className="text-xs text-accent">modified</span>
          )}
          {error && <span className="text-xs text-status-error">{error}</span>}
        </div>
      </div>
    </div>
  );
}
