import { useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { DailyQuestsConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

const DEFAULT_DAILY_QUESTS: DailyQuestsConfig = {
  enabled: false,
  resetTimeUtc: "00:00",
  streakBonusPercent: 10,
  pools: {},
};

export function DailyQuestsPanel({ config, onChange }: ConfigPanelProps) {
  const dq = config.dailyQuests ?? DEFAULT_DAILY_QUESTS;
  const patch = (p: Partial<DailyQuestsConfig>) =>
    onChange({ dailyQuests: { ...dq, ...p } });

  return (
    <>
      <Section
        title="Daily & Weekly Quests"
        description="Rotating quest pools that refresh on a schedule. Players who complete quests on consecutive days earn streak bonuses."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Toggle the daily quest system on or off.">
            <CheckboxInput
              checked={dq.enabled}
              onCommit={(v) => patch({ enabled: v })}
              label="Dailies enabled"
            />
          </FieldRow>
          <FieldRow label="Reset Time (UTC)" hint="Time of day in UTC when daily quests refresh. Format: HH:MM (e.g. '00:00' for midnight).">
            <TextInput
              value={dq.resetTimeUtc}
              onCommit={(v) => patch({ resetTimeUtc: v || "00:00" })}
              placeholder="00:00"
            />
          </FieldRow>
          <FieldRow label="Streak Bonus %" hint="Percentage bonus per consecutive day of quest completion. 10 = +10% per day in the streak.">
            <NumberInput
              value={dq.streakBonusPercent}
              onCommit={(v) => patch({ streakBonusPercent: v ?? 10 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Quest Pools"
        description="Named pools of quest IDs. Each pool is drawn from independently during the daily refresh. Add pools like 'combat', 'gathering', 'social' and populate them with quest IDs from your zone files."
      >
        <PoolEditor pools={dq.pools} onChange={(pools) => patch({ pools })} />
      </Section>
    </>
  );
}

/* ── Pool editor ─────────────────────────────────────────────────── */

function PoolEditor({
  pools,
  onChange,
}: {
  pools: Record<string, string[]>;
  onChange: (pools: Record<string, string[]>) => void;
}) {
  const [newPoolName, setNewPoolName] = useState("");

  const addPool = () => {
    const name = newPoolName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name || name in pools) return;
    onChange({ ...pools, [name]: [] });
    setNewPoolName("");
  };

  const removePool = (name: string) => {
    const next = { ...pools };
    delete next[name];
    onChange(next);
  };

  const updatePool = (name: string, ids: string[]) => {
    onChange({ ...pools, [name]: ids });
  };

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(pools).map(([name, ids]) => (
        <PoolRow
          key={name}
          name={name}
          ids={ids}
          onUpdate={(ids) => updatePool(name, ids)}
          onRemove={() => removePool(name)}
        />
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          className="ornate-input min-h-9 flex-1 rounded px-2 py-1 text-xs text-text-primary"
          value={newPoolName}
          onChange={(e) => setNewPoolName(e.target.value)}
          placeholder="New pool name..."
          onKeyDown={(e) => {
            if (e.key === "Enter") addPool();
          }}
        />
        <button
          onClick={addPool}
          disabled={!newPoolName.trim()}
          className="focus-ring rounded border border-white/10 bg-bg-tertiary px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-bg-tertiary/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add Pool
        </button>
      </div>
    </div>
  );
}

function PoolRow({
  name,
  ids,
  onUpdate,
  onRemove,
}: {
  name: string;
  ids: string[];
  onUpdate: (ids: string[]) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(ids.join(", "));
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== ids.join(", ")) {
    setDraft(ids.join(", "));
  }

  const commit = () => {
    const parsed = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate(parsed);
  };

  return (
    <div className="rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-xs font-semibold text-text-primary">
          {name}
        </span>
        <button
          onClick={onRemove}
          className="text-2xs text-status-error/70 transition hover:text-status-error"
        >
          Remove
        </button>
      </div>
      <input
        type="text"
        className="ornate-input min-h-9 w-full rounded px-2 py-1 text-xs text-text-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        placeholder="quest_id_1, quest_id_2, ..."
      />
      <p className="mt-1 text-2xs text-text-muted">
        {ids.length} quest{ids.length !== 1 ? "s" : ""} in pool
      </p>
    </div>
  );
}
