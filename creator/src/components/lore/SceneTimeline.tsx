import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useStoryStore, generateSceneId } from "@/stores/storyStore";
import type { Scene, SceneTemplate } from "@/types/story";
import { SceneCard } from "./SceneCard";
import { SceneContextMenu } from "./SceneContextMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionButton } from "@/components/ui/FormWidgets";
import { applyTemplate, isSceneEmpty } from "@/lib/sceneTemplates";

interface SceneTimelineProps {
  storyId: string;
  scenes: Scene[];
  activeSceneId: string | null;
}

export function SceneTimeline({
  storyId,
  scenes,
  activeSceneId,
}: SceneTimelineProps) {
  const addScene = useStoryStore((s) => s.addScene);
  const removeScene = useStoryStore((s) => s.removeScene);
  const reorderScenes = useStoryStore((s) => s.reorderScenes);
  const duplicateScene = useStoryStore((s) => s.duplicateScene);
  const updateScene = useStoryStore((s) => s.updateScene);
  const setActiveScene = useStoryStore((s) => s.setActiveScene);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sceneId: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "template";
    sceneId: string;
    template?: SceneTemplate;
  } | null>(null);

  // Scroll fade state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sceneIds = scenes.map((s) => s.id);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollIndicators, scenes.length]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sceneIds.indexOf(String(active.id));
      const newIndex = sceneIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(sceneIds, oldIndex, newIndex);
      reorderScenes(storyId, newOrder);
    },
    [sceneIds, storyId, reorderScenes],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleAddScene = useCallback(() => {
    const newScene: Scene = {
      id: generateSceneId(),
      title: "",
      sortOrder: scenes.length,
    };
    addScene(storyId, newScene);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: "smooth",
      });
    });
  }, [storyId, scenes.length, addScene]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sceneId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, sceneId });
    },
    [],
  );

  const handleContextDuplicate = useCallback(
    (sceneId: string) => {
      duplicateScene(storyId, sceneId);
    },
    [storyId, duplicateScene],
  );

  const handleContextDelete = useCallback((sceneId: string) => {
    setConfirmAction({ type: "delete", sceneId });
  }, []);

  const handleContextApplyTemplate = useCallback(
    (sceneId: string, template: SceneTemplate) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      if (isSceneEmpty(scene)) {
        updateScene(storyId, sceneId, applyTemplate(template));
      } else {
        setConfirmAction({ type: "template", sceneId, template });
      }
    },
    [scenes, storyId, updateScene],
  );

  const handleContextClearTemplate = useCallback(
    (sceneId: string) => {
      updateScene(storyId, sceneId, { template: undefined });
    },
    [storyId, updateScene],
  );

  const handleConfirm = useCallback(() => {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") {
      removeScene(storyId, confirmAction.sceneId);
    } else if (confirmAction.type === "template" && confirmAction.template) {
      updateScene(
        storyId,
        confirmAction.sceneId,
        applyTemplate(confirmAction.template),
      );
    }
    setConfirmAction(null);
  }, [confirmAction, storyId, removeScene, updateScene]);

  const activeDragScene = activeDragId
    ? scenes.find((s) => s.id === activeDragId)
    : null;

  const contextScene = contextMenu
    ? scenes.find((s) => s.id === contextMenu.sceneId)
    : null;

  // ─── Zero scenes empty state ───────────────────────────────────────

  if (scenes.length === 0) {
    return (
      <div className="relative rounded-xl panel-surface-light h-[120px]">
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <ActionButton variant="primary" size="md" onClick={handleAddScene}>
            Add your first scene
          </ActionButton>
          <p className="text-2xs text-text-muted">
            Drag to reorder scenes
          </p>
        </div>
      </div>
    );
  }

  // ─── Timeline with scenes ──────────────────────────────────────────

  return (
    <div className="relative rounded-xl panel-surface-light h-[120px]">
      {/* Scroll fade indicators */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[rgba(8,12,28,0.14)] to-transparent pointer-events-none z-[1] transition-opacity duration-150 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[rgba(8,12,28,0.14)] to-transparent pointer-events-none z-[1] transition-opacity duration-150 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sceneIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto px-4 py-4 h-full"
            onScroll={updateScrollIndicators}
          >
            {scenes.map((scene, i) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={i}
                isSelected={scene.id === activeSceneId}
                onSelect={setActiveScene}
                onContextMenu={handleContextMenu}
              />
            ))}

            {/* Add Scene button at end */}
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={handleAddScene}
              className="flex-shrink-0 h-[88px] flex flex-col items-center justify-center gap-1 px-4"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-text-muted"
              >
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-2xs">Add Scene</span>
            </ActionButton>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeDragScene ? (
            <div className="w-[140px] h-[88px] flex-shrink-0 flex flex-col gap-2 px-3 py-2 rounded-xl border border-accent bg-bg-elevated shadow-[0_0_12px_rgba(168,151,210,0.2)] cursor-grabbing">
              <span className="text-2xs text-text-muted self-end">
                {scenes.findIndex((s) => s.id === activeDragScene.id) + 1}
              </span>
              <span className="truncate text-2xs text-text-primary">
                {activeDragScene.title || "Untitled"}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Context menu */}
      {contextMenu && contextScene && (
        <SceneContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sceneId={contextMenu.sceneId}
          currentTemplate={contextScene.template}
          onDuplicate={handleContextDuplicate}
          onDelete={handleContextDelete}
          onApplyTemplate={handleContextApplyTemplate}
          onClearTemplate={handleContextClearTemplate}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Confirm dialogs */}
      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          title="Delete Scene"
          message="This scene and all its content will be removed. You can undo this action."
          confirmLabel="Delete"
          cancelLabel="Keep Scene"
          destructive
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction?.type === "template" && (
        <ConfirmDialog
          title="Replace Scene Content?"
          message="This will replace the current title and narration with template defaults. You can undo this change."
          confirmLabel="Replace Content"
          cancelLabel="Keep Current"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
