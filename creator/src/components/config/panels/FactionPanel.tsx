import { useCallback, useMemo, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import type { FactionConfig, FactionDefinition } from "@/types/config";

import { Hero } from "./factions/Hero";
import { AllegianceList } from "./factions/AllegianceList";
import { FactionEditor } from "./factions/FactionEditor";
import { ReputationTiersTable } from "./factions/ReputationTiersTable";
import { RivalryMap } from "./factions/RivalryMap";
import { QuestRewards } from "./factions/QuestRewards";
import { SectionCard } from "./factions/SectionCard";
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
  const [selected, setSelected] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
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
    const id = normalizeId(newId);
    if (!id || factions.definitions[id]) return;
    const defs = {
      ...factions.definitions,
      [id]: { name: titleCaseFromId(id) },
    };
    patch({ definitions: defs });
    setNewId("");
    setSelected(id);
  }, [newId, factions.definitions, patch]);

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

  if (!config) return null;

  return (
    <div className="flex flex-col gap-4">
      <Hero factions={factions} count={factionIds.length} onPatch={patch} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AllegianceList
          factionIds={factionIds}
          definitions={factions.definitions}
          factionLabelMap={factionLabelMap}
          selected={selected}
          newId={newId}
          onNewIdChange={setNewId}
          onAdd={addFaction}
          onSelect={(id) => setSelected(selected === id ? null : id)}
        />

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
          <SectionCard
            title="Editing Faction"
            description="Pick an allegiance from the list to edit its display name, flavor description, and rivalries."
          >
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-10 text-center">
              <CompassRoseIcon className="mx-auto mb-2 h-7 w-7 text-text-muted/50" />
              <p className="text-2xs italic text-text-muted/80">
                Nothing selected. Click a faction on the left to edit it.
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      <RivalryMap
        definitions={factions.definitions}
        factionLabelMap={factionLabelMap}
      />

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
