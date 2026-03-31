import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import { MapViewer } from "@/components/MapViewer";

export function MapsPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useShowcase();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Maps — ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  if (!data) return null;
  const maps = data.maps;

  if (maps.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="font-display text-accent text-xl mb-2">Uncharted Lands</h1>
        <p className="text-text-muted text-sm mb-6">No cartographer has yet charted these lands.</p>
        <Link to="/articles" className="text-text-link text-sm hover:text-accent transition-colors">
          Explore the Codex instead
        </Link>
      </div>
    );
  }

  const activeMap = id ? maps.find((m) => m.id === id) : maps[0];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-accent text-2xl tracking-[0.18em]">Maps</h1>

      {/* Map selector */}
      {maps.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/maps/${m.id}`)}
              className={`px-3 py-1.5 text-xs tracking-[0.12em] uppercase rounded-md border transition-colors ${
                activeMap?.id === m.id
                  ? "border-accent/50 text-accent bg-accent/10"
                  : "border-border-muted text-text-muted hover:text-text-secondary"
              }`}
            >
              {m.title}
            </button>
          ))}
        </div>
      )}

      {/* Map viewer */}
      {activeMap && <MapViewer map={activeMap} />}
    </div>
  );
}
