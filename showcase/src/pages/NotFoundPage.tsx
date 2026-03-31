import { useEffect } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Lost in the Void";
  }, []);

  return (
    <div className="text-center py-20">
      <h1 className="font-display text-accent text-4xl mb-3">Beyond the Map's Edge</h1>
      <p className="text-text-secondary text-lg mb-8 max-w-md mx-auto">
        You've wandered past the boundaries of this world. This page exists only in unwritten lore.
      </p>
      <Link
        to="/"
        className="inline-block px-5 py-2 rounded-lg border border-accent/40 text-accent
                   hover:bg-accent/10 transition-colors font-display tracking-[0.12em] text-sm"
      >
        Return to the Known World
      </Link>
    </div>
  );
}
