import { useConfigOptions } from "@/lib/useConfigOptions";
import type { WorldFile, RecipeFile, RecipeMaterialFile } from "@/types/world";
import { updateRecipe, deleteRecipe } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
  EntityHeader,
  FieldGrid,
  CompactField,
  ArrayRow,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton, MediaSection } from "./EditorShared";
import { getPreamble, type ArtStyle } from "@/lib/arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";

interface RecipeEditorProps {
  recipeId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

const FALLBACK_CRAFTING_SKILLS = [
  { value: "smithing", label: "Smithing" },
  { value: "alchemy", label: "Alchemy" },
];

const FALLBACK_STATION_OPTIONS = [
  { value: "forge", label: "Forge" },
  { value: "alchemy_table", label: "Alchemy Table" },
  { value: "workbench", label: "Workbench" },
];

export function RecipeEditor({
  recipeId,
  world,
  onWorldChange,
  onDelete,
  zoneId,
}: RecipeEditorProps) {
  const { entity: recipe, patch, handleDelete } = useEntityEditor<RecipeFile>(
    world,
    recipeId,
    (w) => w.recipes?.[recipeId],
    updateRecipe,
    deleteRecipe,
    onWorldChange,
    onDelete,
  );
  const craftingSkills = useConfigStore((s) => s.config?.craftingSkills);
  const craftingSkillOptions = useConfigOptions(craftingSkills, FALLBACK_CRAFTING_SKILLS);

  const stationTypes = useConfigStore((s) => s.config?.craftingStationTypes);
  const stationOptions = useConfigOptions(stationTypes, FALLBACK_STATION_OPTIONS);

  if (!recipe) return null;

  // ─── Material helpers ─────────────────────────────────────────
  const {
    items: materials,
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
      <EntityHeader type="Recipe">
        <TextInput
          value={recipe.displayName}
          onCommit={(v) => patch({ displayName: v })}
          placeholder="Display Name"
        />
      </EntityHeader>

      <Section title="Basics">
        <FieldGrid cols={2}>
          <CompactField label="Output Item ID" span>
            <TextInput
              value={recipe.outputItemId}
              onCommit={(v) => patch({ outputItemId: v })}
              placeholder="item_id"
              dense
            />
          </CompactField>
          <CompactField label="Output Quantity">
            <NumberInput
              value={recipe.outputQuantity}
              onCommit={(v) => patch({ outputQuantity: v })}
              placeholder="1"
              min={1}
              dense
            />
          </CompactField>
          <CompactField label="XP Reward">
            <NumberInput
              value={recipe.xpReward}
              onCommit={(v) => patch({ xpReward: v })}
              placeholder="25"
              min={0}
              dense
            />
          </CompactField>
          <CompactField label="Skill">
            <SelectInput
              value={recipe.skill}
              options={craftingSkillOptions}
              onCommit={(v) => patch({ skill: v })}
              dense
            />
          </CompactField>
          <CompactField label="Skill Req.">
            <NumberInput
              value={recipe.skillRequired}
              onCommit={(v) => patch({ skillRequired: v })}
              placeholder="1"
              min={1}
              dense
            />
          </CompactField>
          <CompactField label="Level Req.">
            <NumberInput
              value={recipe.levelRequired}
              onCommit={(v) => patch({ levelRequired: v })}
              placeholder="1"
              min={1}
              dense
            />
          </CompactField>
          <CompactField label="Station">
            <SelectInput
              value={recipe.station ?? ""}
              options={stationOptions}
              onCommit={(v) => patch({ station: v || undefined })}
              allowEmpty
              placeholder="— none —"
              dense
            />
          </CompactField>
          <CompactField label="Station Bonus" span>
            <NumberInput
              value={recipe.stationBonus}
              onCommit={(v) => patch({ stationBonus: v })}
              placeholder="0"
              min={0}
              dense
            />
          </CompactField>
        </FieldGrid>
      </Section>

      <Section
        title={`Materials (${materials.length})`}
        defaultExpanded={false}
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
              <ArrayRow key={i} onRemove={() => handleDeleteMaterial(i)}>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      value={mat.itemId}
                      onCommit={(v) => handleUpdateMaterial(i, "itemId", v)}
                      placeholder="item_id"
                      dense
                    />
                  </div>
                  <div className="w-12 shrink-0">
                    <NumberInput
                      value={mat.quantity}
                      onCommit={(v) =>
                        handleUpdateMaterial(i, "quantity", v ?? 1)
                      }
                      min={1}
                      dense
                    />
                  </div>
                </div>
              </ArrayRow>
            ))}
          </div>
        )}
      </Section>

      <MediaSection image={recipe.image} onImageChange={(v) => patch({ image: v })} getPrompt={(style: ArtStyle) => {
        const preamble = getPreamble(style, "worldbuilding");
        return style === "gentle_magic"
          ? `${preamble}\n\nStill life of a crafted creation called "${recipe.displayName}" — a warmly glowing artifact resting on a soft surface, gentle ambient light diffusing around it, floating motes of gold, lavender and pale blue tones, dreamlike quality, painterly, centered composition`
          : `${preamble}\n\nStill life of a crafted creation called "${recipe.displayName}" — a luminous artifact emerging from baroque scrollwork, aurum-gold energy threads weaving through its form, deep indigo background, painterly, centered composition`;
      }} assetType="entity_portrait" context={zoneId ? { zone: zoneId, entity_type: "recipe", entity_id: recipeId } : undefined} />
      <DeleteEntityButton onClick={handleDelete} label="Delete Recipe" />
    </>
  );
}
