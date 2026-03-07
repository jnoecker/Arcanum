import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { AppShell } from "@/components/AppShell";
import { WelcomeScreen } from "@/components/WelcomeScreen";

export function App() {
  const project = useProjectStore((s) => s.project);
  const loadSettings = useAssetStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!project) {
    return <WelcomeScreen />;
  }

  return <AppShell />;
}
