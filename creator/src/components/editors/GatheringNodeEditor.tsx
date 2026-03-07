import { useCallback } from "react";
import type { WorldFile, GatheringNodeFile, GatheringYieldFile } from "@/types/world";
import { updateGatheringNode, deleteGatheringNode } from "@/lib/zoneEdits";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

interface GatheringNodeEditorProps {
  zoneId: string;
  nodeId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const GATHERING_SKILLS = [
  { value: "MINING", label: "Mining" },
  { value: "HERBALISM", label: "Herbalism" },
];

export function GatheringNodeEditor({
  zoneId: _zoneId,
  nodeId,
  world,
  onWorldChange,
  onDelete,
}: GatheringNodeEditorProps) {
  const node = world.gatheringNodes?.[nodeId];
  if (!node) return null;

  const rooms = Object.keys(world.rooms).map((r) => ({
    value: r,
    label: r,
  }));

  const patch = useCallback(
    (p: Partial<GatheringNodeFile>) =>
      onWorldChange(updateGatheringNode(world, nodeId, p)),
    [world, nodeId, onWorldChange],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(deleteGatheringNode(world, nodeId));
    onDelete();
  }, [world, nodeId, onWorldChange, onDelete]);

  // ─── Yield helpers ────────────────────────────────────────────
  const {
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
              placeholder="auto"
            />
          </FieldRow>
          <FieldRow label="Skill">
            <SelectInput
              value={node.skill}
              options={GATHERING_SKILLS}
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
                  <span className="text-[10px] font-medium text-text-muted">
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

      <div className="px-4 py-3">
        <button
          onClick={handleDelete}
          className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
        >
          Delete Gathering Node
        </button>
      </div>
    </>
  );
}
