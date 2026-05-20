import { useCallback, useMemo, useState } from "react";
import type { WorldFile, MobFile, MobDropFile, MobSpellFile, MobRole, SpawnEntry } from "@/types/world";
import { MOB_ROLES, MOB_ROLE_LABELS, MOB_ROLE_DESCRIPTIONS } from "@/types/world";
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
  EntityHeader,
  FieldGrid,
  CompactField,
  ArrayRow,
  TabBar,
} from "@/components/ui/FormWidgets";
import { DialogueEditor } from "./DialogueEditor";
import { DeleteEntityButton, EnhanceDescriptionButton, MediaSection } from "./EditorShared";
import { mobPrompt, mobContext } from "@/lib/entityPrompts";
import { useVibeStore } from "@/stores/vibeStore";
import { useConfigStore } from "@/stores/configStore";
import { resolveMobStats } from "@/lib/resolveMobStats";
import {
  TOUGHNESS_STEPS,
  TOUGHNESS_PROFILES,
  inferToughness,
  toughnessPatch,
} from "@/lib/mobToughness";
import { CATEGORY_ICONS } from "@/assets/ui";
import { QuestPicker, QuestRefBadge } from "@/components/config/panels/QuestPicker";
import { useConfigOptions } from "@/lib/useConfigOptions";
import { getTrainerClasses, setTrainerClasses } from "@/lib/trainers";

interface MobEditorProps {
  mobId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

const TIER_OPTIONS = [
  { value: "weak", label: "Weak" },
  { value: "standard", label: "Standard" },
  { value: "elite", label: "Elite" },
  { value: "boss", label: "Boss" },
];

const ROLE_OPTIONS = MOB_ROLES.map((r) => ({ value: r, label: MOB_ROLE_LABELS[r] }));

const FALLBACK_TRAINER_CLASSES = [
  { value: "WARRIOR", label: "Warrior" },
  { value: "MAGE", label: "Mage" },
  { value: "CLERIC", label: "Cleric" },
  { value: "ROGUE", label: "Rogue" },
];

function fieldLabel(
  base: string,
  stat: { tierDefault: number; overridden: boolean } | undefined,
): string {
  if (!stat || !stat.overridden) return base;
  return `${base} (tier default: ${stat.tierDefault})`;
}

function fieldPlaceholder(stat: { tierDefault: number } | undefined): string {
  return stat ? String(stat.tierDefault) : "Auto";
}

const CATEGORY_OPTIONS = [
  { value: "humanoid", label: "Humanoid" },
  { value: "beast", label: "Beast" },
  { value: "undead", label: "Undead" },
  { value: "elemental", label: "Elemental" },
  { value: "construct", label: "Construct" },
  { value: "aberration", label: "Aberration" },
];

// Mirrors the server's BehaviorTemplates registry. Match case-insensitively
// for legacy YAML that used uppercase values.
const BEHAVIOR_TEMPLATES = [
  { value: "", label: "— none —" },
  { value: "aggro_guard", label: "Aggro Guard" },
  { value: "patrol", label: "Patrol" },
  { value: "patrol_aggro", label: "Patrol + Aggro" },
  { value: "wander", label: "Wander" },
  { value: "wander_aggro", label: "Wander + Aggro" },
  { value: "coward", label: "Coward (flee)" },
];

const TEMPLATES_WITH_PATROL_ROUTE = new Set(["patrol", "patrol_aggro"]);
const TEMPLATES_WITH_WANDER_DISTANCE = new Set(["wander", "wander_aggro", "coward"]);
const TEMPLATES_WITH_AGGRO_MSG = new Set(["aggro_guard", "patrol_aggro", "wander_aggro"]);
const TEMPLATES_WITH_FLEE = new Set(["coward"]);

type MobTab = "mob" | "rewards" | "dialogue" | "media";
const MOB_TABS: readonly { value: MobTab; label: string }[] = [
  { value: "mob", label: "Mob" },
  { value: "rewards", label: "Rewards" },
  { value: "dialogue", label: "Dialogue" },
  { value: "media", label: "Media" },
] as const;

export function MobEditor({
  mobId,
  world,
  onWorldChange,
  onDelete,
  zoneId,
}: MobEditorProps) {
  const [activeTab, setActiveTab] = useState<MobTab>("mob");
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

  const role: MobRole = mob.role ?? "combat";
  const isCombatant = role === "combat";
  const isTrainer = role === "trainer";
  const requiresUniqueSpawn = role === "quest_giver";
  const spawns = mob.spawns ?? [];

  const handleAddSpawn = useCallback(() => {
    const fallback = rooms[0]?.value ?? "";
    const next: SpawnEntry[] = [...spawns, { room: fallback }];
    patch({ spawns: next });
  }, [spawns, rooms, patch]);

  const handleUpdateSpawnRoom = useCallback(
    (index: number, room: string) => {
      const next = spawns.map((s, i) => (i === index ? { ...s, room } : s));
      patch({ spawns: next });
    },
    [spawns, patch],
  );

  const handleUpdateSpawnCount = useCallback(
    (index: number, count: number | undefined) => {
      const next = spawns.map((s, i) => {
        if (i !== index) return s;
        if (count == null || count <= 1) {
          const { count: _drop, ...rest } = s;
          return rest;
        }
        return { ...s, count };
      });
      patch({ spawns: next });
    },
    [spawns, patch],
  );

  const handleRemoveSpawn = useCallback(
    (index: number) => {
      const next = spawns.filter((_, i) => i !== index);
      patch({ spawns: next.length > 0 ? next : undefined });
    },
    [spawns, patch],
  );

  const classConfig = useConfigStore((s) => s.config?.classes);
  const trainerClassOptions = useConfigOptions(classConfig, FALLBACK_TRAINER_CLASSES);
  const trainerClasses = useMemo(() => getTrainerClasses(mob), [mob]);
  const availableTrainerClasses = useMemo(
    () => trainerClassOptions.filter((opt) => !trainerClasses.includes(opt.value)),
    [trainerClassOptions, trainerClasses],
  );
  const handleAddTrainerClass = useCallback(
    (classId: string) => {
      if (!classId) return;
      patch(setTrainerClasses([...trainerClasses, classId]));
    },
    [trainerClasses, patch],
  );
  const handleRemoveTrainerClass = useCallback(
    (classId: string) => {
      patch(setTrainerClasses(trainerClasses.filter((c) => c !== classId)));
    },
    [trainerClasses, patch],
  );
  const handleReplaceTrainerClass = useCallback(
    (oldId: string, newId: string) => {
      patch(setTrainerClasses(trainerClasses.map((c) => (c === oldId ? newId : c))));
    },
    [trainerClasses, patch],
  );
  const trainerClassLabel = useCallback(
    (value: string): string =>
      trainerClassOptions.find((opt) => opt.value === value)?.label ?? value,
    [trainerClassOptions],
  );

  // Switching role away from trainer would leave dead trainerClasses behind;
  // clear them at the same time so the YAML stays clean.
  const handleRoleChange = useCallback(
    (next: MobRole | undefined) => {
      const wasTrainer = mob.role === "trainer";
      if (wasTrainer && next !== "trainer") {
        patch({ role: next, trainerClasses: undefined });
      } else {
        patch({ role: next });
      }
    },
    [mob.role, patch],
  );

  const visibleTabs = isCombatant
    ? MOB_TABS
    : MOB_TABS.filter((t) => t.value !== "rewards");
  const effectiveTab: MobTab = !isCombatant && activeTab === "rewards" ? "mob" : activeTab;

  const mobTiers = useConfigStore((s) => s.config?.mobTiers);
  const stats = resolveMobStats(mob, mobTiers);
  const clearAllOverrides = useCallback(() => {
    patch({
      hp: undefined,
      minDamage: undefined,
      maxDamage: undefined,
      armor: undefined,
      xpReward: undefined,
      goldMin: undefined,
      goldMax: undefined,
    });
  }, [patch]);

  const {
    add: handleAddDrop,
    update: handleUpdateDrop,
    remove: handleDeleteDrop,
  } = useArrayField<MobDropFile>(
    mob.drops,
    (drops) => patch({ drops }),
    { itemId: "", chance: 1 },
  );

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

  const handleAddQuest = useCallback(
    (questId: string) => {
      if (!questId) return;
      const current = mob.quests ?? [];
      if (current.includes(questId)) return;
      patch({ quests: [...current, questId] });
    },
    [mob.quests, patch],
  );

  const handleRemoveQuest = useCallback(
    (questId: string) => {
      const current = mob.quests ?? [];
      const next = current.filter((q) => q !== questId);
      patch({ quests: next.length > 0 ? next : undefined });
    },
    [mob.quests, patch],
  );

  const [addingSpell, setAddingSpell] = useState(false);
  const [newSpellId, setNewSpellId] = useState("");

  const spellEntries = Object.entries(mob.spells ?? {});

  const handleAddSpell = useCallback(
    (id: string) => {
      const next = { ...(mob.spells ?? {}) };
      next[id] = { displayName: "", message: "", weight: 1 };
      patch({ spells: next });
    },
    [mob.spells, patch],
  );

  const handleUpdateSpell = useCallback(
    (id: string, field: keyof MobSpellFile, value: unknown) => {
      const next = { ...(mob.spells ?? {}) };
      const existing = next[id];
      if (!existing) return;
      next[id] = { ...existing, [field]: value } as MobSpellFile;
      patch({ spells: next });
    },
    [mob.spells, patch],
  );

  const handleDeleteSpell = useCallback(
    (id: string) => {
      const next = { ...(mob.spells ?? {}) };
      delete next[id];
      const cleaned = Object.keys(next).length > 0 ? next : undefined;
      patch({
        spells: cleaned,
        defaultAttack: mob.defaultAttack === id ? undefined : mob.defaultAttack,
      });
    },
    [mob.spells, mob.defaultAttack, patch],
  );

  const handleSubmitNewSpell = useCallback(() => {
    const id = newSpellId.trim().replace(/\s+/g, "_");
    if (id && !mob.spells?.[id]) {
      handleAddSpell(id);
    }
    setNewSpellId("");
    setAddingSpell(false);
  }, [newSpellId, mob.spells, handleAddSpell]);

  return (
    <>
      <EntityHeader type="Mob">
        <TextInput value={mob.name} onCommit={(v) => patch({ name: v })} />
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <TextInput
              value={mob.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="Visual description for art generation"
            />
          </div>
          <EnhanceDescriptionButton
            entitySummary={`Mob "${mob.name}", tier: ${mob.tier ?? "standard"}, level: ${mob.level ?? 1}${mob.behavior?.template ? `, behavior: ${mob.behavior.template}` : ""}`}
            currentDescription={mob.description}
            onAccept={(v) => patch({ description: v })}
            vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
          />
        </div>
        <div className="text-xs text-text-muted">
          {spawns.length === 0
            ? "No spawn locations — set one below"
            : `${spawns.length} spawn${spawns.length === 1 ? "" : "s"} · ${spawns.reduce((n, s) => n + (s.count ?? 1), 0)} instance${spawns.reduce((n, s) => n + (s.count ?? 1), 0) === 1 ? "" : "s"}`}
        </div>
      </EntityHeader>

      <TabBar tabs={visibleTabs} active={activeTab} onChange={setActiveTab} />

      {effectiveTab === "mob" && (
        <>
          <Section
            title="Spawns"
            actions={
              !(requiresUniqueSpawn && spawns.length >= 1) && (
                <IconButton onClick={handleAddSpawn} title="Add spawn">+</IconButton>
              )
            }
          >
            {spawns.length === 0 ? (
              <p className="text-xs text-text-muted">
                No spawn locations. Add one to place this mob in the world.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {spawns.map((spawn, i) => (
                  <ArrayRow key={i} onRemove={() => handleRemoveSpawn(i)}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <SelectInput
                          value={spawn.room}
                          options={rooms}
                          onCommit={(v) => handleUpdateSpawnRoom(i, v)}
                        />
                      </div>
                      {!requiresUniqueSpawn && (
                        <>
                          <span className="text-2xs text-text-muted">×</span>
                          <div className="w-14 shrink-0">
                            <NumberInput
                              value={spawn.count ?? 1}
                              onCommit={(v) => handleUpdateSpawnCount(i, v)}
                              min={1}
                              placeholder="1"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </ArrayRow>
                ))}
              </div>
            )}
            {requiresUniqueSpawn && (
              <p className="mt-1.5 text-2xs text-text-muted">
                Quest givers are unique NPCs — only one spawn allowed.
              </p>
            )}
          </Section>

          <Section title="Basics">
            <FieldGrid>
              <CompactField label="Role" hint={MOB_ROLE_DESCRIPTIONS[role]} span>
                <SelectInput
                  value={role}
                  options={ROLE_OPTIONS}
                  onCommit={(v) =>
                    handleRoleChange(v === "combat" ? undefined : (v as MobRole))
                  }
                />
              </CompactField>
              {isCombatant && (
                <>
                  <CompactField label="Tier">
                    <SelectInput
                      value={mob.tier ?? "standard"}
                      options={TIER_OPTIONS}
                      onCommit={(v) => patch({ tier: v })}
                    />
                  </CompactField>
                  <CompactField label="Level">
                    <NumberInput
                      value={mob.level}
                      onCommit={(v) => patch({ level: v })}
                      placeholder="1"
                      min={1}
                    />
                  </CompactField>
                  <CompactField label="Respawn (s)">
                    <NumberInput
                      value={mob.respawnSeconds}
                      onCommit={(v) => patch({ respawnSeconds: v })}
                      placeholder="Default"
                      min={0}
                    />
                  </CompactField>
                </>
              )}
              <CompactField label="Category">
                <div className="flex items-center gap-1.5">
                  {CATEGORY_ICONS[mob.category ?? "humanoid"] && (
                    <img src={CATEGORY_ICONS[mob.category ?? "humanoid"]} alt="" className="h-5 w-5 shrink-0" />
                  )}
                  <SelectInput
                    value={mob.category ?? "humanoid"}
                    options={CATEGORY_OPTIONS}
                    onCommit={(v) => patch({ category: v === "humanoid" ? undefined : v })}
                  />
                </div>
              </CompactField>
              <CompactField label="Faction">
                <TextInput
                  value={mob.faction ?? ""}
                  onCommit={(v) => patch({ faction: v || undefined })}
                  placeholder="Faction ID (e.g. crimson_guild)"
                />
              </CompactField>
            </FieldGrid>
          </Section>

          {isTrainer && (
            <Section
              title="Trainer"
              description={
                trainerClasses.length > 1
                  ? "Multi-class trainer — every spawn room teaches all listed classes."
                  : trainerClasses.length === 1
                    ? "Single-class trainer. Add another class to teach more from the same rooms."
                    : "Pick at least one class. Each spawn room becomes a training room for these classes."
              }
            >
              <div className="flex flex-col gap-1.5">
                {trainerClasses.length === 0 ? (
                  <div className="text-xs italic text-text-muted">No class assigned</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {trainerClasses.map((classId) => (
                      <div
                        key={classId}
                        className="flex items-center gap-1 rounded border border-border-default bg-bg-tertiary/60 px-1 py-0.5"
                      >
                        <SelectInput
                          value={classId}
                          options={[
                            { value: classId, label: trainerClassLabel(classId) },
                            ...availableTrainerClasses,
                          ]}
                          onCommit={(v) => handleReplaceTrainerClass(classId, v)}
                        />
                        {trainerClasses.length > 1 && (
                          <IconButton
                            onClick={() => handleRemoveTrainerClass(classId)}
                            title={`Remove ${trainerClassLabel(classId)}`}
                            danger
                          >
                            ✕
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {availableTrainerClasses.length > 0 && (
                  <select
                    className="ornate-input self-start border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) handleAddTrainerClass(v);
                    }}
                  >
                    <option value="">
                      + add {trainerClasses.length === 0 ? "class" : "another class"}
                    </option>
                    {availableTrainerClasses.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Section>
          )}

          {isCombatant && stats && (
            <Section title="Combat Readout">
              <div className="flex flex-col gap-2">
                <div className="rounded border border-border-default bg-bg-tertiary px-2 py-1.5 text-xs">
                  <div className="font-medium text-text-primary">
                    HP {stats.hp.effective} · DMG {stats.minDamage.effective}–{stats.maxDamage.effective} · ARMOR {stats.armor.effective}
                  </div>
                  <div className="text-2xs text-text-muted">
                    XP {stats.xpReward.effective.toLocaleString()} · GOLD {stats.goldMin.effective}–{stats.goldMax.effective}
                  </div>
                </div>
                <ToughnessSelector
                  mob={mob}
                  onChange={(p) => patch(p)}
                />
              </div>
            </Section>
          )}

          {isCombatant && (() => {
            const templateNorm = (mob.behavior?.template ?? "").toLowerCase();
            return (
          <>
          <Section title="Behavior">
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Template">
                <SelectInput
                  value={templateNorm}
                  options={BEHAVIOR_TEMPLATES}
                  onCommit={handleBehaviorTemplate}
                />
              </FieldRow>
              {TEMPLATES_WITH_PATROL_ROUTE.has(templateNorm) && (
                <FieldRow label="Patrol Route">
                  <TextInput
                    value={(mob.behavior!.params?.patrolRoute ?? []).join(", ")}
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
              {TEMPLATES_WITH_FLEE.has(templateNorm) && (
                <FieldRow label="Flee HP %">
                  <NumberInput
                    value={mob.behavior!.params?.fleeHpPercent ?? 20}
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
              {TEMPLATES_WITH_WANDER_DISTANCE.has(templateNorm) && (
                <FieldRow label="Max Distance">
                  <NumberInput
                    value={mob.behavior!.params?.maxWanderDistance ?? 3}
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
              {TEMPLATES_WITH_AGGRO_MSG.has(templateNorm) && (
                <FieldRow label="Aggro Msg">
                  <TextInput
                    value={mob.behavior!.params?.aggroMessage ?? ""}
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
                    placeholder="Optional"
                  />
                </FieldRow>
              )}
              {TEMPLATES_WITH_FLEE.has(templateNorm) && (
                <FieldRow label="Flee Msg">
                  <TextInput
                    value={mob.behavior!.params?.fleeMessage ?? ""}
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
                    placeholder="Optional"
                  />
                </FieldRow>
              )}
            </div>
          </Section>

          <Section
            title={`Spells (${spellEntries.length})`}
            defaultExpanded={spellEntries.length > 0}
            actions={
              addingSpell ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitNewSpell();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    value={newSpellId}
                    onChange={(e) => setNewSpellId(e.target.value)}
                    placeholder="spell_id"
                    className="h-5 w-20 rounded border border-border-default bg-bg-primary px-1 text-2xs text-text-primary outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
                    onBlur={handleSubmitNewSpell}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewSpellId("");
                      setAddingSpell(false);
                    }}
                    className="text-2xs text-text-muted hover:text-text-primary"
                  >
                    &times;
                  </button>
                </form>
              ) : (
                <IconButton onClick={() => setAddingSpell(true)} title="Add spell">
                  +
                </IconButton>
              )
            }
          >
            {spellEntries.length === 0 ? (
              <p className="text-xs text-text-muted">No spells defined</p>
            ) : (
              <div className="flex flex-col gap-2">
                {spellEntries.map(([spellId, spell]) => (
                  <SpellCard
                    key={spellId}
                    spellId={spellId}
                    spell={spell}
                    onUpdate={(field, value) => handleUpdateSpell(spellId, field, value)}
                    onDelete={() => handleDeleteSpell(spellId)}
                  />
                ))}
              </div>
            )}
            <FieldRow label="Default Attack">
              <SelectInput
                value={mob.defaultAttack ?? ""}
                options={[
                  { value: "", label: "— standard melee —" },
                  ...spellEntries.map(([id, s]) => ({
                    value: id,
                    label: s.displayName || id,
                  })),
                ]}
                onCommit={(v) => patch({ defaultAttack: v || undefined })}
              />
            </FieldRow>
          </Section>

          <Section
            title={stats?.anyOverridden ? "Stat Overrides ●" : "Stat Overrides"}
            defaultExpanded={false}
            titleTooltip={
              stats
                ? "Fields follow tier × level by default. Type a value to override the curve."
                : "Set tier and level first to preview computed stats. Any value typed here overrides the curve."
            }
            actions={
              stats?.anyOverridden ? (
                <button
                  type="button"
                  onClick={clearAllOverrides}
                  className="focus-ring text-2xs text-text-muted underline underline-offset-2 hover:text-text-primary"
                  title="Remove all overrides and use tier defaults"
                >
                  Clear all
                </button>
              ) : undefined
            }
          >
            <FieldGrid>
              <CompactField label={fieldLabel("HP", stats?.hp)} span>
                <NumberInput
                  value={mob.hp}
                  onCommit={(v) => patch({ hp: v })}
                  placeholder={fieldPlaceholder(stats?.hp)}
                  min={1}
                />
              </CompactField>
              <CompactField label={fieldLabel("Min Damage", stats?.minDamage)}>
                <NumberInput
                  value={mob.minDamage}
                  onCommit={(v) => patch({ minDamage: v })}
                  placeholder={fieldPlaceholder(stats?.minDamage)}
                  min={0}
                />
              </CompactField>
              <CompactField label={fieldLabel("Max Damage", stats?.maxDamage)}>
                <NumberInput
                  value={mob.maxDamage}
                  onCommit={(v) => patch({ maxDamage: v })}
                  placeholder={fieldPlaceholder(stats?.maxDamage)}
                  min={0}
                />
              </CompactField>
              <CompactField label={fieldLabel("Armor", stats?.armor)} span>
                <NumberInput
                  value={mob.armor}
                  onCommit={(v) => patch({ armor: v })}
                  placeholder={fieldPlaceholder(stats?.armor)}
                  min={0}
                />
              </CompactField>
              <CompactField label={fieldLabel("XP Reward", stats?.xpReward)} span>
                <NumberInput
                  value={mob.xpReward}
                  onCommit={(v) => patch({ xpReward: v })}
                  placeholder={fieldPlaceholder(stats?.xpReward)}
                  min={0}
                />
              </CompactField>
              <CompactField label={fieldLabel("Gold Min", stats?.goldMin)}>
                <NumberInput
                  value={mob.goldMin}
                  onCommit={(v) => patch({ goldMin: v })}
                  placeholder={fieldPlaceholder(stats?.goldMin)}
                  min={0}
                />
              </CompactField>
              <CompactField label={fieldLabel("Gold Max", stats?.goldMax)}>
                <NumberInput
                  value={mob.goldMax}
                  onCommit={(v) => patch({ goldMax: v })}
                  placeholder={fieldPlaceholder(stats?.goldMax)}
                  min={0}
                />
              </CompactField>
            </FieldGrid>
          </Section>

          <Section
            title="Power-user Multipliers"
            defaultExpanded={false}
            titleTooltip="Raw mults applied to the tier × level baseline. Edit these directly to break out of the toughness presets."
          >
            <p className="mb-1 text-2xs text-text-muted">
              Setting any mult here puts the toughness selector into "Custom" mode.
            </p>
            <FieldGrid>
              <CompactField label="HP ×">
                <NumberInput
                  value={mob.hpMult}
                  onCommit={(v) => patch({ hpMult: v, toughness: undefined })}
                  placeholder="1.0"
                  min={0}
                  step={0.05}
                />
              </CompactField>
              <CompactField label="Damage ×">
                <NumberInput
                  value={mob.dmgMult}
                  onCommit={(v) => patch({ dmgMult: v, toughness: undefined })}
                  placeholder="1.0"
                  min={0}
                  step={0.05}
                />
              </CompactField>
              <CompactField label="XP ×">
                <NumberInput
                  value={mob.xpMult}
                  onCommit={(v) => patch({ xpMult: v, toughness: undefined })}
                  placeholder="1.0"
                  min={0}
                  step={0.05}
                />
              </CompactField>
              <CompactField label="Gold ×">
                <NumberInput
                  value={mob.goldMult}
                  onCommit={(v) => patch({ goldMult: v, toughness: undefined })}
                  placeholder="1.0"
                  min={0}
                  step={0.05}
                />
              </CompactField>
            </FieldGrid>
          </Section>
          </>
            );
          })()}
        </>
      )}

      {effectiveTab === "rewards" && isCombatant && (
        <>
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
                  <ArrayRow key={i} onRemove={() => handleDeleteDrop(i)}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <TextInput
                          value={drop.itemId}
                          onCommit={(v) => handleUpdateDrop(i, "itemId", v)}
                          placeholder="item_id"
                        />
                      </div>
                      <div className="w-16 shrink-0">
                        <NumberInput
                          value={Math.round((drop.chance ?? 1) * 100)}
                          onCommit={(v) =>
                            handleUpdateDrop(i, "chance", (v ?? 100) / 100)
                          }
                          min={0}
                          max={100}
                        />
                      </div>
                      <span className="text-2xs text-text-muted">%</span>
                    </div>
                  </ArrayRow>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Quests (${mob.quests?.length ?? 0})`}>
            <div className="flex flex-col gap-2">
              {(mob.quests ?? []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(mob.quests ?? []).map((qid) => (
                    <div key={qid} className="inline-flex items-center gap-1">
                      <QuestRefBadge questId={qid} />
                      <button
                        type="button"
                        onClick={() => handleRemoveQuest(qid)}
                        aria-label={`Remove ${qid}`}
                        className="focus-ring inline-flex h-5 w-5 items-center justify-center rounded text-text-muted/70 transition hover:bg-status-error/15 hover:text-status-error"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <QuestPicker
                value=""
                onChange={handleAddQuest}
                excludeIds={mob.quests}
                placeholder="Pick a quest this mob gives or turns in…"
                allowCreate
              />
            </div>
          </Section>
        </>
      )}

      {effectiveTab === "dialogue" && (
        <DialogueEditor
          mobId={mobId}
          world={world}
          onWorldChange={onWorldChange}
        />
      )}

      {effectiveTab === "media" && (
        <MediaSection
          image={mob.image}
          onImageChange={(v) => patch({ image: v })}
          video={mob.video}
          onVideoChange={(v) => patch({ video: v })}
          getPrompt={(style) => mobPrompt(mobId, mob, style, zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined)}
          entityContext={mobContext(mobId, mob)}
          assetType="entity_portrait"
          context={zoneId ? { zone: zoneId, entity_type: "mob", entity_id: mobId } : undefined}
          vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
        />
      )}

      <DeleteEntityButton onClick={handleDelete} label="Delete Mob" />
    </>
  );
}

// ─── Spell Card ─────────────────────────────────────────────────────

function SpellCard({
  spellId,
  spell,
  onUpdate,
  onDelete,
}: {
  spellId: string;
  spell: MobSpellFile;
  onUpdate: (field: keyof MobSpellFile, value: unknown) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-l-2 border-accent/20 pl-2.5">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 rounded text-left text-xs font-medium text-text-primary hover:text-accent"
        >
          <span
            className={`inline-block text-[8px] text-text-muted [transition:transform_220ms_var(--ease-unfurl)] ${expanded ? "rotate-90" : ""}`}
          >
            &#x25B6;
          </span>
          {spell.displayName || spellId}
        </button>
        <span className="text-2xs text-text-muted">{spellId}</span>
      </div>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <FieldRow label="Display Name">
            <TextInput
              value={spell.displayName}
              onCommit={(v) => onUpdate("displayName", v)}
              placeholder="Fireball"
            />
          </FieldRow>
          <FieldRow label="Message">
            <TextInput
              value={spell.message}
              onCommit={(v) => onUpdate("message", v)}
              placeholder="The mob hurls a bolt of darkness at you"
            />
          </FieldRow>
          <FieldRow label="Room Message">
            <TextInput
              value={spell.roomMessage ?? ""}
              onCommit={(v) => onUpdate("roomMessage", v || undefined)}
              placeholder="{mob} hurls darkness at {target}."
            />
          </FieldRow>
          <FieldRow label="Damage">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <NumberInput
                  value={spell.minDamage}
                  onCommit={(v) => onUpdate("minDamage", v)}
                  placeholder="Min"
                  min={0}
                />
              </div>
              <span className="text-2xs text-text-muted">/</span>
              <div className="min-w-0 flex-1">
                <NumberInput
                  value={spell.maxDamage}
                  onCommit={(v) => onUpdate("maxDamage", v)}
                  placeholder="Max"
                  min={0}
                />
              </div>
            </div>
          </FieldRow>
          <FieldRow label="Heal">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <NumberInput
                  value={spell.healMin}
                  onCommit={(v) => onUpdate("healMin", v)}
                  placeholder="Min"
                  min={0}
                />
              </div>
              <span className="text-2xs text-text-muted">/</span>
              <div className="min-w-0 flex-1">
                <NumberInput
                  value={spell.healMax}
                  onCommit={(v) => onUpdate("healMax", v)}
                  placeholder="Max"
                  min={0}
                />
              </div>
            </div>
          </FieldRow>
          <FieldRow label="Cooldown / Weight">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <NumberInput
                  value={spell.cooldownMs}
                  onCommit={(v) => onUpdate("cooldownMs", v)}
                  placeholder="0 ms"
                  min={0}
                />
              </div>
              <span className="text-2xs text-text-muted">ms</span>
              <span className="text-2xs text-text-muted">/</span>
              <div className="w-16 shrink-0">
                <NumberInput
                  value={spell.weight}
                  onCommit={(v) => onUpdate("weight", v)}
                  placeholder="1"
                  min={0}
                />
              </div>
              <span className="text-2xs text-text-muted">wt</span>
            </div>
          </FieldRow>
          <FieldRow label="Status Effect">
            <TextInput
              value={spell.statusEffectId ?? ""}
              onCommit={(v) => onUpdate("statusEffectId", v || undefined)}
              placeholder="Status effect ID (optional)"
            />
          </FieldRow>
          <div className="flex justify-end pt-1">
            <button
              onClick={onDelete}
              className="rounded px-2 py-0.5 text-2xs text-text-muted transition-colors hover:bg-status-danger/10 hover:text-status-danger"
            >
              Delete Spell
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToughnessSelector({
  mob,
  onChange,
}: {
  mob: MobFile;
  onChange: (patch: Partial<MobFile>) => void;
}) {
  const inferred = inferToughness(mob);
  const current = inferred;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-text-muted">Toughness</span>
        <span className="text-2xs text-text-muted">
          {current != null
            ? TOUGHNESS_PROFILES[current].label
            : "Custom"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {TOUGHNESS_STEPS.map((step) => {
          const selected = current === step;
          const profile = TOUGHNESS_PROFILES[step];
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(toughnessPatch(step))}
              title={`${profile.label} — ${profile.description} (mults ×${profile.hpMult})`}
              className={
                selected
                  ? "focus-ring rounded border border-accent bg-accent/10 px-1 py-1 text-2xs font-medium text-accent"
                  : "focus-ring rounded border border-border-default px-1 py-1 text-2xs text-text-muted transition-colors hover:border-border-active hover:text-text-primary"
              }
            >
              {step > 0 ? `+${step}` : step}
            </button>
          );
        })}
      </div>
      {current == null && (
        <p className="text-2xs text-text-muted">
          Mults are hand-tuned. Pick a preset to reset to a profile.
        </p>
      )}
    </div>
  );
}
