import { lazy, Suspense, useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { AppShell } from "@/components/AppShell";
import { WelcomeScreen } from "@/components/WelcomeScreen";

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
      {project ? <AppShell /> : <WelcomeScreen onNewProject={() => setShowWizard(true)} />}
      <Suspense>{showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}</Suspense>
    </>
  );
}
