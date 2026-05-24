import { useState } from "react";
import type {
  StatBindings,
  StatusEffectDefinitionConfig,
  StatusEffectTypeDefinition,
} from "@/types/config";
import type { StatMap } from "@/types/world";
import { useStatMods } from "@/lib/useStatMods";
import { useProjectStore } from "@/stores/projectStore";
import {
  TextInput,
  NumberInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import {
  authoredTickAnchor,
  scaledTickAnchor,
  tickKindFor,
  tickScalingStat,
  type TickKind,
} from "@/lib/dotHotPacing";
import { Section } from "../enchanting/Section";
import { XIcon } from "@/components/config/icons";

interface ConditionEditorProps {
  id: string;
  def: StatusEffectDefinitionConfig;
  statIds: string[];
  effectTypeOptions: { value: string; label: string }[];
  stackBehaviorOptions: { value: string; label: string }[];
  bindings: StatBindings;
  effectTypeDefs: Record<string, StatusEffectTypeDefinition>;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}

export function ConditionEditor({
  id,
  def,
  statIds,
  effectTypeOptions,
  stackBehaviorOptions,
  bindings,
  effectTypeDefs,
  onPatch,
  onRename,
}: ConditionEditorProps) {
  const et = (def.effectType ?? "").toUpperCase();
  // Mirror the server's data-driven check: the configured effect type's
  // ticksDamage/ticksHealing flags decide whether tick fields are shown.
  // Fall back to the legacy DOT/HOT id check for configs that pre-date the
  // ticksDamage/ticksHealing flags on EffectTypesConfig.
  const tickKind: TickKind = tickKindFor(def.effectType, effectTypeDefs);
  const showTick = tickKind !== null || et === "DOT" || et === "HOT";
  const showStatMods = et === "STAT_BUFF" || et === "STAT_DEBUFF";
  const showShield = et === "SHIELD";
  const showHooks = showStatMods || showShield;

  return (
    <div className="flex flex-col gap-3">
      <IdentityCard id={id} def={def} onPatch={onPatch} onRename={onRename} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <EffectAndStackingCard
          def={def}
          effectTypeOptions={effectTypeOptions}
          stackBehaviorOptions={stackBehaviorOptions}
          onPatch={onPatch}
        />
        {showTick ? (
          <TickValuesCard
            def={def}
            tickKind={tickKind}
            bindings={bindings}
            onPatch={onPatch}
          />
        ) : (
          <VisualIdentityCard id={id} def={def} onPatch={onPatch} />
        )}
      </div>

      {showTick && <VisualIdentityCard id={id} def={def} onPatch={onPatch} />}

      {showHooks && (
        <ResourceHooksCard
          def={def}
          statIds={statIds}
          showStatMods={showStatMods}
          showShield={showShield}
          onPatch={onPatch}
        />
      )}
    </div>
  );
}

// ─── Identity ──────────────────────────────────────────────────────

function IdentityCard({
  id,
  def,
  onPatch,
  onRename,
}: {
  id: string;
  def: StatusEffectDefinitionConfig;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
  onRename: (v: string) => void;
}) {
  return (
    <Section title="Identity">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Slug" required>
          <SlugRenamer id={id} onRename={onRename} />
        </Field>
        <Field label="Display Name" required>
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Ignite"
            dense
          />
        </Field>
      </div>
    </Section>
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
      placeholder="ignite"
    />
  );
}

// ─── Effect & Stacking ─────────────────────────────────────────────

function EffectAndStackingCard({
  def,
  effectTypeOptions,
  stackBehaviorOptions,
  onPatch,
}: {
  def: StatusEffectDefinitionConfig;
  effectTypeOptions: { value: string; label: string }[];
  stackBehaviorOptions: { value: string; label: string }[];
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  const stack = (def.stackBehavior ?? "REFRESH").toUpperCase();
  const isStack = stack === "STACK";

  return (
    <Section title="Effect & Stacking">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" required>
          <SelectInput
            value={def.effectType}
            options={effectTypeOptions}
            onCommit={(v) => onPatch({ effectType: v })}
            dense
          />
        </Field>

        <Field label="Duration (s)" required>
          <NumberInput
            value={Math.round((def.durationMs ?? 0) / 1000)}
            onCommit={(v) => onPatch({ durationMs: (v ?? 10) * 1000 })}
            min={0}
            dense
          />
        </Field>

        <Field label="On Reapply">
          <SelectInput
            value={def.stackBehavior ?? "REFRESH"}
            options={stackBehaviorOptions}
            onCommit={(v) => onPatch({ stackBehavior: v })}
            dense
          />
        </Field>

        {isStack ? (
          <Field label="Max Stacks">
            <NumberInput
              value={def.maxStacks ?? 3}
              onCommit={(v) => onPatch({ maxStacks: v ?? 3 })}
              min={1}
              dense
            />
          </Field>
        ) : (
          <div />
        )}
      </div>
    </Section>
  );
}

// ─── Tick Values ───────────────────────────────────────────────────

function TickValuesCard({
  def,
  tickKind,
  bindings,
  onPatch,
}: {
  def: StatusEffectDefinitionConfig;
  tickKind: TickKind;
  bindings: StatBindings;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  const scalingStat = tickScalingStat(tickKind, bindings);
  const minMaxHint = tickKind
    ? `L1 base-stat anchor — scales with caster level and ${scalingStat ?? "stat"} at runtime, same as direct ${tickKind === "damage" ? "spell damage" : "heals"}.`
    : undefined;
  return (
    <Section title="Tick Values">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Interval (s)">
          <NumberInput
            value={Math.max(0.1, Math.round(((def.tickIntervalMs ?? 2000) / 1000) * 10) / 10)}
            step={0.1}
            onCommit={(v) =>
              onPatch({ tickIntervalMs: Math.max(100, Math.round((v ?? 2) * 1000)) })
            }
            min={0.1}
            dense
          />
        </Field>
        <Field label="Legacy" hint="Used when min/max are 0.">
          <NumberInput
            value={def.tickValue ?? 0}
            onCommit={(v) => onPatch({ tickValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
        <Field label="Min" hint={minMaxHint}>
          <NumberInput
            value={def.tickMinValue ?? 0}
            onCommit={(v) => onPatch({ tickMinValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
        <Field label="Max" hint={tickKind ? "Upper end of the L1 anchor. Variance is rolled per tick." : undefined}>
          <NumberInput
            value={def.tickMaxValue ?? 0}
            onCommit={(v) => onPatch({ tickMaxValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
      </div>
      {tickKind && <ScaledTickPreview def={def} kind={tickKind} bindings={bindings} />}
    </Section>
  );
}

/**
 * Read-only preview of the per-tick value at representative caster levels for
 * a base-stat caster. Mirrors the server's `StatusEffectSystem.computeTickAnchor`
 * (anchor + statBonus) × levelScale, with no per-tick variance.
 */
function ScaledTickPreview({
  def,
  kind,
  bindings,
}: {
  def: StatusEffectDefinitionConfig;
  kind: NonNullable<TickKind>;
  bindings: StatBindings;
}) {
  const anchor = authoredTickAnchor(def);
  if (anchor <= 0) return null;
  const levels = [1, 10, 20, 30];
  const noun = kind === "damage" ? "damage" : "heal";
  return (
    <div className="mt-3 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Scaled tick · {noun}
        </span>
        <span className="font-mono text-[0.6rem] text-text-muted/70">base-stat caster</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {levels.map((lvl) => {
          const scaled = scaledTickAnchor(def, kind, bindings, lvl);
          return (
            <div
              key={lvl}
              className="flex items-baseline gap-1 rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary px-2 py-0.5"
            >
              <span className="font-display text-[0.6rem] uppercase tracking-wider text-text-muted/80">L{lvl}</span>
              <span className="font-mono text-xs text-text-primary">{Math.round(scaled)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Visual Identity ───────────────────────────────────────────────

function VisualIdentityCard({
  id,
  def,
  onPatch,
}: {
  id: string;
  def: StatusEffectDefinitionConfig;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  const openTab = useProjectStore((s) => s.openTab);

  const openIconStudio = () => {
    openTab({
      id: "studioAbilities",
      kind: "panel",
      label: "Icons",
      panelId: "studioAbilities",
    });
  };

  return (
    <Section
      title="Visual Identity"
      actions={
        <button
          type="button"
          onClick={openIconStudio}
          title="Open the Icons studio for batch generation"
          className="focus-ring inline-flex items-center gap-1 rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-text-muted transition hover:border-accent/30 hover:text-accent"
        >
          Open Studio
        </button>
      }
    >
      <EntityArtGenerator
        getPrompt={(style: ArtStyle) =>
          composePrompt(
            "status_effect_icon",
            style,
            `Status effect: ${def.displayName || id}`,
          )
        }
        entityContext={buildConditionContext(def)}
        currentImage={def.image}
        onAccept={(filePath) => {
          const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
          onPatch({ image: fileName });
        }}
        assetType="status_effect_icon"
        context={{ zone: "", entity_type: "status_effect", entity_id: id }}
        surface="worldbuilding"
      />
    </Section>
  );
}

function buildConditionContext(def: StatusEffectDefinitionConfig): string {
  const parts = [`Status effect: ${def.displayName}`];
  if (def.effectType) parts.push(`Type: ${def.effectType}`);
  if (def.durationMs > 0) parts.push(`Duration: ${Math.round(def.durationMs / 1000)}s`);
  if (def.stackBehavior) parts.push(`Stack: ${def.stackBehavior}`);
  return parts.join("\n");
}

// ─── Resource Hooks ────────────────────────────────────────────────

function ResourceHooksCard({
  def,
  statIds,
  showStatMods,
  showShield,
  onPatch,
}: {
  def: StatusEffectDefinitionConfig;
  statIds: string[];
  showStatMods: boolean;
  showShield: boolean;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  return (
    <Section title="Resource Hooks">
      {showShield && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Shield Amount"
            hint="Total damage the shield absorbs before breaking."
          >
            <NumberInput
              value={def.shieldAmount ?? 20}
              onCommit={(v) => onPatch({ shieldAmount: v ?? 20 })}
              min={0}
              dense
            />
          </Field>
        </div>
      )}

      {showStatMods && (
        <>
          <p className="mb-2 font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
            Core Attribute Mods
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            <CoreStat label="STR" value={def.strMod} onCommit={(v) => onPatch({ strMod: v ?? 0 })} />
            <CoreStat label="DEX" value={def.dexMod} onCommit={(v) => onPatch({ dexMod: v ?? 0 })} />
            <CoreStat label="CON" value={def.conMod} onCommit={(v) => onPatch({ conMod: v ?? 0 })} />
            <CoreStat label="INT" value={def.intMod} onCommit={(v) => onPatch({ intMod: v ?? 0 })} />
            <CoreStat label="WIS" value={def.wisMod} onCommit={(v) => onPatch({ wisMod: v ?? 0 })} />
            <CoreStat label="CHA" value={def.chaMod} onCommit={(v) => onPatch({ chaMod: v ?? 0 })} />
          </div>

          <CustomStatMods
            statMods={def.statMods}
            statIds={statIds}
            onChange={(mods) => onPatch({ statMods: mods })}
          />
        </>
      )}
    </Section>
  );
}

function CoreStat({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1.5">
      <span className="w-9 shrink-0 font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <NumberInput value={value ?? 0} onCommit={onCommit} dense />
      </div>
    </div>
  );
}

function CustomStatMods({
  statMods,
  statIds,
  onChange,
}: {
  statMods: StatMap | undefined;
  statIds: string[];
  onChange: (mods: StatMap | undefined) => void;
}) {
  const { mods, addMod, removeMod, updateMod } = useStatMods(statMods, onChange);
  const modKeys = Object.keys(mods);
  const available = statIds.filter((id) => !(id in mods));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
          Custom Stat Mods
        </p>
        {available.length > 0 && (
          <AddCustomStat available={available} onAdd={addMod} />
        )}
      </div>

      {modKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-4 text-center text-2xs italic text-text-muted/80">
          No custom stat mods.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {modKeys.map((statId) => (
            <div
              key={statId}
              className="flex items-center gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">
                {statId}
              </span>
              <div className="w-20 shrink-0">
                <NumberInput
                  value={mods[statId] ?? 0}
                  onCommit={(v) => updateMod(statId, v ?? 0)}
                  dense
                />
              </div>
              <button
                type="button"
                onClick={() => removeMod(statId)}
                aria-label={`Remove ${statId} mod`}
                className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCustomStat({
  available,
  onAdd,
}: {
  available: string[];
  onAdd: (id: string) => void;
}) {
  return (
    <div className="ornate-input shrink-0 px-1 py-0">
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
        className="min-h-7 cursor-pointer appearance-none border-none bg-transparent px-2 py-0 pr-6 text-xs text-text-primary outline-none"
        aria-label="Add custom stat mod"
        style={{
          backgroundImage:
            'url("data:image/svg+xml;charset=utf-8,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%23999\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.5rem center",
        }}
      >
        <option value="">+ add stat</option>
        {available.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────

function Field({
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
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}

