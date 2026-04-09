import { lazy, Suspense, useEffect, useState } from "react";
import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";

import { MainArea } from "./MainArea";
import { StatusBar } from "./StatusBar";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { CommandPalette } from "./ui/CommandPalette";
import { Toast } from "./ui/Toast";
import { CosmicBackdrop } from "./ui/CosmicBackdrop";
import { ValidationPanel } from "./ValidationPanel";

const ShortcutsHelp = lazy(() => import("./ui/ShortcutsHelp").then((m) => ({ default: m.ShortcutsHelp })));
const AssetGenerator = lazy(() => import("./AssetGenerator").then((m) => ({ default: m.AssetGenerator })));
const AssetGallery = lazy(() => import("./AssetGallery").then((m) => ({ default: m.AssetGallery })));
const MudImportWizard = lazy(() => import("./MudImportWizard").then((m) => ({ default: m.MudImportWizard })));
const SettingsOverlay = lazy(() => import("./settings/SettingsOverlay").then((m) => ({ default: m.SettingsOverlay })));

interface AppShellProps {
  onNewProject: () => void;
}

export function AppShell({ onNewProject }: AppShellProps) {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const generatorOpen = useAssetStore((s) => s.generatorOpen);
  const galleryOpen = useAssetStore((s) => s.galleryOpen);
  const closeGallery = useAssetStore((s) => s.closeGallery);
  const showMudImport = useProjectStore((s) => s.showMudImport);
  const setShowMudImport = useProjectStore((s) => s.setShowMudImport);
  const mapView = useProjectStore((s) => s.mapView);
  const openWorldMap = useProjectStore((s) => s.openWorldMap);
  const settingsOpen = useProjectStore((s) => s.settingsOpen);
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        openWorldMap();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (e.key === "Escape" && mapView && typeof mapView === "object") {
        // Escape from an island detail returns to the world map.
        openWorldMap();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mapView, openWorldMap, setSettingsOpen]);

  // Hide the sidebar entirely on the top-level world map. It remains
  // available on island detail views and inside tabs.
  const showSidebar = mapView !== "world";

  return (
    <div className="relative flex h-screen h-dvh flex-col overflow-hidden bg-bg-abyss">
      <CosmicBackdrop variant="shell" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.14),transparent_68%)] blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.10),transparent_72%)] blur-3xl" />
      </div>
      <header className="shrink-0"><Toolbar onNewProject={onNewProject} /></header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-5 lg:flex-row">
        {showSidebar && <Sidebar />}
        <main
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, black 18px, black 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 18px, black 100%)",
          }}
        >
          <MainArea />
        </main>
      </div>
      <footer className="shrink-0"><StatusBar /></footer>
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      <Suspense>
        {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
        {generatorOpen && <AssetGenerator />}
        {galleryOpen && <AssetGallery onClose={closeGallery} />}
        {showMudImport && <MudImportWizard onClose={() => setShowMudImport(false)} />}
        {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
      </Suspense>
      <Toast />
      <ValidationPanel />
    </div>
  );
}
