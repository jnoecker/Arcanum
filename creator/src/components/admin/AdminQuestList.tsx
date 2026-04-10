import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { ActionButton, Badge, EmptyState } from "@/components/ui/FormWidgets";
import type { QuestEntry } from "@/types/admin";

const StatRow = memo(function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
});

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
      <h4 className="mb-2 text-2xs uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

const QuestRow = memo(function QuestRow({
  quest,
  onSelect,
}: {
  quest: QuestEntry;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(quest.id)}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {quest.name}
          </span>
          <Badge variant="warning">
            {quest.completionType}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs">
          <span className="truncate text-text-muted" title={quest.giverMobId}>
            {quest.giverMobId.length > 24
              ? quest.giverMobId.slice(0, 24) + "..."
              : quest.giverMobId}
          </span>
          <span className="text-text-secondary">
            {quest.objectives.length} objective{quest.objectives.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </button>
  );
});

function QuestDetail({
  quest,
  onBack,
}: {
  quest: QuestEntry;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ActionButton variant="ghost" size="sm" onClick={onBack}>
          &#x2190; Back
        </ActionButton>
        <h3 className="font-display text-xl text-text-primary">{quest.name}</h3>
      </div>

      {quest.description && (
        <p className="text-sm leading-6 text-text-secondary">{quest.description}</p>
      )}

      <Section title="Properties">
        <StatRow label="Giver Mob" value={quest.giverMobId} />
        <StatRow label="Completion Type" value={quest.completionType} />
      </Section>

      {quest.objectives.length > 0 && (
        <Section title="Objectives">
          <div className="flex flex-col gap-2">
            {quest.objectives.map((obj, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="info">
                    {obj.type}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {obj.targetId}
                  </span>
                  <span className="ml-auto text-xs text-text-primary">
                    x{obj.count}
                  </span>
                </div>
                {obj.description && (
                  <p className="mt-1.5 text-xs leading-5 text-text-secondary">
                    {obj.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(quest.rewards.xp || quest.rewards.gold) && (
        <Section title="Rewards">
          {quest.rewards.xp != null && quest.rewards.xp > 0 && (
            <StatRow label="XP" value={quest.rewards.xp.toLocaleString()} />
          )}
          {quest.rewards.gold != null && quest.rewards.gold > 0 && (
            <StatRow label="Gold" value={quest.rewards.gold.toLocaleString()} />
          )}
        </Section>
      )}
    </div>
  );
}

export function AdminQuestList() {
  const quests = useAdminStore((s) => s.quests);
  const selectedQuest = useAdminStore((s) => s.selectedQuest);
  const fetchQuests = useAdminStore((s) => s.fetchQuests);
  const fetchQuestDetail = useAdminStore((s) => s.fetchQuestDetail);
  const clearSelectedQuest = useAdminStore((s) => s.clearSelectedQuest);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  if (selectedQuest) {
    return <QuestDetail quest={selectedQuest} onBack={clearSelectedQuest} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Quests</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered quests. Click to inspect.
          </p>
        </div>
        <span className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {quests.length} registered
        </span>
      </div>

      {quests.length === 0 ? (
        <EmptyState title="No quests found" description="The server has no quests registered." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {quests.map((q) => (
            <QuestRow key={q.id} quest={q} onSelect={fetchQuestDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
