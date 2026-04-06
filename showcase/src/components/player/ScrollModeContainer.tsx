// ─── ScrollModeContainer (stub) ──────────────────────────────────
// Placeholder for Task 2 -- will be replaced with full IntersectionObserver implementation.

import type { ShowcaseStory } from "@/types/showcase";

interface ScrollModeContainerProps {
  story: ShowcaseStory;
}

export function ScrollModeContainer({ story }: ScrollModeContainerProps) {
  return (
    <div className="text-text-muted text-center py-12">
      Scroll mode: {story.scenes.length} scenes
    </div>
  );
}
