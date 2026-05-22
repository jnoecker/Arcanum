import { useCallback, useState, useMemo } from "react";
import type { WorldFile } from "@/types/world";
import { duplicateMob, duplicateItem } from "@/lib/zoneEdits";
import { useToastStore } from "@/stores/toastStore";
import type { EntitySelection } from "./RoomPanel";
import { MobEditor } from "@/components/editors/MobEditor";
import { ItemEditor } from "@/components/editors/ItemEditor";
import { ShopEditor } from "@/components/editors/ShopEditor";
import { QuestEditor } from "@/components/editors/QuestEditor";
import { GatheringNodeEditor } from "@/components/editors/GatheringNodeEditor";
import { RecipeEditor } from "@/components/editors/RecipeEditor";
import { PuzzleEditor } from "@/components/editors/PuzzleEditor";
import { YamlPreview } from "@/components/ui/YamlPreview";
import { RenameEntityDialog } from "./RenameEntityDialog";
import sidebarBg from "@/assets/sidebar-bg.png";

const COLLECTION_MAP: Record<string, string> = {
  mob: "mobs",
  item: "items",
  shop: "shops",
  quest: "quests",
  gatheringNode: "gatheringNodes",
  recipe: "recipes",
  puzzle: "puzzles",
};

interface EntityPanelProps {
  selection: EntitySelection;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
  onRename?: (newId: string) => void;
  zoneId?: string;
}

export function EntityPanel({
  selection,
  world,
  onWorldChange,
  onClose,
  onRename,
  zoneId,
}: EntityPanelProps) {
  const [showYaml, setShowYaml] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const canRename =
    onRename != null &&
    (selection.kind === "mob" ||
      selection.kind === "item" ||
      selection.kind === "quest" ||
      selection.kind === "shop");

  const handleDelete = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDuplicateMob = useCallback(() => {
    try {
      const { world: next, newId } = duplicateMob(world, selection.id);
      onWorldChange(next);
      onRename?.(newId);
      useToastStore.getState().show(`Duplicated as "${newId}"`);
    } catch (err) {
      useToastStore.getState().show(
        err instanceof Error ? err.message : "Failed to duplicate mob",
      );
    }
  }, [world, selection.id, onWorldChange, onRename]);

  const handleDuplicateItem = useCallback(() => {
    try {
      const { world: next, newId } = duplicateItem(world, selection.id);
      onWorldChange(next);
      onRename?.(newId);
      useToastStore.getState().show(`Duplicated as "${newId}"`);
    } catch (err) {
      useToastStore.getState().show(
        err instanceof Error ? err.message : "Failed to duplicate item",
      );
    }
  }, [world, selection.id, onWorldChange, onRename]);

  const entityData = useMemo(() => {
    const collection = COLLECTION_MAP[selection.kind];
    if (!collection) return null;
    return (world as unknown as Record<string, Record<string, unknown>>)[collection]?.[selection.id] ?? null;
  }, [world, selection]);

  return (
    <div className="relative flex min-h-0 min-w-0 w-[clamp(14rem,26vw,26rem)] flex-1 flex-col border-l border-border-default bg-bg-secondary max-[1100px]:max-h-[min(45vh,32rem)] max-[1100px]:w-full max-[1100px]:border-l-0 max-[1100px]:border-t">
      <img src={sidebarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
      {/* Header with back button */}
      <div className="relative z-10 shrink-0 flex items-center gap-2 border-b border-border-default px-4 py-2">
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          title="Back to room"
        >
          &#x2190;
        </button>
        <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
          {selection.kind}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary" title={selection.id}>
          {selection.id}
        </span>
        {canRename && (
          <button
            onClick={() => setRenaming(true)}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
            title="Rename ID"
            aria-label="Rename ID"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setShowYaml((v) => !v)}
          className={`ml-auto rounded px-1.5 py-0.5 font-mono text-2xs transition-colors ${
            showYaml
              ? "bg-accent/20 text-accent"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          }`}
          title="Toggle YAML preview"
        >
          YAML
        </button>
        <button
          onClick={onClose}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          title="Close editor"
          aria-label="Close editor"
        >
          &times;
        </button>
      </div>

      {/* YAML preview or editor */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
      {showYaml ? (
        <YamlPreview
          data={entityData ? { [selection.id]: entityData } : null}
          label={`${selection.kind}: ${selection.id}`}
        />
      ) : (
      <>
      {selection.kind === "mob" && (
        <MobEditor
          mobId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
          onDuplicate={onRename ? handleDuplicateMob : undefined}
          zoneId={zoneId}
        />
      )}
      {selection.kind === "item" && (
        <ItemEditor
          itemId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
          onDuplicate={onRename ? handleDuplicateItem : undefined}
          zoneId={zoneId}
        />
      )}
      {selection.kind === "shop" && (
        <ShopEditor
          shopId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
          zoneId={zoneId}
        />
      )}
      {selection.kind === "quest" && (
        <QuestEditor
          questId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "gatheringNode" && (
        <GatheringNodeEditor
          nodeId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
          zoneId={zoneId}
        />
      )}
      {selection.kind === "recipe" && (
        <RecipeEditor
          recipeId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
          zoneId={zoneId}
        />
      )}
      {selection.kind === "puzzle" && (
        <PuzzleEditor
          puzzleId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      </>
      )}
      </div>

      {renaming && canRename && (
        <RenameEntityDialog
          category={selection.kind as "mob" | "item" | "quest" | "shop"}
          currentId={selection.id}
          world={world}
          onConfirm={(nextWorld, newId) => {
            onWorldChange(nextWorld);
            onRename?.(newId);
          }}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  );
}
