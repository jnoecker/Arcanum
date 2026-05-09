import { memo, useState } from "react";
import { TextInput, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "./SectionCard";
import { PlusIcon, TrashIcon, XIcon, CompassRoseIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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
      description="Reputation changes granted when a quest completes. Push players toward or away from factions based on the jobs they accept."
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
        <button
          type="button"
          onClick={onAddQuest}
          disabled={!newQuestId.trim()}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon />
          Map quest
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center">
          <CompassRoseIcon className="mx-auto mb-2 h-6 w-6 text-text-muted/40" />
          <p className="text-2xs leading-snug text-text-muted/80">
            No quest rewards mapped.
          </p>
          <p className="mt-0.5 text-2xs leading-snug text-text-muted/60">
            Type a quest ID above to connect it to reputation changes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
        </div>
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
    <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
      <div className="flex items-center gap-2">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Quest
        </span>
        <div className="min-w-0 flex-1">
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
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map(([fid, delta]) => {
            const positive = delta >= 0;
            return (
              <div
                key={fid}
                className={cx(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                  positive
                    ? "border-status-success/30 bg-status-success/[0.08]"
                    : "border-status-error/30 bg-status-error/[0.08]",
                )}
              >
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate font-display text-xs font-semibold",
                    positive ? "text-status-success" : "text-status-error",
                  )}
                >
                  {factionOptions.find((o) => o.value === fid)?.label ?? fid}
                </span>
                <div className="w-20 shrink-0">
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
        <div className="mt-2 flex items-center gap-2 border-t border-[var(--chrome-stroke)] pt-2">
          <div className="min-w-0 flex-1">
            <SelectInput
              value={newFaction}
              onCommit={setNewFaction}
              options={[{ value: "", label: "— pick a faction —" }, ...available]}
              dense
            />
          </div>
          <div className="w-20 shrink-0">
            <NumberInput
              value={newAmount}
              onCommit={(v) => setNewAmount(v ?? 0)}
              dense
            />
          </div>
          <button
            type="button"
            onClick={addPair}
            disabled={!newFaction}
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon />
            Add
          </button>
        </div>
      )}
    </div>
  );
});
