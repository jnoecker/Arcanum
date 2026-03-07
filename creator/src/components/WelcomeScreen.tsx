import { useOpenProject } from "@/lib/useOpenProject";

export function WelcomeScreen() {
  const openProject = useOpenProject();

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-text-primary">
            AmbonMUD Creator
          </h1>
          <p className="text-text-secondary">
            World building and server management tool
          </p>
        </div>
        <button
          onClick={openProject}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-emphasis"
        >
          Open AmbonMUD Project
        </button>
      </div>
    </div>
  );
}
