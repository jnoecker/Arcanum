import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseStory } from "@/types/showcase";

// ─── StoryCard ──────────────────────────────────────────────────────

function StoryCard({ story }: { story: ShowcaseStory }) {
  return (
    <Link
      to={`/stories/${encodeURIComponent(story.id)}`}
      className="group block rounded-lg overflow-hidden border-t-2 border-accent/30
                 transition-shadow duration-500
                 hover:shadow-[0_8px_28px_rgba(168,151,210,0.12)]
                 focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {story.coverImageUrl ? (
        <div className="aspect-video overflow-hidden bg-bg-tertiary/30">
          <img
            src={story.coverImageUrl}
            alt={story.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
          />
        </div>
      ) : (
        <div className="aspect-video bg-bg-tertiary/30 flex items-center justify-center">
          <span className="text-text-muted text-sm font-display">No Cover</span>
        </div>
      )}
      <div className="px-4 py-3 bg-bg-secondary/40">
        <div className="text-[12px] font-display text-accent tracking-[0.14em] uppercase">
          STORY
        </div>
        <h2 className="text-[17px] font-sans text-accent-emphasis group-hover:text-accent transition-colors duration-300">
          {story.title}
        </h2>
        <div className="text-[12px] font-display text-text-muted tracking-[0.14em] uppercase">
          {story.sceneCount} {story.sceneCount === 1 ? "scene" : "scenes"}
          <span className="mx-1 opacity-40">.</span>
          {story.zoneName ?? "Unknown Zone"}
        </div>
      </div>
    </Link>
  );
}

// ─── StoriesPage ────────────────────────────────────────────────────

export function StoriesPage() {
  const { data } = useShowcase();

  useEffect(() => {
    document.title = `Stories — ${data?.meta.worldName ?? "World Lore"}`;
  }, [data]);

  const stories = data?.stories ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-[20px] text-accent tracking-[0.18em] uppercase">
          Stories
        </h1>
        <span className="text-text-muted text-[12px] font-display tracking-[0.14em] uppercase">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
        </span>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-24">
          <h2 className="font-display text-accent text-xl mb-3">No Stories Yet</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            Stories will appear here once they are published from the Arcanum creator. Check back soon for cinematic tales from this world.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}
