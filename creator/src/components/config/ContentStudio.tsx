import type { ReactNode } from "react";
import type { AppConfig } from "@/types/config";
import type { ContentStudioSubView } from "@/types/project";
import { AchievementDesigner } from "./AchievementDesigner";
import { QuestTaxonomyDesigner } from "./QuestTaxonomyDesigner";
import { GlobalAssetsPanel } from "./panels/GlobalAssetsPanel";

const CONTENT_STUDIO_VIEWS: Array<{
  id: ContentStudioSubView;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Content",
    title: "Move through authored content by purpose instead of by registry stack.",
    description: "Achievements, quest taxonomy, and shared presentation assets each get a focused surface instead of competing in one long scroll.",
  },
  {
    id: "achievements",
    label: "Achievements",
    eyebrow: "Recognition",
    title: "Shape achievement language and tracking vocabulary together.",
    description: "Categories and criterion types are part of the same reward grammar and should be reviewed side by side.",
  },
  {
    id: "quests",
    label: "Quest Taxonomy",
    eyebrow: "Structure",
    title: "Keep quest verbs and completion models in one authoring view.",
    description: "Objective and completion types define how zone-authored quests read and behave, so they belong in one safe editing surface.",
  },
  {
    id: "assets",
    label: "Shared Assets",
    eyebrow: "Presentation",
    title: "Curate the global asset language the client can reuse everywhere.",
    description: "Only explicitly registered assets are exported, so this workspace doubles as the source of truth for runtime-safe global visuals.",
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

export function ContentStudio({
  config,
  onChange,
  activeView,
  onViewChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  activeView: ContentStudioSubView;
  onViewChange: (view: ContentStudioSubView) => void;
}) {
  const current = CONTENT_STUDIO_VIEWS.find((view) => view.id === activeView) ?? CONTENT_STUDIO_VIEWS[0]!;
  const achievementCount = Object.keys(config.achievementCategories).length;
  const criterionCount = Object.keys(config.achievementCriterionTypes).length;
  const objectiveCount = Object.keys(config.questObjectiveTypes).length;
  const globalAssetCount = Object.keys(config.globalAssets).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-6 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{current.eyebrow}</p>
        <h2 className="mt-3 max-w-4xl font-display text-4xl text-text-primary">{current.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{current.description}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Achievement Categories" value={achievementCount} description="Top-level reward groupings" />
          <MetricCard label="Criterion Types" value={criterionCount} description="Progress verbs and formats" />
          <MetricCard label="Quest Objectives" value={objectiveCount} description="Quest step vocabulary" />
          <MetricCard label="Global Assets" value={globalAssetCount} description="Explicit runtime-safe registrations" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CONTENT_STUDIO_VIEWS.map((view) => (
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
        <div className="grid gap-5 xl:grid-cols-3">
          {CONTENT_STUDIO_VIEWS.filter((view) => view.id !== "overview").map((view) => (
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

      {activeView === "achievements" && (
        <StudioSection
          kicker="Progression content"
          title="Achievement language"
          description="Categories and criterion definitions now live in a focused content workbench instead of a stacked registry pair."
        >
          <AchievementDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}

      {activeView === "quests" && (
        <StudioSection
          kicker="Quest language"
          title="Quest taxonomy designer"
          description="Objective and completion vocabularies stay together so authored quest structure remains readable and migration-safe."
        >
          <QuestTaxonomyDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}

      {activeView === "assets" && (
        <StudioSection
          kicker="Shared assets"
          title="Global presentation assets"
          description="This is the only exported global asset set now, which keeps runtime URLs clean and CDN hygiene intentional."
        >
          <GlobalAssetsPanel config={config} onChange={onChange} />
        </StudioSection>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/12 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{label}</div>
      <div className="mt-2 font-display text-3xl text-text-primary">{value}</div>
      <div className="mt-2 text-xs text-text-secondary">{description}</div>
    </div>
  );
}
