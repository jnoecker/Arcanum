import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { panelTab } from "@/lib/panelRegistry";
import {
  loadGettingStarted,
  markStepCompleted,
  dismissGettingStarted,
} from "@/lib/gettingStartedPersistence";

interface Step {
  id: string;
  glyph: string;
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
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const zones = useZoneStore((s) => s.zones);
  const [completed, setCompleted] = useState<string[]>(() => loadGettingStarted().completed);
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);

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
        glyph: "\u{1F30D}",
        title: "Explore the World Map",
        description:
          "Your home base. The map shows every workshop where you'll build your world.",
        action: () => openWorldMap(),
      },
      {
        id: "zone",
        glyph: "\u{1F5FA}\uFE0F",
        title: "Visit a Zone",
        description:
          "Zones are regions with rooms, creatures, and items. Open one to see its graph.",
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
      {
        id: "characters",
        glyph: "\u2694\uFE0F",
        title: "Discover Characters",
        description:
          "Classes and races define who adventures in your world. Browse or create your own.",
        action: () => openTab(panelTab("classes")),
      },
      {
        id: "art",
        glyph: "\u{1F3A8}",
        title: "Generate Art",
        description:
          "Every creature, item, and place can have AI artwork. Try rendering your first image.",
        action: () => openGenerator(),
      },
      {
        id: "lore",
        glyph: "\u{1F4DC}",
        title: "Write Lore",
        description:
          "Build your world's history, culture, and legends. Articles, maps, and timelines.",
        action: () => openTab(panelTab("lore")),
      },
      {
        id: "config",
        glyph: "\u2699\uFE0F",
        title: "Shape Your World",
        description:
          "Fine-tune game mechanics — stats, combat, crafting, progression — to match your vision.",
        action: () => openTab(panelTab("tuningWizard")),
      },
      {
        id: "publish",
        glyph: "\u2728",
        title: "Share Your Creation",
        description:
          "Publish your world as a public showcase for others to explore and enjoy.",
        action: () => openTab(panelTab("deployment")),
      },
    ];
  }, [openWorldMap, openTab, openGenerator, zones]);

  const completedCount = completed.length;
  const totalSteps = steps.length;
  const allDone = completedCount >= totalSteps;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end"
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
        className="relative flex h-full w-[26rem] max-w-[92vw] flex-col border-l border-[var(--chrome-stroke)] bg-bg-primary"
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
                Your Journey Begins
              </p>
              <h2 className="mt-1 font-display text-lg tracking-wide text-text-primary">
                Getting Started
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

          {/* Progress bar */}
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
        </div>

        {/* Steps */}
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
                  {/* Glyph */}
                  <span
                    className={`mt-0.5 shrink-0 text-base leading-none transition-transform duration-300 ${
                      justCompleted ? "scale-125" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {step.glyph}
                  </span>

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

        {/* Footer */}
        <div className="relative shrink-0 border-t border-[var(--chrome-stroke)] px-6 py-4">
          <p className="text-center text-2xs text-text-muted">
            Press{" "}
            <kbd className="rounded border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
              Ctrl+K
            </kbd>{" "}
            anytime to find anything
          </p>
        </div>
      </div>
    </div>
  );
}

export default GettingStartedPanel;
