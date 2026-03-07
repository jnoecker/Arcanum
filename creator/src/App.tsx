import { useProjectStore } from "@/stores/projectStore";
import { AppShell } from "@/components/AppShell";
import { WelcomeScreen } from "@/components/WelcomeScreen";

export function App() {
  const project = useProjectStore((s) => s.project);

  if (!project) {
    return <WelcomeScreen />;
  }

  return <AppShell />;
}
