import { useCallback } from "react";
import type { WorldFile, MobFile, MobDropFile } from "@/types/world";
import { updateMob, deleteMob } from "@/lib/zoneEdits";
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
import { DialogueEditor } from "./DialogueEditor";
import { DeleteEntityButton, MediaSection } from "./EditorShared";
import { mobPrompt } from "@/lib/entityPrompts";

interface MobEditorProps {
  mobId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const TIER_OPTIONS = [
  { value: "weak", label: "Weak" },
  { value: "standard", label: "Standard" },
  { value: "elite", label: "Elite" },
  { value: "boss", label: "Boss" },
];

const BEHAVIOR_TEMPLATES = [
  { value: "", label: "— none —" },
  { value: "PATROL", label: "Patrol" },
  { value: "WANDER", label: "Wander" },
  { value: "AGGRESSIVE", label: "Aggressive" },
  { value: "FLEE_LOW_HP", label: "Flee Low HP" },
  { value: "STATIC", label: "Static" },
];

export function MobEditor({
  mobId,
  world,
  onWorldChange,
  onDelete,
}: MobEditorProps) {
  const { entity: mob, patch, handleDelete, rooms } = useEntityEditor<MobFile>(
    world,
    mobId,
    (w) => w.mobs?.[mobId],
    updateMob,
    deleteMob,
    onWorldChange,
    onDelete,
  );
  if (!mob) return null;

  const zoneQuests = Object.entries(world.quests ?? {}).map(([id, q]) => ({
    id,
    name: q.name,
  }));

  // ─── Drop helpers ──────────────────────────────────────────────
  const {
    add: handleAddDrop,
    update: handleUpdateDrop,
    remove: handleDeleteDrop,
  } = useArrayField<MobDropFile>(
    mob.drops,
    (drops) => patch({ drops }),
    { itemId: "", chance: 100 },
  );

  // ─── Behavior helpers ─────────────────────────────────────────
  const handleBehaviorTemplate = useCallback(
    (template: string) => {
      if (!template) {
        patch({ behavior: undefined });
      } else {
        const existing = mob.behavior?.params ?? {};
        patch({ behavior: { template, params: existing } });
      }
    },
    [mob.behavior, patch],
  );

  // ─── Quest assignment ─────────────────────────────────────────
  const handleToggleQuest = useCallback(
    (questId: string) => {
      const current = mob.quests ?? [];
      const quests = current.includes(questId)
        ? current.filter((q) => q !== questId)
        : [...current, questId];
      patch({ quests: quests.length > 0 ? quests : undefined });
    },
    [mob.quests, patch],
  );

  return (
    <>
      {/* Core fields */}
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Name">
            <TextInput value={mob.name} onCommit={(v) => patch({ name: v })} />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput
              value={mob.room}
              options={rooms}
              onCommit={(v) => patch({ room: v })}
            />
          </FieldRow>
          <FieldRow label="Tier">
            <SelectInput
              value={mob.tier ?? "standard"}
              options={TIER_OPTIONS}
              onCommit={(v) => patch({ tier: v })}
            />
          </FieldRow>
          <FieldRow label="Level">
            <NumberInput
              value={mob.level}
              onCommit={(v) => patch({ level: v })}
              placeholder="1"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Respawn (s)">
            <NumberInput
              value={mob.respawnSeconds}
              onCommit={(v) => patch({ respawnSeconds: v })}
              placeholder="default"
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      {/* Stat overrides */}
      <Section title="Stat Overrides">
        <p className="mb-1 text-[10px] text-text-muted">
          Leave blank to use tier defaults
        </p>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="HP">
            <NumberInput
              value={mob.hp}
              onCommit={(v) => patch({ hp: v })}
              placeholder="auto"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Min Damage">
            <NumberInput
              value={mob.minDamage}
              onCommit={(v) => patch({ minDamage: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Max Damage">
            <NumberInput
              value={mob.maxDamage}
              onCommit={(v) => patch({ maxDamage: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Armor">
            <NumberInput
              value={mob.armor}
              onCommit={(v) => patch({ armor: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
          <FieldRow label="XP Reward">
            <NumberInput
              value={mob.xpReward}
              onCommit={(v) => patch({ xpReward: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Gold Min">
            <NumberInput
              value={mob.goldMin}
              onCommit={(v) => patch({ goldMin: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Gold Max">
            <NumberInput
              value={mob.goldMax}
              onCommit={(v) => patch({ goldMax: v })}
              placeholder="auto"
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      {/* Drops */}
      <Section
        title={`Drops (${mob.drops?.length ?? 0})`}
        actions={
          <IconButton onClick={handleAddDrop} title="Add drop">+</IconButton>
        }
      >
        {(mob.drops ?? []).length === 0 ? (
          <p className="text-xs text-text-muted">No drops</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(mob.drops ?? []).map((drop, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={drop.itemId}
                    onCommit={(v) => handleUpdateDrop(i, "itemId", v)}
                    placeholder="item_id"
                  />
                </div>
                <div className="w-16 shrink-0">
                  <NumberInput
                    value={drop.chance}
                    onCommit={(v) =>
                      handleUpdateDrop(i, "chance", v ?? 100)
                    }
                    min={0}
                    max={100}
                  />
                </div>
                <span className="text-[10px] text-text-muted">%</span>
                <IconButton
                  onClick={() => handleDeleteDrop(i)}
                  title="Remove drop"
                  danger
                >
                  &times;
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Behavior */}
      <Section title="Behavior">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Template">
            <SelectInput
              value={mob.behavior?.template ?? ""}
              options={BEHAVIOR_TEMPLATES}
              onCommit={handleBehaviorTemplate}
            />
          </FieldRow>
          {mob.behavior?.template === "PATROL" && (
            <FieldRow label="Patrol Route">
              <TextInput
                value={(mob.behavior.params?.patrolRoute ?? []).join(", ")}
                onCommit={(v) => {
                  const route = v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  patch({
                    behavior: {
                      ...mob.behavior!,
                      params: { ...mob.behavior!.params, patrolRoute: route },
                    },
                  });
                }}
                placeholder="room1, room2, room3"
              />
            </FieldRow>
          )}
          {mob.behavior?.template === "FLEE_LOW_HP" && (
            <FieldRow label="Flee HP %">
              <NumberInput
                value={mob.behavior.params?.fleeHpPercent ?? 20}
                onCommit={(v) =>
                  patch({
                    behavior: {
                      ...mob.behavior!,
                      params: { ...mob.behavior!.params, fleeHpPercent: v },
                    },
                  })
                }
                min={1}
                max={99}
              />
            </FieldRow>
          )}
          {mob.behavior?.template === "WANDER" && (
            <FieldRow label="Max Distance">
              <NumberInput
                value={mob.behavior.params?.maxWanderDistance ?? 3}
                onCommit={(v) =>
                  patch({
                    behavior: {
                      ...mob.behavior!,
                      params: { ...mob.behavior!.params, maxWanderDistance: v },
                    },
                  })
                }
                min={1}
              />
            </FieldRow>
          )}
          {mob.behavior && (
            <>
              <FieldRow label="Aggro Msg">
                <TextInput
                  value={mob.behavior.params?.aggroMessage ?? ""}
                  onCommit={(v) =>
                    patch({
                      behavior: {
                        ...mob.behavior!,
                        params: {
                          ...mob.behavior!.params,
                          aggroMessage: v || undefined,
                        },
                      },
                    })
                  }
                  placeholder="optional"
                />
              </FieldRow>
              <FieldRow label="Flee Msg">
                <TextInput
                  value={mob.behavior.params?.fleeMessage ?? ""}
                  onCommit={(v) =>
                    patch({
                      behavior: {
                        ...mob.behavior!,
                        params: {
                          ...mob.behavior!.params,
                          fleeMessage: v || undefined,
                        },
                      },
                    })
                  }
                  placeholder="optional"
                />
              </FieldRow>
            </>
          )}
        </div>
      </Section>

      {/* Quest assignment */}
      {zoneQuests.length > 0 && (
        <Section title="Quests">
          <div className="flex flex-col gap-0.5">
            {zoneQuests.map((q) => (
              <label
                key={q.id}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary"
              >
                <input
                  type="checkbox"
                  checked={(mob.quests ?? []).includes(q.id)}
                  onChange={() => handleToggleQuest(q.id)}
                  className="accent-accent"
                />
                {q.name || q.id}
              </label>
            ))}
          </div>
        </Section>
      )}

      {/* Dialogue */}
      <DialogueEditor
        mobId={mobId}
        world={world}
        onWorldChange={onWorldChange}
      />

      <MediaSection image={mob.image} onImageChange={(v) => patch({ image: v })} getPrompt={(style) => mobPrompt(mobId, mob, style)} />
      <DeleteEntityButton onClick={handleDelete} label="Delete Mob" />
    </>
  );
}
