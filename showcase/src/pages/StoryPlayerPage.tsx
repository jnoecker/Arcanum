import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useShowcase } from "@/lib/DataContext";
import { CinematicRenderer } from "@/components/player/CinematicRenderer";

// ─── StoryPlayerPage ────────────────────────────────────────────────

export function StoryPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, storyById } = useShowcase();

  const story = id ? storyById.get(decodeURIComponent(id)) : undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (story) {
      document.title = `${story.title} — ${data?.meta.worldName ?? "World Lore"}`;
    } else {
      document.title = "Story Not Found";
    }
  }, [story, data?.meta.worldName]);

  // ─── Keyboard navigation ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!story) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          setCurrentIndex((i) => {
            const next = Math.min(story.scenes.length - 1, i + 1);
            if (next !== i) setPlaying(true);
            return next;
          });
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex((i) => Math.max(0, i - 1));
          break;
        case "Escape":
          e.preventDefault();
          navigate("/stories");
          break;
      }
    },
    [story, navigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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

      {/* Player container */}
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <CinematicRenderer
          scenes={story.scenes}
          currentIndex={currentIndex}
          playing={playing}
          narrationSpeed={story.narrationSpeed}
        />
      </div>

      {/* Control bar -- full version added in Plan 03 */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
          aria-label="Previous scene"
        >
          &larr; Prev
        </button>
        <span className="text-[12px] font-display text-text-secondary tracking-[0.12em]">
          Scene {currentIndex + 1} / {story.scenes.length}
        </span>
        <button
          onClick={() => {
            setCurrentIndex((i) => Math.min(story.scenes.length - 1, i + 1));
            setPlaying(true);
          }}
          disabled={currentIndex === story.scenes.length - 1}
          className="text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
          aria-label="Next scene"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
