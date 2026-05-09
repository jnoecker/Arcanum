import type {
  AchievementDefFile,
  AchievementCategoryDefinition,
  AchievementCriterionTypeDefinition,
} from "@/types/config";

interface AchievementPreviewProps {
  def: AchievementDefFile;
  categories: Record<string, AchievementCategoryDefinition>;
  criterionTypes?: Record<string, AchievementCriterionTypeDefinition>;
}

export function AchievementPreview({
  def,
  categories,
  criterionTypes,
}: AchievementPreviewProps) {
  const categoryName =
    categories[def.category]?.displayName ?? def.category ?? "—";

  const hidden = !!def.hidden;
  const criteria = def.criteria ?? [];
  const rewards = def.rewards ?? {};
  const xp = rewards.xp ?? 0;
  const gold = rewards.gold ?? 0;
  const title = rewards.title ?? "";
  const hasRewards = xp > 0 || gold > 0 || title.length > 0;

  return (
    <div className="space-y-2">
      <p className="px-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Achievement Preview
      </p>

      <div
        className={`bg-gradient-glow-top shadow-glow-warm-strong animate-warm-breathe relative overflow-hidden rounded-2xl border border-accent/30 p-6 ${
          hidden ? "opacity-80" : ""
        }`}
      >
        <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />

        <div className="relative flex flex-col items-center text-center">
          <span className="selected-pill mb-3 inline-flex items-center rounded-full border px-3 py-0.5 font-display text-2xs uppercase tracking-[0.18em] text-accent">
            {categoryName}
          </span>

          {hidden ? (
            <HiddenSigil title={def.displayName || "Untitled achievement"} />
          ) : (
            <h4 className="font-display text-2xl font-semibold leading-tight text-text-primary">
              {def.displayName || "Untitled achievement"}
            </h4>
          )}

          {def.description && !hidden && (
            <p className="font-body mt-2 max-w-sm text-sm italic leading-relaxed text-text-secondary">
              {def.description}
            </p>
          )}
          {hidden && (
            <p className="font-body mt-2 max-w-sm text-sm italic leading-relaxed text-text-muted/70">
              Hidden until unlocked.
            </p>
          )}
        </div>

        {!hidden && criteria.length > 0 && (
          <div className="relative mt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-[var(--chrome-stroke)]" />
              <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
                Criteria
              </span>
              <span className="h-px flex-1 bg-[var(--chrome-stroke)]" />
            </div>
            <ul className="flex flex-col gap-1.5">
              {criteria.map((c, i) => {
                const typeLabel =
                  criterionTypes?.[c.type]?.displayName ?? c.type;
                const target = c.targetId?.split(":").pop();
                const summary =
                  c.description?.trim() ||
                  (target ? `${typeLabel} · ${target}` : typeLabel);
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5"
                  >
                    <CheckGlyph />
                    <span className="font-body min-w-0 flex-1 truncate text-xs text-text-secondary">
                      {summary}
                    </span>
                    <span className="font-mono text-2xs text-accent">
                      0 / {c.count ?? 1}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!hidden && hasRewards && (
          <div className="relative mt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-[var(--chrome-stroke)]" />
              <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
                Rewards
              </span>
              <span className="h-px flex-1 bg-[var(--chrome-stroke)]" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {xp > 0 && <RewardChip glyph="✦" label={`${xp} XP`} />}
              {gold > 0 && <RewardChip glyph="◈" label={`${gold} Gold`} />}
              {title.length > 0 && <RewardChip glyph="❦" label={`Title: ${title}`} />}
            </div>
          </div>
        )}

        {!hidden && criteria.length === 0 && !hasRewards && (
          <p className="relative mt-4 text-center text-2xs italic text-text-muted/60">
            Add criteria and rewards to bring this achievement to life.
          </p>
        )}
      </div>
    </div>
  );
}

function CheckGlyph() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

function RewardChip({ glyph, label }: { glyph: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-display text-2xs text-accent">
      <span aria-hidden="true" className="text-sm leading-none">
        {glyph}
      </span>
      <span className="tracking-wide">{label}</span>
    </span>
  );
}

function HiddenSigil({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-display text-3xl text-accent shadow-glow-warm"
      >
        ?
      </span>
      <h4 className="font-display text-lg font-semibold leading-tight text-text-muted/80">
        {title}
      </h4>
    </div>
  );
}
