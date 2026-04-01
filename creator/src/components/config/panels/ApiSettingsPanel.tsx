import { useState, useEffect } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { IMAGE_MODELS } from "@/types/assets";
import type { Settings } from "@/types/assets";

const LLM_PROVIDERS = [
  { id: "deepinfra", label: "DeepInfra", keyField: "deepinfra_api_key" as const },
  { id: "anthropic", label: "Anthropic (Claude)", keyField: "anthropic_api_key" as const },
  { id: "openrouter", label: "OpenRouter", keyField: "openrouter_api_key" as const },
];

const IMAGE_PROVIDERS = [
  { id: "deepinfra", label: "DeepInfra" },
  { id: "runware", label: "Runware" },
  { id: "openai", label: "OpenAI" },
];

export function ApiSettingsPanel({
  initialSection = "providers",
  showDeploymentActions = true,
}: {
  initialSection?: "providers" | "delivery";
  showDeploymentActions?: boolean;
}) {
  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const saveSettings = useAssetStore((s) => s.saveSettings);

  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) setDraft({ ...settings });
  }, [settings]);

  if (!draft) {
    return (
      <div className="text-xs text-text-muted">Loading settings...</div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !settings || (Object.keys(draft) as (keyof Settings)[]).some(
    (k) => draft[k] !== settings[k],
  );

  const filteredModels = IMAGE_MODELS.filter(
    (m) => m.provider === draft.image_provider,
  );
  const showProviderSections = initialSection !== "delivery";
  const showDeliverySection = initialSection !== "providers";

  return (
    <div className="flex flex-col gap-6">
      {/* ─── API Keys ─────────────────────────────────────────── */}
      {showProviderSections && <div>
        <h3 className="mb-3 font-display text-xs uppercase tracking-widest text-text-muted">
          API Keys
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="deepinfra-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              DeepInfra API Key
            </label>
            <input
              id="deepinfra-api-key"
              type="password"
              value={draft.deepinfra_api_key}
              onChange={(e) =>
                setDraft({ ...draft, deepinfra_api_key: e.target.value })
              }
              placeholder="Enter your DeepInfra API key"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Get your key at deepinfra.com/dash/api_keys
            </p>
          </div>

          <div>
            <label htmlFor="anthropic-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Anthropic API Key
            </label>
            <input
              id="anthropic-api-key"
              type="password"
              value={draft.anthropic_api_key}
              onChange={(e) =>
                setDraft({ ...draft, anthropic_api_key: e.target.value })
              }
              placeholder="Enter your Anthropic API key"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label htmlFor="openrouter-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              OpenRouter API Key
            </label>
            <input
              id="openrouter-api-key"
              type="password"
              value={draft.openrouter_api_key}
              onChange={(e) =>
                setDraft({ ...draft, openrouter_api_key: e.target.value })
              }
              placeholder="Enter your OpenRouter API key"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label htmlFor="runware-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Runware API Key
            </label>
            <input
              id="runware-api-key"
              type="password"
              value={draft.runware_api_key}
              onChange={(e) =>
                setDraft({ ...draft, runware_api_key: e.target.value })
              }
              placeholder="Enter your Runware API key"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label htmlFor="openai-api-key" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              OpenAI API Key
            </label>
            <input
              id="openai-api-key"
              type="password"
              value={draft.openai_api_key}
              onChange={(e) =>
                setDraft({ ...draft, openai_api_key: e.target.value })
              }
              placeholder="Enter your OpenAI API key"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>
        </div>
      </div>}

      {/* ─── Provider Selection ───────────────────────────────── */}
      {showProviderSections && <div className="border-t border-border-default pt-4">
        <h3 className="mb-3 font-display text-xs uppercase tracking-widest text-text-muted">
          Providers
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Prompt Enhancement LLM
            </label>
            <div className="flex flex-col gap-1">
              {LLM_PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
                    draft.prompt_llm_provider === p.id
                      ? "bg-accent/10 text-text-primary"
                      : "text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  <input
                    type="radio"
                    name="llm_provider"
                    value={p.id}
                    checked={draft.prompt_llm_provider === p.id}
                    onChange={() =>
                      setDraft({ ...draft, prompt_llm_provider: p.id })
                    }
                    className="accent-accent"
                  />
                  <span className="font-medium">{p.label}</span>
                  {!draft[p.keyField] && (
                    <span className="text-2xs text-text-muted">(no key)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Image Generation Provider
            </label>
            <div className="flex flex-col gap-1">
              {IMAGE_PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
                    draft.image_provider === p.id
                      ? "bg-accent/10 text-text-primary"
                      : "text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  <input
                    type="radio"
                    name="image_provider"
                    value={p.id}
                    checked={draft.image_provider === p.id}
                    onChange={() =>
                      setDraft({ ...draft, image_provider: p.id })
                    }
                    className="accent-accent"
                  />
                  <span className="font-medium">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>}

      {/* ─── Image Model ──────────────────────────────────────── */}
      {showProviderSections && <div className="border-t border-border-default pt-4">
        <label className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
          Default Image Model
        </label>
        <div className="flex flex-col gap-1.5">
          {filteredModels.map((model) => (
            <label
              key={model.id}
              className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs transition-colors ${
                draft.image_model === model.id
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:bg-bg-elevated"
              }`}
            >
              <input
                type="radio"
                name="image_model"
                value={model.id}
                checked={draft.image_model === model.id}
                onChange={() =>
                  setDraft({ ...draft, image_model: model.id })
                }
                className="accent-accent"
              />
              <div>
                <span className="font-medium">{model.label}</span>
                <span className="ml-2 text-text-muted">{model.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>}

      {/* ─── Enhance Model ────────────────────────────────────── */}
      {showProviderSections && <div>
        <label htmlFor="enhance-model" className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
          Prompt Enhancement Model
        </label>
        <input
          id="enhance-model"
          type="text"
          value={draft.enhance_model}
          onChange={(e) =>
            setDraft({ ...draft, enhance_model: e.target.value })
          }
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
        />
        <p className="mt-1 text-2xs text-text-muted">
          Used by DeepInfra and OpenRouter providers
        </p>
      </div>}

      {/* ─── Generation Options ───────────────────────────────── */}
      {showProviderSections && <div className="border-t border-border-default pt-4">
        <h3 className="mb-3 font-display text-xs uppercase tracking-widest text-text-muted">
          Generation Options
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="batch-concurrency" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Batch Concurrency
            </label>
            <input
              id="batch-concurrency"
              type="number"
              min={1}
              max={20}
              value={draft.batch_concurrency}
              onChange={(e) =>
                setDraft({ ...draft, batch_concurrency: parseInt(e.target.value) || 5 })
              }
              className="w-20 rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Max parallel image generations during batch operations
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={draft.auto_remove_bg}
              onChange={(e) =>
                setDraft({ ...draft, auto_remove_bg: e.target.checked })
              }
              className="accent-accent"
            />
            Auto-remove background for mob/item sprites
          </label>
          <p className="ml-6 -mt-1 text-2xs text-text-muted/60">
            Runs client-side AI background removal on sprite-type assets (mobs, items, abilities, player sprites, race/class portraits) after generation. The transparent version is saved as a variant alongside the original.
          </p>
        </div>
      </div>}

      {/* ─── R2 Section ───────────────────────────────────────── */}
      {showDeliverySection && <div className="border-t border-border-default pt-4">
        <h3 className="mb-3 font-display text-xs uppercase tracking-widest text-text-muted">
          Cloudflare R2 (Asset CDN)
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="r2-account-id" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Account ID
            </label>
            <input
              id="r2-account-id"
              type="text"
              value={draft.r2_account_id}
              onChange={(e) =>
                setDraft({ ...draft, r2_account_id: e.target.value })
              }
              placeholder="Cloudflare account ID"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
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
                onChange={(e) =>
                  setDraft({ ...draft, r2_access_key_id: e.target.value })
                }
                placeholder="R2 access key"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
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
                onChange={(e) =>
                  setDraft({ ...draft, r2_secret_access_key: e.target.value })
                }
                placeholder="R2 secret key"
                className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
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
              onChange={(e) =>
                setDraft({ ...draft, r2_bucket: e.target.value })
              }
              placeholder="my-assets-bucket"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
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
              onChange={(e) =>
                setDraft({ ...draft, r2_custom_domain: e.target.value })
              }
              placeholder="https://assets.example.com"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Public URL for the game client to load images from
            </p>
          </div>

          {showDeploymentActions && (
            <div className="mt-1 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3 text-[11px] leading-6 text-text-secondary">
              Runtime publishing now lives in Operations / Handoff.
            </div>
          )}
        </div>
      </div>}

      {/* GitHub (Version Control) */}
      {showDeliverySection && <div className="mt-6">
        <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-text-muted">
          GitHub
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="github-pat" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Personal Access Token
            </label>
            <input
              id="github-pat"
              type="password"
              value={draft.github_pat}
              onChange={(e) =>
                setDraft({ ...draft, github_pat: e.target.value })
              }
              placeholder="ghp_..."
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-2xs text-text-muted">
              Needs <code className="font-mono text-accent/70">repo</code> scope. Used for push, pull, and PR creation.
            </p>
          </div>
        </div>
      </div>}

      {/* Save — sticky at bottom */}
      <div className="sticky bottom-0 -mx-6 border-t border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-xs text-status-success">Saved</span>
          )}
          {isDirty && (
            <span className="text-xs text-accent">modified</span>
          )}
          {error && (
            <span className="text-xs text-status-error">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
