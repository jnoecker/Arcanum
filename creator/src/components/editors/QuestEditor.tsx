import { useCallback, useMemo } from "react";
import type {
  WorldFile,
  QuestFile,
  QuestObjectiveFile,
  QuestRewardsFile,
} from "@/types/world";
import { updateQuest, deleteQuest } from "@/lib/zoneEdits";
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

interface QuestEditorProps {
  questId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const FALLBACK_COMPLETION_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "npc_turn_in", label: "NPC Turn-in" },
];

const FALLBACK_OBJECTIVE_TYPES = [
  { value: "kill", label: "Kill" },
  { value: "collect", label: "Collect" },
];

export function QuestEditor({
  questId,
  world,
  onWorldChange,
  onDelete,
}: QuestEditorProps) {
  const { entity: quest, patch, handleDelete } = useEntityEditor<QuestFile>(
    world,
    questId,
    (w) => w.quests?.[questId],
    updateQuest,
    deleteQuest,
    onWorldChange,
    onDelete,
  );
  const completionTypes = useConfigStore((s) => s.config?.questCompletionTypes);
  const completionOptions = useMemo(() => {
    if (completionTypes && Object.keys(completionTypes).length > 0) {
      return Object.entries(completionTypes).map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_COMPLETION_OPTIONS;
  }, [completionTypes]);

  const objectiveTypes = useConfigStore((s) => s.config?.questObjectiveTypes);
  const objectiveTypeOptions = useMemo(() => {
    if (objectiveTypes && Object.keys(objectiveTypes).length > 0) {
      return Object.entries(objectiveTypes).map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_OBJECTIVE_TYPES;
  }, [objectiveTypes]);

  if (!quest) return null;

  const zoneMobs = Object.entries(world.mobs ?? {}).map(([id, m]) => ({
    value: id,
    label: `${m.name} (${id})`,
  }));

  // ─── Objective helpers ────────────────────────────────────────
  const {
    items: objectives,
    add: handleAddObjective,
    update: handleUpdateObjective,
    remove: handleDeleteObjective,
  } = useArrayField<QuestObjectiveFile>(
    quest.objectives,
    (objectives) => patch({ objectives }),
    { type: "KILL", targetKey: "", count: 1 },
    true, // clear to undefined when empty
  );

  // ─── Rewards helpers ──────────────────────────────────────────
  const rewards = quest.rewards ?? {};

  const handleRewardChange = useCallback(
    (field: keyof QuestRewardsFile, value: number | undefined) => {
      const next: QuestRewardsFile = { ...rewards, [field]: value };
      const hasReward = (next.xp ?? 0) > 0 || (next.gold ?? 0) > 0;
      patch({ rewards: hasReward ? next : undefined });
    },
    [rewards, patch],
  );

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Name">
            <TextInput value={quest.name} onCommit={(v) => patch({ name: v })} />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={quest.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="None"
            />
          </FieldRow>
          <FieldRow label="Giver (mob)">
            <SelectInput
              value={quest.giver}
              options={zoneMobs}
              onCommit={(v) => patch({ giver: v })}
              placeholder="— select mob —"
            />
          </FieldRow>
          <FieldRow label="Completion">
            <SelectInput
              value={quest.completionType ?? "AUTO"}
              options={completionOptions}
              onCommit={(v) => patch({ completionType: v })}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Objectives (${objectives.length})`}
        actions={
          <IconButton onClick={handleAddObjective} title="Add objective">
            +
          </IconButton>
        }
      >
        {objectives.length === 0 ? (
          <p className="text-xs text-text-muted">No objectives</p>
        ) : (
          <div className="flex flex-col gap-2">
            {objectives.map((obj, i) => (
              <div
                key={i}
                className="rounded border border-border-muted p-1.5"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-2xs font-medium text-text-muted">
                    #{i + 1}
                  </span>
                  <IconButton
                    onClick={() => handleDeleteObjective(i)}
                    title="Remove objective"
                    danger
                  >
                    &times;
                  </IconButton>
                </div>
                <div className="flex flex-col gap-1">
                  <FieldRow label="Type">
                    <SelectInput
                      value={obj.type}
                      options={objectiveTypeOptions}
                      onCommit={(v) => handleUpdateObjective(i, "type", v)}
                    />
                  </FieldRow>
                  <FieldRow label="Target">
                    <TextInput
                      value={obj.targetKey}
                      onCommit={(v) =>
                        handleUpdateObjective(i, "targetKey", v)
                      }
                      placeholder="mob/item ID"
                    />
                  </FieldRow>
                  <FieldRow label="Count">
                    <NumberInput
                      value={obj.count}
                      onCommit={(v) =>
                        handleUpdateObjective(i, "count", v ?? 1)
                      }
                      min={1}
                    />
                  </FieldRow>
                  <FieldRow label="Description">
                    <TextInput
                      value={obj.description ?? ""}
                      onCommit={(v) =>
                        handleUpdateObjective(i, "description", v)
                      }
                      placeholder="Optional"
                    />
                  </FieldRow>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rewards" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="XP">
            <NumberInput
              value={rewards.xp}
              onCommit={(v) => handleRewardChange("xp", v)}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Gold">
            <NumberInput
              value={rewards.gold}
              onCommit={(v) => handleRewardChange("gold", v)}
              placeholder="0"
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <DeleteEntityButton onClick={handleDelete} label="Delete Quest" />
    </>
  );
}
