import { useCallback, useMemo, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type {
  EnchantmentDefinitionConfig,
  EnchantingConfig,
} from "@/types/config";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { saveProjectConfig } from "@/lib/saveConfig";

import { EnchantingHeader } from "../enchanting/EnchantingHeader";
import { EnchantmentList } from "../enchanting/EnchantmentList";
import { EnchantmentEditor } from "../enchanting/EnchantmentEditor";
import { EnchantmentPreview } from "../enchanting/EnchantmentPreview";
import { PlusIcon, SaveIcon } from "@/components/config/icons";
import { Section } from "../enchanting/Section";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function defaultEnchantment(displayName: string): EnchantmentDefinitionConfig {
  return {
    displayName: displayName || "New Enchantment",
    skill: "enchanting",
    skillRequired: 1,
    materials: [],
    xpReward: 30,
  };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_enchantment";
  if (!existing[base]) return base;
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

function nextDuplicateId(base: string, existing: Record<string, unknown>): string {
  let i = 2;
  while (existing[`${base}_copy_${i - 1}`]) i += 1;
  return `${base}_copy_${i - 1}`;
}

export function EnchantingPanel({ config, onChange }: ConfigPanelProps) {
  const enchanting = config.enchanting;
  const [selected, setSelected] = useState<string | null>(null);
  const dirty = useConfigStore((s) => s.dirty);
  const project = useProjectStore((s) => s.project);
  const [saving, setSaving] = useState(false);

  const patchGlobal = useCallback(
    (patch: Partial<EnchantingConfig>) => {
      onChange({ enchanting: { ...enchanting, ...patch } });
    },
    [enchanting, onChange],
  );

  const patchEnchantment = useCallback(
    (id: string, p: Partial<EnchantmentDefinitionConfig>) => {
      const current = enchanting.definitions[id];
      if (!current) return;
      patchGlobal({
        definitions: { ...enchanting.definitions, [id]: { ...current, ...p } },
      });
    },
    [enchanting.definitions, patchGlobal],
  );

  const addEnchantment = useCallback(() => {
    const id = nextDefaultId(enchanting.definitions);
    patchGlobal({
      definitions: {
        ...enchanting.definitions,
        [id]: defaultEnchantment("New Enchantment"),
      },
    });
    setSelected(id);
  }, [enchanting.definitions, patchGlobal]);

  const duplicateEnchantment = useCallback(() => {
    if (!selected || !enchanting.definitions[selected]) return;
    const source = enchanting.definitions[selected];
    const newId = nextDuplicateId(selected, enchanting.definitions);
    const cloned: EnchantmentDefinitionConfig = {
      ...source,
      displayName: `${source.displayName} (copy)`,
      materials: source.materials.map((m) => ({ ...m })),
      statBonuses: source.statBonuses ? { ...source.statBonuses } : undefined,
      targetSlots: source.targetSlots ? [...source.targetSlots] : undefined,
    };
    patchGlobal({
      definitions: { ...enchanting.definitions, [newId]: cloned },
    });
    setSelected(newId);
  }, [selected, enchanting.definitions, patchGlobal]);

  const deleteEnchantment = useCallback(() => {
    if (!selected) return;
    const next = { ...enchanting.definitions };
    delete next[selected];
    patchGlobal({ definitions: next });
    setSelected(null);
  }, [selected, enchanting.definitions, patchGlobal]);

  const renameEnchantment = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || enchanting.definitions[newId]) return;
      const next: Record<string, EnchantmentDefinitionConfig> = {};
      for (const [k, v] of Object.entries(enchanting.definitions)) {
        next[k === oldId ? newId : k] = v;
      }
      patchGlobal({ definitions: next });
      if (selected === oldId) setSelected(newId);
    },
    [enchanting.definitions, selected, patchGlobal],
  );

  const handleSave = useCallback(async () => {
    if (!project || !dirty || saving) return;
    setSaving(true);
    try {
      await saveProjectConfig(project);
      useToastStore.getState().show("Changes saved");
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  }, [project, dirty, saving]);

  const craftingSkillOptions = useMemo(
    () =>
      Object.keys(config.craftingSkills).map((id) => ({
        value: id,
        label: config.craftingSkills[id]!.displayName || id,
      })),
    [config.craftingSkills],
  );

  const equipSlotOptions = useMemo(
    () =>
      Object.entries(config.equipmentSlots)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([id, slot]) => ({
          value: id,
          label: slot.displayName || id,
        })),
    [config.equipmentSlots],
  );

  const statOptions = useMemo(
    () =>
      Object.keys(config.stats.definitions).map((id) => ({
        value: id,
        label: config.stats.definitions[id]!.displayName || id,
      })),
    [config.stats.definitions],
  );

  const selectedDef = selected ? enchanting.definitions[selected] : undefined;
  const isEmpty = Object.keys(enchanting.definitions).length === 0;

  return (
    <div className="flex flex-col gap-4">
      <EnchantingHeader
        selectedId={selected}
        hasUnsavedChanges={dirty}
        saving={saving}
        maxPerItem={enchanting.maxEnchantmentsPerItem}
        onMaxPerItemChange={(v) =>
          patchGlobal({ maxEnchantmentsPerItem: Math.max(1, v) })
        }
        onDeselect={() => setSelected(null)}
        onSave={handleSave}
        onDuplicate={duplicateEnchantment}
        onDelete={deleteEnchantment}
      />

      {isEmpty ? (
        <FirstWardHero onBegin={addEnchantment} />
      ) : (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <EnchantmentList
            enchanting={enchanting}
            craftingSkills={config.craftingSkills}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onAdd={addEnchantment}
          />
        </div>

        <div className="xl:col-span-8">
          {selected && selectedDef ? (
            <div className="flex flex-col gap-4">
              <EnchantmentEditor
                id={selected}
                def={selectedDef}
                craftingSkillOptions={craftingSkillOptions}
                equipSlotOptions={equipSlotOptions}
                statOptions={statOptions}
                craftingSkills={config.craftingSkills}
                craftingStationTypes={config.craftingStationTypes}
                equipmentSlots={config.equipmentSlots}
                onPatch={(p) => patchEnchantment(selected, p)}
                onRename={(v) => renameEnchantment(selected, v)}
              />
              <EnchantmentPreview
                id={selected}
                def={selectedDef}
                craftingSkills={config.craftingSkills}
                craftingStationTypes={config.craftingStationTypes}
                equipmentSlots={config.equipmentSlots}
                stats={config.stats}
              />
            </div>
          ) : (
            <Section
              title="Editing Enchantment"
              description="Pick an enchantment from the ledger to edit, or scribe a new ward."
            >
              <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-12 text-center">
                <p className="font-display text-xs text-text-muted">
                  Nothing selected.
                </p>
                <p className="mt-1 max-w-xs text-2xs leading-snug text-text-muted/70 mx-auto">
                  Choose an enchantment from the ledger to inscribe it, or add a
                  new ward to begin.
                </p>
                <button
                  type="button"
                  onClick={addEnchantment}
                  className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
                >
                  <PlusIcon />
                  New Enchantment
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function FirstWardHero({ onBegin }: { onBegin: () => void }) {
  // Reuse SaveIcon as a faint background sigil — its layered geometry
  // reads as a closed reliquary / chest, fitting "first ward".
  return (
    <section className="panel-surface bg-gradient-glow-top shadow-section shadow-glow-warm relative overflow-hidden rounded-3xl border-accent/25 px-8 py-16 text-center">
      <span
        aria-hidden="true"
        className="flourish-top-thread pointer-events-none absolute inset-x-10 top-0 h-px"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.10]"
      >
        <SaveIcon className="h-[260px] w-[260px] text-accent" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-4">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.28em] text-accent/80">
          The Enchanter's Ledger
        </p>
        <h2 className="font-display text-3xl font-semibold leading-tight text-text-primary">
          Scribe the First Ward.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-text-secondary">
          Enchantments inscribe stat bonuses and other augments onto specific
          equipment slots when crafted. Your ledger is empty — begin a ward
          and the discipline takes shape from there.
        </p>
        <button
          type="button"
          onClick={onBegin}
          className="focus-ring mt-2 inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/15 px-5 py-2.5 font-display text-sm font-semibold tracking-wide text-accent shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)] transition hover:bg-accent/25"
        >
          <PlusIcon className="h-4 w-4" />
          Begin a Ward
        </button>
      </div>
    </section>
  );
}
