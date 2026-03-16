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
    title: "Provider credentials and deployment pipeline.",
    description: "Manage external services and publish your world.",
  },
  {
    id: "services",
    label: "Services",
    eyebrow: "Providers",
    title: "Manage image, LLM, and CDN credentials.",
    description: "API keys for image generation, LLM, and CDN.",
  },
  {
    id: "delivery",
    label: "Handoff",
    eyebrow: "Handoff",
    title: "Save, validate, publish, and deploy.",
    description: "Save, validate, export, and publish your world to the live server.",
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
  return (
    <div className="flex flex-col gap-6">
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
          description="LLM, image generation, and R2 credentials."
        >
          <ApiSettingsPanel initialSection="providers" />
        </StudioSection>
      )}

      {activeView === "delivery" && (
        <div className="grid gap-6">
          <StudioSection kicker="Delivery" title="Runtime credentials" description="CDN credentials and public delivery URLs.">
            <ApiSettingsPanel initialSection="delivery" showDeploymentActions={false} />
          </StudioSection>
          <RuntimeHandoffStudio />
        </div>
      )}
    </div>
  );
}
