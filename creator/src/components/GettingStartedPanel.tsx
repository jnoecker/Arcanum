import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { panelTab } from "@/lib/panelRegistry";
import { AI_ENABLED } from "@/lib/featureFlags";
import {
  loadGettingStarted,
  markStepCompleted,
  markIntroSeen,
  dismissGettingStarted,
} from "@/lib/gettingStartedPersistence";
import { GS_ICONS } from "@/assets/ui";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface Step {
  id: string;
  title: string;
  description: string;
  action: () => void;
}

interface GettingStartedPanelProps {
  onClose: () => void;
}

export function GettingStartedPanel({ onClose }: GettingStartedPanelProps) {
  const openWorldMap = useProjectStore((s) => s.openWorldMap);
  const openTab = useProjectStore((s) => s.openTab);
  const zones = useZoneStore((s) => s.zones);
  const initialState = useRef(loadGettingStarted());
  const [completed, setCompleted] = useState<string[]>(() => initialState.current.completed);
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(() => !initialState.current.introSeen);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      dismissGettingStarted();
      onClose();
    }, 280);
  }, [onClose]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [handleClose]);

  const completeAndRun = useCallback(
    (stepId: string, action: () => void) => {
      markStepCompleted(stepId);
      setCompleted((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
      setActiveStep(stepId);
      setTimeout(() => setActiveStep(null), 600);
      action();
    },
    [],
  );

  const steps: Step[] = useMemo(() => {
    const firstZoneId = zones.size > 0 ? Array.from(zones.keys())[0] : null;

    return [
      {
        id: "world-map",
        title: "See the World Map",
        description:
          "An aerial view of everything you've built. Each island is a different kind of work — art, characters, systems, lore.",
        action: () => openWorldMap(),
      },
      {
        id: "zone",
        title: "Open a Zone",
        description:
          "A zone is a region — a forest, a city, a dungeon. Inside are rooms players walk between, and the creatures and items that live there.",
        action: () => {
          if (firstZoneId) {
            openTab({
              id: `zone:${firstZoneId}`,
              kind: "zone",
              label: firstZoneId,
            });
          } else {
            openWorldMap();
          }
        },
      },
      ...(AI_ENABLED ? [{
        id: "characters",
        title: "Meet the Inhabitants",
        description:
          "The classes and races your players can choose. Each has a portrait, a backstory, and stats you can tune.",
        action: () => openTab(panelTab("portraits")),
      }] : []),
      ...(AI_ENABLED ? [{
        id: "art",
        title: "Conjure Some Art",
        description:
          "Every creature, item, and place can have AI-generated artwork. Describe what you want, and it appears.",
        action: () => openTab(panelTab("art")),
      }] : []),
      {
        id: "lore",
        title: "Write the Chronicle",
        description:
          "Histories, cultures, legends, maps, timelines. The written world behind the playable one.",
        action: () => openTab(panelTab("lore")),
      },
      {
        id: "config",
        title: "Tune the Rules",
        description:
          "How combat feels, how crafting works, how players grow. The mechanics that make your world behave.",
        action: () => openTab(panelTab("tuningWizard")),
      },
      {
        id: "publish",
        title: "Open Your World",
        description:
          "Publish a public showcase so others can read your lore, see your maps, and — if you run a server — join in.",
        action: () => openTab(panelTab("deployment")),
      },
    ];
  }, [openWorldMap, openTab, zones]);

  const completedCount = completed.length;
  const totalSteps = steps.length;
  const allDone = completedCount >= totalSteps;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="getting-started-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgb(var(--overlay-rgb)/0.35)]"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
          backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-[26rem] max-w-[92vw] flex-col border-l border-[var(--chrome-stroke)] bg-bg-primary outline-none"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          opacity: visible ? 1 : 0,
          transition: visible
            ? "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease"
            : "transform 260ms cubic-bezier(0.7, 0, 0.84, 0), opacity 180ms ease",
        }}
      >
        {/* Background texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.1),transparent_65%)] blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.06),transparent_70%)] blur-2xl" />
        </div>

        {/* Header */}
        <div className="relative shrink-0 border-b border-[var(--chrome-stroke)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-2xs uppercase tracking-ui text-accent">
                {showIntro ? "Welcome, Creator" : "Your Journey Begins"}
              </p>
              <h2
                id="getting-started-title"
                className="mt-1 font-display text-lg tracking-wide text-text-primary"
              >
                {showIntro ? "A Window Into a World" : "Getting Started"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="focus-ring -mr-1 -mt-1 rounded-full p-1.5 text-text-muted transition hover:text-text-primary"
              aria-label="Close getting started panel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Progress bar — only on checklist view */}
          {!showIntro && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-2xs text-text-muted">
                <span>
                  {allDone
                    ? "All explored!"
                    : `${completedCount} of ${totalSteps} explored`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--chrome-fill)]">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        {showIntro ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="flex flex-col gap-5 text-sm leading-relaxed text-text-secondary">
              <p>
                Arcanum is the instrument for building a world. You sit
                above it and shape what goes where.
              </p>

              <div className="flex flex-col gap-3">
                <p className="font-display text-2xs uppercase tracking-ui text-accent">
                  What a world is made of
                </p>
                <dl className="flex flex-col gap-2.5">
                  <div>
                    <dt className="font-display text-xs tracking-label text-text-primary">
                      Zones & Rooms
                    </dt>
                    <dd className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                      A zone is a region. A room is one place inside it.
                      Players walk from room to room.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display text-xs tracking-label text-text-primary">
                      Creatures & Items
                    </dt>
                    <dd className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                      What the rooms contain. Friends, enemies, treasure,
                      tools.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display text-xs tracking-label text-text-primary">
                      Lore
                    </dt>
                    <dd className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                      The histories, cultures, and legends behind the
                      playable world. Articles, maps, timelines.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display text-xs tracking-label text-text-primary">
                      Characters & Rules
                    </dt>
                    <dd className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                      Who players can be, and how the world behaves
                      around them.
                    </dd>
                  </div>
                </dl>
              </div>

              <p className="text-2xs leading-relaxed text-text-muted">
                Nothing you do is final. Everything can be renamed, moved,
                regenerated, or undone. Start anywhere.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  markIntroSeen();
                  setShowIntro(false);
                }}
                className="focus-ring relative w-full overflow-hidden rounded-2xl border border-accent/40 px-5 py-3 text-center transition hover:border-accent hover:shadow-[0_10px_28px_rgb(var(--accent-rgb)/0.18)]"
                style={{
                  background:
                    "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), rgb(var(--surface-rgb) / 0.14) 60%, rgb(var(--bg-rgb) / 0.90))",
                }}
              >
                <span className="font-display text-xs uppercase tracking-label text-text-primary">
                  Show me the steps
                </span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="focus-ring rounded-full px-3 py-1.5 text-2xs text-text-muted transition hover:text-accent"
              >
                I'll explore on my own
              </button>
            </div>
          </div>
        ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-2">
            {steps.map((step) => {
              const done = completed.includes(step.id);
              const justCompleted = activeStep === step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => completeAndRun(step.id, step.action)}
                  className={`focus-ring group relative flex items-start gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    done
                      ? "border-[var(--chrome-stroke)]/50 bg-[var(--chrome-fill)]/20"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/40 hover:border-accent/40 hover:bg-[var(--chrome-fill)]/60"
                  }`}
                >
                  {/* Icon */}
                  <img
                    src={GS_ICONS[step.id]}
                    alt=""
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 object-contain transition-transform duration-300 ${
                      justCompleted ? "scale-125" : ""
                    }`}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-display text-xs uppercase tracking-label transition ${
                        done
                          ? "text-text-muted"
                          : "text-text-primary group-hover:text-accent"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-text-muted">
                      {step.description}
                    </p>
                  </div>

                  {/* Completion indicator */}
                  <span
                    className={`mt-1 shrink-0 transition-all duration-300 ${
                      done ? "scale-100 opacity-100" : "scale-75 opacity-0"
                    }`}
                    aria-hidden="true"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                    >
                      <circle
                        cx="9"
                        cy="9"
                        r="8"
                        stroke="rgb(var(--accent-rgb))"
                        strokeWidth="1.5"
                        className="opacity-60"
                      />
                      <path
                        d="M5.5 9.5l2 2 5-5"
                        stroke="rgb(var(--accent-rgb))"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Completion message */}
          {allDone && (
            <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3.5 text-center">
              <p className="font-display text-xs uppercase tracking-label text-accent">
                You're ready to create
              </p>
              <p className="mt-1.5 text-2xs leading-relaxed text-text-muted">
                You've explored all the essentials. This guide will stay
                available in the toolbar whenever you need it.
              </p>
            </div>
          )}
        </div>
        )}

        {/* Footer */}
        <div className="relative shrink-0 border-t border-[var(--chrome-stroke)] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="focus-ring rounded-full px-2 py-1 text-2xs text-text-muted transition hover:text-accent"
            >
              Skip for now
            </button>
            <p className="text-2xs text-text-muted">
              Press{" "}
              <kbd className="rounded border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                Ctrl+K
              </kbd>{" "}
              to find anything
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GettingStartedPanel;
