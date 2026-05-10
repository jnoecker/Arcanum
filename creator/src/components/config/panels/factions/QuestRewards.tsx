import { memo, useState } from "react";
import { ActionButton, TextInput, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, TrashIcon, XIcon, CompassRoseIcon } from "./icons";

interface QuestRewardsProps {
  questRewards: Record<string, Record<string, number>> | undefined;
  factionOptions: { value: string; label: string }[];
  newQuestId: string;
  onNewQuestIdChange: (v: string) => void;
  onAddQuest: () => void;
  onPatchPair: (questId: string, factionId: string, amount: number | undefined) => void;
  onRenameQuest: (oldId: string, newId: string) => void;
  onDeleteQuest: (questId: string) => void;
}

export function QuestRewards({
  questRewards,
  factionOptions,
  newQuestId,
  onNewQuestIdChange,
  onAddQuest,
  onPatchPair,
  onRenameQuest,
  onDeleteQuest,
}: QuestRewardsProps) {
  const entries = Object.entries(questRewards ?? {});

  return (
    <SectionCard
      title="Quest Reputation Rewards"
      description="What a finished quest does to a player's standing. Use it to court allies â€” or burn bridges â€” based on the work they take."
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          className="ornate-input min-w-0 flex-1 px-2.5 py-1.5 text-xs text-text-primary"
          placeholder="quest_id"
          value={newQuestId}
          onChange={(e) => onNewQuestIdChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAddQuest();
          }}
        />
        <ActionButton
          variant="primary"
          size="sm"
          onClick={onAddQuest}
          disabled={!newQuestId.trim()}
          className="shrink-0"
        >
          <PlusIcon />
          Add Quest
        </ActionButton>
      </div>

      {entries.length === 0 ? (
        <div className="px-2 py-6 text-center">
          <CompassRoseIcon className="mx-auto mb-2 h-6 w-6 text-text-muted/40" />
          <p className="font-body text-2xs italic leading-snug text-text-muted/80">
            No quests bound to reputation yet. Name a quest above, then tie it to the factions it pleases or offends.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--chrome-stroke)]">
          {entries.map(([qid, rewards]) => (
            <QuestRewardRow
              key={qid}
              questId={qid}
              rewards={rewards}
              factionOptions={factionOptions}
              onRename={(v) => onRenameQuest(qid, v)}
              onPatch={(fid, amount) => onPatchPair(qid, fid, amount)}
              onDelete={() => onDeleteQuest(qid)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

interface QuestRewardRowProps {
  questId: string;
  rewards: Record<string, number>;
  factionOptions: { value: string; label: string }[];
  onRename: (v: string) => void;
  onPatch: (factionId: string, amount: number | undefined) => void;
  onDelete: () => void;
}

const QuestRewardRow = memo(function QuestRewardRow({
  questId,
  rewards,
  factionOptions,
  onRename,
  onPatch,
  onDelete,
}: QuestRewardRowProps) {
  const [newFaction, setNewFaction] = useState("");
  const [newAmount, setNewAmount] = useState(50);
  const entries = Object.entries(rewards);
  const available = factionOptions.filter((opt) => !(opt.value in rewards));

  const addPair = () => {
    if (!newFaction) return;
    onPatch(newFaction, newAmount);
    setNewFaction("");
    setNewAmount(50);
  };

  return (
    <li className="py-3 first:pt-1 last:pb-1">
      <div className="flex items-center gap-2">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Quest
        </span>
        <div className="min-w-0 flex-1 font-mono">
          <TextInput value={questId} onCommit={onRename} placeholder="quest_id" dense />
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${questId}`}
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
        >
          <TrashIcon />
        </button>
      </div>

      {entries.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5 pl-[3.25rem]">
          {entries.map(([fid, delta]) => {
            const positive = delta >= 0;
            return (
              <div key={fid} className="flex items-center gap-2 py-0.5">
                <span className="min-w-0 flex-1 truncate font-body text-xs text-text-secondary">
                  {factionOptions.find((o) => o.value === fid)?.label ?? fid}
                </span>
                <span
                  aria-hidden
                  className={
                    positive
                      ? "shrink-0 select-none font-mono text-2xs font-semibold tabular-nums text-status-success"
                      : "shrink-0 select-none font-mono text-2xs font-semibold tabular-nums text-status-error"
                  }
                >
                  {positive ? "+" : "−"}
                </span>
                <div
                  className={
                    positive
                      ? "w-16 shrink-0 [&_input]:font-mono [&_input]:font-semibold [&_input]:tabular-nums [&_input]:text-status-success"
                      : "w-16 shrink-0 [&_input]:font-mono [&_input]:font-semibold [&_input]:tabular-nums [&_input]:text-status-error"
                  }
                >
                  <NumberInput value={delta} onCommit={(v) => onPatch(fid, v)} dense />
                </div>
                <button
                  type="button"
                  onClick={() => onPatch(fid, undefined)}
                  aria-label="Remove"
                  className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded text-text-muted/70 transition hover:bg-status-error/15 hover:text-status-error"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <div className="mt-2 flex items-center gap-2 pl-[3.25rem]">
          <div className="min-w-0 flex-1">
            <SelectInput
              value={newFaction}
              onCommit={setNewFaction}
              options={[{ value: "", label: "— pick a faction —" }, ...available]}
              dense
            />
          </div>
          <div className="w-16 shrink-0">
            <NumberInput
              value={newAmount}
              onCommit={(v) => setNewAmount(v ?? 0)}
              dense
            />
          </div>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={addPair}
            disabled={!newFaction}
            className="shrink-0"
          >
            <PlusIcon />
            Bind Faction
          </ActionButton>
        </div>
      )}
    </li>
  );
});
