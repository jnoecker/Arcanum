import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveLore } from "@/lib/lorePersistence";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { Spinner } from "@/components/ui/FormWidgets";
import configBg from "@/assets/config-bg.png";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";

import { WorldSettingPanel } from "./WorldSettingPanel";
import { FactionsPanel } from "./FactionsPanel";
import { LoreCodexPanel } from "./LoreCodexPanel";
import { ArticleBrowser } from "./ArticleBrowser";
import { TimelinePanel } from "./TimelinePanel";
import { RelationGraphPanel } from "./RelationGraphPanel";
import { DocumentLibraryPanel } from "./DocumentLibraryPanel";
import { ShowcaseSettingsPanel } from "./ShowcaseSettingsPanel";

// Lazy-load MapPanel to isolate Leaflet CSS from the main bundle
const MapPanel = lazy(() => import("./MapPanel").then(m => ({ default: m.MapPanel })));

// ─── Panel renderer ─────────────────────────────────────────────────

function renderPanel(panelId: string): ReactNode {
  switch (panelId) {
    case "lore":
      return <ArticleBrowser />;
    case "worldSetting":
      return <WorldSettingPanel />;
    case "factions":
      return <FactionsPanel />;
    case "codex":
      return <LoreCodexPanel />;
    case "loreMaps":
      return <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted"><Spinner /> Loading maps...</div>}><MapPanel /></Suspense>;
    case "loreTimeline":
      return <TimelinePanel />;
    case "loreRelations":
      return <RelationGraphPanel />;
    case "loreDocuments":
      return <DocumentLibraryPanel />;
    case "showcaseSettings":
      return <ShowcaseSettingsPanel />;
    default:
      return <div className="text-text-muted">Unknown lore panel: {panelId}</div>;
  }
}

// ─── Host component ─────────────────────────────────────────────────

export function LorePanelHost({ panelId }: { panelId: string }) {
  const lore = useLoreStore((s) => s.lore);
  const dirty = useLoreStore((s) => s.dirty);
  const project = useProjectStore((s) => s.project);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!dirty || !project) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveLore(project).catch((err) => {
        console.error("Lore auto-save failed:", err);
      });
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, project, lore]);

  // Flush unsaved lore when leaving the lore workspace
  useEffect(() => {
    return () => {
      const { dirty: d } = useLoreStore.getState();
      const p = useProjectStore.getState().project;
      if (d && p) {
        saveLore(p).catch((err) => {
          console.error("Lore flush-on-unmount failed:", err);
        });
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLore(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [project, saving]);

  const def = PANEL_MAP[panelId];

  if (!lore) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        No lore loaded
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 overflow-hidden border-b border-border-default bg-bg-secondary">
        <img src={subtoolbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.1]" />
        <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl text-text-primary">{def?.title ?? panelId}</h2>
              <span className="text-xs text-text-secondary">{def?.description ?? ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-accent">modified</span>}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="focus-ring shell-pill-primary rounded-full px-4 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Lore"}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="relative z-10 px-5 pb-3 text-xs text-status-error">
            Could not save lore: {saveError}
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-[100vh] w-full overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.14]"
            style={{ objectPosition: "center 40%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        </div>

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-5 ${def?.maxWidth ?? "max-w-5xl"}`}>
          {renderPanel(panelId)}
        </div>
      </div>
    </div>
  );
}
