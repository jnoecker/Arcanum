import { useCallback } from "react";
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
  EntityHeader,
  FieldGrid,
  CompactField,
  ArrayRow,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton } from "./EditorShared";
import { ReputationGateEditor } from "./ReputationGateEditor";
import { useConfigStore } from "@/stores/configStore";
import { useConfigOptions } from "@/lib/useConfigOptions";

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
  { value: "gather", label: "Gather" },
  { value: "craft", label: "Craft" },
  { value: "dungeon", label: "Dungeon" },
  { value: "pvpKill", label: "PvP Kill" },
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
  const completionOptions = useConfigOptions(completionTypes, FALLBACK_COMPLETION_OPTIONS);

  const objectiveTypes = useConfigStore((s) => s.config?.questObjectiveTypes);
  const objectiveTypeOptions = useConfigOptions(objectiveTypes, FALLBACK_OBJECTIVE_TYPES);

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
      const hasReward = (next.xp ?? 0) > 0 || (next.gold ?? 0) > 0 || (next.currencies && Object.keys(next.currencies).length > 0);
      patch({ rewards: hasReward ? next : undefined });
    },
    [rewards, patch],
  );

  return (
    <>
      <EntityHeader type="Quest">
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
      </EntityHeader>

      <Section title="Basics">
        <FieldGrid>
          <CompactField label="Giver (mob)">
            <SelectInput
              value={quest.giver}
              options={zoneMobs}
              onCommit={(v) => patch({ giver: v })}
              placeholder="— select mob —"
              dense
            />
          </CompactField>
          <CompactField label="Completion">
            <SelectInput
              value={quest.completionType ?? "AUTO"}
              options={completionOptions}
              onCommit={(v) => patch({ completionType: v })}
              dense
            />
          </CompactField>
          <CompactField
            label="Intended level"
            hint="When set, XP reward diminishes if the player has out-levelled the quest."
          >
            <NumberInput
              value={quest.level}
              onCommit={(v) => patch({ level: v && v > 0 ? v : undefined })}
              placeholder="—"
              min={1}
              dense
            />
          </CompactField>
        </FieldGrid>
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
              <ArrayRow key={i} index={i} onRemove={() => handleDeleteObjective(i)}>
                <FieldGrid>
                  <CompactField label="Type">
                    <SelectInput
                      value={obj.type}
                      options={objectiveTypeOptions}
                      onCommit={(v) => handleUpdateObjective(i, "type", v)}
                      dense
                    />
                  </CompactField>
                  <CompactField label="Target">
                    <TextInput
                      value={obj.targetKey}
                      onCommit={(v) => handleUpdateObjective(i, "targetKey", v)}
                      placeholder="mob/item ID"
                      dense
                    />
                  </CompactField>
                </FieldGrid>
                <FieldGrid>
                  <CompactField label="Count">
                    <NumberInput
                      value={obj.count}
                      onCommit={(v) => handleUpdateObjective(i, "count", v ?? 1)}
                      min={1}
                      dense
                    />
                  </CompactField>
                  <CompactField label="Description">
                    <TextInput
                      value={obj.description ?? ""}
                      onCommit={(v) => handleUpdateObjective(i, "description", v)}
                      placeholder={
                        obj.type && obj.targetKey
                          ? `${obj.type.toLowerCase()} ${obj.targetKey} x${obj.count ?? 1}`
                          : "Optional"
                      }
                      dense
                    />
                  </CompactField>
                </FieldGrid>
              </ArrayRow>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rewards" defaultExpanded={false}>
        <FieldGrid>
          <CompactField label="XP">
            <NumberInput
              value={rewards.xp}
              onCommit={(v) => handleRewardChange("xp", v)}
              placeholder="0"
              min={0}
              dense
            />
          </CompactField>
          <CompactField label="Gold">
            <NumberInput
              value={rewards.gold}
              onCommit={(v) => handleRewardChange("gold", v)}
              placeholder="0"
              min={0}
              dense
            />
          </CompactField>
        </FieldGrid>
        <div className="mt-2">
          <FieldRow label="Currencies" hint="Secondary currency rewards (e.g. quest_points, honor)">
            <div className="flex flex-col gap-1">
              {Object.entries(rewards.currencies ?? {}).map(([key, amount]) => (
                <div key={key} className="flex items-center gap-2">
                  <TextInput
                    value={key}
                    onCommit={(newKey) => {
                      const next = { ...rewards.currencies };
                      const val = next[key];
                      delete next[key];
                      if (newKey) next[newKey] = val ?? 0;
                      patch({ rewards: { ...rewards, currencies: Object.keys(next).length > 0 ? next : undefined } });
                    }}
                    placeholder="currency key"
                  />
                  <NumberInput
                    value={amount as number}
                    onCommit={(v) => {
                      const next = { ...(rewards.currencies ?? {}), [key]: v ?? 0 };
                      patch({ rewards: { ...rewards, currencies: next } });
                    }}
                  />
                  <IconButton
                    onClick={() => {
                      const next = { ...rewards.currencies };
                      delete next[key];
                      patch({ rewards: { ...rewards, currencies: Object.keys(next).length > 0 ? next : undefined } });
                    }}
                    title="Remove"
                  >
                    &times;
                  </IconButton>
                </div>
              ))}
              <button
                onClick={() => {
                  const next = { ...(rewards.currencies ?? {}), "": 0 };
                  patch({ rewards: { ...rewards, currencies: next } });
                }}
                className="self-start rounded border border-border-default px-2 py-0.5 text-2xs text-text-secondary hover:bg-bg-tertiary"
              >
                + Add currency
              </button>
            </div>
          </FieldRow>
        </div>
      </Section>

      <ReputationGateEditor
        value={quest.requiredReputation}
        onChange={(v) => patch({ requiredReputation: v })}
        hint="Giver won't offer the quest to players who fail this gate."
      />

      <DeleteEntityButton onClick={handleDelete} label="Delete Quest" />
    </>
  );
}
