import { useCallback, useMemo, useState, memo } from "react";
import { useConfigStore } from "@/stores/configStore";
import type { FactionConfig, FactionDefinition, ReputationTier } from "@/types/config";
import { DEFAULT_REPUTATION_TIERS } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
  FieldGrid,
  CompactField,
  Badge,
} from "@/components/ui/FormWidgets";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
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
          nextRewards && Object.keys(nextRewards).length > 0
            ? nextRewards
            : undefined,
      });
      if (selected === id) setSelected(null);
    },
    [factions.definitions, factions.questRewards, patch, selected],
  );

  const renameFaction = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || factions.definitions[newId]) return;
      const next: Record<string, FactionDefinition> = {};
      for (const [k, v] of Object.entries(factions.definitions)) {
        const def = { ...v };
        if (def.enemies) {
          def.enemies = def.enemies.map((e) => (e === oldId ? newId : e));
        }
        next[k === oldId ? newId : k] = def;
      }
      const nextRewards = factions.questRewards
        ? Object.fromEntries(
            Object.entries(factions.questRewards).map(([qid, rewards]) => {
              const remapped = { ...rewards };
              if (oldId in remapped) {
                remapped[newId] = remapped[oldId]!;
                delete remapped[oldId];
              }
              return [qid, remapped];
            }),
          )
        : undefined;
      patch({ definitions: next, questRewards: nextRewards });
      if (selected === oldId) setSelected(newId);
      setRenaming(null);
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
      if (amount == null || amount === 0) {
        delete entry[factionId];
      } else {
        entry[factionId] = amount;
      }
      const next = { ...existing, [questId]: entry };
      patch({ questRewards: next });
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
      patch({
        questRewards: Object.keys(rest).length > 0 ? rest : undefined,
      });
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
    <div className="flex flex-col gap-6">
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              Political landscape
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Factions &amp; Reputation
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Guilds, courts, cabals, and mercenary companies. Players earn or
              lose standing with each through quests and combat; reputation
              gates shops, quests, and regions tied to each group.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4 border-t border-border-muted/50 pt-4">
            <GlobalStat
              label="Starting rep"
              hint="Where new players begin with every faction."
            >
              <NumberInput
                value={factions.defaultReputation}
                onCommit={(v) => patch({ defaultReputation: v ?? 0 })}
              />
            </GlobalStat>
            <GlobalStat
              label="Kill penalty"
              hint="Lost with the mob's own faction per kill (× level)."
              tint="rose"
            >
              <NumberInput
                value={factions.killPenalty}
                onCommit={(v) => patch({ killPenalty: v ?? 5 })}
                min={0}
              />
            </GlobalStat>
            <GlobalStat
              label="Kill bonus"
              hint="Gained with the victim's enemy factions per kill (× level)."
              tint="emerald"
            >
              <NumberInput
                value={factions.killBonus}
                onCommit={(v) => patch({ killBonus: v ?? 3 })}
                min={0}
              />
            </GlobalStat>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {factionIds.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {factionIds.length === 1 ? "faction" : "factions"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-text-primary">
              Allegiances
            </h3>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted/70">
              Every political group in the world. Mobs and quests reference
              these IDs.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="w-44 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="new_faction_id"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addFaction();
              }}
            />
            <button
              type="button"
              onClick={addFaction}
              disabled={!newId.trim()}
              className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </header>

        {factionIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 px-6 py-12 text-center">
            <p className="font-display text-sm text-text-muted">
              No factions defined.
            </p>
            <p className="mt-1 text-2xs text-text-muted/70">
              Add a guild, a court, or a cabal — try{" "}
              <code className="text-text-muted">thieves_guild</code> or{" "}
              <code className="text-text-muted">royal_court</code>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {factionIds.map((id) => (
              <FactionCard
                key={id}
                id={id}
                definition={factions.definitions[id]!}
                factionLabelMap={factionLabelMap}
                selected={selected === id}
                onSelect={() => setSelected(selected === id ? null : id)}
                onDelete={() => deleteFaction(id)}
              />
            ))}
          </div>
        )}

        {selected && factions.definitions[selected] && (
          <FactionEditor
            id={selected}
            definition={factions.definitions[selected]!}
            factionIds={factionIds}
            factionLabelMap={factionLabelMap}
            renaming={renaming === selected}
            renameValue={renameValue}
            onStartRename={() => {
              setRenaming(selected);
              setRenameValue(selected);
            }}
            onRenameChange={setRenameValue}
            onCommitRename={() => renameFaction(selected, renameValue)}
            onCancelRename={() => setRenaming(null)}
            onPatch={(p) => patchDefinition(selected, p)}
            onClose={() => setSelected(null)}
            onDelete={() => deleteFaction(selected)}
          />
        )}
      </section>

      <ReputationTiersSection
        tiers={factions.tiers}
        onChange={(tiers) => patch({ tiers })}
      />

      {factionIds.length > 1 && (
        <RivalryGraph
          definitions={factions.definitions}
          factionLabelMap={factionLabelMap}
        />
      )}

      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-text-primary">
              Quest Reputation Rewards
            </h3>
            <p className="mt-0.5 max-w-xl text-2xs leading-relaxed text-text-muted/70">
              Reputation changes granted when a quest completes. Push players
              toward or away from factions based on the jobs they accept.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="w-44 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="quest_id"
              value={newQuestId}
              onChange={(e) => setNewQuestId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addQuestReward();
              }}
            />
            <button
              type="button"
              onClick={addQuestReward}
              disabled={!newQuestId.trim()}
              className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Map quest
            </button>
          </div>
        </header>

        {!factions.questRewards ||
        Object.keys(factions.questRewards).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 px-6 py-8 text-center">
            <p className="text-2xs text-text-muted/70">
              No quest rewards mapped. Type a quest ID above to connect it to
              reputation changes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(factions.questRewards).map(([qid, rewards]) => (
              <QuestRewardRow
                key={qid}
                questId={qid}
                rewards={rewards}
                factionOptions={factionOptions}
                onRename={(newQid) => renameQuestReward(qid, newQid)}
                onPatch={(factionId, amount) =>
                  patchQuestReward(qid, factionId, amount)
                }
                onDelete={() => deleteQuestReward(qid)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GlobalStat({
  label,
  hint,
  tint = "neutral",
  children,
}: {
  label: string;
  hint?: string;
  tint?: "neutral" | "rose" | "emerald";
  children: React.ReactNode;
}) {
  const tintClass =
    tint === "rose"
      ? "border-status-error/30 bg-status-error/[0.06]"
      : tint === "emerald"
        ? "border-status-success/30 bg-status-success/[0.06]"
        : "border-border-muted/60 bg-bg-primary/30";
  return (
    <div
      className={cx(
        "flex min-w-[8rem] flex-col gap-1 rounded-xl border px-3 py-2",
        tintClass,
      )}
    >
      <p className="font-display text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {children}
      {hint && (
        <p className="text-[0.6rem] leading-snug text-text-muted/60">{hint}</p>
      )}
    </div>
  );
}

interface FactionCardProps {
  id: string;
  definition: FactionDefinition;
  factionLabelMap: Map<string, string>;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function FactionCard({
  id,
  definition,
  factionLabelMap,
  selected,
  onSelect,
  onDelete,
}: FactionCardProps) {
  const enemies = definition.enemies ?? [];

  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-2xl border transition",
        selected
          ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-10px_rgb(var(--accent-rgb)/0.65)]"
          : "border-border-muted/50 bg-bg-primary/25 hover:border-border-default hover:bg-bg-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="focus-ring flex w-full flex-col gap-2 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-semibold text-text-primary">
              {definition.name || id}
            </h4>
            <p className="truncate font-mono text-2xs uppercase tracking-widest text-text-muted/70">
              {id}
            </p>
          </div>
        </div>

        {definition.description && (
          <p className="line-clamp-2 text-2xs italic leading-snug text-text-muted/70">
            {definition.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {enemies.length === 0 ? (
            <Badge variant="muted">No rivals</Badge>
          ) : (
            <>
              <span className="text-[0.55rem] font-semibold uppercase tracking-wider text-text-muted/60">
                Rivals ·
              </span>
              {enemies.slice(0, 4).map((e) => {
                const label = factionLabelMap.get(e);
                const missing = !label;
                return (
                  <span
                    key={e}
                    className={cx(
                      "rounded-full border px-2 py-0.5 font-display text-2xs",
                      missing
                        ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                        : "border-status-error/30 bg-status-error/10 text-status-error",
                    )}
                    title={missing ? `Unknown faction: ${e}` : undefined}
                  >
                    {label ?? `? ${e}`}
                  </span>
                );
              })}
              {enemies.length > 4 && (
                <span className="text-2xs text-text-muted/60">
                  +{enemies.length - 4} more
                </span>
              )}
            </>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${id}`}
        className="focus-ring absolute right-2 top-2 rounded p-1 text-text-muted/40 opacity-0 transition hover:bg-status-error/15 hover:text-status-error group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

interface FactionEditorProps {
  id: string;
  definition: FactionDefinition;
  factionIds: string[];
  factionLabelMap: Map<string, string>;
  renaming: boolean;
  renameValue: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onPatch: (p: Partial<FactionDefinition>) => void;
  onClose: () => void;
  onDelete: () => void;
}

function FactionEditor({
  id,
  definition,
  factionIds,
  factionLabelMap,
  renaming,
  renameValue,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onPatch,
  onClose,
  onDelete,
}: FactionEditorProps) {
  const enemies = definition.enemies ?? [];
  const others = factionIds.filter((fid) => fid !== id);

  const toggleEnemy = (enemyId: string) => {
    const next = enemies.includes(enemyId)
      ? enemies.filter((e) => e !== enemyId)
      : [...enemies, enemyId];
    onPatch({ enemies: next.length > 0 ? next : undefined });
  };

  return (
    <div className="panel-surface relative overflow-hidden rounded-2xl p-5 shadow-section">
      <div className="relative z-10">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-border-muted/50 pb-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-wider text-text-muted">
              Editing faction
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <h3 className="font-display font-semibold text-base text-text-primary">
                {definition.name || id}
              </h3>
              {renaming ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    className="w-40 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 font-mono text-xs text-text-primary outline-none focus:border-accent/50"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRename();
                      if (e.key === "Escape") onCancelRename();
                    }}
                  />
                  <button
                    type="button"
                    onClick={onCommitRename}
                    className="rounded bg-accent/20 px-1.5 py-0.5 text-2xs text-accent hover:bg-accent/30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="rounded px-1.5 py-0.5 text-2xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onStartRename}
                  title="Rename ID"
                  className="font-mono text-xs font-normal uppercase tracking-widest text-text-muted/70 underline-offset-2 hover:text-text-primary hover:underline"
                >
                  {id}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring shrink-0 rounded-full border border-border-muted/60 px-3 py-1 text-2xs text-text-muted transition hover:border-border-default hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <FieldGrid>
            <CompactField
              label="Display name"
              span
              hint="Shown in reputation readouts, quest text, and faction commands."
            >
              <TextInput
                value={definition.name}
                onCommit={(v) => onPatch({ name: v })}
                placeholder="The Royal Court"
              />
            </CompactField>
            <CompactField
              label="Flavor description"
              span
              hint="Short summary shown in faction info and help text."
            >
              <CommitTextarea
                label="Description"
                value={definition.description ?? ""}
                onCommit={(v) =>
                  onPatch({ description: v || undefined })
                }
                placeholder="A secretive order of spellwrights who..."
                rows={2}
              />
            </CompactField>
          </FieldGrid>

          <div>
            <div className="mb-2">
              <p className="font-display text-2xs uppercase tracking-wider text-text-muted">
                Rivals
              </p>
              <p className="mt-0.5 text-2xs leading-snug text-text-muted/60">
                Killing a member of this faction grants reputation with the
                selected rivals, and vice versa.
              </p>
            </div>
            {others.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                Add another faction to set up rivalries.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {others.map((eid) => {
                  const on = enemies.includes(eid);
                  return (
                    <button
                      key={eid}
                      type="button"
                      onClick={() => toggleEnemy(eid)}
                      aria-pressed={on}
                      className={cx(
                        "focus-ring rounded-full border px-3 py-1 text-2xs font-medium transition",
                        on
                          ? "border-status-error/45 bg-status-error/15 text-status-error"
                          : "border-border-muted/60 bg-bg-primary/40 text-text-muted hover:border-border-default hover:text-text-secondary",
                      )}
                    >
                      {factionLabelMap.get(eid) ?? eid}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-border-muted/50 pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="focus-ring rounded border border-status-error/30 bg-status-error/10 px-2.5 py-1 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
            >
              Delete faction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuestRewardRowProps {
  questId: string;
  rewards: Record<string, number>;
  factionOptions: { value: string; label: string }[];
  onRename: (newId: string) => void;
  onPatch: (factionId: string, amount: number | undefined) => void;
  onDelete: () => void;
}

const QuestRewardRow = memo(function QuestRewardRow({
  questId,
  rewards,
  factionOptions,
  onRename,
  onPatch,
  onDelete,
}: QuestRewardRowProps) {
  const [newFaction, setNewFaction] = useState("");
  const [newAmount, setNewAmount] = useState<number>(50);
  const entries = Object.entries(rewards);

  const availableFactions = factionOptions.filter(
    (opt) => !(opt.value in rewards),
  );

  const addPair = () => {
    if (!newFaction) return;
    onPatch(newFaction, newAmount);
    setNewFaction("");
    setNewAmount(50);
  };

  return (
    <div className="rounded-2xl border border-border-muted/50 bg-bg-primary/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-display text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
            Quest
          </span>
          <div className="min-w-0 flex-1">
            <TextInput
              value={questId}
              onCommit={onRename}
              placeholder="quest_id"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${questId}`}
          className="focus-ring rounded p-1 text-text-muted/50 transition hover:bg-status-error/15 hover:text-status-error"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-2xs italic text-text-muted/60">
          No reputation changes mapped yet.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map(([fid, delta]) => {
            const positive = delta >= 0;
            return (
              <div
                key={fid}
                className={cx(
                  "flex items-center gap-2 rounded-lg border px-2 py-1",
                  positive
                    ? "border-status-success/25 bg-status-success/[0.06]"
                    : "border-status-error/25 bg-status-error/[0.06]",
                )}
              >
                <span
                  className={cx(
                    "flex-1 truncate font-display text-xs font-semibold",
                    positive ? "text-status-success" : "text-status-error",
                  )}
                >
                  {factionOptions.find((o) => o.value === fid)?.label ?? fid}
                </span>
                <div className="w-24 shrink-0">
                  <NumberInput
                    value={delta}
                    onCommit={(v) => onPatch(fid, v)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onPatch(fid, undefined)}
                  aria-label="Remove"
                  className="focus-ring rounded p-1 text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4L12 12M12 4L4 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {availableFactions.length > 0 && (
        <div className="mt-2 flex items-center gap-2 border-t border-border-muted/30 pt-2">
          <div className="min-w-0 flex-1">
            <SelectInput
              value={newFaction}
              onCommit={setNewFaction}
              options={[
                { value: "", label: "— pick a faction —" },
                ...availableFactions,
              ]}
            />
          </div>
          <div className="w-24 shrink-0">
            <NumberInput
              value={newAmount}
              onCommit={(v) => setNewAmount(v ?? 0)}
            />
          </div>
          <button
            type="button"
            onClick={addPair}
            disabled={!newFaction}
            className="focus-ring rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Reputation tiers ─────────────────────────────────────────────

interface ReputationTiersSectionProps {
  tiers: ReputationTier[] | undefined;
  onChange: (tiers: ReputationTier[] | undefined) => void;
}

function ReputationTiersSection({ tiers, onChange }: ReputationTiersSectionProps) {
  const effective = tiers && tiers.length > 0 ? tiers : DEFAULT_REPUTATION_TIERS;
  const isDefault = !tiers || tiers.length === 0;

  const patchTier = (index: number, p: Partial<ReputationTier>) => {
    const next = [...effective];
    next[index] = { ...next[index]!, ...p };
    next.sort((a, b) => a.minReputation - b.minReputation);
    onChange(next);
  };

  const addTier = () => {
    const last = effective[effective.length - 1];
    const next: ReputationTier = {
      id: `tier_${effective.length + 1}`,
      label: `Tier ${effective.length + 1}`,
      minReputation: (last?.minReputation ?? 0) + 5000,
    };
    onChange([...effective, next]);
  };

  const deleteTier = (index: number) => {
    if (effective.length <= 2) return;
    const next = effective.filter((_, i) => i !== index);
    onChange(next);
  };

  const resetToDefaults = () => {
    onChange(undefined);
  };

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-base text-text-primary">
            Reputation Tiers
          </h3>
          <p className="mt-0.5 max-w-xl text-2xs leading-relaxed text-text-muted/70">
            Named bands of standing. Each tier covers everything from its
            threshold up to the next one. Referenced by reputation gates on
            shops and quests.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!isDefault && (
            <button
              type="button"
              onClick={resetToDefaults}
              className="focus-ring rounded border border-border-muted/60 px-2.5 py-1 text-2xs text-text-muted hover:border-border-default hover:text-text-primary"
            >
              Reset to default
            </button>
          )}
          <button
            type="button"
            onClick={addTier}
            className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            + Add tier
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-border-muted/50 bg-bg-primary/25 p-3">
        {effective.map((tier, i) => {
          const nextMin = effective[i + 1]?.minReputation;
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
            >
              <TextInput
                value={tier.label}
                onCommit={(v) => patchTier(i, { label: v })}
                placeholder="Label"
              />
              <TextInput
                value={tier.id}
                onCommit={(v) => patchTier(i, { id: normalizeId(v) })}
                placeholder="id"
              />
              <div className="flex items-center gap-1">
                <NumberInput
                  value={tier.minReputation}
                  onCommit={(v) =>
                    patchTier(i, { minReputation: v ?? 0 })
                  }
                />
                {nextMin != null && (
                  <span className="text-2xs text-text-muted/60 whitespace-nowrap">
                    → {nextMin - 1}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteTier(i)}
                disabled={effective.length <= 2}
                aria-label={`Delete ${tier.label}`}
                className="focus-ring rounded p-1 text-text-muted/50 transition hover:bg-status-error/15 hover:text-status-error disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      {isDefault && (
        <p className="text-2xs italic text-text-muted/60">
          Using built-in defaults. Edit any value to override.
        </p>
      )}
    </section>
  );
}

// ─── Rivalry graph ────────────────────────────────────────────────

interface RivalryGraphProps {
  definitions: Record<string, FactionDefinition>;
  factionLabelMap: Map<string, string>;
}

function RivalryGraph({ definitions, factionLabelMap }: RivalryGraphProps) {
  const ids = Object.keys(definitions);

  // Collect deduplicated rivalry edges (sorted tuple → visited set).
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<[string, string]> = [];
    for (const [aid, def] of Object.entries(definitions)) {
      for (const bid of def.enemies ?? []) {
        if (!definitions[bid]) continue;
        const key = aid < bid ? `${aid}|${bid}` : `${bid}|${aid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([aid, bid]);
      }
    }
    return pairs;
  }, [definitions]);

  const layout = useMemo(() => {
    const cx = 180;
    const cy = 180;
    const radius = 130;
    const positions = new Map<string, { x: number; y: number }>();
    const n = ids.length;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return positions;
  }, [ids]);

  if (ids.length < 2) return null;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="font-display font-semibold text-base text-text-primary">
          Rivalry Map
        </h3>
        <p className="mt-0.5 text-2xs leading-relaxed text-text-muted/70">
          Lines mark hostile pairs. Killing a member of one faction earns rep
          with the other.
        </p>
      </header>

      <div className="rounded-2xl border border-border-muted/50 bg-bg-primary/25 p-4">
        <svg
          viewBox="0 0 360 360"
          className="mx-auto block h-auto w-full max-w-md"
          role="img"
          aria-label="Faction rivalry graph"
        >
          {edges.length === 0 && (
            <text
              x={180}
              y={180}
              textAnchor="middle"
              className="fill-text-muted"
              fontSize="11"
              fontFamily="system-ui"
            >
              No rivalries defined
            </text>
          )}

          {edges.map(([a, b], i) => {
            const pa = layout.get(a);
            const pb = layout.get(b);
            if (!pa || !pb) return null;
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgb(var(--status-error-rgb))"
                strokeOpacity="0.45"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            );
          })}

          {ids.map((id) => {
            const p = layout.get(id);
            if (!p) return null;
            const label = factionLabelMap.get(id) ?? id;
            return (
              <g key={id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={18}
                  fill="rgb(var(--bg-primary-rgb))"
                  stroke="rgb(var(--accent-rgb))"
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                />
                <text
                  x={p.x}
                  y={p.y + 32}
                  textAnchor="middle"
                  className="fill-text-primary font-display"
                  fontSize="11"
                >
                  {label.length > 18 ? label.slice(0, 16) + "…" : label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
