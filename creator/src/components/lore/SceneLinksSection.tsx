// ─── SceneLinksSection ──────────────────────────────────────────────
// Per-scene lore links: location article, featured articles, map+pin,
// and timeline event. Lives below DM Notes in SceneDetailEditor.

import { useId, type ReactNode } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { ArticleSinglePicker, ArticleMultiPicker, MapPinPicker, TimelineEventPicker } from "./LoreLinkPicker";
import type { Scene } from "@/types/story";

interface SceneLinksSectionProps {
  storyId: string;
  scene: Scene;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1" role="group" aria-labelledby={labelId}>
      <div
        id={labelId}
        className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted"
      >
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal text-text-muted/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SceneLinksSection({ storyId, scene }: SceneLinksSectionProps) {
  const updateScene = useStoryStore((s) => s.updateScene);

  return (
    <details className="group rounded-lg border border-border-muted bg-bg-primary/50 p-3" open>
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
        Linked Lore
      </summary>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Location article" hint="(single)">
          <ArticleSinglePicker
            value={scene.linkedLocationArticleId}
            onChange={(id) => updateScene(storyId, scene.id, { linkedLocationArticleId: id })}
            templateFilter="location"
            placeholder="Link location"
            ariaLabel="Location article"
          />
        </Field>

        <Field label="Timeline event">
          <TimelineEventPicker
            value={scene.linkedTimelineEventId}
            onChange={(id) => updateScene(storyId, scene.id, { linkedTimelineEventId: id })}
            ariaLabel="Timeline event"
          />
        </Field>

        <Field label="Map + pin">
          <MapPinPicker
            mapId={scene.linkedMapId}
            pinId={scene.linkedPinId}
            onChange={(mapId, pinId) =>
              updateScene(storyId, scene.id, { linkedMapId: mapId, linkedPinId: pinId })
            }
            mapAriaLabel="Linked map"
            pinAriaLabel="Linked map pin"
          />
        </Field>

        <Field label="Featured articles" hint="(any kind)">
          <ArticleMultiPicker
            selected={scene.linkedArticleIds ?? []}
            onChange={(ids) =>
              updateScene(storyId, scene.id, {
                linkedArticleIds: ids.length > 0 ? ids : undefined,
              })
            }
            placeholder="Link article"
            ariaLabel="Featured articles"
          />
        </Field>
      </div>
    </details>
  );
}
