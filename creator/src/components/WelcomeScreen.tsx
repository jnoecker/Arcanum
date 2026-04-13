import { lazy, Suspense, useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import {
  loadUIState,
  removeRecentProject,
  type RecentProject,
} from "@/lib/uiPersistence";
import { ErrorDialog } from "./ErrorDialog";
import { CosmicBackdrop } from "./ui/CosmicBackdrop";
import { AI_ENABLED } from "@/lib/featureFlags";
import splashHero from "@/assets/splash-hero.jpg";

const ImportFromR2Dialog = lazy(() => import("./ImportFromR2Dialog").then((m) => ({ default: m.ImportFromR2Dialog })));
const OnboardingFlow = __BUILD_VARIANT__ === "full" ? lazy(() => import("./onboarding/OnboardingFlow").then((m) => ({ default: m.OnboardingFlow }))) : () => null;

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

  const mostRecent = recentProjects[0] ?? null;
  const olderProjects = recentProjects.slice(1);

  return (
    <div className="relative h-screen h-dvh overflow-x-hidden overflow-y-auto bg-bg-abyss">
      <CosmicBackdrop variant="welcome" />
      <img
        src={splashHero}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.10)_0%,rgb(var(--bg-rgb)/0.50)_40%,rgb(var(--bg-rgb)/0.88)_100%)]" />

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-xl flex-col items-center">

          {/* ── Brand ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-center">
            <h1
              className="font-display text-[clamp(2.8rem,6vw,4.2rem)] uppercase leading-none tracking-[0.28em] text-text-primary"
              style={{
                textShadow: "0 0 48px rgb(var(--accent-rgb) / 0.30), 0 0 120px rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              Arcanum
            </h1>
            <div
              className="mt-3 h-px w-24"
              style={{
                background: "linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.5), transparent)",
              }}
            />
            <p className="mt-3 text-center font-display text-2xs uppercase tracking-ui text-text-muted">
              Shape worlds. Forge legends.
            </p>
          </div>

          {/* ── Continue (most recent project) ────────────────────── */}
          {mostRecent && (
            <div className="mt-10 w-full">
              <button
                onClick={() => void handleOpenRecent(mostRecent)}
                disabled={loading === mostRecent.path}
                className="group relative w-full overflow-hidden rounded-3xl border border-[var(--border-accent-ring)] px-7 py-6 text-left transition hover:shadow-[0_20px_50px_rgb(var(--accent-rgb)/0.22)] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), rgb(var(--surface-rgb) / 0.14) 60%, rgb(var(--bg-rgb) / 0.90))",
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
                  style={{ background: "radial-gradient(circle, rgb(var(--accent-rgb) / 0.4), transparent 65%)" }}
                />
                <p className="relative font-display text-2xs uppercase tracking-ui text-accent">
                  Continue
                </p>
                <p className="relative mt-2 font-display text-2xl tracking-wide text-text-primary">
                  {loading === mostRecent.path ? "Opening\u2026" : mostRecent.name}
                </p>
                <p className="relative mt-1.5 truncate text-2xs text-text-muted">
                  {mostRecent.path}
                </p>
              </button>
            </div>
          )}

          {/* ── Create paths ──────────────────────────────────────── */}
          <div className={`w-full ${mostRecent ? "mt-4" : "mt-10"} grid gap-3 sm:grid-cols-2`}>
            {AI_ENABLED && (
              <button
                onClick={() => setShowOnboarding(true)}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border-accent-ring)]/60 px-5 py-5 text-left transition hover:border-[var(--border-accent-ring)] hover:shadow-[0_14px_36px_rgb(var(--accent-rgb)/0.18)]"
                style={{
                  background: "linear-gradient(155deg, rgb(var(--accent-rgb) / 0.12), rgb(var(--surface-rgb) / 0.10) 50%, rgb(var(--bg-rgb) / 0.88))",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-text-primary">
                    Start with Arcanum Hub
                  </span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-[10px] uppercase tracking-label text-accent">
                    New
                  </span>
                </div>
                <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                  Enter a hub API key and we'll generate your first zone, art and all, in about a minute.
                </p>
              </button>
            )}

            <button
              onClick={onNewProject}
              className="group rounded-2xl border border-[var(--chrome-stroke)] px-5 py-5 text-left transition hover:border-[var(--border-accent-ring)]/50 hover:bg-[var(--chrome-fill)]/40"
              style={{
                background: "linear-gradient(155deg, rgb(var(--surface-rgb) / 0.08), rgb(var(--bg-rgb) / 0.80))",
              }}
            >
              <p className="font-display text-sm text-text-primary">
                Create new project
              </p>
              <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                Bring your own API keys. Lay down a fresh scaffold and go.
              </p>
            </button>
          </div>

          {/* ── Secondary actions ──────────────────────────────────── */}
          <div className="mt-4 flex w-full items-center justify-center gap-6">
            <button
              onClick={handleOpen}
              className="focus-ring rounded-full px-3 py-1.5 text-2xs text-text-muted transition hover:text-accent"
            >
              Open existing project
            </button>
            <span className="text-2xs text-text-muted/30" aria-hidden="true">{"\u00B7"}</span>
            <button
              onClick={() => setShowR2Import(true)}
              className="focus-ring rounded-full px-3 py-1.5 text-2xs text-text-muted transition hover:text-accent"
            >
              Import from R2
            </button>
          </div>

          {/* ── Older recent projects ─────────────────────────────── */}
          {olderProjects.length > 0 && (
            <div className="mt-8 w-full">
              <p className="mb-3 text-center font-display text-2xs uppercase tracking-ui text-text-muted">
                Recent worlds
              </p>
              <div className="flex flex-col gap-1.5">
                {olderProjects.map((project) => (
                  <div
                    key={project.path}
                    className="group flex items-center gap-3 rounded-2xl border border-[var(--chrome-stroke)]/50 px-4 py-2.5 transition hover:border-[var(--chrome-stroke)] hover:bg-[var(--chrome-fill)]/30"
                  >
                    <button
                      onClick={() => void handleOpenRecent(project)}
                      disabled={loading === project.path}
                      className="min-w-0 flex-1 text-left disabled:opacity-50"
                    >
                      <span className="text-xs text-text-primary">
                        {loading === project.path ? "Opening\u2026" : project.name}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRecent(project.path);
                      }}
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-text-muted opacity-0 transition hover:text-status-error group-hover:opacity-100 focus:opacity-100"
                      title="Remove from recent"
                      aria-label={`Remove ${project.name} from recent projects`}
                    >
                      {"\u2715"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
        {AI_ENABLED && showOnboarding && (
          <OnboardingFlow onClose={() => setShowOnboarding(false)} />
        )}
      </Suspense>
    </div>
  );
}
