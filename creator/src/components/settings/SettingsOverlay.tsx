import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { PANEL_MAP, panelsForIsland } from "@/lib/panelRegistry";
import type { PanelDef } from "@/lib/panelRegistry";
import { PANEL_ICONS } from "@/assets/ui";

const ConfigPanelHost = lazy(() =>
  import("../config/ConfigPanelHost").then((m) => ({ default: m.ConfigPanelHost })),
);
const LorePanelHost = lazy(() =>
  import("../lore/LorePanelHost").then((m) => ({ default: m.LorePanelHost })),
);
const AppearancePanel = lazy(() =>
  import("../AppearancePanel").then((m) => ({ default: m.AppearancePanel })),
);

interface SettingsOverlayProps {
  onClose: () => void;
}

/**
 * Unified Settings overlay — a single full-screen modal that groups
 * app/project configuration panels that don't belong to any of the
 * six islands (API keys, appearance, version control, raw YAML,
 * templates, showcase settings, etc.).
 *
 * This is a v1 stub: it presents the settings-bucketed panels as a
 * vertical tab list on the left with the panel body on the right,
 * lazily mounting whichever host knows how to render each panel.
 * The structure is intentionally simple — we'll iterate on grouping,
 * ordering, and the "is this really a setting?" question later.
 */
export function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const panels = useMemo<PanelDef[]>(() => panelsForIsland("settings"), []);
  const [activeId, setActiveId] = useState<string>(() => panels[0]?.id ?? "services");
  const active = PANEL_MAP[activeId];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let body: React.ReactNode = null;
  if (active) {
    if (active.id === "appearance") {
      body = <AppearancePanel />;
    } else if (active.host === "lore") {
      body = <LorePanelHost panelId={active.id} />;
    } else {
      body = <ConfigPanelHost panelId={active.id} />;
    }
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-[90] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className="panel-surface relative flex h-full max-h-[min(900px,92vh)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-accent/30 bg-bg-primary shadow-[var(--shadow-overlay)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <div>
            <div className="text-3xs uppercase tracking-[0.28em] text-text-muted">
              Arcanum
            </div>
            <h2 className="mt-1 font-display text-2xl text-accent">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-xs text-text-secondary transition hover:border-accent/60 hover:text-accent"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Tabs */}
          <nav
            className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-default p-3"
            aria-label="Settings sections"
          >
            {panels.map((p) => {
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
                  }`}
                >
                  {PANEL_ICONS[p.id] ? (
                    <img src={PANEL_ICONS[p.id]} alt="" aria-hidden="true" className="h-4 w-4 shrink-0 object-contain" />
                  ) : p.glyph ? (
                    <span aria-hidden="true" className="text-base leading-none">
                      {p.glyph}
                    </span>
                  ) : null}
                  <span className="font-display uppercase tracking-wide-ui text-[11px]">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Active panel */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            <Suspense
              fallback={
                <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
                  Loading…
                </div>
              }
            >
              {body}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
