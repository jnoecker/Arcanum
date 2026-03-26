import { useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import {
  loadUIState,
  removeRecentProject,
  type RecentProject,
} from "@/lib/uiPersistence";
import { ErrorDialog } from "./ErrorDialog";
import { ImportFromR2Dialog } from "./ImportFromR2Dialog";
import splashHero from "@/assets/splash-hero.jpg";

interface WelcomeScreenProps {
  onNewProject: () => void;
}

export function WelcomeScreen({ onNewProject }: WelcomeScreenProps) {
  const { openWithPicker, openDir } = useOpenProject();
  const [errors, setErrors] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showR2Import, setShowR2Import] = useState(false);
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
    <div className="relative flex h-screen overflow-hidden bg-bg-abyss">
      <img
        src={splashHero}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(34,41,60,0.18),rgba(34,41,60,0.84))]" />
      <div className="absolute left-[-8rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(168,151,210,0.22),transparent_66%)] blur-3xl" />
      <div className="absolute bottom-[-10rem] right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(140,174,201,0.18),transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-6 py-8 lg:px-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">Surreal Gentle Magic</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.04] text-text-primary lg:text-5xl">
            Build enchanted worlds, systems, and assets in one creator.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-text-secondary lg:text-base">
            Open a world, shape it, generate assets, and hand it off.
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-6">
          <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(155deg,rgba(54,63,90,0.9),rgba(37,45,68,0.92))] p-6 shadow-hero backdrop-blur-xl">
            <h2 className="font-display text-2xl text-text-primary">Enter the studio</h2>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              Resume where you left off, start a new world, or open an existing one.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {/* Resume latest — primary action when a recent project exists */}
              {recentProjects[0] && (
                <button
                  onClick={() => void handleOpenRecent(recentProjects[0]!)}
                  disabled={loading === recentProjects[0]!.path}
                  className="rounded-[22px] border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgba(168,151,210,0.34),rgba(140,174,201,0.22))] px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(137,155,214,0.28)] disabled:opacity-50"
                >
                  <div>{loading === recentProjects[0]!.path ? "Opening..." : `Resume: ${recentProjects[0]!.name}`}</div>
                  <div className="mt-1 truncate text-xs font-normal text-text-secondary">{recentProjects[0]!.path}</div>
                </button>
              )}
              <button
                onClick={onNewProject}
                className="rounded-[22px] border border-white/10 bg-black/12 px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:bg-white/10"
              >
                <div>Create new project</div>
                <div className="mt-1 text-xs font-normal text-text-secondary">Set up a new world from scratch.</div>
              </button>
              <button
                onClick={handleOpen}
                className="rounded-[22px] border border-white/10 bg-black/12 px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:bg-white/10"
              >
                <div>Open existing project</div>
                <div className="mt-1 text-xs font-normal text-text-secondary">Choose an existing world folder on disk.</div>
              </button>
              <button
                onClick={() => setShowR2Import(true)}
                className="rounded-[22px] border border-white/10 bg-black/12 px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:bg-white/10"
              >
                <div>Import from R2</div>
                <div className="mt-1 text-xs font-normal text-text-secondary">Download and set up a world from your R2 deployment.</div>
              </button>
            </div>
          </div>

          <div className="min-h-0 rounded-[36px] border border-white/10 bg-[linear-gradient(155deg,rgba(54,63,90,0.9),rgba(37,45,68,0.92))] p-6 shadow-hero backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl text-text-primary">Recent worlds</h3>
              {recentProjects.length > 0 && (
                <span className="text-xs uppercase tracking-ui text-text-muted">
                  {recentProjects.length} saved
                </span>
              )}
            </div>
            {recentProjects.length > 0 ? (
              <ul className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1">
                {recentProjects.map((project) => (
                  <li
                    key={project.path}
                    className="group flex items-center gap-2 rounded-[22px] border border-white/8 bg-black/12 px-4 py-3 transition hover:bg-white/8"
                  >
                    <button
                      onClick={() => handleOpenRecent(project)}
                      disabled={loading === project.path}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium text-text-primary">
                        {loading === project.path ? "Opening..." : project.name}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-text-muted">
                        {project.path}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRecent(project.path);
                      }}
                      className="shrink-0 rounded-full border border-white/8 px-2 py-1 text-xs text-text-muted opacity-0 transition hover:border-status-error/40 hover:text-status-error group-hover:opacity-100 focus:opacity-100"
                      title="Remove from recent"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 px-4 py-8 text-sm leading-7 text-text-muted">
                Your worlds will appear here once created. Start a new one above.
              </div>
            )}
          </div>
        </div>
      </div>

      {errors && (
        <ErrorDialog
          title="Project Error"
          messages={errors}
          onClose={() => setErrors(null)}
        />
      )}

      {showR2Import && (
        <ImportFromR2Dialog onClose={() => setShowR2Import(false)} />
      )}
    </div>
  );
}
