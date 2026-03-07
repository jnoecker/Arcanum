import { useState, useEffect } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { IMAGE_MODELS } from "@/types/assets";
import type { Settings } from "@/types/assets";

export function ApiSettingsPanel() {
  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const saveSettings = useAssetStore((s) => s.saveSettings);

  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    try {
      await saveSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="flex flex-col gap-6">
      {/* API Key */}
      <div>
        <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
          DeepInfra API Key
        </label>
        <input
          type="password"
          value={draft.deepinfra_api_key}
          onChange={(e) =>
            setDraft({ ...draft, deepinfra_api_key: e.target.value })
          }
          placeholder="Enter your DeepInfra API key"
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
        />
        <p className="mt-1 text-[10px] text-text-muted">
          Get your key at deepinfra.com/dash/api_keys
        </p>
      </div>

      {/* Default Image Model */}
      <div>
        <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
          Default Image Model
        </label>
        <div className="flex flex-col gap-1.5">
          {IMAGE_MODELS.map((model) => (
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
      </div>

      {/* Enhance Model */}
      <div>
        <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
          Prompt Enhancement Model
        </label>
        <input
          type="text"
          value={draft.enhance_model}
          onChange={(e) =>
            setDraft({ ...draft, enhance_model: e.target.value })
          }
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
        />
      </div>

      {/* Save */}
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
      </div>
    </div>
  );
}
