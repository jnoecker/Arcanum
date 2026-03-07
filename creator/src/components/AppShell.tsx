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
    <div className="flex h-screen flex-col bg-bg-abyss">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <MainArea />
        </div>
      </div>
      <StatusBar />
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {generatorOpen && <AssetGenerator />}
      {galleryOpen && <AssetGallery onClose={closeGallery} />}
    </div>
  );
}
