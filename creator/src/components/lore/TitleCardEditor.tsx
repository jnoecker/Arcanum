// ─── TitleCardEditor ────────────────────────────────────────────────
// Optional top-center text overlay distinct from bottom narration.
// Used for location labels, year stamps, character reveals, subtitles.

import { useStoryStore } from "@/stores/storyStore";
import type { Scene, TitleCardStyle } from "@/types/story";

const STYLE_OPTIONS: { value: TitleCardStyle; label: string }[] = [
  { value: "location", label: "Location" },
  { value: "year", label: "Year / Era" },
  { value: "subtitle", label: "Subtitle" },
  { value: "character", label: "Character" },
];

interface TitleCardEditorProps {
  storyId: string;
  scene: Scene;
}

export function TitleCardEditor({ storyId, scene }: TitleCardEditorProps) {
  const updateScene = useStoryStore((s) => s.updateScene);
  const card = scene.titleCard;

  const setText = (text: string) => {
    if (!text.trim()) {
      updateScene(storyId, scene.id, { titleCard: undefined });
      return;
    }
    updateScene(storyId, scene.id, {
      titleCard: { ...(card ?? {}), text, style: card?.style ?? "subtitle" },
    });
  };

  const setStyle = (style: TitleCardStyle) => {
    updateScene(storyId, scene.id, {
      titleCard: { text: card?.text ?? "", style },
    });
  };

  return (
    <details className="group rounded-lg border border-border-muted bg-bg-primary/50 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-display uppercase tracking-[0.15em] text-text-secondary">
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className="transform transition-transform group-open:rotate-90"
        >
          <path d="M5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Title Card
        {card?.text && (
          <span className="ml-2 max-w-[200px] truncate normal-case tracking-normal text-2xs text-text-muted">
            "{card.text}"
          </span>
        )}
      </summary>

      <div className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          value={card?.text ?? ""}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. The Black Spire — 1247 A.M."
          className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">Style</span>
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStyle(opt.value)}
              className={`rounded-full border px-2 py-0.5 text-2xs transition-colors ${
                card?.style === opt.value
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-border-default text-text-muted hover:border-accent/40 hover:text-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
