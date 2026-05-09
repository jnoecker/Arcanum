import { useState } from "react";
import type {
  AbilityDefinitionConfig,
  AbilityEffectConfig,
} from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getPreamble } from "@/lib/arcanumPrompts";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { classColor } from "@/lib/cssTokens";
import { SectionCard } from "../panels/factions/SectionCard";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const EFFECT_TYPES = [
  { value: "DIRECT_DAMAGE", label: "Direct Damage" },
  { value: "DIRECT_HEAL", label: "Direct Heal" },
  { value: "APPLY_STATUS", label: "Apply Status" },
  { value: "AREA_DAMAGE", label: "Area Damage" },
  { value: "TAUNT", label: "Taunt" },
  { value: "SUMMON_PET", label: "Summon Pet" },
];

const DESCRIPTION_LIMIT = 240;

function abilityPrompt(ability: AbilityDefinitionConfig, style: ArtStyle): string {
  const preamble = getPreamble(style, "worldbuilding");
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

interface AbilityEditorProps {
  id: string;
  ability: AbilityDefinitionConfig;
  classOptions: { value: string; label: string }[];
  statusEffectOptions: { value: string; label: string }[];
  targetTypeOptions: { value: string; label: string }[];
  petOptions: { value: string; label: string }[];
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
  onPatchEffect: (p: Partial<AbilityEffectConfig>) => void;
  onRename: (newId: string) => void;
}

export function AbilityEditor({
  id,
  ability,
  classOptions,
  statusEffectOptions,
  targetTypeOptions,
  petOptions,
  onPatch,
  onPatchEffect,
  onRename,
}: AbilityEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <DetailHeader ability={ability} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IdentityCard ability={ability} onPatch={onPatch} />
        <ActionCostCard
          ability={ability}
          classOptions={classOptions}
          targetTypeOptions={targetTypeOptions}
          onPatch={onPatch}
        />
        <CombatEffectCard
          ability={ability}
          statusEffectOptions={statusEffectOptions}
          petOptions={petOptions}
          onPatchEffect={onPatchEffect}
        />
        <VisualIdentityCard
          id={id}
          ability={ability}
          onPatch={onPatch}
        />
      </div>
      <MetadataCard id={id} ability={ability} onPatch={onPatch} onRename={onRename} />
    </div>
  );
}

// ─── Detail header (kicker + title) ────────────────────────────────

function DetailHeader({ ability }: { ability: AbilityDefinitionConfig }) {
  const cost = ability.skillPointCost ?? 1;
  return (
    <div className="panel-surface rounded-2xl px-5 py-4 shadow-section">
      <p className="font-display text-2xs uppercase tracking-[0.22em] text-text-muted">
        Abilities <span className="text-text-muted/50">›</span>{" "}
        <span className="text-accent">{ability.displayName || "Untitled"}</span>
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
        {ability.displayName || "Untitled Ability"}
      </h2>
      <p className="mt-0.5 max-w-2xl text-2xs text-text-muted">
        Target rules, class access, effects, and identity.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill>{prettyType(ability.effect.type)}</Pill>
        <Pill>{ability.targetType}</Pill>
        <Pill>Mana {ability.manaCost}</Pill>
        <Pill>CD {ability.cooldownMs}ms</Pill>
        {cost === 0 ? (
          <span
            className="rounded-full border border-badge-success/40 bg-badge-success-bg px-3 py-1 text-2xs uppercase tracking-[0.14em] text-badge-success"
            title="Auto-learned when level, class, and prerequisites are met"
          >
            Auto-learn
          </span>
        ) : (
          <Pill>{cost} SP</Pill>
        )}
      </div>
    </div>
  );
}

function prettyType(t: string) {
  return t.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1 text-2xs uppercase tracking-[0.14em] text-text-secondary">
      {children}
    </span>
  );
}

// ─── Identity ──────────────────────────────────────────────────────

function IdentityCard({
  ability,
  onPatch,
}: {
  ability: AbilityDefinitionConfig;
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
}) {
  const desc = ability.description ?? "";
  const overLimit = desc.length > DESCRIPTION_LIMIT;
  return (
    <SectionCard title="Identity">
      <div className="flex flex-col gap-3">
        <FieldLabel label="Display Name" required>
          <TextInput
            value={ability.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Power Strike"
            dense
          />
        </FieldLabel>
        <FieldLabel label="Description">
          <CommitTextarea
            label=""
            value={desc}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="A powerful blow that deals heavy damage to a single target."
            rows={3}
          />
          <p
            className={cx(
              "mt-0.5 text-right font-mono text-2xs",
              overLimit ? "text-status-error" : "text-text-muted/70",
            )}
          >
            {desc.length} / {DESCRIPTION_LIMIT}
          </p>
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

// ─── Action & Cost ─────────────────────────────────────────────────

function ActionCostCard({
  ability,
  classOptions,
  targetTypeOptions,
  onPatch,
}: {
  ability: AbilityDefinitionConfig;
  classOptions: { value: string; label: string }[];
  targetTypeOptions: { value: string; label: string }[];
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Action & Cost">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Mana Cost">
          <NumberInput
            value={ability.manaCost}
            onCommit={(v) => onPatch({ manaCost: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Cooldown (ms)">
          <NumberInput
            value={ability.cooldownMs}
            onCommit={(v) => onPatch({ cooldownMs: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Level Required">
          <NumberInput
            value={ability.levelRequired}
            onCommit={(v) => onPatch({ levelRequired: v ?? 1 })}
            min={1}
            dense
          />
        </FieldLabel>
        <FieldLabel
          label="Skill Point Cost"
          hint="0 = auto-learned once gates are met."
        >
          <NumberInput
            value={ability.skillPointCost ?? 1}
            onCommit={(v) => onPatch({ skillPointCost: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Target">
          <SelectInput
            value={ability.targetType}
            onCommit={(v) => onPatch({ targetType: v })}
            options={targetTypeOptions}
            dense
          />
        </FieldLabel>
        <FieldLabel
          label="Required Class"
          hint="Leave empty for any class."
        >
          <SelectInput
            value={ability.requiredClass ?? ability.classRestriction ?? ""}
            onCommit={(v) =>
              onPatch({
                requiredClass: v || "",
                classRestriction: v || undefined,
              })
            }
            options={classOptions}
            allowEmpty
            placeholder="— any class —"
            dense
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

// ─── Combat Effect ─────────────────────────────────────────────────

function CombatEffectCard({
  ability,
  statusEffectOptions,
  petOptions,
  onPatchEffect,
}: {
  ability: AbilityDefinitionConfig;
  statusEffectOptions: { value: string; label: string }[];
  petOptions: { value: string; label: string }[];
  onPatchEffect: (p: Partial<AbilityEffectConfig>) => void;
}) {
  const t = ability.effect.type;
  const hasDamage = t === "DIRECT_DAMAGE" || t === "AREA_DAMAGE";
  const hasHeal = t === "DIRECT_HEAL" || t === "AREA_DAMAGE";
  const hasValue = hasDamage || hasHeal;
  const hasThreat = t === "TAUNT" || t === "AREA_DAMAGE";

  return (
    <SectionCard title="Combat Effect">
      <div className="flex flex-col gap-3">
        <FieldLabel label="Effect Type" required>
          <SelectInput
            value={t}
            onCommit={(v) => onPatchEffect({ type: v })}
            options={EFFECT_TYPES}
            dense
          />
        </FieldLabel>

        {hasDamage && (
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Min Damage">
              <NumberInput
                value={ability.effect.minDamage ?? 0}
                onCommit={(v) => onPatchEffect({ minDamage: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel label="Max Damage">
              <NumberInput
                value={ability.effect.maxDamage ?? 0}
                onCommit={(v) => onPatchEffect({ maxDamage: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel label="Damage / Level" hint="Scales per level above the requirement.">
              <NumberInput
                value={ability.effect.damagePerLevel ?? 0}
                onCommit={(v) => onPatchEffect({ damagePerLevel: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
          </div>
        )}

        {hasHeal && (
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Min Heal">
              <NumberInput
                value={ability.effect.minHeal ?? 0}
                onCommit={(v) => onPatchEffect({ minHeal: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel label="Max Heal">
              <NumberInput
                value={ability.effect.maxHeal ?? 0}
                onCommit={(v) => onPatchEffect({ maxHeal: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel label="Heal / Level">
              <NumberInput
                value={ability.effect.healPerLevel ?? 0}
                onCommit={(v) => onPatchEffect({ healPerLevel: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
          </div>
        )}

        {hasValue && (
          <FieldLabel
            label="Legacy Value"
            hint="Used when min/max are both 0."
          >
            <NumberInput
              value={ability.effect.value ?? 0}
              onCommit={(v) => onPatchEffect({ value: v ?? 0 })}
              min={0}
              dense
            />
          </FieldLabel>
        )}

        {t === "APPLY_STATUS" && (
          <FieldLabel label="Status Effect">
            <SelectInput
              value={ability.effect.statusEffectId ?? ""}
              onCommit={(v) =>
                onPatchEffect({ statusEffectId: v || undefined })
              }
              options={statusEffectOptions}
              allowEmpty
              placeholder="— select —"
              dense
            />
          </FieldLabel>
        )}

        {hasThreat && (
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Flat Threat">
              <NumberInput
                value={ability.effect.flatThreat ?? 0}
                onCommit={(v) => onPatchEffect({ flatThreat: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel label="Margin">
              <NumberInput
                value={ability.effect.margin ?? 0}
                onCommit={(v) => onPatchEffect({ margin: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
          </div>
        )}

        {t === "SUMMON_PET" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldLabel label="Pet Template">
              <SelectInput
                value={ability.effect.petTemplateKey ?? ""}
                onCommit={(v) =>
                  onPatchEffect({ petTemplateKey: v || undefined })
                }
                options={petOptions}
                allowEmpty
                placeholder="— select pet —"
                dense
              />
            </FieldLabel>
            <FieldLabel label="Duration (ms)" hint="0 = permanent until dismissed.">
              <NumberInput
                value={ability.effect.durationMs ?? 0}
                onCommit={(v) => onPatchEffect({ durationMs: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Visual Identity ───────────────────────────────────────────────

function VisualIdentityCard({
  id,
  ability,
  onPatch,
}: {
  id: string;
  ability: AbilityDefinitionConfig;
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
}) {
  const classId = ability.requiredClass || ability.classRestriction || "";
  const color = classId ? classColor(classId) : null;
  return (
    <SectionCard title="Visual Identity">
      <div className="flex flex-col gap-3">
        <FieldLabel label="Image Reference">
          <TextInput
            value={ability.image ?? ""}
            onCommit={(v) => onPatch({ image: v || undefined })}
            placeholder="None"
            dense
          />
        </FieldLabel>

        {color && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-sm border border-border-default"
              style={{ backgroundColor: color }}
            />
            <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
              {classId} palette
            </span>
          </div>
        )}

        <EntityArtGenerator
          getPrompt={(style) => abilityPrompt(ability, style)}
          entityContext={buildAbilityContext(ability)}
          currentImage={ability.image}
          onAccept={(filePath) => onPatch({ image: filePath })}
          assetType="ability_icon"
          context={{ zone: "", entity_type: "ability", entity_id: id }}
          surface="worldbuilding"
        />
      </div>
    </SectionCard>
  );
}

// ─── Notes / Metadata ──────────────────────────────────────────────

function MetadataCard({
  id,
  ability,
  onPatch,
  onRename,
}: {
  id: string;
  ability: AbilityDefinitionConfig;
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}) {
  return (
    <SectionCard title="Notes / Metadata">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FieldLabel label="Internal ID (slug)" required>
          <SlugRenamer id={id} onRename={onRename} />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Used for references (must be unique).
          </p>
        </FieldLabel>
        <FieldLabel label="Skill Tree" hint="Optional grouping (e.g. warrior_arms).">
          <TextInput
            value={ability.tree ?? ""}
            onCommit={(v) => onPatch({ tree: v || undefined })}
            placeholder="—"
            dense
          />
        </FieldLabel>
        <FieldLabel label="Tier" hint="Depth in the skill tree (0 = root).">
          <NumberInput
            value={ability.tier ?? 0}
            onCommit={(v) => onPatch({ tier: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
        <div className="md:col-span-3">
          <FieldLabel label="Prerequisites" hint="Comma-separated ability IDs.">
            <TextInput
              value={(ability.prerequisites ?? []).join(", ")}
              onCommit={(v) => {
                const list = v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                onPatch({ prerequisites: list.length > 0 ? list : undefined });
              }}
              placeholder="ability_id_a, ability_id_b"
              dense
            />
          </FieldLabel>
        </div>
      </div>
    </SectionCard>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="power_strike"
    />
  );
}

// ─── Shared primitives ─────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {hint && <p className="text-2xs text-text-muted/70">{hint}</p>}
    </div>
  );
}
