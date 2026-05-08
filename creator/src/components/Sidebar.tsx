import { useShallow } from "zustand/shallow";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useSidebarStore, type DrillTarget } from "@/stores/sidebarStore";
import { panelTab, type Island } from "@/lib/panelRegistry";
import { ISLANDS } from "@/lib/islandRegistry";
import { ISLAND_ICONS, UI_ARROW } from "@/assets/ui";
import { CosmicBackdrop } from "./ui/CosmicBackdrop";
import { ArticlesPanel } from "./sidebar/ArticlesPanel";
import { ZonesPanel } from "./sidebar/ZonesPanel";
import { IslandPanelList } from "./sidebar/IslandPanelList";

// ─── Sidebar entry registry ─────────────────────────────────────────
// Order mirrors the world map (orrery, loom, forge — top row;
// livingWorld, arcanum, spire — bottom row), then the two virtual
// "islands" for entity collections.

interface SidebarEntry {
  target: Exclude<DrillTarget, null>;
  icon: string;
  title: string;
  tagline: string;
}

function buildIslandEntry(id: Island): SidebarEntry {
  const def = ISLANDS[id];
  return {
    target: id,
    icon: ISLAND_ICONS[id] ?? "",
    title: def?.title ?? id,
    tagline: def?.tagline ?? "",
  };
}

const ENTRIES: SidebarEntry[] = [
  buildIslandEntry("orrery"),
  buildIslandEntry("loom"),
  buildIslandEntry("forge"),
  buildIslandEntry("livingWorld"),
  buildIslandEntry("arcanum"),
  buildIslandEntry("spire"),
  {
    target: "articles",
    icon: ISLAND_ICONS.articles ?? "",
    title: "Articles",
    tagline: "Lore articles, characters, factions, locations.",
  },
  {
    target: "zones",
    icon: ISLAND_ICONS.zones ?? "",
    title: "Zones",
    tagline: "World map zones and their entities.",
  },
];

const ENTRY_BY_TARGET: Record<string, SidebarEntry> = Object.fromEntries(
  ENTRIES.map((e) => [e.target, e]),
);

// ─── Sidebar ────────────────────────────────────────────────────────

export function Sidebar() {
  const { mode, drillTarget, toggleMode, drillInto, goBack } = useSidebarStore(
    useShallow((s) => ({
      mode: s.mode,
      drillTarget: s.drillTarget,
      toggleMode: s.toggleMode,
      drillInto: s.drillInto,
      goBack: s.goBack,
    })),
  );

  // Clicking "Articles" anywhere in the sidebar drills into the article tree
  // AND opens the lore panel in the main area, so the user can keep editing
  // whichever article is active.
  const handlePick = (target: Exclude<DrillTarget, null>) => {
    drillInto(target);
    if (target === "articles") {
      useProjectStore.getState().openTab(panelTab("lore"));
    }
  };

  if (mode === "rail") {
    return <RailSidebar onExpand={toggleMode} onPick={handlePick} drillTarget={drillTarget} />;
  }

  return (
    <nav
      aria-label="Main navigation"
      className="relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel shadow-panel lg:w-[clamp(16rem,22vw,23rem)]"
    >
      <CosmicBackdrop variant="panel" className="opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-glow-top" />

      {drillTarget ? (
        <DrilledHeader target={drillTarget} onBack={goBack} onCollapse={toggleMode} />
      ) : (
        <TopLevelHeader onCollapse={toggleMode} />
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {drillTarget ? <DrilledBody target={drillTarget} /> : <TopLevelList onPick={handlePick} />}
      </div>

      <div className="relative z-10 border-t border-[var(--chrome-stroke)] px-4 py-3 text-2xs text-text-muted">
        Ctrl+M map | Ctrl+K palette | Ctrl+, settings | Ctrl+\ collapse
      </div>
    </nav>
  );
}

// ─── Top-level views ────────────────────────────────────────────────

function TopLevelHeader({ onCollapse }: { onCollapse: () => void }) {
  const zonesCount = useZoneStore((s) => s.zones.size);
  const articleCount = useLoreStore((s) => Object.keys(selectArticles(s)).length);
  const openTabs = useProjectStore((s) => s.tabs);
  const openTab = useProjectStore((s) => s.openTab);

  return (
    <div className="relative z-10 shrink-0 px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onCollapse}
          className="focus-ring shell-pill flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:text-text-primary"
          title="Collapse sidebar (Ctrl+\\)"
          aria-label="Collapse sidebar"
        >
          <img src={UI_ARROW} alt="" aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          onClick={() => openTab(panelTab("worldSetting"))}
          className="focus-ring shell-pill ml-auto whitespace-nowrap rounded-full px-2.5 py-1 font-display text-[9px] font-semibold uppercase tracking-wide-ui text-accent"
          title="Open world settings"
          aria-label="Open world settings"
        >
          World Settings
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-3xs text-text-muted">
        <span className="whitespace-nowrap">{zonesCount} zones</span>
        <span className="text-border-default">·</span>
        <span className="whitespace-nowrap">{articleCount} lore</span>
        <span className="text-border-default">·</span>
        <span className="whitespace-nowrap">{openTabs.length} open</span>
      </div>
    </div>
  );
}

function TopLevelList({ onPick }: { onPick: (target: Exclude<DrillTarget, null>) => void }) {
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-4">
      {ENTRIES.map((entry) => (
        <li key={entry.target}>
          <button
            onClick={() => onPick(entry.target)}
            className="group/entry flex w-full items-center gap-3 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-2.5 text-left text-text-secondary transition hover:border-accent/40 hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
            title={entry.tagline}
          >
            <img
              src={entry.icon}
              alt=""
              aria-hidden="true"
              className="h-9 w-9 shrink-0 rounded-lg object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-semibold tracking-label">
                {entry.title}
              </span>
              {entry.tagline && (
                <span className="mt-0.5 block truncate text-2xs text-text-muted">
                  {entry.tagline}
                </span>
              )}
            </span>
            <span
              className="self-center text-text-muted transition group-hover/entry:translate-x-0.5 group-hover/entry:text-accent"
              aria-hidden="true"
            >
              {"›"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Drilled views ──────────────────────────────────────────────────

function DrilledHeader({
  target,
  onBack,
  onCollapse,
}: {
  target: Exclude<DrillTarget, null>;
  onBack: () => void;
  onCollapse: () => void;
}) {
  const entry = ENTRY_BY_TARGET[target];
  if (!entry) return null;
  return (
    <div className="relative z-10 shrink-0 px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="focus-ring shell-pill flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs text-text-muted transition hover:text-text-primary"
          title="Back to islands"
          aria-label="Back to islands"
        >
          <img
            src={UI_ARROW}
            alt=""
            aria-hidden="true"
            className="h-3.5 w-3.5 -scale-x-100"
          />
          <span>Back</span>
        </button>
        <button
          onClick={onCollapse}
          className="focus-ring shell-pill ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:text-text-primary"
          title="Collapse sidebar (Ctrl+\\)"
          aria-label="Collapse sidebar"
        >
          <img src={UI_ARROW} alt="" aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 px-1">
        <img
          src={entry.icon}
          alt=""
          aria-hidden="true"
          className="h-7 w-7 shrink-0 rounded-md object-contain"
        />
        <h2 className="font-display text-base font-semibold tracking-label text-text-primary">
          {entry.title}
        </h2>
      </div>
      {entry.tagline && (
        <p className="mt-1 px-1 text-2xs text-text-muted">{entry.tagline}</p>
      )}
    </div>
  );
}

function DrilledBody({ target }: { target: Exclude<DrillTarget, null> }) {
  if (target === "articles") return <ArticlesPanel />;
  if (target === "zones") return <ZonesPanel />;
  if (target === "settings") {
    return (
      <div className="px-4 pb-4 pt-1 text-sm text-text-muted">
        Open settings via Ctrl+, — they live in the modal, not the sidebar.
      </div>
    );
  }
  return <IslandPanelList island={target} />;
}

// ─── Rail view ──────────────────────────────────────────────────────

function RailSidebar({
  onExpand,
  onPick,
  drillTarget,
}: {
  onExpand: () => void;
  onPick: (target: Exclude<DrillTarget, null>) => void;
  drillTarget: DrillTarget;
}) {
  return (
    <nav
      aria-label="Main navigation (collapsed)"
      className="relative flex min-h-0 w-14 shrink-0 flex-col overflow-hidden rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel shadow-panel"
    >
      <CosmicBackdrop variant="panel" className="opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-glow-top" />

      <div className="relative z-10 shrink-0 px-2 pt-3 pb-2">
        <button
          onClick={onExpand}
          className="focus-ring shell-pill flex h-9 w-full items-center justify-center rounded-full text-text-muted transition hover:text-text-primary"
          title="Expand sidebar (Ctrl+\\)"
          aria-label="Expand sidebar"
        >
          <img
            src={UI_ARROW}
            alt=""
            aria-hidden="true"
            className="h-4 w-4 -scale-x-100"
          />
        </button>
      </div>

      <ul className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-2 pb-4">
        {ENTRIES.map((entry) => {
          const isActive = drillTarget === entry.target;
          return (
            <li key={entry.target}>
              <button
                onClick={() => onPick(entry.target)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  isActive
                    ? "border-border-active bg-gradient-active"
                    : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:border-accent/40 hover:bg-[var(--chrome-highlight-strong)]"
                }`}
                title={`${entry.title} — ${entry.tagline}`}
                aria-label={entry.title}
              >
                <img
                  src={entry.icon}
                  alt=""
                  aria-hidden="true"
                  className="h-7 w-7 object-contain"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
