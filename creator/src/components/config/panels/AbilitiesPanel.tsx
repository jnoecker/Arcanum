import { useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { AbilityDefinitionConfig, AbilityEffectConfig, AppConfig } from "@/types/config";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getPreamble } from "@/lib/arcanumPrompts";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { BulkImportButton } from "./BulkImportButton";

const FALLBACK_TARGET_TYPES = [
  { value: "enemy", label: "Enemy" },
  { value: "self", label: "Self" },
  { value: "ally", label: "Ally" },
];

const EFFECT_TYPES = [
  { value: "DIRECT_DAMAGE", label: "Direct Damage" },
  { value: "DIRECT_HEAL", label: "Direct Heal" },
  { value: "APPLY_STATUS", label: "Apply Status" },
  { value: "AREA_DAMAGE", label: "Area Damage" },
  { value: "TAUNT", label: "Taunt" },
];

/** Class-to-color mapping for ability icon color badges */
const CLASS_COLORS: Record<string, string> = {
  BULWARK: "#bea873",
  WARDEN: "#c4956a",
  ARCANIST: "#a897d2",
  FAEWEAVER: "#8da97b",
  NECROMANCER: "#7a8a6e",
  VEIL: "#6e5a8a",
  BINDER: "#bea873",
  STORMBLADE: "#8caec9",
  HERALD: "#d4c8a0",
  STARWEAVER: "#b88faa",
};

export function defaultAbilityDefinition(raw: string): AbilityDefinitionConfig {
  return {
    displayName: raw,
    manaCost: 5,
    cooldownMs: 0,
    levelRequired: 1,
    targetType: "ENEMY",
    effect: { type: "DIRECT_DAMAGE", value: 3 },
  };
}

export function summarizeAbility(ability: AbilityDefinitionConfig): string {
  const parts = [ability.effect.type];
  if (ability.requiredClass || ability.classRestriction) parts.push(ability.requiredClass || ability.classRestriction || "");
  if (ability.image) parts.push("art");
  return parts.filter(Boolean).join(" | ");
}

export function renameAbilityDefinition(config: AppConfig, oldId: string, newId: string) {
  const abilities: Record<string, AbilityDefinitionConfig> = {};
  for (const [k, v] of Object.entries(config.abilities)) {
    abilities[k === oldId ? newId : k] = v;
  }
  return abilities;
}

function abilityPrompt(ability: AbilityDefinitionConfig, style: ArtStyle): string {
  const preamble = getPreamble(style);
  const effectDesc = ability.effect.type.toLowerCase().replace(/_/g, " ");
  return `${preamble}, a game ability icon for "${ability.displayName}" — ${effectDesc} spell, ${ability.description || "magical ability"}, centered square composition like an RPG ability sprite, iconic symbol rendered as flowing energy, no text, no figures`;
}

function buildAbilityContext(ability: AbilityDefinitionConfig): string {
  const parts = [
    `Ability: ${ability.displayName}`,
    ability.description ? `Description: ${ability.description}` : null,
    ability.requiredClass ? `Class: ${ability.requiredClass}` : null,
    `Effect: ${ability.effect.type}`,
    `Target: ${ability.targetType}`,
    `Level required: ${ability.levelRequired}`,
    `Mana cost: ${ability.manaCost}`,
  ];
  return parts.filter(Boolean).join("\n");
}

function ClassColorBadge({ classId }: { classId: string }) {
  const color = CLASS_COLORS[classId.toUpperCase()] ?? "#888";
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-3 w-3 rounded-sm border border-border-default"
        style={{ backgroundColor: color }}
      />
      <span className="text-2xs text-text-muted">{classId} palette</span>
    </div>
  );
}

export function AbilitiesPanel({ config, onChange }: ConfigPanelProps) {
  const targetTypeOptions = useMemo(() => {
    const entries = Object.entries(config.abilityTargetTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_TARGET_TYPES;
  }, [config.abilityTargetTypes]);

  const statusEffectOptions = Object.keys(config.statusEffects).map((id) => ({
    value: id,
    label: config.statusEffects[id]!.displayName,
  }));

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      onChange({ abilities: renameAbilityDefinition(config, oldId, newId) });
    },
    [config, onChange],
  );

  const classOptions = Object.keys(config.classes).map((id) => ({
    value: id,
    label: config.classes[id]!.displayName,
  }));

  const patchEffect = (
    ability: AbilityDefinitionConfig,
    patch: (p: Partial<AbilityDefinitionConfig>) => void,
    p: Partial<AbilityEffectConfig>,
  ) => {
    const newEffect =
      p.type && p.type !== ability.effect.type
        ? { type: p.type, ...p }
        : { ...ability.effect, ...p };
    patch({ effect: newEffect as AbilityEffectConfig });
  };

  const handleBulkImport = useCallback(
    (mapping: Array<{ original_name: string; file_name: string }>) => {
      const lookup = Object.fromEntries(mapping.map((m) => [m.original_name, m.file_name]));
      const updated: Record<string, AbilityDefinitionConfig> = {};
      for (const [id, ability] of Object.entries(config.abilities)) {
        const stem = ability.image?.replace(/^.*[\\/]/, "").replace(/\.\w+$/, "");
        if (stem && lookup[stem]) {
          updated[id] = { ...ability, image: lookup[stem] };
        } else {
          updated[id] = ability;
        }
      }
      onChange({ abilities: updated });
    },
    [config.abilities, onChange],
  );

  return (
    <>
    <BulkImportButton
      assetType="ability_icon"
      entityType="ability"
      label="Import Ability Icons"
      onImported={handleBulkImport}
    />
    <RegistryPanel<AbilityDefinitionConfig>
      title="Abilities"
      items={config.abilities}
      onItemsChange={(abilities) => onChange({ abilities })}
      onRenameId={handleRename}
      placeholder="New ability"
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(a) => a.displayName}
      defaultItem={defaultAbilityDefinition}
      renderSummary={(_id, a) => summarizeAbility(a)}
      renderDetail={(id, a, patch) => (
        <AbilityDetail
          id={id}
          ability={a}
          patch={patch}
          classOptions={classOptions}
          statusEffectOptions={statusEffectOptions}
          targetTypeOptions={targetTypeOptions}
          patchEffect={patchEffect}
        />
      )}
    />
    </>
  );
}

export function AbilityDetail({
  id,
  ability,
  patch,
  classOptions,
  statusEffectOptions,
  targetTypeOptions,
  patchEffect,
}: {
  id: string;
  ability: AbilityDefinitionConfig;
  patch: (p: Partial<AbilityDefinitionConfig>) => void;
  classOptions: { value: string; label: string }[];
  statusEffectOptions: { value: string; label: string }[];
  targetTypeOptions: { value: string; label: string }[];
  patchEffect: (
    ability: AbilityDefinitionConfig,
    patch: (p: Partial<AbilityDefinitionConfig>) => void,
    p: Partial<AbilityEffectConfig>,
  ) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={ability.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput
          value={ability.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="optional"
        />
      </FieldRow>
      <FieldRow label="Mana Cost">
        <NumberInput
          value={ability.manaCost}
          onCommit={(v) => patch({ manaCost: v ?? 0 })}
          min={0}
        />
      </FieldRow>
      <FieldRow label="Cooldown (ms)">
        <NumberInput
          value={ability.cooldownMs}
          onCommit={(v) => patch({ cooldownMs: v ?? 0 })}
          min={0}
        />
      </FieldRow>
      <FieldRow label="Level Req">
        <NumberInput
          value={ability.levelRequired}
          onCommit={(v) => patch({ levelRequired: v ?? 1 })}
          min={1}
        />
      </FieldRow>
      <FieldRow label="Target">
        <SelectInput
          value={ability.targetType}
          onCommit={(v) => patch({ targetType: v })}
          options={targetTypeOptions}
        />
      </FieldRow>
      <FieldRow label="Req. Class" hint="If set, only this class can learn the ability. Leave empty for any class.">
        <SelectInput
          value={ability.requiredClass ?? ability.classRestriction ?? ""}
          onCommit={(v) => patch({ requiredClass: v || "", classRestriction: v || undefined })}
          options={classOptions}
          allowEmpty
          placeholder="-- any class --"
        />
      </FieldRow>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Effect
        </h5>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Type">
            <SelectInput
              value={ability.effect.type}
              onCommit={(v) => patchEffect(ability, patch, { type: v })}
              options={EFFECT_TYPES}
            />
          </FieldRow>
          {(ability.effect.type === "DIRECT_DAMAGE" ||
            ability.effect.type === "AREA_DAMAGE") && (
            <>
              <FieldRow label="Min Damage" hint="Minimum damage dealt per hit. 0 means no direct damage.">
                <NumberInput
                  value={ability.effect.minDamage ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { minDamage: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Max Damage" hint="Maximum damage dealt per hit. The actual value is rolled between min and max.">
                <NumberInput
                  value={ability.effect.maxDamage ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { maxDamage: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
            </>
          )}
          {(ability.effect.type === "DIRECT_HEAL" ||
            ability.effect.type === "AREA_DAMAGE") && (
            <>
              <FieldRow label="Min Heal" hint="Minimum healing per cast. 0 means no healing component.">
                <NumberInput
                  value={ability.effect.minHeal ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { minHeal: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Max Heal" hint="Maximum healing per cast. The actual value is rolled between min and max.">
                <NumberInput
                  value={ability.effect.maxHeal ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { maxHeal: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
            </>
          )}
          {(ability.effect.type === "DIRECT_DAMAGE" ||
            ability.effect.type === "AREA_DAMAGE" ||
            ability.effect.type === "DIRECT_HEAL") && (
            <FieldRow label="Value" hint="Legacy flat value. Used when min/max are both 0.">
              <NumberInput
                value={ability.effect.value}
                onCommit={(v) =>
                  patchEffect(ability, patch, { value: v ?? 1 })
                }
                min={0}
              />
            </FieldRow>
          )}
          {ability.effect.type === "APPLY_STATUS" && (
            <FieldRow label="Status Effect">
              <SelectInput
                value={ability.effect.statusEffectId ?? ""}
                onCommit={(v) =>
                  patchEffect(ability, patch, {
                    statusEffectId: v || undefined,
                  })
                }
                options={statusEffectOptions}
                allowEmpty
                placeholder="-- select --"
              />
            </FieldRow>
          )}
          {(ability.effect.type === "TAUNT" ||
            ability.effect.type === "AREA_DAMAGE") && (
            <>
              <FieldRow label="Flat Threat" hint="Fixed threat added to the target's threat table. Forces mob attention.">
                <NumberInput
                  value={ability.effect.flatThreat ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { flatThreat: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Margin" hint="Extra threat margin above current highest. Ensures taunt sticks.">
                <NumberInput
                  value={ability.effect.margin ?? 0}
                  onCommit={(v) =>
                    patchEffect(ability, patch, { margin: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
            </>
          )}
        </div>
      </div>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Icon
        </h5>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Image">
            <TextInput
              value={ability.image ?? ""}
              onCommit={(v) => patch({ image: v || undefined })}
              placeholder="none"
            />
          </FieldRow>
          {ability.requiredClass && (
            <ClassColorBadge classId={ability.requiredClass} />
          )}
          <EntityArtGenerator
            getPrompt={(style) => abilityPrompt(ability, style)}
            entityContext={buildAbilityContext(ability)}
            currentImage={ability.image}
            onAccept={(filePath) => patch({ image: filePath })}
            assetType="ability_icon"
            context={{ zone: "", entity_type: "ability", entity_id: id }}
          />
        </div>
      </div>
    </>
  );
}
