import { useMemo } from "react";
import type { WorldFile, GatheringNodeFile, GatheringYieldFile } from "@/types/world";
import { updateGatheringNode, deleteGatheringNode } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton } from "./EditorShared";
import { useConfigStore } from "@/stores/configStore";

interface GatheringNodeEditorProps {
  nodeId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
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
  const gatheringSkillOptions = useMemo(() => {
    if (craftingSkills && Object.keys(craftingSkills).length > 0) {
      return Object.entries(craftingSkills)
        .filter(([, def]) => def.type === "gathering")
        .map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_GATHERING_SKILLS;
  }, [craftingSkills]);

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

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
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
              placeholder="Auto"
            />
          </FieldRow>
          <FieldRow label="Skill">
            <SelectInput
              value={node.skill}
              options={gatheringSkillOptions}
              onCommit={(v) => patch({ skill: v })}
            />
          </FieldRow>
          <FieldRow label="Skill Req.">
            <NumberInput
              value={node.skillRequired}
              onCommit={(v) => patch({ skillRequired: v })}
              placeholder="1"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput
              value={node.room}
              options={rooms}
              onCommit={(v) => patch({ room: v })}
            />
          </FieldRow>
          <FieldRow label="Respawn (s)">
            <NumberInput
              value={node.respawnSeconds}
              onCommit={(v) => patch({ respawnSeconds: v })}
              placeholder="60"
              min={1}
            />
          </FieldRow>
          <FieldRow label="XP Reward">
            <NumberInput
              value={node.xpReward}
              onCommit={(v) => patch({ xpReward: v })}
              placeholder="10"
              min={0}
            />
          </FieldRow>
        </div>
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
              <div
                key={i}
                className="rounded border border-border-muted p-1.5"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-2xs font-medium text-text-muted">
                    #{i + 1}
                  </span>
                  <IconButton
                    onClick={() => handleDeleteYield(i)}
                    title="Remove yield"
                    danger
                  >
                    &times;
                  </IconButton>
                </div>
                <div className="flex flex-col gap-1">
                  <FieldRow label="Item ID">
                    <TextInput
                      value={y.itemId}
                      onCommit={(v) => handleUpdateYield(i, "itemId", v)}
                      placeholder="item_id"
                    />
                  </FieldRow>
                  <FieldRow label="Min Qty">
                    <NumberInput
                      value={y.minQuantity}
                      onCommit={(v) =>
                        handleUpdateYield(i, "minQuantity", v ?? 1)
                      }
                      min={1}
                    />
                  </FieldRow>
                  <FieldRow label="Max Qty">
                    <NumberInput
                      value={y.maxQuantity}
                      onCommit={(v) =>
                        handleUpdateYield(i, "maxQuantity", v ?? 1)
                      }
                      min={1}
                    />
                  </FieldRow>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <DeleteEntityButton onClick={handleDelete} label="Delete Gathering Node" />
    </>
  );
}
