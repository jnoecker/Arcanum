import { useCallback, useState, useMemo } from "react";
import type { WorldFile } from "@/types/world";
import type { EntitySelection } from "./RoomPanel";
import { MobEditor } from "@/components/editors/MobEditor";
import { ItemEditor } from "@/components/editors/ItemEditor";
import { ShopEditor } from "@/components/editors/ShopEditor";
import { QuestEditor } from "@/components/editors/QuestEditor";
import { GatheringNodeEditor } from "@/components/editors/GatheringNodeEditor";
import { RecipeEditor } from "@/components/editors/RecipeEditor";
import { YamlPreview } from "@/components/ui/YamlPreview";
import sidebarBg from "@/assets/sidebar-bg.png";

const COLLECTION_MAP: Record<string, string> = {
  mob: "mobs",
  item: "items",
  shop: "shops",
  quest: "quests",
  gatheringNode: "gatheringNodes",
  recipe: "recipes",
};

interface EntityPanelProps {
  selection: EntitySelection;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
  zoneId?: string;
}

export function EntityPanel({
  selection,
  world,
  onWorldChange,
  onClose,
  zoneId,
}: EntityPanelProps) {
  const [showYaml, setShowYaml] = useState(false);

  const handleDelete = useCallback(() => {
    onClose();
  }, [onClose]);

  const entityData = useMemo(() => {
    const collection = COLLECTION_MAP[selection.kind];
    if (!collection) return null;
    return (world as unknown as Record<string, Record<string, unknown>>)[collection]?.[selection.id] ?? null;
  }, [world, selection]);

  return (
    <div className="relative flex min-h-0 w-80 shrink-0 flex-col border-l border-border-default bg-bg-secondary">
      <img src={sidebarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
      {/* Header with back button */}
      <div className="relative z-10 shrink-0 flex items-center gap-2 border-b border-border-default px-4 py-2">
        <button
          onClick={onClose}
          className="h-5 w-5 rounded text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          title="Back to room"
        >
          &#x2190;
        </button>
        <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
          {selection.kind}
        </span>
        <span className="text-xs font-medium text-text-primary">
          {selection.id}
        </span>
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
          zoneId={zoneId}
        />
      )}
      {selection.kind === "item" && (
        <ItemEditor
          itemId={selection.id}
          world={world}
          onWorldChange={onWorldChange}
          onDelete={handleDelete}
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
      </>
      )}
      </div>
    </div>
  );
}
