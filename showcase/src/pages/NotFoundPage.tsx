import { useEffect } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Lost in the Void";
  }, []);

  return (
    <div className="text-center py-24 sm:py-32">
      <div className="animate-fade-in-up">
        <h1 className="font-display text-accent text-5xl sm:text-6xl mb-4 tracking-[0.08em]">404</h1>
        <h2 className="font-display text-accent-emphasis text-xl sm:text-2xl mb-4 tracking-[0.06em]">
          Beyond the Map's Edge
        </h2>
        <p className="text-text-secondary text-lg mb-10 max-w-md mx-auto leading-relaxed">
          You've wandered past the boundaries of this world. This page exists only in unwritten lore.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 rounded-lg border border-accent/30 text-accent
                     hover:bg-accent/8 hover:border-accent/50 transition-all duration-300
                     font-display tracking-[0.14em] text-sm"
        >
          Return to the Known World
        </Link>
      </div>
    </div>
  );
}
