import type {
  AppConfig,
  DailyQuestDefinition,
  DailyQuestsConfig,
  GlobalQuestObjectiveConfig,
  GlobalQuestsConfig,
} from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
  SelectInput,
  TextInput,
  IconButton,
  FieldGrid,
  CompactField,
  ArrayRow,
} from "@/components/ui/FormWidgets";
import { useArrayField } from "@/lib/useArrayField";
import { useConfigOptions } from "@/lib/useConfigOptions";
import { AutoQuestsPanel } from "./panels/AutoQuestsPanel";
import { QuestTaxonomyDesigner } from "./QuestTaxonomyDesigner";

interface Props {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

const DEFAULT_DAILY_QUESTS: DailyQuestsConfig = {
  enabled: false,
  resetHourUtc: 0,
  dailySlots: 3,
  weeklySlots: 1,
  streakBonusPercent: 10,
  streakMaxDays: 7,
  dailyPool: [],
  weeklyPool: [],
};

const DEFAULT_GLOBAL_QUESTS: GlobalQuestsConfig = {
  enabled: false,
  intervalMs: 3_600_000,
  durationMs: 1_800_000,
  announceIntervalMs: 300_000,
  minPlayersOnline: 2,
  objectives: [],
};

const FALLBACK_OBJECTIVE_TYPES = [
  { value: "kill", label: "Kill" },
  { value: "collect", label: "Collect" },
  { value: "gather", label: "Gather" },
  { value: "craft", label: "Craft" },
  { value: "dungeon", label: "Dungeon" },
  { value: "pvpKill", label: "PvP Kill" },
];

const DEFAULT_DAILY_DEFINITION: DailyQuestDefinition = {
  type: "",
  targetCount: 1,
};

const DEFAULT_GLOBAL_OBJECTIVE: GlobalQuestObjectiveConfig = {
  type: "",
  targetCount: 1,
};

/**
 * Aggregated Living World → Quests panel. Surfaces enable + tuning knobs for
 * daily/weekly, bounty, and global quests, plus the existing taxonomy
 * designer and row-level editors for dailyPool, weeklyPool, and
 * globalQuests.objectives.
 */
export function QuestsStudio({ config, onChange }: Props) {
  const objectiveTypeOptions = useConfigOptions(
    config.questObjectiveTypes,
    FALLBACK_OBJECTIVE_TYPES,
  );

  return (
    <div className="flex flex-col gap-6">
      <DailyQuestsSection
        config={config}
        onChange={onChange}
        objectiveTypeOptions={objectiveTypeOptions}
      />
      <AutoQuestsPanel config={config} onChange={onChange} />
      <GlobalQuestsSection
        config={config}
        onChange={onChange}
        objectiveTypeOptions={objectiveTypeOptions}
      />
      <QuestTaxonomyDesigner config={config} onChange={onChange} />
    </div>
  );
}

type ObjectiveOption = { value: string; label: string };

function DailyQuestsSection({
  config,
  onChange,
  objectiveTypeOptions,
}: Props & { objectiveTypeOptions: ObjectiveOption[] }) {
  const dq = config.dailyQuests ?? DEFAULT_DAILY_QUESTS;
  const patch = (p: Partial<DailyQuestsConfig>) =>
    onChange({ dailyQuests: { ...dq, ...p } });

  const dailyPoolLen = dq.dailyPool?.length ?? 0;
  const weeklyPoolLen = dq.weeklyPool?.length ?? 0;
  const dailySlots = dq.dailySlots ?? 3;
  const weeklySlots = dq.weeklySlots ?? 1;
  const dailyShort = dailyPoolLen < dailySlots;
  const weeklyShort = weeklyPoolLen < weeklySlots;
  const showPrereq = dq.enabled && (dailyShort || weeklyShort);

  return (
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
        <FieldRow label="Reset Hour (UTC)" hint="Hour of day (0–23) when daily quests refresh.">
          <NumberInput
            value={dq.resetHourUtc ?? 0}
            onCommit={(v) => patch({ resetHourUtc: v ?? 0 })}
            min={0}
            max={23}
          />
        </FieldRow>
        <FieldRow label="Daily Slots" hint="How many daily quests each player gets per reset.">
          <NumberInput
            value={dq.dailySlots ?? 3}
            onCommit={(v) => patch({ dailySlots: v ?? 3 })}
            min={0}
            max={20}
          />
        </FieldRow>
        <FieldRow label="Weekly Slots" hint="How many weekly quests each player gets per reset.">
          <NumberInput
            value={dq.weeklySlots ?? 1}
            onCommit={(v) => patch({ weeklySlots: v ?? 1 })}
            min={0}
            max={20}
          />
        </FieldRow>
        <FieldRow label="Streak Bonus %" hint="Percentage bonus per consecutive day of quest completion. 10 = +10% per day in the streak.">
          <NumberInput
            value={dq.streakBonusPercent}
            onCommit={(v) => patch({ streakBonusPercent: v ?? 10 })}
            min={0}
          />
        </FieldRow>
        <FieldRow label="Streak Max Days" hint="Maximum streak length before the bonus caps.">
          <NumberInput
            value={dq.streakMaxDays ?? 7}
            onCommit={(v) => patch({ streakMaxDays: v ?? 7 })}
            min={0}
          />
        </FieldRow>
      </div>

      <DailyPoolEditor
        title="Daily pool"
        need={dailySlots}
        pool={dq.dailyPool}
        onChange={(dailyPool) => patch({ dailyPool })}
        objectiveTypeOptions={objectiveTypeOptions}
      />
      <DailyPoolEditor
        title="Weekly pool"
        need={weeklySlots}
        pool={dq.weeklyPool}
        onChange={(weeklyPool) => patch({ weeklyPool })}
        objectiveTypeOptions={objectiveTypeOptions}
      />

      {showPrereq && (
        <PrereqWarning message="Daily quests are enabled but the pools aren't full enough. The server won't start with this config. Add more pool entries above or turn dailies off until you do." />
      )}
    </Section>
  );
}

function DailyPoolEditor({
  title,
  need,
  pool,
  onChange,
  objectiveTypeOptions,
}: {
  title: string;
  need: number;
  pool: DailyQuestDefinition[] | undefined;
  onChange: (next: DailyQuestDefinition[] | undefined) => void;
  objectiveTypeOptions: ObjectiveOption[];
}) {
  const { items, add, update, remove } = useArrayField<DailyQuestDefinition>(
    pool,
    onChange,
    DEFAULT_DAILY_DEFINITION,
  );
  const have = items.length;
  const ok = have >= need;

  return (
    <div className="mt-4 rounded border border-border-muted/60 bg-[var(--chrome-fill-soft)]/40 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-display text-2xs uppercase tracking-widest text-text-secondary">
          {title}
        </span>
        <span className="text-2xs text-text-muted">
          <span className={`font-mono ${ok ? "text-text-secondary" : "text-status-error"}`}>
            {have}
          </span>
          <span className="text-text-muted/60"> / {need} needed</span>
        </span>
        <div className="ml-auto">
          <IconButton onClick={add} title={`Add ${title.toLowerCase()} entry`} size="sm">
            +
          </IconButton>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-2xs text-text-muted">No entries yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((entry, i) => (
            <ArrayRow key={i} index={i} onRemove={() => remove(i)}>
              <FieldGrid>
                <CompactField label="Type">
                  <SelectInput
                    value={entry.type}
                    options={objectiveTypeOptions}
                    onCommit={(v) => update(i, "type", v)}
                    placeholder="— select type —"
                    dense
                  />
                </CompactField>
                <CompactField label="Target count">
                  <NumberInput
                    value={entry.targetCount}
                    onCommit={(v) => update(i, "targetCount", v ?? 1)}
                    min={1}
                    dense
                  />
                </CompactField>
              </FieldGrid>
              <FieldGrid>
                <CompactField label="Gold reward">
                  <NumberInput
                    value={entry.goldReward}
                    onCommit={(v) => update(i, "goldReward", v)}
                    min={0}
                    dense
                  />
                </CompactField>
                <CompactField label="XP reward">
                  <NumberInput
                    value={entry.xpReward}
                    onCommit={(v) => update(i, "xpReward", v)}
                    min={0}
                    dense
                  />
                </CompactField>
              </FieldGrid>
              <FieldGrid>
                <CompactField label="Description" span>
                  <TextInput
                    value={entry.description ?? ""}
                    onCommit={(v) => update(i, "description", v || undefined)}
                    placeholder={
                      entry.type
                        ? `${entry.type} x${entry.targetCount ?? 1}`
                        : "Optional"
                    }
                    dense
                  />
                </CompactField>
              </FieldGrid>
            </ArrayRow>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalQuestsSection({
  config,
  onChange,
  objectiveTypeOptions,
}: Props & { objectiveTypeOptions: ObjectiveOption[] }) {
  const gq = config.globalQuests ?? DEFAULT_GLOBAL_QUESTS;
  const patch = (p: Partial<GlobalQuestsConfig>) =>
    onChange({ globalQuests: { ...gq, ...p } });

  const objectiveCount = gq.objectives?.length ?? 0;
  const showPrereq = gq.enabled && objectiveCount === 0;

  const { items, add, update, remove } = useArrayField<GlobalQuestObjectiveConfig>(
    gq.objectives,
    (objectives) => patch({ objectives }),
    DEFAULT_GLOBAL_OBJECTIVE,
  );

  return (
    <Section
      title="Global Quests"
      description="Server-wide timed competitions. Events spawn on an interval, run for a fixed duration, and reward the top contributors."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Toggle global competitions on or off.">
          <CheckboxInput
            checked={gq.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Global events enabled"
          />
        </FieldRow>
        <FieldRow label="Interval (ms)" hint="Time between the start of each global event. 3600000 = 1 hour.">
          <NumberInput
            value={gq.intervalMs}
            onCommit={(v) => patch({ intervalMs: v ?? 3_600_000 })}
            min={60_000}
          />
        </FieldRow>
        <FieldRow label="Duration (ms)" hint="How long each event lasts once started. 1800000 = 30 minutes.">
          <NumberInput
            value={gq.durationMs}
            onCommit={(v) => patch({ durationMs: v ?? 1_800_000 })}
            min={60_000}
          />
        </FieldRow>
        <FieldRow label="Announce Interval (ms)" hint="How often the server broadcasts progress during an active event.">
          <NumberInput
            value={gq.announceIntervalMs ?? 300_000}
            onCommit={(v) => patch({ announceIntervalMs: v ?? 300_000 })}
            min={1000}
          />
        </FieldRow>
        <FieldRow label="Min Players Online" hint="Events won't start unless this many players are online.">
          <NumberInput
            value={gq.minPlayersOnline ?? 2}
            onCommit={(v) => patch({ minPlayersOnline: v ?? 2 })}
            min={1}
          />
        </FieldRow>
      </div>

      <div className="mt-4 rounded border border-border-muted/60 bg-[var(--chrome-fill-soft)]/40 p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-display text-2xs uppercase tracking-widest text-text-secondary">
            Objectives
          </span>
          <span className="text-2xs text-text-muted">
            <span className="font-mono text-text-secondary">{items.length}</span>
            <span className="text-text-muted/60"> authored</span>
          </span>
          <div className="ml-auto">
            <IconButton onClick={add} title="Add objective" size="sm">
              +
            </IconButton>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-2xs text-text-muted">No objectives yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((obj, i) => (
              <ArrayRow key={i} index={i} onRemove={() => remove(i)}>
                <FieldGrid>
                  <CompactField label="Type">
                    <SelectInput
                      value={obj.type}
                      options={objectiveTypeOptions}
                      onCommit={(v) => update(i, "type", v)}
                      placeholder="— select type —"
                      dense
                    />
                  </CompactField>
                  <CompactField label="Target count">
                    <NumberInput
                      value={obj.targetCount}
                      onCommit={(v) => update(i, "targetCount", v ?? 1)}
                      min={1}
                      dense
                    />
                  </CompactField>
                </FieldGrid>
                <FieldGrid>
                  <CompactField label="Description" span>
                    <TextInput
                      value={obj.description ?? ""}
                      onCommit={(v) => update(i, "description", v || undefined)}
                      placeholder={
                        obj.type
                          ? `${obj.type} x${obj.targetCount ?? 1}`
                          : "Optional"
                      }
                      dense
                    />
                  </CompactField>
                </FieldGrid>
              </ArrayRow>
            ))}
          </div>
        )}
      </div>

      {showPrereq && (
        <PrereqWarning message="Global quests are enabled but no objectives are authored. The server won't start with this config. Add at least one objective above or turn global events off until you do." />
      )}
    </Section>
  );
}

function PrereqWarning({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded border border-status-error/40 bg-status-error/5 p-2 text-2xs leading-relaxed text-status-error">
      {message}
    </div>
  );
}
