import { lazy, Suspense, useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import {
  loadUIState,
  removeRecentProject,
  type RecentProject,
} from "@/lib/uiPersistence";
import { ErrorDialog } from "./ErrorDialog";
import splashHero from "@/assets/splash-hero.jpg";

const ImportFromR2Dialog = lazy(() => import("./ImportFromR2Dialog").then((m) => ({ default: m.ImportFromR2Dialog })));

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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-8 lg:px-10">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.18fr)]">
          <div className="flex flex-col justify-center gap-6">
            <div>
              <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Creator&apos;s Instrument</p>
              <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.02] text-text-primary lg:text-5xl">
                Return to a world already in motion, or found a new canon.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-text-secondary lg:text-base">
                Arcanum is built for long sessions of shaping zones, systems, lore, and art. Enter through the most direct path and keep working.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(155deg,rgba(54,63,90,0.9),rgba(37,45,68,0.92))] p-6 shadow-panel">
              <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Studio paths</p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  onClick={onNewProject}
                  className="rounded-3xl border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgba(168,151,210,0.26),rgba(200,151,46,0.16))] px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:shadow-[0_14px_34px_rgba(168,151,210,0.2)]"
                >
                  <div className="text-3xs uppercase tracking-ui text-text-muted">Founding</div>
                  <div className="mt-2 font-display text-lg">Create new project</div>
                  <div className="mt-1 text-xs font-normal text-text-secondary">Lay down a fresh scaffold, then move directly into worldmaking.</div>
                </button>
                <button
                  onClick={handleOpen}
                  className="rounded-3xl border border-white/10 bg-black/12 px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:bg-white/10"
                >
                  <div className="text-3xs uppercase tracking-ui text-text-muted">Re-entry</div>
                  <div className="mt-2">Open existing project</div>
                  <div className="mt-1 text-xs font-normal text-text-secondary">Reconnect to a local project folder and restore its working state.</div>
                </button>
                <button
                  onClick={() => setShowR2Import(true)}
                  className="rounded-3xl border border-white/10 bg-black/12 px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:bg-white/10"
                >
                  <div className="text-3xs uppercase tracking-ui text-text-muted">Recovery</div>
                  <div className="mt-2">Import from R2</div>
                  <div className="mt-1 text-xs font-normal text-text-secondary">Pull a published world down from R2 and continue shaping it locally.</div>
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 rounded-3xl border border-white/10 bg-[linear-gradient(155deg,rgba(54,63,90,0.9),rgba(37,45,68,0.92))] p-6 shadow-panel">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Recent worlds</p>
                <h2 className="mt-2 font-display text-3xl text-text-primary">Resume the latest work</h2>
              </div>
              {recentProjects.length > 0 && (
                <span className="shrink-0 text-xs uppercase tracking-ui text-text-muted">
                  {recentProjects.length} saved
                </span>
              )}
            </div>

            {recentProjects.length > 0 ? (
              <div className="flex min-h-0 flex-col gap-4">
                <button
                  onClick={() => void handleOpenRecent(recentProjects[0]!)}
                  disabled={loading === recentProjects[0]!.path}
                  className="rounded-3xl border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgba(168,151,210,0.34),rgba(200,151,46,0.18))] px-5 py-5 text-left shadow-[0_16px_40px_rgba(8,10,18,0.22)] transition hover:shadow-[0_18px_46px_rgba(168,151,210,0.24)] disabled:opacity-50"
                >
                  <div className="text-3xs uppercase tracking-ui text-text-muted">Last opened realm</div>
                  <div className="mt-3 font-display text-2xl text-text-primary">
                    {loading === recentProjects[0]!.path ? "Opening..." : recentProjects[0]!.name}
                  </div>
                  <div className="mt-2 truncate text-xs text-text-secondary">{recentProjects[0]!.path}</div>
                </button>

                {recentProjects.length > 1 ? (
                  <ul className="flex max-h-[20rem] flex-col gap-2 overflow-y-auto pr-1">
                    {recentProjects.slice(1).map((project) => (
                      <li
                        key={project.path}
                        className="group flex items-center gap-2 rounded-3xl border border-white/8 bg-black/12 px-4 py-3 transition hover:bg-white/8"
                      >
                        <button
                          onClick={() => handleOpenRecent(project)}
                          disabled={loading === project.path}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-medium text-text-primary">
                            {loading === project.path ? "Opening..." : project.name}
                          </div>
                          <div className="mt-1 truncate text-2xs text-text-muted">
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
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/12 px-4 py-6 text-sm leading-7 text-text-muted">
                    No older worlds are on hand yet. The latest realm is ready above.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/12 px-4 py-8 text-sm leading-7 text-text-muted">
                Your worlds will gather here once created. Found a new one to establish the archive.
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

      <Suspense>
        {showR2Import && (
          <ImportFromR2Dialog onClose={() => setShowR2Import(false)} />
        )}
      </Suspense>
    </div>
  );
}
