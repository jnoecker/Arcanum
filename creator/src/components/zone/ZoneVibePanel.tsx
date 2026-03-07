import { useState, useEffect } from "react";
import { useVibeStore } from "@/stores/vibeStore";
import { buildVibeInput } from "@/lib/vibePrompts";
import type { WorldFile } from "@/types/world";

interface ZoneVibePanelProps {
  zoneId: string;
  world: WorldFile;
}

export function ZoneVibePanel({ zoneId, world }: ZoneVibePanelProps) {
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const saveVibe = useVibeStore((s) => s.saveVibe);
  const generateVibe = useVibeStore((s) => s.generateVibe);
  const storedVibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const isLoading = useVibeStore((s) => s.loading.has(zoneId));

  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVibe(zoneId);
  }, [zoneId, loadVibe]);

  useEffect(() => {
    setDraft(storedVibe);
  }, [storedVibe]);

  const isDirty = draft !== storedVibe;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveVibe(zoneId, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const worldContext = buildVibeInput(world);
      const vibe = await generateVibe(zoneId, worldContext);
      setDraft(vibe);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="text-[10px] text-text-muted">Loading vibe...</div>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] uppercase tracking-widest text-text-muted">
          Zone Vibe
        </span>
        {saved && (
          <span className="text-[10px] text-status-success">Saved</span>
        )}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Atmospheric description for this zone — injected into all entity image prompts for visual coherence..."
        className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1 font-mono text-[10px] leading-relaxed text-text-secondary placeholder:text-text-muted outline-none focus:border-accent/50"
      />

      <div className="flex gap-1">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Vibe"}
        </button>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[10px] italic text-status-error">{error}</p>
      )}
    </div>
  );
}
