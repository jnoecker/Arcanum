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
  }, [loadSettings]);

  return (
    <>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-bg-abyss text-text-muted">Opening the instrument...</div>}>
        {project ? <AppShell /> : <WelcomeScreen onNewProject={() => setShowWizard(true)} />}
      </Suspense>
      <Suspense>{showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}</Suspense>
    </>
  );
}
