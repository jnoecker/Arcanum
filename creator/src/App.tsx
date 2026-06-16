import { lazy, Suspense, useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const AppShell = lazy(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })));
const ProjectWizard = lazy(() => import("@/components/wizard/ProjectWizard").then(m => ({ default: m.ProjectWizard })));

export function App() {
  const project = useProjectStore((s) => s.project);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadSettings();
    // Seed the asset manifest once a project is open so surfaces that read
    // `assets` without loading it themselves (e.g. the zone editor's music
    // box / jukebox track dropdowns) aren't empty until a studio is visited.
    if (project) loadAssets().catch(() => {});
  }, [project, loadSettings, loadAssets]);

  return (
    <>
      <Suspense fallback={<div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-abyss"><div className="h-10 w-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" /><p className="text-sm text-text-muted">Opening the instrument...</p></div>}>
        {project ? (
          <AppShell onNewProject={() => setShowWizard(true)} />
        ) : (
          <WelcomeScreen onNewProject={() => setShowWizard(true)} />
        )}
      </Suspense>
      <Suspense>{showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}</Suspense>
    </>
  );
}
