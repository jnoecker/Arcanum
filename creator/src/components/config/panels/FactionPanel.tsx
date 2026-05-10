import { useCallback, useMemo, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import type { FactionConfig, FactionDefinition } from "@/types/config";
import { buildFactionUsage } from "@/lib/factionUsage";

import { Hero } from "./factions/Hero";
import { AllegianceList } from "./factions/AllegianceList";
import { FactionEditor } from "./factions/FactionEditor";
import { ReputationTiersTable } from "./factions/ReputationTiersTable";
import { RivalryMap } from "./factions/RivalryMap";
import { QuestRewards } from "./factions/QuestRewards";
import { CompassRoseIcon } from "./factions/icons";

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function titleCaseFromId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFAULT_FACTION_CONFIG: FactionConfig = {
  defaultReputation: 0,
  killPenalty: 5,
  killBonus: 3,
  definitions: {},
};

export function FactionPanel() {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const zones = useZoneStore((s) => s.zones);
  const [selected, setSelected] = useState<string | null>(null);
  const [newQuestId, setNewQuestId] = useState("");

  const rawFactions = config?.factions;
  const factions: FactionConfig = {
    ...DEFAULT_FACTION_CONFIG,
    ...rawFactions,
    definitions: rawFactions?.definitions ?? {},
  };

  const patch = useCallback(
    (p: Partial<FactionConfig>) => {
      if (!config) return;
      updateConfig({ ...config, factions: { ...factions, ...p } });
    },
    [config, factions, updateConfig],
  );

  const patchDefinition = useCallback(
    (id: string, p: Partial<FactionDefinition>) => {
      const defs = { ...factions.definitions };
      defs[id] = { ...(defs[id] ?? { name: id }), ...p };
      patch({ definitions: defs });
    },
    [factions.definitions, patch],
  );

  const addFaction = useCallback(() => {
    const base = "new_faction";
    let id = base;
    let i = 2;
    while (factions.definitions[id]) {
      id = `${base}_${i}`;
      i += 1;
    }
    const defs = {
      ...factions.definitions,
      [id]: { name: "New Faction" },
    };
    patch({ definitions: defs });
    setSelected(id);
  }, [factions.definitions, patch]);

  const duplicateFaction = useCallback(() => {
    if (!selected || !factions.definitions[selected]) return;
    const source = factions.definitions[selected]!;
    let newId = `${selected}_copy`;
    let i = 2;
    while (factions.definitions[newId]) {
      newId = `${selected}_copy_${i}`;
      i += 1;
    }
    const cloned: FactionDefinition = {
      ...source,
      name: `${source.name} (copy)`,
      enemies: source.enemies ? [...source.enemies] : undefined,
    };
    patch({
      definitions: { ...factions.definitions, [newId]: cloned },
    });
    setSelected(newId);
  }, [factions.definitions, patch, selected]);

  const deleteFaction = useCallback(
    (id: string) => {
      const { [id]: _, ...rest } = factions.definitions;
      const cleaned: Record<string, FactionDefinition> = {};
      for (const [k, def] of Object.entries(rest)) {
        cleaned[k] = {
          ...def,
          enemies: def.enemies?.filter((e) => e !== id),
        };
        if (cleaned[k]!.enemies?.length === 0) {
          delete cleaned[k]!.enemies;
        }
      }
      const nextRewards = factions.questRewards
        ? Object.fromEntries(
            Object.entries(factions.questRewards)
              .map(([qid, rewards]) => {
                const { [id]: _removed, ...kept } = rewards;
                return [qid, kept] as const;
              })
              .filter(([, r]) => Object.keys(r).length > 0),
          )
        : undefined;
      patch({
        definitions: cleaned,
        questRewards:
          nextRewards && Object.keys(nextRewards).length > 0 ? nextRewards : undefined,
      });
      if (selected === id) setSelected(null);
    },
    [factions.definitions, factions.questRewards, patch, selected],
  );

  const renameFaction = useCallback(
    (oldId: string, rawNewId: string) => {
      const newIdNorm = normalizeId(rawNewId);
      if (!newIdNorm || oldId === newIdNorm || factions.definitions[newIdNorm]) return;
      const next: Record<string, FactionDefinition> = {};
      for (const [k, v] of Object.entries(factions.definitions)) {
        const def = { ...v };
        if (def.enemies) {
          def.enemies = def.enemies.map((e) => (e === oldId ? newIdNorm : e));
        }
        next[k === oldId ? newIdNorm : k] = def;
      }
      const nextRewards = factions.questRewards
        ? Object.fromEntries(
            Object.entries(factions.questRewards).map(([qid, rewards]) => {
              const remapped = { ...rewards };
              if (oldId in remapped) {
                remapped[newIdNorm] = remapped[oldId]!;
                delete remapped[oldId];
              }
              return [qid, remapped];
            }),
          )
        : undefined;
      patch({ definitions: next, questRewards: nextRewards });
      if (selected === oldId) setSelected(newIdNorm);
    },
    [factions.definitions, factions.questRewards, patch, selected],
  );

  const addQuestReward = useCallback(() => {
    const qid = newQuestId.trim();
    if (!qid) return;
    const existing = factions.questRewards ?? {};
    if (existing[qid]) return;
    patch({ questRewards: { ...existing, [qid]: {} } });
    setNewQuestId("");
  }, [newQuestId, factions.questRewards, patch]);

  const patchQuestReward = useCallback(
    (questId: string, factionId: string, amount: number | undefined) => {
      const existing = factions.questRewards ?? {};
      const entry = { ...(existing[questId] ?? {}) };
      if (amount == null || amount === 0) delete entry[factionId];
      else entry[factionId] = amount;
      patch({ questRewards: { ...existing, [questId]: entry } });
    },
    [factions.questRewards, patch],
  );

  const renameQuestReward = useCallback(
    (oldQid: string, newQid: string) => {
      const trimmed = newQid.trim();
      if (!trimmed || oldQid === trimmed) return;
      const existing = factions.questRewards ?? {};
      if (existing[trimmed]) return;
      const next: Record<string, Record<string, number>> = {};
      for (const [qid, rewards] of Object.entries(existing)) {
        next[qid === oldQid ? trimmed : qid] = rewards;
      }
      patch({ questRewards: next });
    },
    [factions.questRewards, patch],
  );

  const deleteQuestReward = useCallback(
    (questId: string) => {
      const existing = factions.questRewards ?? {};
      const { [questId]: _, ...rest } = existing;
      patch({ questRewards: Object.keys(rest).length > 0 ? rest : undefined });
    },
    [factions.questRewards, patch],
  );

  const factionIds = useMemo(
    () => Object.keys(factions.definitions),
    [factions.definitions],
  );

  const factionLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, def] of Object.entries(factions.definitions)) {
      m.set(id, def.name);
    }
    return m;
  }, [factions.definitions]);

  const factionOptions = useMemo(
    () =>
      factionIds.map((id) => ({
        value: id,
        label: factions.definitions[id]!.name,
      })),
    [factionIds, factions.definitions],
  );

  const definedIdsSet = useMemo(() => new Set(factionIds), [factionIds]);
  const usageReport = useMemo(
    () => buildFactionUsage(zones, definedIdsSet, factions.questRewards),
    [zones, definedIdsSet, factions.questRewards],
  );

  const handleAdoptOrphanId = useCallback(
    (orphanId: string) => {
      const id = normalizeId(orphanId);
      if (!id || factions.definitions[id]) {
        setSelected(id);
        return;
      }
      const defs = {
        ...factions.definitions,
        [id]: { name: titleCaseFromId(id) },
      };
      patch({ definitions: defs });
      setSelected(id);
    },
    [factions.definitions, patch],
  );

  if (!config) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel-surface flex flex-col gap-4 rounded-2xl p-4 shadow-section">
        <RivalryMap
          definitions={factions.definitions}
          factionLabelMap={factionLabelMap}
        />
        <div className="border-t border-[var(--chrome-stroke)] pt-3">
          <Hero factions={factions} onPatch={patch} />
        </div>
      </section>

      {usageReport.orphanIds.length > 0 && (
        <OrphanReferencesBanner
          orphanIds={usageReport.orphanIds}
          usage={usageReport.usage}
          onAdopt={handleAdoptOrphanId}
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <AllegianceList
            factionIds={factionIds}
            definitions={factions.definitions}
            usage={usageReport.usage}
            selected={selected}
            onSelect={(id) => setSelected(selected === id ? null : id)}
            onAdd={addFaction}
            onDuplicate={duplicateFaction}
            onDelete={() => selected && deleteFaction(selected)}
          />
        </div>

        <div className="xl:col-span-9">
          {selected && factions.definitions[selected] ? (
            <FactionEditor
              id={selected}
              definition={factions.definitions[selected]!}
              factionIds={factionIds}
              factionLabelMap={factionLabelMap}
              onPatch={(p) => patchDefinition(selected, p)}
              onClose={() => setSelected(null)}
              onDelete={() => deleteFaction(selected)}
              onRename={(v) => renameFaction(selected, v)}
            />
          ) : (
            <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center shadow-section">
              <CompassRoseIcon className="mb-1 h-7 w-7 text-text-muted/50" />
              <p className="font-display text-sm text-text-primary">
                No allegiance chosen
              </p>
              <p className="max-w-xs text-2xs text-text-muted/80">
                Pick one from the rolls, or inscribe a new faction.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReputationTiersTable
          tiers={factions.tiers}
          onChange={(tiers) => patch({ tiers })}
        />
        <QuestRewards
          questRewards={factions.questRewards}
          factionOptions={factionOptions}
          newQuestId={newQuestId}
          onNewQuestIdChange={setNewQuestId}
          onAddQuest={addQuestReward}
          onPatchPair={patchQuestReward}
          onRenameQuest={renameQuestReward}
          onDeleteQuest={deleteQuestReward}
        />
      </div>
    </div>
  );
}

interface OrphanReferencesBannerProps {
  orphanIds: string[];
  usage: Map<string, { mobCount: number; questCount: number; zones: Set<string> }>;
  onAdopt: (id: string) => void;
}

function OrphanReferencesBanner({
  orphanIds,
  usage,
  onAdopt,
}: OrphanReferencesBannerProps) {
  return (
    <div
      role="status"
      className="rounded-xl border border-status-warning/30 bg-status-warning/[0.08] px-4 py-3"
    >
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-2xs uppercase tracking-wider text-status-warning">
          {orphanIds.length === 1
            ? "1 reference to an undefined faction"
            : `${orphanIds.length} references to undefined factions`}
        </p>
        <p className="text-2xs leading-snug text-text-muted/85">
          Mobs or quests cite faction IDs that don't exist in the allegiance roll.
          Click an ID to prefill the add field below — or rename the offending references.
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {orphanIds.map((oid) => {
            const stats = usage.get(oid);
            const tip = stats
              ? `${stats.mobCount} mob${stats.mobCount === 1 ? "" : "s"} · ${stats.questCount} quest${stats.questCount === 1 ? "" : "s"} · ${stats.zones.size} zone${stats.zones.size === 1 ? "" : "s"}`
              : undefined;
            return (
              <button
                key={oid}
                type="button"
                onClick={() => onAdopt(oid)}
                title={tip ? `Define this faction (${tip})` : "Define this faction"}
                className="focus-ring inline-flex items-center gap-1 rounded-md border border-status-warning/40 bg-status-warning/10 px-2 py-0.5 font-mono text-2xs text-status-warning transition hover:border-status-warning/60 hover:bg-status-warning/20"
              >
                {oid}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
