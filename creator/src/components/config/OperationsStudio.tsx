import type { ReactNode } from "react";
import type { OperationsSubView } from "@/types/project";
import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";
import { RuntimeHandoffStudio } from "./RuntimeHandoffStudio";

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
    <section className="rounded-[28px] border border-white/10 bg-gradient-panel-light p-5 shadow-[0_16px_42px_rgba(9,12,24,0.22)]">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function OperationsStudio({
  activeView,
}: {
  activeView: OperationsSubView;
}) {
  return (
    <div className="flex flex-col gap-6">
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
