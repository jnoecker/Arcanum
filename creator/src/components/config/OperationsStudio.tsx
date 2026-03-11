import type { ReactNode } from "react";
import type { OperationsSubView } from "@/types/project";
import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";

const OPERATIONS_VIEWS: Array<{
  id: OperationsSubView;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Ops",
    title: "Keep external providers and runtime delivery behind a dedicated shell.",
    description: "Operations work is now separate from world design, with focused views for credentials and deployment handoff.",
  },
  {
    id: "services",
    label: "Services",
    eyebrow: "Providers",
    title: "Manage image, LLM, and CDN credentials in one place.",
    description: "All external service settings stay isolated from creator workflows so world editing and infrastructure editing do not mix.",
  },
  {
    id: "delivery",
    label: "Delivery",
    eyebrow: "Handoff",
    title: "Handle config and world deployment with explicit runtime intent.",
    description: "R2 deployment controls live in their own view so export, publish, and sync steps stay visible instead of buried under provider fields.",
  },
];

function StudioSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(56,66,96,0.9),rgba(39,48,72,0.92))] p-5 shadow-[0_16px_42px_rgba(9,12,24,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-2xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function OperationsStudio({
  activeView,
  onViewChange,
}: {
  activeView: OperationsSubView;
  onViewChange: (view: OperationsSubView) => void;
}) {
  const current = OPERATIONS_VIEWS.find((view) => view.id === activeView) ?? OPERATIONS_VIEWS[0]!;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-6 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{current.eyebrow}</p>
        <h2 className="mt-3 max-w-4xl font-display text-4xl text-text-primary">{current.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{current.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {OPERATIONS_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeView === view.id
                  ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.2),rgba(140,174,201,0.14))] text-text-primary"
                  : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "overview" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {OPERATIONS_VIEWS.filter((view) => view.id !== "overview").map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className="rounded-[26px] border border-white/10 bg-[linear-gradient(160deg,rgba(56,66,96,0.9),rgba(39,48,72,0.92))] p-5 text-left shadow-[0_16px_42px_rgba(9,12,24,0.22)] transition hover:border-[rgba(184,216,232,0.2)] hover:bg-[linear-gradient(160deg,rgba(63,73,105,0.94),rgba(43,52,79,0.96))]"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{view.eyebrow}</p>
              <h3 className="mt-3 font-display text-2xl text-text-primary">{view.label}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{view.description}</p>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-accent">Open workspace</div>
            </button>
          ))}
        </div>
      )}

      {activeView === "services" && (
        <StudioSection
          kicker="Services"
          title="API and provider credentials"
          description="LLM, image generation, and R2 credentials stay together so provider swaps and auth changes do not touch the rest of the config."
        >
          <ApiSettingsPanel initialSection="providers" />
        </StudioSection>
      )}

      {activeView === "delivery" && (
        <StudioSection
          kicker="Delivery"
          title="R2 deployment and handoff"
          description="Use this view for CDN publishing and runtime handoff instead of hunting for deploy buttons inside the provider form."
        >
          <ApiSettingsPanel initialSection="delivery" />
        </StudioSection>
      )}
    </div>
  );
}
