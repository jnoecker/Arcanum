import { useMemo } from "react";
import type { WorldFile, GatheringNodeFile, GatheringYieldFile, RareYieldFile } from "@/types/world";
import { updateGatheringNode, deleteGatheringNode } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import { useConfigOptions } from "@/lib/useConfigOptions";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
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
import { gatheringNodePrompt, gatheringNodeContext } from "@/lib/entityPrompts";
import { keywordFromId } from "@/lib/sanitizeZone";
import { useConfigStore } from "@/stores/configStore";
import { useVibeStore } from "@/stores/vibeStore";

interface GatheringNodeEditorProps {
  nodeId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

const FALLBACK_GATHERING_SKILLS = [
  { value: "mining", label: "Mining" },
  { value: "herbalism", label: "Herbalism" },
];

export function GatheringNodeEditor({
  nodeId,
  world,
  onWorldChange,
  onDelete,
  zoneId,
}: GatheringNodeEditorProps) {
  const { entity: node, patch, handleDelete, rooms } =
    useEntityEditor<GatheringNodeFile>(
      world,
      nodeId,
      (w) => w.gatheringNodes?.[nodeId],
      updateGatheringNode,
      deleteGatheringNode,
      onWorldChange,
      onDelete,
    );

  const craftingSkills = useConfigStore((s) => s.config?.craftingSkills);
  const gatheringSkills = useMemo(() => {
    if (!craftingSkills) return undefined;
    const filtered: Record<string, typeof craftingSkills[string]> = {};
    for (const [id, def] of Object.entries(craftingSkills)) {
      if (def.type === "gathering") filtered[id] = def;
    }
    return Object.keys(filtered).length > 0 ? filtered : undefined;
  }, [craftingSkills]);
  const gatheringSkillOptions = useConfigOptions(gatheringSkills, FALLBACK_GATHERING_SKILLS);

  if (!node) return null;

  // ─── Yield helpers ────────────────────────────────────────────
  const {
    items: yields,
    add: handleAddYield,
    update: handleUpdateYield,
    remove: handleDeleteYield,
  } = useArrayField<GatheringYieldFile>(
    node.yields,
    (yields) => patch({ yields }),
    { itemId: "", minQuantity: 1, maxQuantity: 1 },
  );

  const {
    items: rareYields,
    add: handleAddRare,
    update: handleUpdateRare,
    remove: handleDeleteRare,
  } = useArrayField<RareYieldFile>(
    node.rareYields ?? [],
    (ry) => patch({ rareYields: ry && ry.length > 0 ? ry : undefined }),
    { itemId: "", quantity: 1, dropChance: 0.1 },
  );

  return (
    <>
      <EntityHeader type="Gathering Node">
        <FieldRow label="Display Name">
          <TextInput
            value={node.displayName}
            onCommit={(v) => patch({ displayName: v })}
          />
        </FieldRow>
        <FieldRow label="Keyword">
          <TextInput
            value={node.keyword ?? ""}
            onCommit={(v) => patch({ keyword: v || undefined })}
            placeholder={keywordFromId(nodeId)}
          />
        </FieldRow>
        <FieldRow label="Room">
          <SelectInput
            value={node.room}
            options={rooms}
            onCommit={(v) => patch({ room: v })}
          />
        </FieldRow>
      </EntityHeader>

      <Section title="Mechanics">
        <FieldGrid>
          <CompactField label="Skill">
            <SelectInput
              value={node.skill}
              options={gatheringSkillOptions}
              onCommit={(v) => patch({ skill: v })}
              dense
            />
          </CompactField>
          <CompactField label="Skill Req.">
            <NumberInput
              value={node.skillRequired}
              onCommit={(v) => patch({ skillRequired: v })}
              placeholder="1"
              min={1}
              dense
            />
          </CompactField>
          <CompactField label="Respawn (s)">
            <NumberInput
              value={node.respawnSeconds}
              onCommit={(v) => patch({ respawnSeconds: v })}
              placeholder="60"
              min={1}
              dense
            />
          </CompactField>
          <CompactField label="XP Reward">
            <NumberInput
              value={node.xpReward}
              onCommit={(v) => patch({ xpReward: v })}
              placeholder="10"
              min={0}
              dense
            />
          </CompactField>
        </FieldGrid>
      </Section>

      <Section
        title={`Yields (${yields.length})`}
        defaultExpanded={false}
        actions={
          <IconButton onClick={handleAddYield} title="Add yield">+</IconButton>
        }
      >
        {yields.length === 0 ? (
          <p className="text-xs text-text-muted">No yields</p>
        ) : (
          <div className="flex flex-col gap-2">
            {yields.map((y, i) => (
              <ArrayRow key={i} index={i} onRemove={() => handleDeleteYield(i)}>
                <FieldGrid cols={3}>
                  <CompactField label="Item ID" span>
                    <TextInput
                      value={y.itemId}
                      onCommit={(v) => handleUpdateYield(i, "itemId", v)}
                      placeholder="item_id"
                      dense
                    />
                  </CompactField>
                  <CompactField label="Min Qty">
                    <NumberInput
                      value={y.minQuantity}
                      onCommit={(v) => handleUpdateYield(i, "minQuantity", v ?? 1)}
                      min={1}
                      dense
                    />
                  </CompactField>
                  <CompactField label="Max Qty">
                    <NumberInput
                      value={y.maxQuantity}
                      onCommit={(v) => handleUpdateYield(i, "maxQuantity", v ?? 1)}
                      min={1}
                      dense
                    />
                  </CompactField>
                </FieldGrid>
              </ArrayRow>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Rare Yields (${rareYields.length})`}
        defaultExpanded={false}
        actions={
          <IconButton onClick={handleAddRare} title="Add rare yield">+</IconButton>
        }
      >
        {rareYields.length === 0 ? (
          <p className="text-xs text-text-muted">No rare yields. These have a chance to drop alongside normal yields.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rareYields.map((y, i) => (
              <ArrayRow key={i} index={i} onRemove={() => handleDeleteRare(i)}>
                <FieldGrid cols={3}>
                  <CompactField label="Item ID" span>
                    <TextInput value={y.itemId} onCommit={(v) => handleUpdateRare(i, "itemId", v)} placeholder="item_id" dense />
                  </CompactField>
                  <CompactField label="Quantity">
                    <NumberInput value={y.quantity} onCommit={(v) => handleUpdateRare(i, "quantity", v ?? 1)} min={1} dense />
                  </CompactField>
                  <CompactField label="Drop Chance">
                    <NumberInput value={y.dropChance} onCommit={(v) => handleUpdateRare(i, "dropChance", v ?? 0.1)} min={0} max={1} step={0.01} dense />
                  </CompactField>
                </FieldGrid>
              </ArrayRow>
            ))}
          </div>
        )}
      </Section>

      <MediaSection
        image={node.image}
        onImageChange={(v) => patch({ image: v })}
        getPrompt={(style) => gatheringNodePrompt(nodeId, node, style)}
        entityContext={gatheringNodeContext(nodeId, node)}
        assetType="gathering_node"
        context={zoneId ? { zone: zoneId, entity_type: "gatheringNode", entity_id: nodeId } : undefined}
        vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
      />
      <DeleteEntityButton onClick={handleDelete} label="Delete Gathering Node" />
    </>
  );
}
