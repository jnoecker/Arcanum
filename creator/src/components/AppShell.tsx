import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MainArea } from "./MainArea";
import { StatusBar } from "./StatusBar";
import { ShortcutsHelp } from "./ui/ShortcutsHelp";
import { AssetGenerator } from "./AssetGenerator";
import { AssetGallery } from "./AssetGallery";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAssetStore } from "@/stores/assetStore";

export function AppShell() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const generatorOpen = useAssetStore((s) => s.generatorOpen);
  const galleryOpen = useAssetStore((s) => s.galleryOpen);
  const closeGallery = useAssetStore((s) => s.closeGallery);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg-abyss">
      <header><Toolbar /></header>
      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <aside><Sidebar /></aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-gradient-panel shadow-panel backdrop-blur-xl">
          <TabBar />
          <MainArea />
        </main>
      </div>
      <footer><StatusBar /></footer>
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {generatorOpen && <AssetGenerator />}
      {galleryOpen && <AssetGallery onClose={closeGallery} />}
    </div>
  );
}
