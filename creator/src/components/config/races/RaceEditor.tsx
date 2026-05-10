import { useState } from "react";
import type { RaceDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { TextInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { getBackstoryEnhancePrompt } from "@/lib/lorePrompts";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { useStatMods } from "@/lib/useStatMods";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, TrashIcon } from "../achievements/icons";

const DESCRIPTION_LIMIT = 200;

const BODY_DESC_SYSTEM_PROMPT = `You are an expert AI image prompt engineer writing body descriptions for fantasy RPG character sprites.

Given a race's name, lore, and traits, write a concise but vivid prompt fragment describing the race's PHYSICAL BODY ONLY — not clothing or gear (those come from the class).

Rules:
- 1-3 sentences of dense visual detail optimized for AI image generation
- Focus on: body shape, skin/surface material, colors, face, hair/head features, any magical visual effects
- Match the visual tone to the world's setting and themes
- Do NOT include clothing, armor, or weapons — the class system handles those
- Output ONLY the description text — no quotes, no explanation`;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface RaceEditorProps {
  id: string;
  race: RaceDefinitionConfig;
  patch: (p: Partial<RaceDefinitionConfig>) => void;
  onRename: (newId: string) => void;
  statIds: string[];
  statDefs: Record<string, { displayName: string; baseStat: number }>;
}

export function RaceEditor({
  id,
  race,
  patch,
  onRename,
  statIds,
  statDefs,
}: RaceEditorProps) {
  const buildContext = () => {
    const parts = [`Race: ${race.displayName}`];
    if (race.description) parts.push(`Description: ${race.description}`);
    if (race.bodyDescription) parts.push(`Physical appearance: ${race.bodyDescription}`);
    if (race.backstory) parts.push(`Backstory: ${race.backstory}`);
    if (race.traits?.length) parts.push(`Traits: ${race.traits.join(", ")}`);
    if (race.statMods) {
      const mods = Object.entries(race.statMods)
        .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`)
        .join(", ");
      if (mods) parts.push(`Stat modifiers: ${mods}`);
    }
    return parts.join("\n");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IdentityCard id={id} race={race} onRename={onRename} patch={patch} />
        <BackstoryLoreCard race={race} patch={patch} buildContext={buildContext} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatModifiersCard
          statMods={race.statMods}
          statIds={statIds}
          statDefs={statDefs}
          onChange={(mods) => patch({ statMods: mods })}
        />

        <div className="flex flex-col gap-4">
          <SectionCard title="Ability Restrictions">
            <StringListEditor
              items={race.abilities ?? []}
              onChange={(abilities) =>
                patch({ abilities: abilities.length > 0 ? abilities : undefined })
              }
              placeholder="e.g. STONE_FORM"
              monospace
            />
          </SectionCard>

          <SectionCard title="Trait Bonuses">
            <StringListEditor
              items={race.traits ?? []}
              onChange={(traits) =>
                patch({ traits: traits.length > 0 ? traits : undefined })
              }
              placeholder="e.g. Darkvision"
            />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Concept Art">
        <ConceptArt id={id} race={race} patch={patch} buildContext={buildContext} />
      </SectionCard>
    </div>
  );
}

// â”€â”€â”€ Identity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function IdentityCard({
  id,
  race,
  onRename,
  patch,
}: {
  id: string;
  race: RaceDefinitionConfig;
  onRename: (newId: string) => void;
  patch: (p: Partial<RaceDefinitionConfig>) => void;
}) {
  const desc = race.description ?? "";
  const remaining = DESCRIPTION_LIMIT - desc.length;
  const overLimit = remaining < 0;

  return (
    <SectionCard title="Identity">
      <IdentityPortrait race={race} />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Slug" required>
          <SlugRenamer id={id} onRename={onRename} />
        </FieldLabel>
        <FieldLabel label="Display Name" required>
          <TextInput
            value={race.displayName}
            onCommit={(v) => patch({ displayName: v })}
            placeholder="Human"
            dense
          />
        </FieldLabel>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
            Short Tagline
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
        <TextInput
          value={desc}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="One-line tagline shown in the race picker."
          dense
        />
      </div>
    </SectionCard>
  );
}

function IdentityPortrait({ race }: { race: RaceDefinitionConfig }) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath =
    race.image && assetsDir ? `${assetsDir}\\images\\${race.image}` : undefined;
  const src = useImageSrc(imagePath);
  const initial = race.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cx(
        "relative flex h-44 w-full items-center justify-center overflow-hidden rounded-xl border bg-[var(--chrome-fill)]",
        src ? "border-[var(--chrome-stroke)]" : "border-dashed border-[var(--chrome-stroke-strong)]",
      )}
      aria-label={src ? `${race.displayName} portrait` : "No portrait set"}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-text-muted/60">
          <span className="font-display text-3xl">{initial}</span>
          <span className="font-display text-[0.55rem] uppercase tracking-[0.22em]">
            No portrait
          </span>
        </div>
      )}
    </div>
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
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-text-primary"
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
      placeholder="HUMAN"
    />
  );
}

// â”€â”€â”€ Backstory & Lore (with body description) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BackstoryLoreCard({
  race,
  patch,
  buildContext,
}: {
  race: RaceDefinitionConfig;
  patch: (p: Partial<RaceDefinitionConfig>) => void;
  buildContext: () => string;
}) {
  return (
    <SectionCard title="Backstory & Lore">
      <CommitTextarea
        label=""
        value={race.backstory ?? ""}
        onCommit={(v) => patch({ backstory: v || undefined })}
        placeholder="Lore, history, and cultural background — what shaped them, and what they want."
        rows={6}
      />
      <div className="mt-1.5 flex justify-end">
        <EnhanceDescriptionButton
          entitySummary={buildContext()}
          currentDescription={race.backstory}
          onAccept={(text) => patch({ backstory: text })}
          systemPrompt={getBackstoryEnhancePrompt()}
          label="Enhance"
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Body Description
        </span>
        <CommitTextarea
          label=""
          value={race.bodyDescription ?? ""}
          onCommit={(v) => patch({ bodyDescription: v || undefined })}
          placeholder="Physical appearance for sprite/portrait prompts (e.g. 'tall luminous humanoid with translucent crystalline skin…')."
          rows={3}
        />
        <div className="mt-1.5 flex justify-end">
          <EnhanceDescriptionButton
            entitySummary={buildContext()}
            currentDescription={race.bodyDescription}
            onAccept={(v) => patch({ bodyDescription: v })}
            systemPrompt={BODY_DESC_SYSTEM_PROMPT}
            label="AI generate"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// â”€â”€â”€ Stat Modifiers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatModifiersCard({
  statMods,
  statIds,
  statDefs,
  onChange,
}: {
  statMods: StatMap | undefined;
  statIds: string[];
  statDefs: Record<string, { displayName: string; baseStat: number }>;
  onChange: (mods: StatMap | undefined) => void;
}) {
  const { mods, updateMod } = useStatMods(statMods, onChange);
  const netTotal = Object.values(mods).reduce((sum, v) => sum + v, 0);

  return (
    <SectionCard
      title="Stat Modifiers"
      actions={
        <span
          className={cx(
            "rounded-full border px-2.5 py-1 font-display text-[0.6rem] uppercase tracking-[0.18em]",
            netTotal === 0
              ? "border-status-success/40 bg-status-success/10 text-status-success"
              : "border-status-warning/40 bg-status-warning/10 text-status-warning",
          )}
        >
          Net {netTotal >= 0 ? "+" : ""}
          {netTotal}
          {netTotal === 0 ? " · balanced" : ""}
        </span>
      }
    >
      {statIds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-6 text-center text-2xs italic text-text-muted/80">
          No stats defined in the world yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {statIds.map((statId) => {
            const def = statDefs[statId];
            if (!def) return null;
            const mod = mods[statId] ?? 0;
            const effective = def.baseStat + mod;
            const tone =
              mod > 0
                ? "text-status-success"
                : mod < 0
                  ? "text-status-danger"
                  : "text-text-muted";
            return (
              <div
                key={statId}
                className="flex items-center gap-2 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    {def.displayName || statId}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6rem] text-text-muted/70">
                    base {def.baseStat} · effective {effective}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StepperButton
                    onClick={() => updateMod(statId, mod - 1)}
                    label={`Decrease ${statId}`}
                  >
                    âˆ’
                  </StepperButton>
                  <span
                    className={cx(
                      "w-10 text-center font-mono text-sm font-semibold tabular-nums",
                      tone,
                    )}
                  >
                    {mod >= 0 ? "+" : ""}
                    {mod}
                  </span>
                  <StepperButton
                    onClick={() => updateMod(statId, mod + 1)}
                    label={`Increase ${statId}`}
                  >
                    +
                  </StepperButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function StepperButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary/40 font-display text-sm leading-none text-text-secondary transition hover:border-accent/40 hover:text-accent"
    >
      {children}
    </button>
  );
}

// â”€â”€â”€ Concept Art â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConceptArt({
  id,
  race,
  patch,
  buildContext,
}: {
  id: string;
  race: RaceDefinitionConfig;
  patch: (p: Partial<RaceDefinitionConfig>) => void;
  buildContext: () => string;
}) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath =
    race.image && assetsDir ? `${assetsDir}\\images\\${race.image}` : undefined;

  return (
    <EntityArtGenerator
      getPrompt={(style: ArtStyle) =>
        composePrompt("race_portrait", style, `Race: ${race.displayName}`)
      }
      entityContext={buildContext()}
      currentImage={imagePath}
      onAccept={(filePath) => {
        const fileName = filePath.split(/[\\/]/).pop() ?? "";
        patch({ image: fileName });
      }}
      assetType="race_portrait"
      context={{ zone: "", entity_type: "race", entity_id: id }}
      surface="worldbuilding"
    />
  );
}

// â”€â”€â”€ String list editor (traits / abilities) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StringListEditor({
  items,
  onChange,
  placeholder,
  monospace,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-4 text-center text-2xs italic text-text-muted/80">
          None yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] py-1 pl-2 pr-1 transition hover:border-accent/30"
            >
              <input
                className={cx(
                  "min-w-0 bg-transparent text-xs text-text-primary outline-none",
                  monospace && "font-mono uppercase tracking-[0.12em]",
                )}
                style={{ width: `${Math.max(item.length, 4) + 1}ch` }}
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                title="Remove"
                aria-label={`Remove ${item}`}
                className="focus-ring inline-flex h-5 w-5 items-center justify-center rounded text-text-muted/70 transition hover:bg-status-error/15 hover:text-status-error"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <div className="ornate-input flex flex-1 items-center gap-2 px-2.5 py-1.5">
          <input
            className={cx(
              "min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60",
              monospace && "font-mono uppercase tracking-[0.12em]",
            )}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon />
          Add
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Shared label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}
