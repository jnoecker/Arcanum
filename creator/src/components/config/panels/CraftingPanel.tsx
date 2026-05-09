import { useCallback } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { CraftingSkillDefinition, CraftingStationTypeDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
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

export function CraftingPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.crafting;
  const patch = (p: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...c, ...p } });

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
          <div className="relative overflow-hidden rounded-xl border border-border-muted/50 bg-gradient-panel-light">
            <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
            {/*
              RegistryPanel ships the "+" and "x" glyphs hardcoded in its action buttons
              and does not accept addGlyph / deleteGlyph props. We leave it alone here
              because it is shared across many panels — swapping the glyphs needs a
              coordinated change to the shared component, not a local override.
            */}
            <RegistryPanel<CraftingSkillDefinition>
              title="The Disciplines"
              items={config.craftingSkills}
              onItemsChange={(craftingSkills) => onChange({ craftingSkills })}
              placeholder="New skill"
              idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
              getDisplayName={(s) => s.displayName}
              defaultItem={defaultCraftingSkillDefinition}
              renderSummary={(_id, s) => summarizeCraftingSkill(s)}
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
              renderSummary={summarizeCraftingStationType}
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
