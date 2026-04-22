import { useEffect, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { IMAGE_MODELS } from "@/types/assets";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { ProjectSettings, Settings } from "@/types/assets";

// ─── Provider catalog ──────────────────────────────────────────────
// Kept local so the panel stays self-contained. Adjusting the list
// here is the only touch point when a new provider key is added.

interface ProviderCard {
  id: "deepinfra" | "anthropic" | "openrouter" | "runware" | "openai";
  label: string;
  keyField: keyof Settings & (
    | "deepinfra_api_key"
    | "anthropic_api_key"
    | "openrouter_api_key"
    | "runware_api_key"
    | "openai_api_key"
  );
  helpUrl: string;
  /** Which pipelines this provider feeds. Displayed under the key
   *  field so users know what this key unlocks. */
  uses: string;
}

const PROVIDER_CARDS: ProviderCard[] = [
  {
    id: "deepinfra",
    label: "DeepInfra",
    keyField: "deepinfra_api_key",
    helpUrl: "deepinfra.com/dash/api_keys",
    uses: "Image generation (FLUX) and LLM prompt enhancement.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyField: "anthropic_api_key",
    helpUrl: "console.anthropic.com/settings/keys",
    uses: "LLM prompt enhancement and vision map analysis.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyField: "openrouter_api_key",
    helpUrl: "openrouter.ai/keys",
    uses: "LLM prompt enhancement (unified provider gateway).",
  },
  {
    id: "runware",
    label: "Runware",
    keyField: "runware_api_key",
    helpUrl: "runware.ai/account/api-keys",
    uses: "Image generation (FLUX, FLUX.2, GPT Image 2).",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyField: "openai_api_key",
    helpUrl: "platform.openai.com/api-keys",
    uses: "Image generation (GPT Image 2) and text-to-speech.",
  },
];

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

// Keys this panel edits on the user-level Settings. Kept narrow so
// dirty detection doesn't react to hub/R2/PAT edits happening elsewhere.
const ACCOUNT_KEY_FIELDS = PROVIDER_CARDS.map((p) => p.keyField);

// Keys this panel edits on ProjectSettings. Excludes R2 (own panel) and
// hub world fields (own panel).
const PROJECT_FIELDS = [
  "prompt_llm_provider",
  "image_provider",
  "image_model",
  "enhance_model",
  "batch_concurrency",
  "auto_enhance_prompts",
  "auto_remove_bg",
  "bg_removal_provider",
] as const satisfies readonly (keyof ProjectSettings)[];

const BG_REMOVAL_PROVIDERS = [
  {
    id: "local" as const,
    label: "Local (on-device)",
    description: "Runs the @imgly / ONNX model in a Web Worker. Free, but uses CPU/RAM.",
  },
  {
    id: "runware" as const,
    label: "Runware (Bria RMBG v2.0)",
    description: "Server-side, high quality. ~$0.018/image when using direct Runware; billed against your hub image quota in hub mode.",
  },
];

export function ApiSettingsPanel() {
  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const saveProjectSettings = useAssetStore((s) => s.saveProjectSettings);
  const projectDir = useProjectStore((s) => s.project?.mudDir);

  const [draft, setDraft] = useState<Settings | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) setDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    if (projectSettings) setProjectDraft({ ...projectSettings });
  }, [projectSettings]);

  if (!draft) {
    return <div className="text-xs text-text-muted">Loading settings...</div>;
  }

  const accountDirty =
    !settings || ACCOUNT_KEY_FIELDS.some((k) => draft[k] !== settings[k]);
  const projectDirty =
    !!(projectSettings && projectDraft) &&
    PROJECT_FIELDS.some((k) => projectDraft[k] !== projectSettings[k]);

  const hasPendingChanges = accountDirty || projectDirty;

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      if (accountDirty) {
        await saveSettings(draft);
      }
      if (projectDirty && projectDir && projectDraft) {
        await saveProjectSettings(projectDir, projectDraft);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const filteredModels = IMAGE_MODELS.filter(
    (m) => m.provider === (projectDraft?.image_provider ?? draft.image_provider),
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Account keys ─────────────────────────────────────── */}
      {AI_ENABLED && (
        <section>
          <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
            Account API keys
          </h3>
          <p className="mb-4 text-2xs text-text-muted">
            Provider credentials used when you're not routing through the Arcanum Hub. Each key is
            stored on this machine only.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {PROVIDER_CARDS.map((p) => {
              const configured = !!draft[p.keyField];
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border px-4 py-3 transition ${
                    configured
                      ? "border-accent/20 bg-[var(--chrome-fill)]"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`apikey-${p.id}`}
                      className="font-display text-xs uppercase tracking-wide-ui text-text-primary"
                    >
                      {p.label}
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-3xs uppercase tracking-ui ${
                        configured
                          ? "bg-status-success/15 text-status-success"
                          : "bg-[var(--chrome-highlight)] text-text-muted"
                      }`}
                    >
                      {configured ? "set" : "empty"}
                    </span>
                  </div>
                  <input
                    id={`apikey-${p.id}`}
                    type="password"
                    value={draft[p.keyField]}
                    onChange={(e) => setDraft({ ...draft, [p.keyField]: e.target.value })}
                    placeholder={`Enter your ${p.label} API key`}
                    className="mt-2 w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                  />
                  <p className="mt-2 text-2xs text-text-muted/80">{p.uses}</p>
                  <p className="mt-0.5 text-3xs text-text-muted/60">
                    Get your key at <code className="font-mono text-accent/70">{p.helpUrl}</code>
                  </p>
                </div>
              );
            })}
          </div>

          {draft.use_hub_ai && (
            <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-2xs leading-5 text-accent">
              Hub AI mode is on. Every image, LLM, and vision call routes through the hub and uses
              your hub quota — these keys are only used for direct-provider fallback. Change the
              routing in Settings → Arcanum Hub.
            </div>
          )}
        </section>
      )}

      {/* ─── Pipeline ─────────────────────────────────────────── */}
      {projectDir && projectDraft ? (
        <section className="border-t border-border-default pt-6">
          <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
            Project pipeline
          </h3>
          <p className="mb-4 text-2xs text-text-muted">
            Per-project choices for which provider and model power each step.
          </p>

          {AI_ENABLED && (
            <div className="grid gap-5 md:grid-cols-2">
              {/* Prompt LLM */}
              <div>
                <h4 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                  Prompt LLM
                </h4>
                <div className="flex flex-col gap-1">
                  {LLM_PROVIDERS.map((p) => {
                    const hasKey = !!draft[p.keyField];
                    const selected = projectDraft.prompt_llm_provider === p.id;
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
                          selected
                            ? "bg-accent/10 text-text-primary"
                            : "text-text-secondary hover:bg-bg-elevated"
                        }`}
                      >
                        <input
                          type="radio"
                          name="llm_provider"
                          value={p.id}
                          checked={selected}
                          onChange={() =>
                            setProjectDraft({ ...projectDraft, prompt_llm_provider: p.id })
                          }
                          className="accent-accent"
                        />
                        <span className="flex-1 font-medium">{p.label}</span>
                        {!hasKey && (
                          <span className="rounded-full bg-[var(--chrome-highlight)] px-2 py-0.5 text-3xs text-text-muted">
                            no key
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <label htmlFor="enhance-model" className="mt-3 block text-2xs uppercase tracking-wider text-text-muted">
                  Enhancement model
                </label>
                <input
                  id="enhance-model"
                  type="text"
                  value={projectDraft.enhance_model}
                  onChange={(e) =>
                    setProjectDraft({ ...projectDraft, enhance_model: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                />
                <p className="mt-1 text-3xs text-text-muted/70">
                  Free-form model ID. Used by DeepInfra and OpenRouter.
                </p>
              </div>

              {/* Image pipeline */}
              <div>
                <h4 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                  Image generation
                </h4>
                <div className="flex flex-col gap-1">
                  {IMAGE_PROVIDERS.map((p) => {
                    const selected = projectDraft.image_provider === p.id;
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
                          selected
                            ? "bg-accent/10 text-text-primary"
                            : "text-text-secondary hover:bg-bg-elevated"
                        }`}
                      >
                        <input
                          type="radio"
                          name="image_provider"
                          value={p.id}
                          checked={selected}
                          onChange={() =>
                            setProjectDraft({ ...projectDraft, image_provider: p.id })
                          }
                          className="accent-accent"
                        />
                        <span className="font-medium">{p.label}</span>
                      </label>
                    );
                  })}
                </div>

                <h4 className="mt-3 mb-1 text-2xs uppercase tracking-wider text-text-muted">
                  Default model
                </h4>
                <div className="flex flex-col gap-1">
                  {filteredModels.map((model) => {
                    const selected = projectDraft.image_model === model.id;
                    return (
                      <label
                        key={model.id}
                        className={`flex cursor-pointer items-start gap-2 rounded px-3 py-2 text-xs transition-colors ${
                          selected
                            ? "bg-accent/10 text-text-primary"
                            : "text-text-secondary hover:bg-bg-elevated"
                        }`}
                      >
                        <input
                          type="radio"
                          name="image_model"
                          value={model.id}
                          checked={selected}
                          onChange={() =>
                            setProjectDraft({ ...projectDraft, image_model: model.id })
                          }
                          className="mt-0.5 accent-accent"
                        />
                        <div className="min-w-0">
                          <div className="font-medium">{model.label}</div>
                          <div className="text-3xs text-text-muted/80">{model.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Generation options */}
          <div className={AI_ENABLED ? "mt-6 border-t border-border-muted pt-4" : ""}>
            <h4 className="mb-3 text-2xs uppercase tracking-wider text-text-muted">
              {AI_ENABLED ? "Generation options" : "Asset options"}
            </h4>
            <div className="flex flex-col gap-3">
              {AI_ENABLED && (
                <div className="flex items-center gap-3">
                  <label htmlFor="batch-concurrency" className="text-2xs uppercase tracking-wider text-text-muted">
                    Batch concurrency
                  </label>
                  <input
                    id="batch-concurrency"
                    type="number"
                    min={1}
                    max={20}
                    value={projectDraft.batch_concurrency}
                    onChange={(e) =>
                      setProjectDraft({
                        ...projectDraft,
                        batch_concurrency: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-20 rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                  />
                  <span className="text-3xs text-text-muted/70">
                    Max parallel image generations during batch operations.
                  </span>
                </div>
              )}

              {AI_ENABLED && (
                <label className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={projectDraft.auto_enhance_prompts}
                    onChange={(e) =>
                      setProjectDraft({
                        ...projectDraft,
                        auto_enhance_prompts: e.target.checked,
                      })
                    }
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="text-text-primary">Auto-enhance prompts before generation</span>
                    <span className="mt-0.5 block text-3xs text-text-muted/70">
                      Runs the prompt LLM inside the generation pipeline before image models are called.
                    </span>
                  </span>
                </label>
              )}

              <label className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={projectDraft.auto_remove_bg}
                  onChange={(e) =>
                    setProjectDraft({ ...projectDraft, auto_remove_bg: e.target.checked })
                  }
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="text-text-primary">Auto-remove background for sprite assets</span>
                  <span className="mt-0.5 block text-3xs text-text-muted/70">
                    AI background removal on mobs, items, abilities, and portraits. Saved as a
                    transparent variant alongside the original.
                  </span>
                </span>
              </label>

              <div className="ml-6">
                <h5 className="mb-1 text-2xs uppercase tracking-wider text-text-muted">
                  Background removal backend
                </h5>
                <div className="flex flex-col gap-1">
                  {BG_REMOVAL_PROVIDERS.map((p) => {
                    const selected =
                      (projectDraft.bg_removal_provider || "local") === p.id;
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-start gap-2 rounded px-3 py-2 text-xs transition-colors ${
                          selected
                            ? "bg-accent/10 text-text-primary"
                            : "text-text-secondary hover:bg-bg-elevated"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bg_removal_provider"
                          value={p.id}
                          checked={selected}
                          onChange={() =>
                            setProjectDraft({ ...projectDraft, bg_removal_provider: p.id })
                          }
                          className="mt-0.5 accent-accent"
                        />
                        <div className="min-w-0">
                          <div className="font-medium">{p.label}</div>
                          <div className="text-3xs text-text-muted/80">{p.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4 text-xs text-text-muted">
          Project pipeline settings (provider selection, model choice, generation options) appear
          here once a world project is open.
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
