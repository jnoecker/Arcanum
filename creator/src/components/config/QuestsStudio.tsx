import type { AppConfig, DailyQuestsConfig, GlobalQuestsConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";
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

/**
 * Aggregated Living World → Quests panel. Surfaces enable + tuning knobs for
 * daily/weekly, bounty, and global quests, plus the existing taxonomy
 * designer. Pool/objective content authoring is not yet in the UI — until
 * then, sections flag unsatisfied prereqs and point users at Raw YAML.
 */
export function QuestsStudio({ config, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <DailyQuestsSection config={config} onChange={onChange} />
      <AutoQuestsPanel config={config} onChange={onChange} />
      <GlobalQuestsSection config={config} onChange={onChange} />
      <QuestTaxonomyDesigner config={config} onChange={onChange} />
    </div>
  );
}

function DailyQuestsSection({ config, onChange }: Props) {
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

      <PoolStatusLine
        label="Daily pool"
        have={dailyPoolLen}
        need={dailySlots}
      />
      <PoolStatusLine
        label="Weekly pool"
        have={weeklyPoolLen}
        need={weeklySlots}
      />

      {showPrereq && <PrereqWarning message="Daily quests are enabled but the pools aren't full enough. The server won't start with this config. Fill the pools (edit dailyPool / weeklyPool under Raw YAML) or turn dailies off until you do." />}
    </Section>
  );
}

function GlobalQuestsSection({ config, onChange }: Props) {
  const gq = config.globalQuests ?? DEFAULT_GLOBAL_QUESTS;
  const patch = (p: Partial<GlobalQuestsConfig>) =>
    onChange({ globalQuests: { ...gq, ...p } });

  const objectiveCount = gq.objectives?.length ?? 0;
  const showPrereq = gq.enabled && objectiveCount === 0;

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

      <div className="mt-3 text-2xs text-text-muted">
        Objectives authored: <span className="font-mono text-text-secondary">{objectiveCount}</span>
      </div>

      {showPrereq && <PrereqWarning message="Global quests are enabled but no objectives are authored. The server won't start with this config. Add at least one objective under Raw YAML (globalQuests.objectives) or turn global events off until you do." />}
    </Section>
  );
}

function PoolStatusLine({ label, have, need }: { label: string; have: number; need: number }) {
  const ok = have >= need;
  return (
    <div className="mt-0.5 text-2xs text-text-muted">
      {label}: <span className={`font-mono ${ok ? "text-text-secondary" : "text-status-error"}`}>{have}</span>
      <span className="text-text-muted/60"> / {need} needed</span>
    </div>
  );
}

function PrereqWarning({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded border border-status-error/40 bg-status-error/5 p-2 text-2xs leading-relaxed text-status-error">
      {message}
    </div>
  );
}
