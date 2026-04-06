import { useState } from "react";
import { useImageSrc } from "@/lib/useImageSrc";

// ─── Types ────────────────────────────────────────────────────────

interface EntityRow {
  id: string;
  name: string;
  image?: string;
}

interface EntityPickerTabProps {
  entities: EntityRow[];
  entityType: "room" | "mob" | "item";
  activeEntityId?: string;
  onEntityClick: (entityId: string) => void;
}

// ─── Entity Thumbnail ─────────────────────────────────────────────

function EntityThumb({
  image,
  entityType,
}: {
  image?: string;
  entityType: "room" | "mob" | "item";
}) {
  const src = useImageSrc(image);

  // Image loaded successfully
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-8 w-8 rounded object-cover shrink-0"
        draggable={false}
      />
    );
  }

  // Image path exists but still loading
  if (image && !src) {
    return (
      <div className="h-8 w-8 rounded bg-bg-elevated animate-pulse shrink-0" />
    );
  }

  // No image -- show placeholder icon
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-elevated shrink-0">
      {entityType === "room" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-text-muted"
        >
          <rect
            x="2"
            y="1"
            width="10"
            height="12"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect
            x="5"
            y="7"
            width="4"
            height="6"
            rx="0.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      )}
      {entityType === "mob" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-text-muted"
        >
          <circle cx="7" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5.5" cy="5.5" r="0.8" fill="currentColor" />
          <circle cx="8.5" cy="5.5" r="0.8" fill="currentColor" />
        </svg>
      )}
      {entityType === "item" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-text-muted"
        >
          <path
            d="M7 1L12 5.5L7 13L2 5.5L7 1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

// ─── EntityPickerTab ──────────────────────────────────────────────

export function EntityPickerTab({
  entities,
  entityType,
  activeEntityId,
  onEntityClick,
}: EntityPickerTabProps) {
  const [search, setSearch] = useState("");

  const filtered = entities.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {/* Search filter */}
      <input
        type="text"
        role="searchbox"
        aria-label={`Filter ${entityType}s`}
        placeholder={`Filter ${entityType}s...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-bg-tertiary rounded-md py-2 px-3 text-xs font-body text-text-primary placeholder:text-text-muted/40 border border-border-muted focus:border-accent/40 focus:outline-none"
      />

      {/* Scrollable entity list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((entity) => {
            const isActive =
              entityType === "room" && entity.id === activeEntityId;
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => onEntityClick(entity.id)}
                className={`flex items-center gap-2 w-full px-2 py-2 rounded transition-colors duration-[180ms] hover:bg-bg-hover ${
                  isActive
                    ? "bg-accent/14 border-l-2 border-accent"
                    : "border-l-2 border-transparent"
                }`}
              >
                <EntityThumb image={entity.image} entityType={entityType} />
                <span className="text-sm font-body text-text-primary truncate">
                  {entity.name}
                </span>
              </button>
            );
          })
        ) : search ? (
          <p className="text-xs text-text-muted text-center py-4 font-body">
            No matches for &ldquo;{search}&rdquo;
          </p>
        ) : (
          <p className="text-xs text-text-muted text-center py-4 font-body">
            No {entityType}s in this zone
          </p>
        )}
      </div>
    </div>
  );
}
