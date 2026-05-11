import { useEffect, useMemo, useRef, useState } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useQuestAuthoringStore } from "@/stores/questAuthoringStore";
import { panelTab } from "@/lib/panelRegistry";

interface QuestOption {
  zoneId: string;
  questId: string;
  name: string;
}

interface QuestPickerProps {
  value: string;
  onChange: (questId: string) => void;
  /** Hide quests already chosen (e.g. existing keys in a Record map). */
  excludeIds?: string[];
  placeholder?: string;
  /** Show a '+ New Quest' footer that opens the Quests authoring panel. */
  allowCreate?: boolean;
  /** When the picker's value points to a quest that doesn't exist, render a warning. */
  warnOnMissing?: boolean;
  className?: string;
}

function getActiveZoneId(): string | null {
  const { tabs, activeTabId } = useProjectStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.kind === "zone") return tab.id.replace(/^zone:/, "");
  return null;
}

/**
 * Cross-zone quest picker. Lists every quest in the project grouped by zone,
 * with search. Optional '+ New Quest' footer routes to the Living World →
 * Quests authoring panel with create intent.
 */
export function QuestPicker({
  value,
  onChange,
  excludeIds,
  placeholder,
  allowCreate,
  warnOnMissing = true,
  className,
}: QuestPickerProps) {
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const setPendingCreate = useQuestAuthoringStore((s) => s.setPendingCreate);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const allQuests = useMemo<QuestOption[]>(() => {
    const rows: QuestOption[] = [];
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

  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allQuests.filter((row) => {
      if (excludeSet.has(row.questId)) return false;
      if (!q) return true;
      return (
        row.questId.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.zoneId.toLowerCase().includes(q)
      );
    });
  }, [allQuests, query, excludeSet]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(
    () => (value ? allQuests.find((q) => q.questId === value) : undefined),
    [allQuests, value],
  );
  const hasUnknownValue = !!value && !selected;

  const handleCreate = () => {
    const activeZone = getActiveZoneId();
    const firstZone = Array.from(zones.keys()).sort()[0];
    const targetZone = (activeZone && zones.has(activeZone) ? activeZone : firstZone) ?? null;
    if (targetZone) setPendingCreate({ zoneId: targetZone });
    openTab(panelTab("quests"));
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ornate-input flex min-h-9 w-full items-center px-2.5 py-1.5 text-left text-xs text-text-primary"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-semibold">{selected.name}</span>
            <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-px font-mono text-2xs text-text-muted">
              {selected.zoneId}
            </span>
          </span>
        ) : hasUnknownValue ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className={`truncate italic ${warnOnMissing ? "text-status-warning" : "text-text-muted"}`}>
              {warnOnMissing ? "Missing quest" : "Unknown quest"}
            </span>
            <span className="truncate font-mono text-2xs text-text-muted">{value}</span>
          </span>
        ) : (
          <span className="flex-1 text-text-muted">{placeholder ?? "Select quest…"}</span>
        )}
        <span
          className={`ml-2 text-[9px] text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          &#x25B6;
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded border border-border-default bg-bg-elevated shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${allQuests.length} quest${allQuests.length === 1 ? "" : "s"}…`}
            className="w-full border-b border-border-muted bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <div className="max-h-60 overflow-y-auto">
            {allQuests.length === 0 ? (
              <p className="px-2 py-2 text-2xs text-text-muted">
                No quests authored yet. Open the Quests panel to create one.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-2xs text-text-muted">
                {query ? `No quests match "${query}".` : "All quests are already selected."}
              </p>
            ) : (
              filtered.map((row) => {
                const isActive = row.questId === value;
                return (
                  <button
                    key={`${row.zoneId}/${row.questId}`}
                    type="button"
                    onClick={() => {
                      onChange(row.questId);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center gap-2 border-b border-border-muted/30 px-2 py-1.5 text-left transition-colors hover:bg-bg-hover ${isActive ? "bg-accent/10" : ""}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs text-text-primary">{row.name}</span>
                      <span className="truncate font-mono text-2xs text-text-muted">{row.questId}</span>
                    </span>
                    <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-px font-mono text-2xs text-text-muted">
                      {row.zoneId}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {allowCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full border-t border-border-muted bg-bg-primary/50 px-2 py-1.5 text-left text-2xs font-medium text-accent transition hover:bg-accent/10"
            >
              + New quest in the Quests panel…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only display of a quest reference: shows the quest name + zone badge,
 * or a missing-quest warning. Clicking jumps to the Quests authoring panel
 * with that quest focused.
 */
export function QuestRefBadge({ questId }: { questId: string }) {
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const setPendingFocus = useQuestAuthoringStore((s) => s.setPendingFocus);

  const found = useMemo(() => {
    for (const [zoneId, zoneState] of zones) {
      const quest = zoneState.data.quests?.[questId];
      if (quest) return { zoneId, name: quest.name || questId };
    }
    return null;
  }, [zones, questId]);

  const handleJump = () => {
    if (found) setPendingFocus({ zoneId: found.zoneId, questId });
    openTab(panelTab("quests"));
  };

  if (!found) {
    return (
      <button
        type="button"
        onClick={handleJump}
        className="focus-ring inline-flex items-center gap-1.5 rounded border border-status-warning/40 bg-status-warning/5 px-1.5 py-0.5 text-2xs text-status-warning transition hover:bg-status-warning/10"
        title="This quest is not defined in any loaded zone — click to open the Quests panel"
      >
        <span aria-hidden>⚠</span>
        <span className="font-mono">{questId}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleJump}
      className="focus-ring inline-flex items-center gap-1.5 rounded border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-1.5 py-0.5 text-2xs text-text-primary transition hover:border-accent/40 hover:bg-[var(--chrome-fill)]"
      title="Open this quest in the Quests panel"
    >
      <span className="truncate">{found.name}</span>
      <span className="shrink-0 rounded bg-bg-tertiary px-1 font-mono text-text-muted">{found.zoneId}</span>
    </button>
  );
}
