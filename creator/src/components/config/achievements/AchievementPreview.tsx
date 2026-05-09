import type { AchievementDefFile, AchievementCategoryDefinition } from "@/types/config";
import { CheckIcon, XIcon } from "./icons";

interface AchievementPreviewProps {
  id: string;
  def: AchievementDefFile;
  categories: Record<string, AchievementCategoryDefinition>;
}

export function AchievementPreview({ id, def, categories }: AchievementPreviewProps) {
  const categoryName =
    categories[def.category]?.displayName ?? def.category ?? "—";
  const xp = def.rewards?.xp ?? 0;
  const gold = def.rewards?.gold ?? 0;
  const title = def.rewards?.title?.trim();
  const rewardSummary = [
    xp > 0 ? `${xp} XP` : null,
    gold > 0 ? `${gold} Gold` : null,
    title ? `“${title}”` : null,
  ].filter(Boolean);

  return (
    <aside className="flex flex-col gap-3">
      <PreviewCard def={def} categoryName={categoryName} />

      <OverviewCard
        id={id}
        categoryName={categoryName}
        criteriaCount={def.criteria?.length ?? 0}
        rewardSummary={rewardSummary.length > 0 ? rewardSummary.join(", ") : "0 XP, 0 Gold"}
        hidden={def.hidden ?? false}
      />

      <TipsCard />
    </aside>
  );
}

function PreviewCard({
  def,
  categoryName,
}: {
  def: AchievementDefFile;
  categoryName: string;
}) {
  return (
    <div className="panel-surface rounded-2xl p-4 shadow-section">
      <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Achievement Preview
      </p>

      <div className="mt-3 flex flex-col items-center text-center">
        <h4 className="font-display text-xl font-semibold text-text-primary">
          {def.displayName || "Untitled achievement"}
        </h4>
        {def.description && (
          <p className="mt-1.5 max-w-xs text-2xs leading-relaxed text-text-secondary">
            {def.description}
          </p>
        )}

        <span className="mt-3 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-display text-2xs text-accent">
          {categoryName}
        </span>
      </div>
    </div>
  );
}

function OverviewCard({
  id,
  categoryName,
  criteriaCount,
  rewardSummary,
  hidden,
}: {
  id: string;
  categoryName: string;
  criteriaCount: number;
  rewardSummary: string;
  hidden: boolean;
}) {
  return (
    <div className="panel-surface rounded-2xl p-4 shadow-section">
      <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Overview
      </p>
      <dl className="mt-2 flex flex-col gap-1.5">
        <Row label="Internal ID" value={<span className="font-mono">{id}</span>} />
        <Row label="Category" value={categoryName} />
        <Row label="Criteria" value={String(criteriaCount)} />
        <Row label="Rewards" value={rewardSummary} />
        <Row
          label="Hidden"
          value={
            hidden ? (
              <span className="inline-flex items-center gap-1 text-status-warning">
                <CheckIcon className="h-3 w-3" />
                Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <XIcon className="h-3 w-3" />
                No
              </span>
            )
          }
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-1.5 last:border-b-0 last:pb-0">
      <dt className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="truncate text-right text-xs text-text-secondary">{value}</dd>
    </div>
  );
}

function TipsCard() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] p-4">
      <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Tips
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-2xs leading-snug text-text-muted/80">
        <Tip>Use clear and concise names.</Tip>
        <Tip>Criteria are evaluated in the order shown.</Tip>
        <Tip>Leave Target ID empty to apply to any target.</Tip>
      </ul>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}
