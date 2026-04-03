import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { AchievementEntry } from "@/types/admin";

const StatRow = memo(function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
});

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
      <h4 className="mb-2 text-[11px] uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

const AchievementRow = memo(function AchievementRow({
  achievement,
  onSelect,
}: {
  achievement: AchievementEntry;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(achievement.id)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {achievement.displayName}
          </span>
          <span className="rounded-full bg-violet/12 px-2 py-0.5 text-2xs text-violet">
            {achievement.category}
          </span>
          {achievement.hidden && (
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-2xs text-text-muted">
              Hidden
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

function AchievementDetail({
  achievement,
  onBack,
}: {
  achievement: AchievementEntry;
  onBack: () => void;
}) {
  const hasRewards =
    (achievement.rewards.xp != null && achievement.rewards.xp > 0) ||
    (achievement.rewards.gold != null && achievement.rewards.gold > 0) ||
    achievement.rewards.title;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">
          {achievement.displayName}
        </h3>
        <span className="rounded-full bg-violet/12 px-2 py-0.5 text-2xs text-violet">
          {achievement.category}
        </span>
        {achievement.hidden && (
          <span className="rounded-full bg-black/20 px-2 py-0.5 text-2xs text-text-muted">
            Hidden
          </span>
        )}
      </div>

      {achievement.description && (
        <p className="text-sm leading-6 text-text-secondary">{achievement.description}</p>
      )}

      <Section title="Properties">
        <StatRow label="Category" value={achievement.category} />
        <StatRow label="Hidden" value={achievement.hidden ? "Yes" : "No"} />
      </Section>

      {achievement.criteria.length > 0 && (
        <Section title="Criteria">
          <div className="flex flex-col gap-2">
            {achievement.criteria.map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
                    {c.type}
                  </span>
                  <span className="text-xs text-text-muted">{c.targetId}</span>
                  <span className="ml-auto text-xs text-text-primary">
                    x{c.count}
                  </span>
                </div>
                {c.description && (
                  <p className="mt-1.5 text-xs leading-5 text-text-secondary">
                    {c.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {hasRewards && (
        <Section title="Rewards">
          {achievement.rewards.xp != null && achievement.rewards.xp > 0 && (
            <StatRow label="XP" value={achievement.rewards.xp.toLocaleString()} />
          )}
          {achievement.rewards.gold != null && achievement.rewards.gold > 0 && (
            <StatRow label="Gold" value={achievement.rewards.gold.toLocaleString()} />
          )}
          {achievement.rewards.title && (
            <StatRow label="Title" value={achievement.rewards.title} />
          )}
        </Section>
      )}
    </div>
  );
}

export function AdminAchievementList() {
  const achievements = useAdminStore((s) => s.achievements);
  const selectedAchievement = useAdminStore((s) => s.selectedAchievement);
  const fetchAchievements = useAdminStore((s) => s.fetchAchievements);
  const fetchAchievementDetail = useAdminStore((s) => s.fetchAchievementDetail);
  const clearSelectedAchievement = useAdminStore((s) => s.clearSelectedAchievement);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  if (selectedAchievement) {
    return (
      <AchievementDetail
        achievement={selectedAchievement}
        onBack={clearSelectedAchievement}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Achievements</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered achievements. Click to inspect.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wide-ui text-text-muted">
          {achievements.length} registered
        </span>
      </div>

      {achievements.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">
            No achievements found
          </p>
          <p className="mt-1 text-sm text-text-muted">
            The server has no achievements registered.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {achievements.map((a) => (
            <AchievementRow
              key={a.id}
              achievement={a}
              onSelect={fetchAchievementDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
