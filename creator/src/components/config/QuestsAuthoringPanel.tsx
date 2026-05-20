import { useEffect, useMemo, useState } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useQuestAuthoringStore } from "@/stores/questAuthoringStore";
import { addQuest, generateEntityId } from "@/lib/zoneEdits";
import type { QuestFile, WorldFile } from "@/types/world";
import { QuestEditor } from "@/components/editors/QuestEditor";
import { PlusIcon, SearchIcon } from "@/components/config/icons";
import { cx } from "@/components/ui/FormWidgets";
import { RenameEntityDialog } from "@/components/zone/RenameEntityDialog";

interface QuestRow {
  zoneId: string;
  questId: string;
  name: string;
}

interface Selection {
  zoneId: string;
  questId: string;
}

function getActiveZoneId(): string | null {
  const { tabs, activeTabId } = useProjectStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.kind === "zone") return tab.id.replace(/^zone:/, "");
  return null;
}

/**
 * Top-level cross-zone quest authoring surface. Lists every quest in the
 * project grouped by zone, with a reusable QuestEditor on the right.
 * Reachable via the Living World → Quests panel (the default tab).
 */
export function QuestsAuthoringPanel() {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);

  const pendingFocus = useQuestAuthoringStore((s) => s.pendingFocus);
  const pendingCreate = useQuestAuthoringStore((s) => s.pendingCreate);
  const consumePendingFocus = useQuestAuthoringStore((s) => s.consumePendingFocus);
  const consumePendingCreate = useQuestAuthoringStore((s) => s.consumePendingCreate);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [newQuestZone, setNewQuestZone] = useState<string>(() => getActiveZoneId() ?? "");
  const [renaming, setRenaming] = useState(false);

  // Flat list of every quest across loaded zones, alphabetised by zone then name.
  const allQuests: QuestRow[] = useMemo(() => {
    const rows: QuestRow[] = [];
    for (const [zoneId, zoneState] of zones) {
      const quests = zoneState.data.quests ?? {};
      for (const [questId, quest] of Object.entries(quests)) {
        rows.push({ zoneId, questId, name: quest.name || questId });
      }
    }
    rows.sort((a, b) => {
      if (a.zoneId !== b.zoneId) return a.zoneId.localeCompare(b.zoneId);
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [zones]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allQuests;
    return allQuests.filter(
      (r) =>
        r.questId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.zoneId.toLowerCase().includes(q),
    );
  }, [allQuests, query]);

  // Group filtered rows by zone for display.
  const grouped = useMemo(() => {
    const map = new Map<string, QuestRow[]>();
    for (const row of filtered) {
      const list = map.get(row.zoneId) ?? [];
      list.push(row);
      map.set(row.zoneId, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const zoneOptions = useMemo(() => {
    return Array.from(zones.keys()).sort();
  }, [zones]);

  // Keep newQuestZone valid: default to active zone, otherwise first available.
  useEffect(() => {
    if (newQuestZone && zones.has(newQuestZone)) return;
    const active = getActiveZoneId();
    setNewQuestZone(active && zones.has(active) ? active : (zoneOptions[0] ?? ""));
  }, [zones, zoneOptions, newQuestZone]);

  // Default selection: first quest in the list, if nothing selected.
  useEffect(() => {
    if (selection) {
      const stillExists = zones.get(selection.zoneId)?.data.quests?.[selection.questId];
      if (stillExists) return;
    }
    setSelection(allQuests[0] ? { zoneId: allQuests[0].zoneId, questId: allQuests[0].questId } : null);
  }, [allQuests, selection, zones]);

  // Consume incoming focus intent.
  useEffect(() => {
    if (!pendingFocus) return;
    const focus = consumePendingFocus();
    if (!focus) return;
    if (zones.get(focus.zoneId)?.data.quests?.[focus.questId]) {
      setSelection({ zoneId: focus.zoneId, questId: focus.questId });
    }
  }, [pendingFocus, consumePendingFocus, zones]);

  // Consume incoming create-new intent.
  useEffect(() => {
    if (!pendingCreate) return;
    const req = consumePendingCreate();
    if (!req) return;
    handleCreate(req.zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate]);

  const handleCreate = (zoneId: string) => {
    const zone = zones.get(zoneId);
    if (!zone) return;
    const id = generateEntityId(zone.data, "quests");
    const next = addQuest(zone.data, id, { name: id, giver: "" } as QuestFile);
    updateZone(zoneId, next);
    setSelection({ zoneId, questId: id });
  };

  const handleWorldChange = (zoneId: string) => (world: WorldFile) => {
    updateZone(zoneId, world);
  };

  const handleDelete = () => {
    setSelection(null);
  };

  const selectedWorld = selection ? zones.get(selection.zoneId)?.data : undefined;
  const selectedExists =
    selection && selectedWorld?.quests?.[selection.questId] !== undefined;

  if (zones.size === 0) {
    return (
      <div className="panel-surface flex min-h-[24rem] flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
        <p className="font-display text-base text-text-primary">No zones loaded</p>
        <p className="max-w-xs text-2xs text-text-muted/80">
          Open a project with at least one zone to start authoring quests.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <aside className="panel-surface flex max-h-[calc(100vh-2rem)] flex-col gap-3 rounded-2xl p-4 shadow-section xl:sticky xl:top-3 xl:col-span-4 xl:self-start">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Quests
          </h3>
          <span className="font-mono text-2xs text-text-muted/70">{allQuests.length}</span>
        </div>

        <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
          <SearchIcon className="text-text-muted/70" />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
            placeholder="Search quests, ids, or zones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Target zone for new quest"
            value={newQuestZone}
            onChange={(e) => setNewQuestZone(e.target.value)}
            className="ornate-input min-w-0 flex-1 px-2.5 py-1.5 text-xs text-text-primary"
          >
            {zoneOptions.length === 0 ? (
              <option value="">— no zones —</option>
            ) : (
              zoneOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => newQuestZone && handleCreate(newQuestZone)}
            disabled={!newQuestZone}
            title={
              newQuestZone
                ? `Add a new quest in ${newQuestZone}`
                : "Open a zone before creating a quest"
            }
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon />
            New
          </button>
        </div>

        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-1">
          {grouped.length === 0 ? (
            <li>
              <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
                {allQuests.length === 0
                  ? "No quests yet — pick a zone above and click New."
                  : `No matches for "${query}".`}
              </div>
            </li>
          ) : (
            grouped.map(([zoneId, rows]) => (
              <li key={zoneId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {zoneId}
                  </span>
                  <span className="font-mono text-2xs text-text-muted/60">{rows.length}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {rows.map((row) => {
                    const isSelected =
                      selection?.zoneId === row.zoneId && selection?.questId === row.questId;
                    return (
                      <li key={`${row.zoneId}/${row.questId}`}>
                        <button
                          type="button"
                          onClick={() => setSelection({ zoneId: row.zoneId, questId: row.questId })}
                          aria-pressed={isSelected}
                          className={cx(
                            "focus-ring flex w-full flex-col gap-0.5 rounded-xl border p-2.5 text-left transition",
                            isSelected
                              ? "selected-card"
                              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                          )}
                        >
                          <span className="truncate font-display text-sm font-semibold text-text-primary">
                            {row.name}
                          </span>
                          <span className="truncate font-mono text-2xs text-text-muted/70">
                            {row.questId}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="xl:col-span-8">
        {selection && selectedExists && selectedWorld ? (
          <div className="panel-surface flex min-h-[34rem] flex-col gap-4 rounded-2xl p-4 shadow-section">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Quest · {selection.zoneId}
                </p>
                <h3 className="mt-1 truncate font-display text-xl font-semibold text-text-primary">
                  {selectedWorld.quests?.[selection.questId]?.name || selection.questId}
                </h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-2xs text-text-muted/70">{selection.questId}</span>
                  <button
                    type="button"
                    onClick={() => setRenaming(true)}
                    className="focus-ring rounded px-1 py-0.5 text-2xs text-text-muted transition hover:bg-[var(--chrome-fill)] hover:text-accent"
                    title="Rename ID"
                    aria-label="Rename quest ID"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </header>
            <QuestEditor
              key={`${selection.zoneId}/${selection.questId}`}
              questId={selection.questId}
              world={selectedWorld}
              onWorldChange={handleWorldChange(selection.zoneId)}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          <div className="panel-surface flex min-h-[34rem] flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
            <p className="font-display text-base text-text-primary">No quest selected</p>
            <p className="max-w-xs text-2xs text-text-muted/80">
              Pick a quest from the list, or create a new one in the zone of your choice.
            </p>
          </div>
        )}
      </section>

      {renaming && selection && selectedWorld && selectedExists && (
        <RenameEntityDialog
          category="quest"
          currentId={selection.questId}
          world={selectedWorld}
          onConfirm={(nextWorld, newId) => {
            updateZone(selection.zoneId, nextWorld);
            setSelection({ zoneId: selection.zoneId, questId: newId });
          }}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  );
}
