import type { ReactNode } from "react";
import type { OperationsSubView } from "@/types/project";
import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";
import { RuntimeHandoffStudio } from "./RuntimeHandoffStudio";

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
    label: "Handoff",
    eyebrow: "Handoff",
    title: "Run the full world handoff from one explicit workflow.",
    description: "Save the canonical world, validate it, export a runtime bundle, and publish the exact files the live MUD expects.",
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
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
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
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-4 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{current.eyebrow}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl text-text-primary">{current.label}</h2>
              <span className="text-sm text-text-secondary">{current.description}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {OPERATIONS_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeView === view.id
                  ? "border-[rgba(184,216,232,0.48)] bg-[linear-gradient(135deg,rgba(168,151,210,0.3),rgba(140,174,201,0.2))] text-white shadow-[0_10px_24px_rgba(137,155,214,0.18)]"
                  : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "overview" && (
        <div className="grid gap-4 xl:grid-cols-2">
          {OPERATIONS_VIEWS.filter((view) => view.id !== "overview").map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className="rounded-[26px] border border-white/10 bg-[linear-gradient(160deg,rgba(56,66,96,0.9),rgba(39,48,72,0.92))] p-4 text-left shadow-[0_16px_42px_rgba(9,12,24,0.22)] transition hover:border-[rgba(184,216,232,0.2)] hover:bg-[linear-gradient(160deg,rgba(63,73,105,0.94),rgba(43,52,79,0.96))]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{view.eyebrow}</p>
                  <h3 className="mt-2 font-display text-xl text-text-primary">{view.label}</h3>
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-accent">
                  Open
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{view.description}</p>
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
        <div className="grid gap-6">
          <StudioSection kicker="Delivery" title="Runtime credentials" description="Keep CDN credentials and public delivery URLs here.">
            <ApiSettingsPanel initialSection="delivery" showDeploymentActions={false} />
          </StudioSection>
          <RuntimeHandoffStudio />
        </div>
      )}
    </div>
  );
}
