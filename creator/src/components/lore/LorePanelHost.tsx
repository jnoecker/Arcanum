import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveLore } from "@/lib/lorePersistence";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { Spinner } from "@/components/ui/FormWidgets";
import configBg from "@/assets/config-bg.png";

import { WorldSettingPanel } from "./WorldSettingPanel";
import { FactionsPanel } from "./FactionsPanel";
import { LoreCodexPanel } from "./LoreCodexPanel";
import { ArticleBrowser } from "./ArticleBrowser";
import { TimelinePanel } from "./TimelinePanel";
import { RelationGraphPanel } from "./RelationGraphPanel";
import { DocumentLibraryPanel } from "./DocumentLibraryPanel";
import { ShowcaseSettingsPanel } from "./ShowcaseSettingsPanel";
import { TemplateEditorPanel } from "./TemplateEditorPanel";

// Lazy-load MapPanel to isolate Leaflet CSS from the main bundle
const MapPanel = lazy(() => import("./MapPanel").then(m => ({ default: m.MapPanel })));

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
    case "templates":
      return <TemplateEditorPanel />;
    default:
      return <div className="px-6 py-8 text-sm text-text-muted/60">Panel not found: {panelId}</div>;
  }
}

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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-base text-text-muted">The Archive Awaits</p>
        <p className="max-w-xs text-xs leading-6 text-text-muted/60">Open a world project to begin recording its lore.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.10] mix-blend-soft-light"
            style={{ objectPosition: "center 40%" }}
          />
        </div>

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-5 ${def?.maxWidth ?? "max-w-5xl"}`}>
          {(dirty || saving || saveError) && (
            <div className="pointer-events-auto sticky top-3 z-20 flex items-center justify-end gap-2">
              {saveError && <span role="alert" className="text-2xs text-status-error">Save failed</span>}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                aria-label={saving ? "Saving lore" : "Save lore"}
                className="focus-ring rounded-full border border-white/10 bg-bg-primary/80 px-3 py-1 text-2xs font-medium text-accent shadow-md backdrop-blur-sm transition hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Lore"}
              </button>
            </div>
          )}
          {renderPanel(panelId)}
        </div>
      </div>
    </div>
  );
}
