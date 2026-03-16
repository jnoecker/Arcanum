import type { ReactNode } from "react";
import type { AppConfig } from "@/types/config";
import type { ContentStudioSubView } from "@/types/project";
import { AchievementDesigner } from "./AchievementDesigner";
import { QuestTaxonomyDesigner } from "./QuestTaxonomyDesigner";
import { GlobalAssetsPanel } from "./panels/GlobalAssetsPanel";

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

export function ContentStudio({
  config,
  onChange,
  activeView,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  activeView: ContentStudioSubView;
}) {
  return (
    <div className="flex flex-col gap-6">
      {activeView === "achievements" && (
        <StudioSection
          kicker="Progression content"
          title="Achievement language"
          description="Categories and criterion definitions."
        >
          <AchievementDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}

      {activeView === "quests" && (
        <StudioSection
          kicker="Quest language"
          title="Quest taxonomy designer"
          description="Objective and completion vocabularies."
        >
          <QuestTaxonomyDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}

      {activeView === "assets" && (
        <StudioSection
          kicker="Shared assets"
          title="Global presentation assets"
          description="Global assets exported with runtime config."
        >
          <GlobalAssetsPanel config={config} onChange={onChange} />
        </StudioSection>
      )}
    </div>
  );
}