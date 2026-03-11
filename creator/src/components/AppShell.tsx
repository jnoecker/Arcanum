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
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-14rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(168,151,210,0.24),transparent_66%)] blur-2xl" />
        <div className="absolute right-[-12rem] top-[4rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(140,174,201,0.18),transparent_68%)] blur-2xl" />
        <div className="absolute bottom-[-14rem] left-[22%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(184,143,170,0.14),transparent_72%)] blur-3xl" />
      </div>

      <Toolbar />
      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(45,56,84,0.88),rgba(36,44,68,0.92))] shadow-[0_24px_80px_rgba(8,10,18,0.45)] backdrop-blur-xl">
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
