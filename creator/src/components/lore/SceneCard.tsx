import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Scene } from "@/types/story";
import { TemplateBadge } from "./TemplateBadge";

interface SceneCardProps {
  scene: Scene;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, sceneId: string) => void;
}

export function SceneCard({
  scene,
  index,
  isSelected,
  onSelect,
  onContextMenu,
}: SceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      className={`w-[140px] h-[88px] flex-shrink-0 flex flex-col gap-2 px-3 py-2 rounded-xl cursor-grab transition-[border-color,background-color] duration-[160ms] ${
        isDragging ? "opacity-50" : ""
      } ${
        isSelected
          ? "border border-accent bg-bg-elevated shadow-[0_0_12px_rgba(168,151,210,0.2)]"
          : "border border-border-default bg-bg-primary hover:bg-bg-tertiary"
      }`}
      aria-selected={isSelected}
      onClick={() => onSelect(scene.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, scene.id);
      }}
      {...attributes}
      {...listeners}
    >
      <span className="text-2xs text-text-muted self-end">{index + 1}</span>
      <span className="truncate text-2xs text-text-primary">
        {scene.title || "Untitled"}
      </span>
      <span className="mt-auto">
        {scene.template ? <TemplateBadge template={scene.template} /> : null}
      </span>
    </button>
  );
}
