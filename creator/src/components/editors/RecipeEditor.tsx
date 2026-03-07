import { useCallback } from "react";
import type { WorldFile, RecipeFile, RecipeMaterialFile } from "@/types/world";
import { updateRecipe, deleteRecipe } from "@/lib/zoneEdits";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

interface RecipeEditorProps {
  zoneId: string;
  recipeId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const CRAFTING_SKILLS = [
  { value: "SMITHING", label: "Smithing" },
  { value: "ALCHEMY", label: "Alchemy" },
];

const STATION_OPTIONS = [
  { value: "FORGE", label: "Forge" },
  { value: "ALCHEMY_TABLE", label: "Alchemy Table" },
  { value: "WORKBENCH", label: "Workbench" },
];

export function RecipeEditor({
  zoneId: _zoneId,
  recipeId,
  world,
  onWorldChange,
  onDelete,
}: RecipeEditorProps) {
  const recipe = world.recipes?.[recipeId];
  if (!recipe) return null;

  const patch = useCallback(
    (p: Partial<RecipeFile>) =>
      onWorldChange(updateRecipe(world, recipeId, p)),
    [world, recipeId, onWorldChange],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(deleteRecipe(world, recipeId));
    onDelete();
  }, [world, recipeId, onWorldChange, onDelete]);

  // ─── Material helpers ─────────────────────────────────────────
  const {
    add: handleAddMaterial,
    update: handleUpdateMaterial,
    remove: handleDeleteMaterial,
  } = useArrayField<RecipeMaterialFile>(
    recipe.materials,
    (materials) => patch({ materials }),
    { itemId: "", quantity: 1 },
  );

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Display Name">
            <TextInput
              value={recipe.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Skill">
            <SelectInput
              value={recipe.skill}
              options={CRAFTING_SKILLS}
              onCommit={(v) => patch({ skill: v })}
            />
          </FieldRow>
          <FieldRow label="Skill Req.">
            <NumberInput
              value={recipe.skillRequired}
              onCommit={(v) => patch({ skillRequired: v })}
              placeholder="1"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Level Req.">
            <NumberInput
              value={recipe.levelRequired}
              onCommit={(v) => patch({ levelRequired: v })}
              placeholder="1"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Station">
            <SelectInput
              value={recipe.station ?? ""}
              options={STATION_OPTIONS}
              onCommit={(v) => patch({ station: v || undefined })}
              allowEmpty
              placeholder="— none —"
            />
          </FieldRow>
          <FieldRow label="Station Bonus">
            <NumberInput
              value={recipe.stationBonus}
              onCommit={(v) => patch({ stationBonus: v })}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <FieldRow label="XP Reward">
            <NumberInput
              value={recipe.xpReward}
              onCommit={(v) => patch({ xpReward: v })}
              placeholder="25"
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Output">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Item ID">
            <TextInput
              value={recipe.outputItemId}
              onCommit={(v) => patch({ outputItemId: v })}
              placeholder="item_id"
            />
          </FieldRow>
          <FieldRow label="Quantity">
            <NumberInput
              value={recipe.outputQuantity}
              onCommit={(v) => patch({ outputQuantity: v })}
              placeholder="1"
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Materials (${materials.length})`}
        actions={
          <IconButton onClick={handleAddMaterial} title="Add material">
            +
          </IconButton>
        }
      >
        {materials.length === 0 ? (
          <p className="text-xs text-text-muted">No materials</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {materials.map((mat, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={mat.itemId}
                    onCommit={(v) => handleUpdateMaterial(i, "itemId", v)}
                    placeholder="item_id"
                  />
                </div>
                <div className="w-12 shrink-0">
                  <NumberInput
                    value={mat.quantity}
                    onCommit={(v) =>
                      handleUpdateMaterial(i, "quantity", v ?? 1)
                    }
                    min={1}
                  />
                </div>
                <IconButton
                  onClick={() => handleDeleteMaterial(i)}
                  title="Remove material"
                  danger
                >
                  &times;
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Media */}
      <Section title="Media">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Image">
            <TextInput
              value={recipe.image ?? ""}
              onCommit={(v) => patch({ image: v || undefined })}
              placeholder="none"
            />
          </FieldRow>
        </div>
      </Section>

      <div className="px-4 py-3">
        <button
          onClick={handleDelete}
          className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
        >
          Delete Recipe
        </button>
      </div>
    </>
  );
}
