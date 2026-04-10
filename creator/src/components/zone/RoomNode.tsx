import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { RoomNodeData, EntitySprite } from "@/lib/zoneToGraph";
import { useImageSrc } from "@/lib/useImageSrc";
import missingRoomBg from "@/assets/missing-room.jpg";

type RoomNodeType = Node<RoomNodeData, "room">;

// ─── Handle definitions ──────────────────────────────────────────────

interface HandleDef {
  id: string;
  position: Position;
  style: React.CSSProperties;
  /** Show a visible "+" button for this handle */
  showPlus?: boolean;
  /** Label for tooltip */
  label: string;
}

/** Cardinal + diagonal handles with visible plus signs on the four walls */
const HANDLES: HandleDef[] = [
  // Cardinal — visible "+" on each wall center
  { id: "n", position: Position.Top, style: { left: "50%" }, showPlus: true, label: "North" },
  { id: "s", position: Position.Bottom, style: { left: "50%" }, showPlus: true, label: "South" },
  { id: "e", position: Position.Right, style: { top: "50%" }, showPlus: true, label: "East" },
  { id: "w", position: Position.Left, style: { top: "50%" }, showPlus: true, label: "West" },
  // Diagonals — invisible connection points
  { id: "ne", position: Position.Top, style: { left: "85%" }, label: "Northeast" },
  { id: "nw", position: Position.Top, style: { left: "15%" }, label: "Northwest" },
  { id: "se", position: Position.Bottom, style: { left: "85%" }, label: "Southeast" },
  { id: "sw", position: Position.Bottom, style: { left: "15%" }, label: "Southwest" },
  // Up/Down — visible "+" at top-right and bottom-left corners
  { id: "u", position: Position.Top, style: { left: "95%" }, showPlus: true, label: "Up" },
  { id: "d", position: Position.Bottom, style: { left: "5%" }, showPlus: true, label: "Down" },
];

const hiddenHandleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  background: "transparent",
  border: "none",
  zIndex: 10,
};

const plusHandleStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  background: "color-mix(in srgb, var(--color-border-default) 40%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border-default) 60%, transparent)",
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "crosshair",
  fontSize: 12,
  color: "color-mix(in srgb, var(--color-text-muted) 60%, transparent)",
  transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
  zIndex: 10,
};

// ─── Sub-components ──────────────────────────────────────────────────

function SpriteThumb({ sprite }: { sprite: EntitySprite }) {
  const src = useImageSrc(sprite.image);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={sprite.name}
      title={`${sprite.kind}: ${sprite.name}`}
      className="h-6 w-6 rounded-sm border border-[var(--chrome-stroke-emphasis)] object-cover"
    />
  );
}

function RoomBackground({ image }: { image?: string }) {
  const src = useImageSrc(image);
  if (!src) return null;
  return (
    <>
      <img
        src={src}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full rounded object-cover"
      />
      {/* Gradient fade at bottom so the badge is readable */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b bg-gradient-to-t from-black/70 to-transparent" />
    </>
  );
}

/** Role pill badges (bank, tavern/lottery, dungeon) */
function RoleBadges({ d }: { d: RoomNodeData }) {
  if (!d.bank && !d.tavern && !d.dungeon) return null;
  return (
    <div className="relative flex flex-wrap gap-1">
      {d.bank && (
        <span className="rounded bg-status-info/20 px-1 text-3xs font-semibold text-status-info" title="Bank">Bank</span>
      )}
      {d.tavern && (
        <span className="rounded bg-status-warning/20 px-1 text-3xs font-semibold text-status-warning" title="Lottery (tavern)">Lottery</span>
      )}
      {d.dungeon && (
        <span className="rounded bg-status-error/20 px-1 text-3xs font-semibold text-status-error" title="Dungeon portal">Dungeon</span>
      )}
    </div>
  );
}

/** Compact info badge shown at the bottom of image-backed nodes */
function InfoBadge({ d }: { d: RoomNodeData }) {
  const hasEntities = d.mobCount > 0 || d.itemCount > 0 || d.shopCount > 0 || d.gatheringNodeCount > 0 || d.station;

  return (
    <div className="relative mt-auto flex flex-col gap-0.5">
      {/* Role badges */}
      <RoleBadges d={d} />

      {/* Title */}
      <div className="flex items-center gap-1">
        {d.isStartRoom && (
          <span className="text-accent text-2xs" title="Start room" aria-label="Start room">★</span>
        )}
        <span className="truncate text-2xs font-semibold text-text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {d.title}
        </span>
      </div>

      {/* Room ID + entity counts in a single row */}
      <div className="flex items-center gap-1.5">
        <span className="truncate text-3xs text-text-secondary">{d.roomId}</span>
        {hasEntities && (
          <div className="flex items-center gap-1.5 text-3xs text-text-primary">
            {d.mobCount > 0 && <span title="Mobs" aria-label={`${d.mobCount} mobs`}>⚔{d.mobCount}</span>}
            {d.itemCount > 0 && <span title="Items" aria-label={`${d.itemCount} items`}>◆{d.itemCount}</span>}
            {d.shopCount > 0 && <span title="Shops" aria-label={`${d.shopCount} shops`}>⛋{d.shopCount}</span>}
            {d.gatheringNodeCount > 0 && <span title="Gathering nodes" aria-label={`${d.gatheringNodeCount} gathering nodes`}>⛏{d.gatheringNodeCount}</span>}
            {d.station && (
              <span className="text-status-info" title={`Station: ${d.station}`} aria-label={`Crafting station: ${d.station}`}>⚒</span>
            )}
          </div>
        )}
      </div>

      {/* Entity sprite thumbnails */}
      {d.entities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {d.entities.map((e) => (
            <SpriteThumb key={`${e.kind}:${e.id}`} sprite={e} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RoomNode ────────────────────────────────────────────────────────

export const RoomNode = memo(function RoomNode({ data, selected }: NodeProps<RoomNodeType>) {
  const d = data as RoomNodeData;
  const hasImage = !!d.image;

  return (
    <div
      className={`group/room relative flex flex-col rounded border transition-colors ${
        selected
          ? "border-accent shadow-lg shadow-accent/20"
          : d.isStartRoom
            ? "border-accent/50"
            : "border-border-default"
      } ${hasImage ? "bg-bg-abyss" : "bg-bg-elevated"}`}
      style={{ width: 220, minHeight: hasImage ? 100 : undefined }}
    >
      {/* Room background image — full opacity */}
      <RoomBackground image={d.image} />

      {/* Source handles (drag from these to create exits) */}
      {HANDLES.map((h) => (
        <Handle
          key={`source-${h.id}`}
          type="source"
          position={h.position}
          id={`source-${h.id}`}
          title={h.label}
          isConnectable
          className={h.showPlus ? "room-handle-plus" : ""}
          style={h.showPlus ? { ...plusHandleStyle, ...h.style } : { ...hiddenHandleStyle, ...h.style }}
        />
      ))}

      {/* Target handles (invisible — receive connections) */}
      {HANDLES.map((h) => (
        <Handle
          key={`target-${h.id}`}
          type="target"
          position={h.position}
          id={`target-${h.id}`}
          style={{ ...hiddenHandleStyle, ...h.style }}
          isConnectable
        />
      ))}

      {hasImage ? (
        /* Image mode: badge overlay at the bottom */
        <div className="relative flex min-h-0 flex-1 flex-col justify-end px-2.5 py-2">
          <InfoBadge d={d} />
        </div>
      ) : (
        /* No image: placeholder background + classic layout */
        <div className="relative px-3 py-2">
          <img
            src={missingRoomBg}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full rounded object-cover opacity-15"
          />
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            {d.isStartRoom && (
              <span className="text-accent text-xs" title="Start room">★</span>
            )}
            <span className="truncate text-xs font-medium text-text-primary">
              {d.title}
            </span>
          </div>

          {/* Room ID */}
          <div className="truncate text-2xs text-text-muted">{d.roomId}</div>

          {/* Entity sprites */}
          {d.entities.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.entities.map((e) => (
                <SpriteThumb key={`${e.kind}:${e.id}`} sprite={e} />
              ))}
            </div>
          )}

          {/* Role badges */}
          <RoleBadges d={d} />

          {/* Entity badges (for entities without images) */}
          {(d.mobCount > 0 || d.itemCount > 0 || d.shopCount > 0 || d.gatheringNodeCount > 0 || d.station) && (
            <div className="mt-1 flex items-center gap-2 text-2xs text-text-muted">
              {d.mobCount > 0 && <span title="Mobs">⚔{d.mobCount}</span>}
              {d.itemCount > 0 && <span title="Items">◆{d.itemCount}</span>}
              {d.shopCount > 0 && <span title="Shops">⛋{d.shopCount}</span>}
              {d.gatheringNodeCount > 0 && <span title="Gathering nodes">⛏{d.gatheringNodeCount}</span>}
              {d.station && (
                <span className="text-status-info" title={`Station: ${d.station}`}>⚒</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
