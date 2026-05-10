import { useCallback, useMemo } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { CraftingSkillDefinition, CraftingStationTypeDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { useZoneStore } from "@/stores/zoneStore";
import { RegistryPanel } from "./RegistryPanel";

export function defaultCraftingSkillDefinition(raw: string): CraftingSkillDefinition {
  return { displayName: raw, type: "crafting" };
}

export function summarizeCraftingSkill(skill: CraftingSkillDefinition): string {
  return skill.type;
}

export function CraftingSkillDetail({
  skill,
  patch,
}: {
  skill: CraftingSkillDefinition;
  patch: (p: Partial<CraftingSkillDefinition>) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={skill.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Type" hint="Gathering skills harvest raw materials; Crafting skills transform materials into items.">
        <SelectInput
          value={skill.type}
          onCommit={(v) => patch({ type: v })}
          options={[
            { value: "gathering", label: "Gathering" },
            { value: "crafting", label: "Crafting" },
          ]}
        />
      </FieldRow>
    </>
  );
}

export function defaultCraftingStationTypeDefinition(raw: string): CraftingStationTypeDefinition {
  return { displayName: raw };
}

export function summarizeCraftingStationType(): string {
  return "";
}

export function CraftingStationTypeDetail({
  stationType,
  patch,
}: {
  stationType: CraftingStationTypeDefinition;
  patch: (p: Partial<CraftingStationTypeDefinition>) => void;
}) {
  return (
    <FieldRow label="Display Name" hint="Name shown to players (e.g. Forge, Alchemy Table, Loom).">
      <TextInput
        value={stationType.displayName}
        onCommit={(v) => patch({ displayName: v })}
      />
    </FieldRow>
  );
}

const STARTER_SKILLS: Array<[string, CraftingSkillDefinition]> = [
  ["forging", { displayName: "Forging", type: "crafting" }],
  ["alchemy", { displayName: "Alchemy", type: "crafting" }],
  ["mining", { displayName: "Mining", type: "gathering" }],
  ["herbalism", { displayName: "Herbalism", type: "gathering" }],
];

const STARTER_STATIONS: Array<[string, CraftingStationTypeDefinition]> = [
  ["forge", { displayName: "Forge" }],
  ["workbench", { displayName: "Workbench" }],
  ["loom", { displayName: "Loom" }],
];

interface EmptyRegistryCardProps {
  prompt: string;
  buttonLabel: string;
  onAdd: () => void;
}

function EmptyRegistryCard({ prompt, buttonLabel, onAdd }: EmptyRegistryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-muted/50 bg-gradient-panel-light px-4 py-4">
      <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
      <p className="font-body text-sm leading-snug text-text-muted">{prompt}</p>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 font-display text-xs uppercase tracking-wide-ui text-accent transition hover:bg-accent/20"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface OrphanWarningCardProps {
  count: number;
  singular: string;
  plural: string;
  ids: string[];
  hint: string;
}

function OrphanWarningCard({ count, singular, plural, ids, hint }: OrphanWarningCardProps) {
  const heading = `${count} ${count === 1 ? singular : plural}`;
  return (
    <div
      role="status"
      className="rounded-xl border border-status-warning/30 bg-status-warning/[0.08] px-4 py-3"
    >
      <h4 className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-status-warning">
        {heading}
      </h4>
      <p className="mt-1 font-body text-xs leading-snug text-text-muted">
        {hint}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span
            key={id}
            className="inline-flex items-center rounded-md border border-status-warning/30 bg-status-warning/10 px-1.5 py-0.5 font-mono text-[0.65rem] text-status-warning"
          >
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CraftingPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.crafting;
  const patch = (p: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...c, ...p } });

  const zones = useZoneStore((s) => s.zones);
  // Re-aggregate only when a zone's recipes object identity changes — keystrokes
  // inside non-recipe edits don't reach this list because zoneEdits returns a
  // shallow-merged WorldFile (recipes ref is preserved unless recipes themselves change).
  const recipeCollections = useMemo(() => {
    const out: Array<Record<string, { skill: string; station?: string }>> = [];
    for (const z of zones.values()) {
      if (z.data.recipes) out.push(z.data.recipes);
    }
    return out;
  }, [zones]);

  const { skillUsage, stationUsage } = useMemo(() => {
    const skillMap = new Map<string, number>();
    const stationMap = new Map<string, number>();
    for (const recipes of recipeCollections) {
      for (const recipe of Object.values(recipes)) {
        if (recipe.skill) {
          skillMap.set(recipe.skill, (skillMap.get(recipe.skill) ?? 0) + 1);
        }
        if (recipe.station) {
          stationMap.set(recipe.station, (stationMap.get(recipe.station) ?? 0) + 1);
        }
      }
    }
    return { skillUsage: skillMap, stationUsage: stationMap };
  }, [recipeCollections]);

  const orphanSkillIds = useMemo(
    () =>
      Object.keys(config.craftingSkills ?? {}).filter(
        (id) => (skillUsage.get(id) ?? 0) === 0,
      ),
    [config.craftingSkills, skillUsage],
  );

  const orphanStationIds = useMemo(
    () =>
      Object.keys(config.craftingStationTypes ?? {}).filter(
        (id) => (stationUsage.get(id) ?? 0) === 0,
      ),
    [config.craftingStationTypes, stationUsage],
  );

  const seedStarterSkills = useCallback(() => {
    const next = { ...(config.craftingSkills ?? {}) };
    for (const [id, def] of STARTER_SKILLS) {
      if (!next[id]) next[id] = def;
    }
    onChange({ craftingSkills: next });
  }, [config.craftingSkills, onChange]);

  const seedStarterStations = useCallback(() => {
    const next = { ...(config.craftingStationTypes ?? {}) };
    for (const [id, def] of STARTER_STATIONS) {
      if (!next[id]) next[id] = def;
    }
    onChange({ craftingStationTypes: next });
  }, [config.craftingStationTypes, onChange]);

  const skillsEmpty = Object.keys(config.craftingSkills ?? {}).length === 0;
  const stationsEmpty = Object.keys(config.craftingStationTypes ?? {}).length === 0;

  const formatRecipeCount = (n: number) =>
    n === 1 ? "1 recipe" : `${n} recipes`;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-border-muted/50 bg-gradient-panel-light px-4 py-3">
        <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
        <p className="font-body text-sm leading-snug text-text-muted">
          <span className="text-text-primary">Recipes live with the zones that teach them.</span>{" "}
          This panel tunes the systems those recipes lean on.
        </p>
      </div>

      <div className="ornate-divider" aria-hidden="true" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg uppercase tracking-wide-ui text-text-primary">
            Calibration
          </h3>
          <Section
            title="The Climb"
            description="Each discipline levels on its own arc, separate from character level. XP per level grows as base × level^exponent — gentler curves invite dabblers, steeper ones reward devotion."
          >
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Max Skill Level" hint="The mastery cap for every discipline. 100 is the classic ceiling; lower it (say, 50) for a friendlier reach.">
                <NumberInput
                  value={c.maxSkillLevel}
                  onCommit={(v) => patch({ maxSkillLevel: v ?? 100 })}
                  min={1}
                />
              </FieldRow>
              <FieldRow label="Base XP / Level" hint="The constant in the skill-up formula. Larger values stretch every level out. 50 is a steady, unhurried pace.">
                <NumberInput
                  value={c.baseXpPerLevel}
                  onCommit={(v) => patch({ baseXpPerLevel: v ?? 50 })}
                  min={1}
                />
              </FieldRow>
              <FieldRow label="XP Exponent" hint="How sharply XP cost rises. 1.0 is a flat staircase; 1.5 a steady incline; 2.0+ becomes a true late-game grind.">
                <NumberInput
                  value={c.xpExponent}
                  onCommit={(v) => patch({ xpExponent: v ?? 1.5 })}
                  min={1}
                  step={0.1}
                />
              </FieldRow>
            </div>
          </Section>

          <Section
            title="Gathering"
            description="The harvest loop. Cooldown sets the rhythm of returning to a node; the station bonus rewards crafters who set up shop instead of working from a knapsack in the field."
          >
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Cooldown (ms)" hint="Pause between hits on the same node. 3000ms feels brisk; 10000+ turns gathering into a slower, more deliberate ritual.">
                <NumberInput
                  value={c.gatherCooldownMs}
                  onCommit={(v) => patch({ gatherCooldownMs: v ?? 3000 })}
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Station Bonus" hint="Extra yield when crafting at a proper station rather than improvising in the field. Set to 0 to remove the perk entirely.">
                <NumberInput
                  value={c.stationBonusQuantity}
                  onCommit={(v) => patch({ stationBonusQuantity: v ?? 1 })}
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Specialization XP Bonus" hint="Bonus XP awarded inside a player's chosen specialty. 0.25 means +25%.">
                <NumberInput
                  value={c.specializationXpBonus}
                  onCommit={(v) => patch({ specializationXpBonus: v })}
                  placeholder="0.25"
                  min={0}
                  step={0.05}
                />
              </FieldRow>
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg uppercase tracking-wide-ui text-text-primary">
            Registries
          </h3>

          {skillsEmpty && (
            <EmptyRegistryCard
              prompt="No disciplines yet. Forging? Alchemy? Cartography? Name what hands in your world know how to do."
              buttonLabel="Add a starter set"
              onAdd={seedStarterSkills}
            />
          )}
          {orphanSkillIds.length > 0 && (
            <OrphanWarningCard
              count={orphanSkillIds.length}
              singular="unused discipline"
              plural="unused disciplines"
              ids={orphanSkillIds}
              hint="No recipes lean on these yet — either teach a recipe or trim them from the registry."
            />
          )}
          <div className="relative overflow-hidden rounded-xl border border-border-muted/50 bg-gradient-panel-light">
            <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
            {/*
              RegistryPanel ships the "+" and "x" glyphs hardcoded in its action buttons
              and does not accept addGlyph / deleteGlyph props. We leave it alone here
              because it is shared across many panels — swapping the glyphs needs a
              coordinated change to the shared component, not a local override.

              TODO: RegistryPanel.renderSummary currently takes a string. Once it accepts
              JSX, swap these template strings for proper Cinzel pill badges so the
              count and warning treatment can read with their own styling.
            */}
            <RegistryPanel<CraftingSkillDefinition>
              title="The Disciplines"
              items={config.craftingSkills}
              onItemsChange={(craftingSkills) => onChange({ craftingSkills })}
              placeholder="New skill"
              idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
              getDisplayName={(s) => s.displayName}
              defaultItem={defaultCraftingSkillDefinition}
              renderSummary={(id, s) => {
                const count = skillUsage.get(id) ?? 0;
                const tail = count === 0
                  ? "0 recipes (unused)"
                  : `used by ${formatRecipeCount(count)}`;
                return `${summarizeCraftingSkill(s)} · ${tail}`;
              }}
              renderDetail={(_id, s, patch) => (
                <CraftingSkillDetail skill={s} patch={patch} />
              )}
            />
          </div>

          {stationsEmpty && (
            <EmptyRegistryCard
              prompt="No workbenches yet. A forge for smiths, a loom for weavers, a quiet bench for tinkers — give your crafters somewhere to stand."
              buttonLabel="Add a starter set"
              onAdd={seedStarterStations}
            />
          )}
          {orphanStationIds.length > 0 && (
            <OrphanWarningCard
              count={orphanStationIds.length}
              singular="unused workbench"
              plural="unused workbenches"
              ids={orphanStationIds}
              hint="No recipe currently calls for these stations. Wire them into a recipe or retire them."
            />
          )}
          <div className="relative overflow-hidden rounded-xl border border-border-muted/50 bg-gradient-panel-light">
            <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
            <RegistryPanel<CraftingStationTypeDefinition>
              title="Workbenches & Forges"
              items={config.craftingStationTypes}
              onItemsChange={(craftingStationTypes) => onChange({ craftingStationTypes })}
              placeholder="New station type"
              idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
              getDisplayName={(s) => s.displayName}
              defaultItem={defaultCraftingStationTypeDefinition}
              renderSummary={(id) => {
                const count = stationUsage.get(id) ?? 0;
                return count === 0
                  ? "0 recipes (unused)"
                  : `used by ${formatRecipeCount(count)}`;
              }}
              renderDetail={(_id, s, patch) => (
                <CraftingStationTypeDetail stationType={s} patch={patch} />
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
