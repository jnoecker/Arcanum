import { useCallback } from "react";
import type { WorldFile } from "@/types/world";
import type { EntitySelection } from "./RoomPanel";
import { MobEditor } from "@/components/editors/MobEditor";
import { ItemEditor } from "@/components/editors/ItemEditor";
import { ShopEditor } from "@/components/editors/ShopEditor";
import { QuestEditor } from "@/components/editors/QuestEditor";
import { GatheringNodeEditor } from "@/components/editors/GatheringNodeEditor";
import { RecipeEditor } from "@/components/editors/RecipeEditor";

interface EntityPanelProps {
  zoneId: string;
  selection: EntitySelection;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
}

export function EntityPanel({
  zoneId,
  selection,
  world,
  onWorldChange,
  onClose,
}: EntityPanelProps) {
  const handleDelete = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border-default bg-bg-secondary">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b border-border-default px-4 py-2">
        <button
          onClick={onClose}
          className="h-5 w-5 rounded text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          title="Back to room"
        >
          &#x2190;
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {selection.kind}
        </span>
        <span className="text-xs font-medium text-text-primary">
          {selection.id}
        </span>
      </div>

      {/* Delegate to specific editor */}
      {selection.kind === "mob" && (
        <MobEditor
          zoneId={zoneId}
          mobId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "item" && (
        <ItemEditor
          zoneId={zoneId}
          itemId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "shop" && (
        <ShopEditor
          zoneId={zoneId}
          shopId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "quest" && (
        <QuestEditor
          zoneId={zoneId}
          questId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "gatheringNode" && (
        <GatheringNodeEditor
          zoneId={zoneId}
          nodeId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
      {selection.kind === "recipe" && (
        <RecipeEditor
          zoneId={zoneId}
          recipeId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
