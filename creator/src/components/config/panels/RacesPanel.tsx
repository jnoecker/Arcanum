import { useCallback, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { AppConfig, RaceDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { useStatMods } from "@/lib/useStatMods";
import { FieldRow, TextInput, IconButton, CommitTextarea } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { getBackstoryEnhancePrompt } from "@/lib/lorePrompts";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";

const BODY_DESC_SYSTEM_PROMPT = `You are an expert AI image prompt engineer writing body descriptions for fantasy RPG character sprites.

Given a race's name, lore, and traits, write a concise but vivid prompt fragment describing the race's PHYSICAL BODY ONLY — not clothing or gear (those come from the class).

Rules:
- 1-3 sentences of dense visual detail optimized for AI image generation
- Focus on: body shape, skin/surface material, colors, face, hair/head features, any magical visual effects
- Match the visual tone to the world's setting and themes
- Do NOT include clothing, armor, or weapons — the class system handles those
- Output ONLY the description text — no quotes, no explanation`;

const STAFF_PROMPT_SYSTEM_PROMPT = `You are an expert AI image prompt engineer writing god-tier staff sprite prompts for a fantasy MUD RPG.

Given a race's name and body description, write a COMPLETE image generation prompt for an ascended/divine administrator version of this race. This should be dramatically more powerful and visually impressive than any player tier.

Rules:
- 3-6 sentences of vivid, dense prompt detail
- The figure should radiate cosmic/divine authority — golden light, celestial effects, impossible scale
- Incorporate the race's core visual identity but elevated to godlike levels
- Include dramatic magical effects: halos, orbiting elements, reality distortion, blazing energy
- Must be unmistakably different from player sprites — a being of supreme authority
- Output ONLY the prompt text — no quotes, no explanation`;

export function defaultRaceDefinition(raw: string): RaceDefinitionConfig {
  return { displayName: raw };
}

export function summarizeRace(race: RaceDefinitionConfig): string {
  const mods = race.statMods ?? {};
  const parts: string[] = [];
  const modStr = Object.entries(mods)
    .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`)
    .join(" ");
  if (modStr) parts.push(modStr);
  if (race.traits?.length) parts.push(`${race.traits.length} traits`);
  if (race.image) parts.push("art");
  return parts.join(" | ");
}

export function renameRaceDefinition(config: AppConfig, oldId: string, newId: string) {
  const races: Record<string, RaceDefinitionConfig> = {};
  for (const [k, v] of Object.entries(config.races)) {
    races[k === oldId ? newId : k] = v;
  }
  return races;
}

export function RacesPanel({ config, onChange }: ConfigPanelProps) {
  const statDefs = config.stats.definitions;
  const statIds = Object.keys(statDefs);

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      onChange({ races: renameRaceDefinition(config, oldId, newId) });
    },
    [config.races, onChange],
  );

  return (
    <RegistryPanel<RaceDefinitionConfig>
      title="Races"
      items={config.races}
      onItemsChange={(races) => onChange({ races })}
      onRenameId={handleRename}
      placeholder="New race"
      idTransform={(raw) => raw.trim().toUpperCase().replace(/\s+/g, "_")}
      getDisplayName={(r) => r.displayName}
      defaultItem={defaultRaceDefinition}
      renderSummary={(_id, race) => summarizeRace(race)}
      renderDetail={(id, race, patch) => (
        <RaceDetail
          id={id}
          race={race}
          patch={patch}
          statIds={statIds}
          statDefs={statDefs}
        />
      )}
    />
  );
}

export function RaceDetail({
  id,
  race,
  patch,
  statIds,
  statDefs,
}: {
  id: string;
  race: RaceDefinitionConfig;
  patch: (p: Partial<RaceDefinitionConfig>) => void;
  statIds: string[];
  statDefs: Record<string, { displayName: string; baseStat: number }>;
}) {
  const assetsDir = useAssetStore((s) => s.assetsDir);

  // Build the full image path for display
  const imagePath = race.image && assetsDir
    ? `${assetsDir}\\images\\${race.image}`
    : undefined;

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
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={race.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput
          value={race.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="Short tagline"
        />
      </FieldRow>

      {/* Backstory */}
      <CommitTextarea
        label="Backstory"
        value={race.backstory ?? ""}
        onCommit={(v) => patch({ backstory: v || undefined })}
        placeholder="Lore, history, and cultural background..."
      />
      <EnhanceDescriptionButton
        entitySummary={buildContext()}
        currentDescription={race.backstory}
        onAccept={(text) => patch({ backstory: text })}
        systemPrompt={getBackstoryEnhancePrompt()}
        label="Enhance backstory"
      />

      {/* Traits */}
      <StringListEditor
        label="Traits"
        items={race.traits ?? []}
        onChange={(traits) => patch({ traits: traits.length > 0 ? traits : undefined })}
        placeholder="e.g. Darkvision"
      />

      {/* Abilities */}
      <StringListEditor
        label="Abilities"
        items={race.abilities ?? []}
        onChange={(abilities) => patch({ abilities: abilities.length > 0 ? abilities : undefined })}
        placeholder="e.g. STONE_FORM"
      />

      {/* Stat Mods */}
      <RaceStatMods
        statMods={race.statMods}
        statIds={statIds}
        statDefs={statDefs}
        onChange={(mods) => patch({ statMods: mods })}
      />

      {/* Sprite / Portrait Descriptions */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Sprite &amp; Portrait Generation
        </h5>
        <CommitTextarea
          label="Body Description"
          value={race.bodyDescription ?? ""}
          onCommit={(v) => patch({ bodyDescription: v || undefined })}
          placeholder="Physical appearance for sprite/portrait prompts (e.g. 'tall luminous humanoid with translucent crystalline skin...')"
        />
        <EnhanceDescriptionButton
          entitySummary={`Race: ${race.displayName}\n${race.description ? `Description: ${race.description}` : ""}${race.backstory ? `\nBackstory: ${race.backstory}` : ""}${race.traits?.length ? `\nTraits: ${race.traits.join(", ")}` : ""}`}
          currentDescription={race.bodyDescription}
          onAccept={(v) => patch({ bodyDescription: v })}
          systemPrompt={BODY_DESC_SYSTEM_PROMPT}
          label="AI Generate Body Description"
        />
        <CommitTextarea
          label="Staff Tier Prompt"
          value={race.staffPrompt ?? ""}
          onCommit={(v) => patch({ staffPrompt: v || undefined })}
          placeholder="Complete prompt override for the god-tier (tstaff) sprite. Leave blank to use the default template."
          rows={4}
        />
        <EnhanceDescriptionButton
          entitySummary={`Race: ${race.displayName}\n${race.description ? `Description: ${race.description}` : ""}${race.bodyDescription ? `\nBody: ${race.bodyDescription}` : ""}`}
          currentDescription={race.staffPrompt}
          onAccept={(v) => patch({ staffPrompt: v })}
          systemPrompt={STAFF_PROMPT_SYSTEM_PROMPT}
          label="AI Generate Staff Prompt"
        />
      </div>

      {/* Concept Art */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Concept Art
        </h5>
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
      </div>
    </>
  );
}



/** Editable list of strings (for traits, abilities) */
function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [newValue, setNewValue] = useState("");

  const addItem = () => {
    const v = newValue.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setNewValue("");
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
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-2xs font-display uppercase tracking-widest text-text-muted">
          {label}
        </h5>
        <span className="text-2xs text-text-muted">({items.length})</span>
      </div>
      {items.length > 0 && (
        <div className="mb-1 flex flex-col gap-0.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
              />
              <IconButton onClick={() => removeItem(i)} title="Remove" danger>
                x
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <input
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          placeholder={placeholder}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
        />
        <IconButton onClick={addItem} title={`Add ${label.toLowerCase()}`}>
          +
        </IconButton>
      </div>
    </div>
  );
}

/**
 * Renders +/- steppers for every defined stat.
 * Shows all stats (not just those with non-zero values) so the user
 * can easily adjust any stat. Only non-zero values are serialized.
 * Includes net-zero indicator and effective base stats preview.
 */
function RaceStatMods({
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
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-2xs font-display uppercase tracking-widest text-text-muted">
          Stat Modifiers
        </h5>
        <span
          className={`text-2xs font-medium ${
            netTotal === 0
              ? "text-status-success"
              : "text-status-warning"
          }`}
        >
          Net: {netTotal >= 0 ? "+" : ""}
          {netTotal}
          {netTotal === 0 ? " (balanced)" : ""}
        </span>
      </div>
      {statIds.length === 0 ? (
        <p className="text-2xs text-text-muted">No stats defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {statIds.map((statId) => {
            const mod = mods[statId] ?? 0;
            const def = statDefs[statId]!;
            const effective = def.baseStat + mod;
            return (
              <div key={statId} className="flex items-center gap-1.5">
                <span className="w-20 shrink-0 text-xs text-text-muted" title={def.displayName}>
                  {statId}
                </span>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => updateMod(statId, mod - 1)}
                  title="Decrease"
                >
                  -
                </button>
                <span
                  className={`w-8 text-center text-xs font-medium ${
                    mod > 0
                      ? "text-status-success"
                      : mod < 0
                        ? "text-status-danger"
                        : "text-text-muted"
                  }`}
                >
                  {mod >= 0 ? "+" : ""}
                  {mod}
                </span>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => updateMod(statId, mod + 1)}
                  title="Increase"
                >
                  +
                </button>
                <span className="ml-1 text-2xs text-text-muted">
                  = {effective}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
