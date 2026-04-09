import { useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

export function ImagesPanel({ config, onChange }: ConfigPanelProps) {
  const img = config.images;
  const patch = (p: Partial<AppConfig["images"]>) =>
    onChange({ images: { ...img, ...p } });

  const sorted = [...img.spriteLevelTiers].sort((a, b) => a - b);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addTier = () => {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < 1 || sorted.includes(n)) return;
    patch({ spriteLevelTiers: [...sorted, n].sort((a, b) => b - a) });
    setDraft("");
    setAdding(false);
  };

  const removeTier = (level: number) => {
    const next = sorted.filter((t) => t !== level);
    if (next.length > 0) patch({ spriteLevelTiers: next.sort((a, b) => b - a) });
  };

  return (
    <>
      <Section
        title="Image Serving"
        description="Base URL for serving images to the game client. In production this typically points to your CDN or Cloudflare R2 custom domain."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base URL" hint="URL prefix for all image assets. Use '/images/' for local serving, or a full CDN URL like 'https://assets.yourgame.com/' for production.">
            <TextInput
              value={img.baseUrl}
              onCommit={(v) => patch({ baseUrl: v || "/images/" })}
              placeholder="/images/"
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Player Sprite Tiers"
        description="Level breakpoints for sprite art progression. The server picks the highest tier at or below the player's level. A staff tier is always included."
      >
        <div className="flex flex-wrap items-center gap-2">
          {sorted.map((level) => (
            <span
              key={level}
              className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-3 py-1 text-xs text-text-secondary"
            >
              <span className="font-mono text-accent">t{level}</span>
              <span className="text-text-muted">Lv {level}+</span>
              <button
                onClick={() => removeTier(level)}
                className="ml-0.5 text-text-muted transition-colors hover:text-status-error"
                title={`Remove tier t${level}`}
              >
                &times;
              </button>
            </span>
          ))}
          <span className="flex items-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-3 py-1 text-xs text-text-muted">
            <span className="font-mono">tstaff</span>
          </span>

          {adding ? (
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                autoFocus
                className="ornate-input w-16 rounded-full px-3 py-1 text-center text-xs text-text-primary"
                placeholder="Lv"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTier();
                  if (e.key === "Escape") { setAdding(false); setDraft(""); }
                }}
              />
              <button
                onClick={addTier}
                disabled={!draft || isNaN(parseInt(draft, 10)) || sorted.includes(parseInt(draft, 10))}
                className="rounded-full bg-accent/20 px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/30 disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setDraft(""); }}
                className="px-1 text-xs text-text-muted hover:text-text-secondary"
              >
                &times;
              </button>
            </span>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed border-accent/30 px-3 py-1 text-xs text-accent/70 transition-colors hover:border-accent hover:text-accent"
            >
              + Add tier
            </button>
          )}
        </div>
      </Section>
    </>
  );
}
