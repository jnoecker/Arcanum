import { lazy, Suspense, useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const AppShell = lazy(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })));
const ProjectWizard = lazy(() => import("@/components/wizard/ProjectWizard").then(m => ({ default: m.ProjectWizard })));

export function App() {
  const project = useProjectStore((s) => s.project);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [project, loadSettings]);

  return (
    <>
      <Suspense fallback={<div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-abyss"><div className="h-10 w-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" /><p className="text-sm text-text-muted">Opening the instrument...</p></div>}>
        {project ? <AppShell /> : <WelcomeScreen onNewProject={() => setShowWizard(true)} />}
      </Suspense>
      <Suspense>{showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}</Suspense>
    </>
  );
}
