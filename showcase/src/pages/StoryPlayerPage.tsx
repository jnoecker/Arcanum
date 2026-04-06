import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useShowcase } from "@/lib/DataContext";
import { StoryPlayer } from "@/components/player/StoryPlayer";

// ─── StoryPlayerPage ────────────────────────────────────────────────

export function StoryPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, storyById } = useShowcase();

  const story = id ? storyById.get(decodeURIComponent(id)) : undefined;

  useEffect(() => {
    if (story) {
      document.title = `${story.title} — ${data?.meta.worldName ?? "World Lore"}`;
    } else {
      document.title = "Story Not Found";
    }
  }, [story, data?.meta.worldName]);

  // ─── Escape key returns to stories listing ──────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        navigate("/stories");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // ─── Not-found state ──────────────────────────────────────────────

  if (!story) {
    return (
      <div className="text-center py-24">
        <h1 className="font-display text-accent text-2xl mb-3">Story Not Found</h1>
        <p className="text-text-muted mb-6">This tale has been lost to the ages.</p>
        <Link
          to="/stories"
          className="text-text-link text-sm hover:text-accent transition-colors duration-300"
        >
          Return to Stories
        </Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-xs text-text-muted">
          <li>
            <Link
              to="/stories"
              className="hover:text-text-link transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
            >
              Stories
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li aria-current="page" className="text-text-secondary truncate max-w-[300px]">
            {story.title}
          </li>
        </ol>
      </nav>

      {/* Story title */}
      <h1 className="font-display text-[28px] font-bold text-accent-emphasis tracking-[0.04em] mb-6">
        {story.title}
      </h1>

      {/* Player */}
      <StoryPlayer story={story} />
    </div>
  );
}
