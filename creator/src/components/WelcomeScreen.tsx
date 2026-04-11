import { lazy, Suspense, useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import {
  loadUIState,
  removeRecentProject,
  type RecentProject,
} from "@/lib/uiPersistence";
import { ErrorDialog } from "./ErrorDialog";
import { CosmicBackdrop } from "./ui/CosmicBackdrop";
import splashHero from "@/assets/splash-hero.jpg";

const ImportFromR2Dialog = lazy(() => import("./ImportFromR2Dialog").then((m) => ({ default: m.ImportFromR2Dialog })));
const OnboardingFlow = lazy(() => import("./onboarding/OnboardingFlow").then((m) => ({ default: m.OnboardingFlow })));

interface WelcomeScreenProps {
  onNewProject: () => void;
}

export function WelcomeScreen({ onNewProject }: WelcomeScreenProps) {
  const { openWithPicker, openDir } = useOpenProject();
  const [errors, setErrors] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showR2Import, setShowR2Import] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
    <div className="relative flex min-h-screen min-h-dvh overflow-x-hidden overflow-y-auto bg-bg-abyss">
      <CosmicBackdrop variant="welcome" />
      <img
        src={splashHero}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.18),rgb(var(--bg-rgb)/0.84))]" />
      <div className="absolute left-[-8rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.22),transparent_66%)] blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-8 lg:px-10">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(18rem,0.64fr)_minmax(0,1.24fr)]">
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.02] text-text-primary lg:text-5xl">
                Return to a world already in motion, or start a new canon.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-text-secondary lg:text-base">
                Arcanum is built for long sessions of shaping zones, systems, lore, and art. Enter through the most direct path and keep working.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[linear-gradient(155deg,rgb(var(--surface-rgb)/0.78),rgb(var(--bg-rgb)/0.92))] p-6 shadow-panel">
              <div className="mt-1 flex flex-col gap-4">
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="rounded-3xl border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.34),rgb(var(--surface-rgb)/0.18))] px-5 py-5 text-left text-sm font-medium text-text-primary shadow-[0_16px_40px_rgb(var(--accent-rgb)/0.18)] transition hover:shadow-[0_18px_46px_rgb(var(--accent-rgb)/0.28)]"
                >
                  <div className="flex items-center gap-2">
                    <div className="font-display text-xl">Start with Arcanum Hub</div>
                    <span className="rounded-full border border-[var(--border-accent-ring)] bg-[var(--chrome-fill)] px-2 py-0.5 text-2xs uppercase tracking-ui text-accent">New</span>
                  </div>
                  <div className="mt-2 text-xs font-normal leading-6 text-text-secondary">Drop in a hub API key and we'll generate your first zone, art and all, in about a minute.</div>
                </button>
                <button
                  onClick={onNewProject}
                  className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4 text-left text-sm font-medium text-text-primary transition hover:border-[var(--border-accent-ring)] hover:bg-[var(--chrome-highlight-strong)]"
                >
                  <div className="font-display text-lg">Create new project</div>
                  <div className="mt-1 text-xs font-normal leading-6 text-text-secondary">Bring your own API keys. Lay down a fresh scaffold and go.</div>
                </button>
                <div className="space-y-2 border-t border-[var(--chrome-stroke)] pt-4">
                  <button
                    onClick={handleOpen}
                    className="flex w-full items-start justify-between gap-4 rounded-2xl px-3 py-3 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    <div>
                      <div>Open existing project</div>
                      <div className="mt-1 text-xs font-normal leading-6 text-text-secondary">Reconnect to a local project folder and restore its working state.</div>
                    </div>
                    <span className="pt-1 text-[var(--color-warm-pale)]">↗</span>
                  </button>
                  <button
                    onClick={() => setShowR2Import(true)}
                    className="flex w-full items-start justify-between gap-4 rounded-2xl px-3 py-3 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    <div>
                      <div>Import from R2</div>
                      <div className="mt-1 text-xs font-normal leading-6 text-text-secondary">Pull a published world down from R2 and continue shaping it locally.</div>
                    </div>
                    <span className="pt-1 text-[var(--color-warm-pale)]">↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 rounded-2xl border border-[var(--chrome-stroke)] bg-[linear-gradient(155deg,rgb(var(--surface-rgb)/0.78),rgb(var(--bg-rgb)/0.92))] p-6 shadow-panel">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-text-primary">Continue where you left off</h2>
              </div>
              {recentProjects.length > 0 && (
                <span className="shrink-0 text-xs text-text-muted">
                  {recentProjects.length} saved
                </span>
              )}
            </div>

            {recentProjects.length > 0 ? (
              <div className="flex min-h-0 flex-col gap-4">
                <button
                  onClick={() => void handleOpenRecent(recentProjects[0]!)}
                  disabled={loading === recentProjects[0]!.path}
                  className="rounded-3xl border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.34),rgb(var(--surface-rgb)/0.18))] px-5 py-5 text-left shadow-[0_16px_40px_rgb(var(--shadow-rgb)/0.22)] transition hover:shadow-[0_18px_46px_rgb(var(--accent-rgb)/0.24)] disabled:opacity-50"
                >
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
                        className="group flex items-center gap-2 rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3 transition hover:bg-[var(--chrome-highlight-strong)]"
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
                          className="shrink-0 rounded-full border border-[var(--chrome-stroke)] px-2 py-1 text-xs text-text-muted opacity-0 transition hover:border-status-error/40 hover:text-status-error group-hover:opacity-100 focus:opacity-100"
                          title="Remove from recent"
                          aria-label={`Remove ${project.name} from recent projects`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-3xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-6 text-sm leading-7 text-text-muted">
                    No older worlds are on hand yet. Your latest project is ready above.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-8 text-sm leading-7 text-text-muted">
                No world has opened here yet. Begin one above and it will be waiting when you return.
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

      <Suspense>
        {showOnboarding && (
          <OnboardingFlow onClose={() => setShowOnboarding(false)} />
        )}
      </Suspense>
    </div>
  );
}
