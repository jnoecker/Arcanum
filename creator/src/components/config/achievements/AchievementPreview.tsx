import type { AchievementDefFile, AchievementCategoryDefinition } from "@/types/config";

interface AchievementPreviewProps {
  def: AchievementDefFile;
  categories: Record<string, AchievementCategoryDefinition>;
}

export function AchievementPreview({ def, categories }: AchievementPreviewProps) {
  const categoryName =
    categories[def.category]?.displayName ?? def.category ?? "—";

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
