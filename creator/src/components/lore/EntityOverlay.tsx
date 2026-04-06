import { useState, useRef, useCallback } from "react";
import { useImageSrc } from "@/lib/useImageSrc";
import {
  resolveEntityPosition,
  getEntityScale,
  isBackRow,
  clampPosition,
} from "@/lib/sceneLayout";
import type { SceneEntity } from "@/types/story";

// ─── Props ─────────────────────────────────────────────────────────

interface EntityOverlayProps {
  entity: SceneEntity;
  entityName: string;
  entityImage?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: (entityId: string) => void;
  onReposition: (entityId: string, position: { x: number; y: number }) => void;
  onRemove: (entityId: string) => void;
}

// ─── Placeholder icons (inline SVG, 20px) ──────────────────────────

function PlaceholderIcon({ type }: { type: SceneEntity["entityType"] }) {
  if (type === "mob") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
        <path
          d="M10 2C6.5 2 4 5 4 8c0 2 1 3.5 2 4.5L5 18h10l-1-5.5c1-1 2-2.5 2-4.5 0-3-2.5-6-6-6z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
        <circle cx="12.5" cy="7.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "item") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
        <path
          d="M10 2l2.5 5.5L18 8.5l-4 4 1 5.5-5-2.5-5 2.5 1-5.5-4-4 5.5-1z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    );
  }
  // npc
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
      <circle cx="10" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

// ─── Remove button (X at top-right) ────────────────────────────────

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="Remove entity"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 1l6 6M7 1l-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── EntityOverlay ─────────────────────────────────────────────────

const DRAG_THRESHOLD = 3;

export function EntityOverlay({
  entity,
  entityName,
  entityImage,
  containerRef,
  selected,
  onSelect,
  onReposition,
  onRemove,
}: EntityOverlayProps) {
  const src = useImageSrc(entityImage);

  // Local drag state (not committed to store until pointerup -- per Pitfall 5)
  const [dragging, setDragging] = useState(false);
  const [localPos, setLocalPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ px: number; py: number; moved: boolean } | null>(null);

  const scale = getEntityScale(entity);
  const backRow = isBackRow(entity.slot);
  const baseWidth = 72;
  const width = Math.round(baseWidth * scale);

  // Use local position during drag, otherwise resolve from entity
  const pos = localPos ?? resolveEntityPosition(entity);

  // ─── Pointer drag handlers ─────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartRef.current = { px: e.clientX, py: e.clientY, moved: false };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      if (!dragStartRef.current) return;
      if (!containerRef.current) return;

      const dx = e.clientX - dragStartRef.current.px;
      const dy = e.clientY - dragStartRef.current.py;

      if (!dragStartRef.current.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        dragStartRef.current.moved = true;
        setDragging(true);
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLocalPos(clampPosition({ x, y }));
    },
    [containerRef],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (dragStartRef.current?.moved && localPos) {
        onReposition(entity.id, localPos);
      } else {
        onSelect(entity.id);
      }

      setDragging(false);
      setLocalPos(null);
      dragStartRef.current = null;
    },
    [entity.id, localPos, onReposition, onSelect],
  );

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      className={[
        "group absolute pointer-events-auto select-none",
        "transition-shadow duration-[180ms]",
        dragging ? "cursor-grabbing" : "cursor-grab",
        selected
          ? "ring-2 ring-accent/45 rounded"
          : "hover:ring-2 hover:ring-accent/30 rounded",
      ].join(" ")}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -100%)",
        opacity: dragging ? 0.85 : backRow ? 0.9 : 1,
        width: `${width}px`,
      }}
      role="button"
      aria-label={entityName}
      aria-pressed={selected}
      aria-roledescription="draggable entity"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Entity sprite or placeholder */}
      {src ? (
        <img
          src={src}
          alt={entityName}
          className="w-full h-auto object-contain pointer-events-none"
          draggable={false}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded bg-bg-elevated/80"
          style={{ width: `${width}px`, height: `${Math.round(width * 1.2)}px` }}
        >
          <PlaceholderIcon type={entity.entityType} />
        </div>
      )}

      {/* Name label */}
      <p
        className="text-center font-body text-xs text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {entityName}
      </p>

      {/* Remove button (visible on hover) */}
      <RemoveButton onClick={() => onRemove(entity.id)} />
    </div>
  );
}
