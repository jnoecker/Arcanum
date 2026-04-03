import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MainArea } from "./MainArea";
import { StatusBar } from "./StatusBar";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAssetStore } from "@/stores/assetStore";
import type { Workspace } from "@/lib/panelRegistry";
import { loadWorkspace, saveWorkspace } from "@/lib/uiPersistence";
import { CommandPalette } from "./ui/CommandPalette";

const ShortcutsHelp = lazy(() => import("./ui/ShortcutsHelp").then((m) => ({ default: m.ShortcutsHelp })));
const AssetGenerator = lazy(() => import("./AssetGenerator").then((m) => ({ default: m.AssetGenerator })));
const AssetGallery = lazy(() => import("./AssetGallery").then((m) => ({ default: m.AssetGallery })));

export function AppShell() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const generatorOpen = useAssetStore((s) => s.generatorOpen);
  const galleryOpen = useAssetStore((s) => s.galleryOpen);
  const closeGallery = useAssetStore((s) => s.closeGallery);
  const [workspace, setWorkspaceState] = useState<Workspace>(loadWorkspace);
  const setWorkspace = useCallback((next: Workspace) => {
    setWorkspaceState(next);
    saveWorkspace(next);
  }, []);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg-abyss">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(168,151,210,0.14),transparent_68%)] blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(140,174,201,0.12),transparent_72%)] blur-3xl" />
      </div>
      <header><Toolbar workspace={workspace} setWorkspace={setWorkspace} /></header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 xl:flex-row">
        <aside className="min-w-0 xl:min-h-0"><Sidebar workspace={workspace} /></aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-bg-primary shadow-panel">
          <TabBar workspace={workspace} />
          <MainArea workspace={workspace} />
        </main>
      </div>
      <footer><StatusBar /></footer>
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      <Suspense>
        {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
        {generatorOpen && <AssetGenerator />}
        {galleryOpen && <AssetGallery onClose={closeGallery} />}
      </Suspense>
    </div>
  );
}
