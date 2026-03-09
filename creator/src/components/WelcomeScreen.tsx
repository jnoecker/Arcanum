import { useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import {
  loadUIState,
  removeRecentProject,
  type RecentProject,
} from "@/lib/uiPersistence";
import { ErrorDialog } from "./ErrorDialog";
import splashHero from "@/assets/splash-hero.jpg";

interface WelcomeScreenProps {
  onNewProject: () => void;
}

export function WelcomeScreen({ onNewProject }: WelcomeScreenProps) {
  const { openWithPicker, openDir } = useOpenProject();
  const [errors, setErrors] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(
    () => loadUIState()?.recentProjects ?? [],
  );

  const handleOpen = async () => {
    const result = await openWithPicker();
    if (result && !result.success && result.errors) {
      setErrors(result.errors);
    }
  };

  const handleOpenRecent = async (project: RecentProject) => {
    setLoading(project.path);
    try {
      const result = await openDir(project.path);
      if (!result.success && result.errors) {
        setErrors(result.errors);
      }
    } catch {
      setErrors([
        `Could not open ${project.path}. The project may have been moved or deleted.`,
      ]);
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveRecent = (path: string) => {
    removeRecentProject(path);
    setRecentProjects((prev) => prev.filter((p) => p.path !== path));
  };

  return (
    <div className="relative flex h-screen items-center justify-center bg-bg-abyss overflow-hidden">
      {/* Hero background */}
      <img
        src={splashHero}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/60 to-bg-abyss/80" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-4xl font-semibold tracking-wide text-accent-emphasis drop-shadow-lg">
            Ambon Arcanum
          </h1>
          <p className="text-lg text-text-secondary drop-shadow">
            World building &amp; server management
          </p>
        </div>

        {/* Action buttons */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <button
            onClick={onNewProject}
            className="rounded-lg bg-gradient-to-r from-accent-muted to-accent px-6 py-3 font-display text-sm font-medium tracking-wide text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
          >
            Create New Project
          </button>
          <button
            onClick={handleOpen}
            className="rounded-lg border border-border-default px-6 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            Open Existing Project
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="w-80">
            <h3 className="mb-2 font-display text-[10px] uppercase tracking-widest text-text-muted">
              Recent Projects
            </h3>
            <ul className="flex flex-col gap-1">
              {recentProjects.map((project) => (
                <li
                  key={project.path}
                  className="group flex items-center gap-2 rounded-md border border-border-default/50 bg-bg-secondary/40 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-bg-elevated/60"
                >
                  <button
                    onClick={() => handleOpenRecent(project)}
                    disabled={loading === project.path}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-xs text-text-primary">
                      {loading === project.path
                        ? "Opening..."
                        : project.name}
                    </div>
                    <div className="truncate text-[10px] text-text-muted">
                      {project.path}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRecent(project.path);
                    }}
                    className="hidden shrink-0 rounded px-1 text-xs text-text-muted transition-colors hover:text-status-error group-hover:block"
                    title="Remove from recent"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {errors && (
        <ErrorDialog
          title="Project Error"
          messages={errors}
          onClose={() => setErrors(null)}
        />
      )}

    </div>
  );
}
