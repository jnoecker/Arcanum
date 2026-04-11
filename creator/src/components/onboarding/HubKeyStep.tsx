import { useState } from "react";
import { useAssetStore } from "@/stores/assetStore";

const DEFAULT_HUB_API_URL = "https://api.arcanum-hub.com";

interface HubKeyStepProps {
  onDone: () => void;
}

export function HubKeyStep({ onDone }: HubKeyStepProps) {
  const settings = useAssetStore((s) => s.settings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const [key, setKey] = useState(settings?.hub_api_key ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!settings) {
      setError("Settings not loaded yet — give it a moment and try again.");
      return;
    }
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Enter your Arcanum Hub API key to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSettings({
        ...settings,
        hub_api_key: trimmed,
        hub_api_url: settings.hub_api_url?.trim() || DEFAULT_HUB_API_URL,
        use_hub_ai: true,
      });
      onDone();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !saving) {
      void handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm leading-7 text-text-secondary">
          Arcanum Hub handles AI generation for you — no API keys to manage, no provider accounts to
          juggle. Drop in the key you were given and we'll have you sketching worlds in about a
          minute.
        </p>
        <p className="text-xs leading-6 text-text-muted">
          Your key is saved to this machine only. You can revoke or rotate it later from the Hub admin
          console.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="hub-api-key" className="text-2xs uppercase tracking-ui text-text-muted">
          Arcanum Hub API Key
        </label>
        <input
          id="hub-api-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="arch_live_..."
          autoFocus
          className="ornate-input w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        {error && <p className="text-2xs text-status-error">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs text-text-muted">
          Don't have one?{" "}
          <a
            href="https://arcanum-hub.com"
            target="_blank"
            rel="noreferrer"
            className="text-text-link underline-offset-2 hover:underline"
          >
            Request access at arcanum-hub.com
          </a>
        </p>
        <button
          onClick={handleSubmit}
          disabled={saving || !settings}
          className="rounded-full border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--surface-rgb)/0.18))] px-6 py-2 text-sm font-medium text-text-primary transition hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
