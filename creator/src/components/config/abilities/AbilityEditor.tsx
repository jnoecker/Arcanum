import { useMemo, useState } from "react";
import type {
  AbilityDefinitionConfig,
  AbilityEffectConfig,
  AbilityVisualArchetype,
  AbilityVisualConfig,
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
import { SectionCard } from "@/components/ui/SectionCard";

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
  abilities: Record<string, AbilityDefinitionConfig>;
  knownTrees: string[];
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
  abilities,
  knownTrees,
  classOptions,
  statusEffectOptions,
  targetTypeOptions,
  petOptions,
  onPatch,
  onPatchEffect,
  onRename,
}: AbilityEditorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <IdentityCard
        id={id}
        ability={ability}
        knownTrees={knownTrees}
        onPatch={onPatch}
        onRename={onRename}
      />
      <ActionCostCard
        ability={ability}
        classOptions={classOptions}
        targetTypeOptions={targetTypeOptions}
        onPatch={onPatch}
      />
      <CombatEffectCard
        id={id}
        ability={ability}
        abilities={abilities}
        statusEffectOptions={statusEffectOptions}
        petOptions={petOptions}
        onPatch={onPatch}
        onPatchEffect={onPatchEffect}
      />
      <VisualIdentityCard
        id={id}
        ability={ability}
        onPatch={onPatch}
      />
      <CombatVisualsCard ability={ability} onPatch={onPatch} />
    </div>
  );
}

// ─── Combat Visuals ────────────────────────────────────────────────

const ARCHETYPE_OPTIONS: { value: AbilityVisualArchetype; label: string; hint: string }[] = [
  { value: "RANGED_PROJECTILE", label: "Ranged Projectile", hint: "Icon or sprite arcs caster → target." },
  { value: "MELEE_STRIKE", label: "Melee Strike", hint: "Lunge + icon pulses at impact (no red slash)." },
  { value: "HEAL_AURA", label: "Heal Aura", hint: "Rising green/gold aura on target." },
  { value: "BUFF_AURA", label: "Buff Aura", hint: "Rising aura + icon flash on self/ally." },
  { value: "DEBUFF_AURA", label: "Debuff Aura", hint: "Sinking dark aura on enemy." },
  { value: "AREA_BURST", label: "Area Burst", hint: "Radial expanding wave at target." },
  { value: "SUMMON_POOF", label: "Summon Poof", hint: "Sparkle puff at the caster." },
];

const ARCHETYPE_LABEL: Record<AbilityVisualArchetype, string> = Object.fromEntries(
  ARCHETYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AbilityVisualArchetype, string>;

/**
 * Mirrors the Kotlin `deriveDefaultVisual` on the server so the editor can
 * show the auto-derived choice without a roundtrip. Keep in sync with
 * `engine/abilities/AbilityDefinition.kt`.
 */
function deriveDefaultArchetype(ability: AbilityDefinitionConfig): AbilityVisualArchetype {
  const tt = (ability.targetType || "").toUpperCase();
  const cls = (ability.requiredClass || ability.classRestriction || "").toUpperCase();
  switch (ability.effect.type) {
    case "DIRECT_DAMAGE":
      return cls === "WARRIOR" || cls === "ROGUE" ? "MELEE_STRIKE" : "RANGED_PROJECTILE";
    case "DIRECT_HEAL":
      return "HEAL_AURA";
    case "APPLY_STATUS":
      return tt === "ENEMY" || tt === "ALL_ENEMIES" ? "DEBUFF_AURA" : "BUFF_AURA";
    case "AREA_DAMAGE":
      return "AREA_BURST";
    case "TAUNT":
      return "BUFF_AURA";
    case "SUMMON_PET":
      return "SUMMON_POOF";
    default:
      return "RANGED_PROJECTILE";
  }
}

function CombatVisualsCard({
  ability,
  onPatch,
}: {
  ability: AbilityDefinitionConfig;
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
}) {
  const visual = ability.visual ?? {};
  const auto = deriveDefaultArchetype(ability);
  const archetype = visual.archetype || "";
  const effective = (archetype as AbilityVisualArchetype) || auto;
  const effectiveHint =
    ARCHETYPE_OPTIONS.find((o) => o.value === effective)?.hint ?? "";

  const patchVisual = (delta: Partial<AbilityVisualConfig>) => {
    const next: AbilityVisualConfig = { ...visual, ...delta };
    // Drop empty strings so the YAML stays minimal.
    const cleaned: AbilityVisualConfig = {};
    if (next.archetype) cleaned.archetype = next.archetype;
    if (next.projectileImage) cleaned.projectileImage = next.projectileImage;
    if (next.color) cleaned.color = next.color;
    if (next.accentColor) cleaned.accentColor = next.accentColor;
    onPatch({ visual: Object.keys(cleaned).length > 0 ? cleaned : undefined });
  };

  return (
    <SectionCard title="Combat Visuals">
      <div className="flex flex-col gap-3">
        <FieldLabel
          label="Cast Animation"
          hint={
            archetype
              ? effectiveHint
              : `Auto — derived from effect, target, and class. ${effectiveHint}`
          }
        >
          <SelectInput
            value={archetype}
            onCommit={(v) => patchVisual({ archetype: (v as AbilityVisualArchetype) || "" })}
            options={ARCHETYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            allowEmpty
            placeholder={`— Auto (${ARCHETYPE_LABEL[auto]}) —`}
            dense
          />
        </FieldLabel>

        <FieldLabel
          label="Projectile / Pulse Image"
          hint="Optional override. Defaults to the ability icon above."
        >
          <TextInput
            value={visual.projectileImage ?? ""}
            onCommit={(v) => patchVisual({ projectileImage: v.trim() || undefined })}
            placeholder="e.g. ice_lance.png"
            dense
          />
        </FieldLabel>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldLabel
            label="Primary Color"
            hint="Tint for projectile head, aura, or burst."
          >
            <ColorField
              value={visual.color}
              onCommit={(v) => patchVisual({ color: v })}
            />
          </FieldLabel>
          <FieldLabel
            label="Accent Color"
            hint="Trail glow / secondary sparkles. Falls back to primary."
          >
            <ColorField
              value={visual.accentColor}
              onCommit={(v) => patchVisual({ accentColor: v })}
            />
          </FieldLabel>
        </div>
      </div>
    </SectionCard>
  );
}

function ColorField({
  value,
  onCommit,
}: {
  value: string | undefined;
  onCommit: (v: string | undefined) => void;
}) {
  const hasValue = !!value;
  const display = value || "#888888";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={display}
        aria-label="Pick color"
        onChange={(e) => onCommit(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]"
      />
      <TextInput
        value={value ?? ""}
        onCommit={(v) => {
          const trimmed = v.trim();
          if (!trimmed) onCommit(undefined);
          else if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
            onCommit(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
          }
        }}
        placeholder="#c8a8f0"
        dense
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onCommit(undefined)}
          className="focus-ring rounded-md border border-[var(--chrome-stroke)] px-2 py-1 font-display text-[0.6rem] uppercase tracking-wider text-text-muted transition hover:bg-[var(--chrome-fill-soft)] hover:text-text-primary"
          aria-label="Clear color"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Identity ──────────────────────────────────────────────────────

function IdentityCard({
  id,
  ability,
  knownTrees,
  onPatch,
  onRename,
}: {
  id: string;
  ability: AbilityDefinitionConfig;
  knownTrees: string[];
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
  onRename: (v: string) => void;
}) {
  const desc = ability.description ?? "";
  const overLimit = desc.length > DESCRIPTION_LIMIT;
  return (
    <SectionCard title="Identity">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Slug" required>
          <SlugRenamer id={id} onRename={onRename} />
        </FieldLabel>
        <FieldLabel label="Display Name" required>
          <TextInput
            value={ability.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Power Strike"
            dense
          />
        </FieldLabel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem]">
        <FieldLabel label="Skill Tree" hint="Group related abilities (e.g. warrior_arms).">
          <SkillTreePicker
            value={ability.tree ?? ""}
            knownTrees={knownTrees}
            onCommit={(v) => onPatch({ tree: v || undefined })}
          />
        </FieldLabel>
        <FieldLabel label="Tier" hint="Depth in the tree.">
          <NumberInput
            value={ability.tier ?? 0}
            onCommit={(v) => onPatch({ tier: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
            Description
          </span>
          <span
            className={cx(
              "font-mono text-[0.6rem]",
              overLimit ? "text-status-error" : "text-text-muted/60",
            )}
          >
            {desc.length} / {DESCRIPTION_LIMIT}
          </span>
        </div>
        <CommitTextarea
          label=""
          value={desc}
          onCommit={(v) => onPatch({ description: v || undefined })}
          placeholder="A powerful blow that deals heavy damage to a single target."
          rows={3}
        />
      </div>
    </SectionCard>
  );
}

function SkillTreePicker({
  value,
  knownTrees,
  onCommit,
}: {
  value: string;
  knownTrees: string[];
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const listId = "skill-tree-options";

  if (!focused && draft !== value) setDraft(value);

  const commit = () => {
    const next = draft.trim().toLowerCase().replace(/\s+/g, "_");
    if (next !== value) onCommit(next);
    setDraft(next);
  };

  return (
    <>
      <input
        list={listId}
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
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="warrior_arms"
      />
      <datalist id={listId}>
        {knownTrees.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
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
  id,
  ability,
  abilities,
  statusEffectOptions,
  petOptions,
  onPatch,
  onPatchEffect,
}: {
  id: string;
  ability: AbilityDefinitionConfig;
  abilities: Record<string, AbilityDefinitionConfig>;
  statusEffectOptions: { value: string; label: string }[];
  petOptions: { value: string; label: string }[];
  onPatch: (p: Partial<AbilityDefinitionConfig>) => void;
  onPatchEffect: (p: Partial<AbilityEffectConfig>) => void;
}) {
  const t = ability.effect.type;
  const hasDamage = t === "DIRECT_DAMAGE" || t === "AREA_DAMAGE";
  const hasHeal = t === "DIRECT_HEAL" || t === "AREA_DAMAGE";
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <FieldLabel
              label="Legacy"
              hint="Used when min/max are 0."
            >
              <NumberInput
                value={ability.effect.value ?? 0}
                onCommit={(v) => onPatchEffect({ value: v ?? 0 })}
                min={0}
                dense
              />
            </FieldLabel>
          </div>
        )}

        {hasHeal && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            {!hasDamage && (
              <FieldLabel
                label="Legacy"
                hint="Used when min/max are 0."
              >
                <NumberInput
                  value={ability.effect.value ?? 0}
                  onCommit={(v) => onPatchEffect({ value: v ?? 0 })}
                  min={0}
                  dense
                />
              </FieldLabel>
            )}
          </div>
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

        <PrerequisitesPicker
          selfId={id}
          selectedTree={ability.tree}
          prereqs={ability.prerequisites ?? []}
          abilities={abilities}
          onChange={(next) =>
            onPatch({ prerequisites: next.length > 0 ? next : undefined })
          }
        />
      </div>
    </SectionCard>
  );
}

function PrerequisitesPicker({
  selfId,
  selectedTree,
  prereqs,
  abilities,
  onChange,
}: {
  selfId: string;
  selectedTree: string | undefined;
  prereqs: string[];
  abilities: Record<string, AbilityDefinitionConfig>;
  onChange: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const candidates = useMemo(() => {
    return Object.entries(abilities)
      .filter(([id]) => id !== selfId && !prereqs.includes(id))
      .sort(([, a], [, b]) => {
        const aSame = a.tree === selectedTree ? 0 : 1;
        const bSame = b.tree === selectedTree ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return (a.tree ?? "").localeCompare(b.tree ?? "");
      });
  }, [abilities, prereqs, selfId, selectedTree]);

  const removeOne = (pid: string) => {
    onChange(prereqs.filter((p) => p !== pid));
  };

  const addOne = (pid: string) => {
    onChange([...prereqs, pid]);
    setPickerOpen(false);
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--chrome-stroke)] pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Prerequisites
        </span>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={candidates.length === 0}
          className="focus-ring inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {prereqs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-2xs italic text-text-muted/70">
          None — this ability has no gates beyond level and class.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {prereqs.map((pid) => {
            const target = abilities[pid];
            const label = target?.displayName ?? pid;
            const tree = target?.tree;
            const orphan = !target;
            return (
              <li
                key={pid}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md border bg-[var(--chrome-fill-soft)] py-1 pl-2 pr-1 text-2xs",
                  orphan
                    ? "border-status-warning/40 text-status-warning"
                    : "border-[var(--chrome-stroke)] text-text-secondary",
                )}
              >
                <span className="font-display">{label}</span>
                {tree && (
                  <span className="rounded-full border border-[var(--chrome-stroke-strong)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-text-muted/80">
                    {tree}
                  </span>
                )}
                {orphan && (
                  <span className="font-mono text-[0.55rem] uppercase tracking-wider">
                    missing
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeOne(pid)}
                  title={`Remove ${label}`}
                  aria-label={`Remove ${label}`}
                  className="focus-ring inline-flex h-4 w-4 items-center justify-center rounded text-text-muted/70 transition hover:bg-status-error/15 hover:text-status-error"
                >
                  Ã—
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen && (
        <div className="rounded-lg border border-[var(--chrome-stroke)] bg-bg-elevated p-1 shadow-lg">
          <ul className="max-h-48 overflow-y-auto">
            {candidates.map(([cid, c]) => {
              const sameTree = c.tree && c.tree === selectedTree;
              return (
                <li key={cid}>
                  <button
                    type="button"
                    onClick={() => addOne(cid)}
                    className="focus-ring flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs text-text-secondary transition hover:bg-[var(--chrome-fill-soft)] hover:text-text-primary"
                  >
                    <span className="truncate font-display">
                      {c.displayName || cid}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {c.tree && (
                        <span
                          className={cx(
                            "rounded-full border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider",
                            sameTree
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-[var(--chrome-stroke)] text-text-muted/70",
                          )}
                        >
                          {c.tree}
                        </span>
                      )}
                      {typeof c.tier === "number" && c.tier > 0 && (
                        <span className="font-mono text-[0.55rem] text-text-muted/60">
                          T{c.tier}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
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
