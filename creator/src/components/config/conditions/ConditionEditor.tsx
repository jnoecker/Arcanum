import { useState } from "react";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { useImageSrc } from "@/lib/useImageSrc";
import { useStatMods } from "@/lib/useStatMods";
import { useProjectStore } from "@/stores/projectStore";
import {
  TextInput,
  NumberInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { Section } from "../enchanting/Section";
import { PlusIcon, XIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface ConditionEditorProps {
  id: string;
  def: StatusEffectDefinitionConfig;
  statIds: string[];
  effectTypeOptions: { value: string; label: string }[];
  stackBehaviorOptions: { value: string; label: string }[];
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}

export function ConditionEditor({
  id,
  def,
  statIds,
  effectTypeOptions,
  stackBehaviorOptions,
  onPatch,
  onRename,
}: ConditionEditorProps) {
  const et = (def.effectType ?? "").toUpperCase();
  const showTick = et === "DOT" || et === "HOT";
  const showStatMods = et === "STAT_BUFF" || et === "STAT_DEBUFF";
  const showShield = et === "SHIELD";
  const stack = (def.stackBehavior ?? "REFRESH").toUpperCase();
  const showHooks = showStatMods || showShield;

  return (
    <div className="flex flex-col gap-4">
      <DetailHero
        id={id}
        def={def}
        effectTypeOptions={effectTypeOptions}
        stack={stack}
        showTick={showTick}
      />

      <IdentityCard id={id} def={def} onPatch={onPatch} onRename={onRename} />

      <EffectAndStackingCard
        def={def}
        effectTypeOptions={effectTypeOptions}
        stackBehaviorOptions={stackBehaviorOptions}
        onPatch={onPatch}
      />

      {showTick && <TickValuesCard def={def} onPatch={onPatch} />}

      <VisualIdentityCard def={def} onPatch={onPatch} />

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

// ─── Detail hero ───────────────────────────────────────────────────

function DetailHero({
  id,
  def,
  effectTypeOptions,
  stack,
  showTick,
}: {
  id: string;
  def: StatusEffectDefinitionConfig;
  effectTypeOptions: { value: string; label: string }[];
  stack: string;
  showTick: boolean;
}) {
  const typeLabel =
    effectTypeOptions.find(
      (t) => t.value.toLowerCase() === (def.effectType ?? "").toLowerCase(),
    )?.label ?? def.effectType;

  const tags: { label: string; emphasis?: boolean }[] = [];
  if (typeLabel) tags.push({ label: typeLabel, emphasis: true });
  if (stack) tags.push({ label: titleCase(stack) });
  if (def.durationMs > 0) tags.push({ label: `${def.durationMs}ms` });
  if (showTick && def.tickIntervalMs && def.tickIntervalMs > 0) {
    tags.push({ label: `Tick ${def.tickIntervalMs}ms` });
  }
  if ((def.maxStacks ?? 0) > 1 && stack === "STACK") {
    tags.push({ label: `Up to ${def.maxStacks} stacks` });
  }

  return (
    <section className="panel-surface relative overflow-hidden rounded-3xl px-5 py-5 shadow-section">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top right, rgb(var(--accent-rgb)/0.18), transparent 55%), radial-gradient(circle at 25% 80%, rgb(var(--stellar-blue-rgb)/0.10), transparent 55%)",
        }}
      />
      <div className="relative z-10 flex flex-wrap items-start gap-5">
        <ConditionHeroArt image={def.image} />

        <div className="min-w-0 flex-1">
          <p className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
            Conditions <span className="mx-1.5 text-text-muted/40">›</span>{" "}
            <span className="text-accent">
              {(def.displayName || id).toUpperCase()}
            </span>
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
            {def.displayName || id}
          </h2>
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {tags.map((tag, i) => (
                <span
                  key={`${tag.label}-${i}`}
                  className={cx(
                    "inline-flex items-center rounded-full border px-2.5 py-1 font-display text-2xs",
                    tag.emphasis
                      ? "border-accent/45 bg-accent/12 text-accent"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-secondary",
                  )}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ConditionHeroArt({ image }: { image: string | undefined }) {
  const src = useImageSrc(image);
  return (
    <div
      className={cx(
        "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border",
        src
          ? "border-accent/40 shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)]"
          : "border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)]",
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted/70">
          No icon
        </span>
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
    <Section title="Identity" description="What this condition is called and how it's referenced.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Display Name" required>
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Ignite"
            dense
          />
        </Field>
        <Field label="Internal ID (slug)" required hint="Used in YAML refs (must be unique).">
          <SlugRenamer id={id} onRename={onRename} />
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
    <Section
      title="Effect & Stacking"
      description="Pick the engine effect kind, how long it lingers, and how repeat applications behave."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Effect Type" required hint="Engine handler that drives the condition.">
          <SelectInput
            value={def.effectType}
            options={effectTypeOptions}
            onCommit={(v) => onPatch({ effectType: v })}
            dense
          />
        </Field>

        <Field label="Duration (ms)" required hint="Total lifetime in milliseconds.">
          <NumberInput
            value={def.durationMs}
            onCommit={(v) => onPatch({ durationMs: v ?? 10000 })}
            min={0}
            dense
          />
        </Field>

        <Field
          label="Stack Behavior"
          hint="Reapplying the condition refreshes the timer, stacks intensity, or is rejected."
        >
          <SelectInput
            value={def.stackBehavior ?? "REFRESH"}
            options={stackBehaviorOptions}
            onCommit={(v) => onPatch({ stackBehavior: v })}
            dense
          />
        </Field>

        {isStack && (
          <Field label="Max Stacks" hint="Hard cap on simultaneous stacks.">
            <NumberInput
              value={def.maxStacks ?? 3}
              onCommit={(v) => onPatch({ maxStacks: v ?? 3 })}
              min={1}
              dense
            />
          </Field>
        )}
      </div>
    </Section>
  );
}

// ─── Tick Values ───────────────────────────────────────────────────

function TickValuesCard({
  def,
  onPatch,
}: {
  def: StatusEffectDefinitionConfig;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  return (
    <Section
      title="Tick Values"
      description="Per-tick damage or healing for damage-over-time and heal-over-time conditions."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Tick Interval (ms)" hint="Milliseconds between each tick.">
          <NumberInput
            value={def.tickIntervalMs ?? 2000}
            onCommit={(v) => onPatch({ tickIntervalMs: v ?? 2000 })}
            min={100}
            dense
          />
        </Field>
        <Field label="Tick Min" hint="Minimum value rolled per tick.">
          <NumberInput
            value={def.tickMinValue ?? 0}
            onCommit={(v) => onPatch({ tickMinValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
        <Field label="Tick Max" hint="Maximum value rolled per tick.">
          <NumberInput
            value={def.tickMaxValue ?? 0}
            onCommit={(v) => onPatch({ tickMaxValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
        <Field
          label="Tick Value (legacy)"
          hint="Flat value used when min/max are both 0."
        >
          <NumberInput
            value={def.tickValue ?? 0}
            onCommit={(v) => onPatch({ tickValue: v ?? 0 })}
            min={0}
            dense
          />
        </Field>
      </div>
    </Section>
  );
}

// ─── Visual Identity ───────────────────────────────────────────────

function VisualIdentityCard({
  def,
  onPatch,
}: {
  def: StatusEffectDefinitionConfig;
  onPatch: (p: Partial<StatusEffectDefinitionConfig>) => void;
}) {
  const openTab = useProjectStore((s) => s.openTab);
  const src = useImageSrc(def.image);

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
      description="The icon players see in their status bar and combat log."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[7rem_1fr]">
        <div
          className={cx(
            "relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border",
            src
              ? "border-accent/40"
              : "border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)]",
          )}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center font-display text-2xs uppercase tracking-[0.18em] text-text-muted/70">
              No icon
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Field label="Icon File" hint="Filename of the active icon variant. Generate or import via the Ability & Status Effect Studio.">
            <TextInput
              value={def.image ?? ""}
              onCommit={(v) => onPatch({ image: v || undefined })}
              placeholder="None"
              dense
            />
          </Field>
          <button
            type="button"
            onClick={openIconStudio}
            className="focus-ring inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            <PlusIcon />
            Open Ability &amp; Status Studio
          </button>
          <p className="text-2xs text-text-muted/70">
            The studio runs the icon generation pipeline (prompt, render, accept) and writes the
            resulting filename back to this condition.
          </p>
        </div>
      </div>
    </Section>
  );
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
    <Section
      title="Resource Hooks"
      description="Stats, shields, and other engine resources this condition pushes on."
    >
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

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
