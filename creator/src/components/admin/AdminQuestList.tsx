import { useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { QuestEntry } from "@/types/admin";

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
      <h4 className="mb-2 text-[11px] uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
}

function QuestRow({
  quest,
  onSelect,
}: {
  quest: QuestEntry;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(quest.id)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-all duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {quest.name}
          </span>
          <span className="rounded-full bg-status-warning/12 px-2 py-0.5 text-2xs text-status-warning">
            {quest.completionType}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
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
}

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
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
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
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
                    {obj.type}
                  </span>
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
        <span className="text-[11px] uppercase tracking-wide-ui text-text-muted">
          {quests.length} registered
        </span>
      </div>

      {quests.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No quests found</p>
          <p className="mt-1 text-sm text-text-muted">
            The server has no quests registered.
          </p>
        </div>
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
