import type { ReactNode } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { DiminishingXpConfig, DiminishingXpThreshold } from "@/types/config";
import { NumberInput, TextInput, IconButton, ActionButton } from "@/components/ui/FormWidgets";

import { OrnateCard } from "@/components/ui/OrnateCard";
import { Toggle } from "./world/Toggle";
import { IconField } from "./world/IconField";
import { XpCurveChart } from "./world/XpCurveChart";
import { RoomPicker } from "./world/RoomPicker";
import { DiminishingStaircase } from "./world/DiminishingStaircase";

// Re-export RoomPicker for backwards compatibility — historically lived here.
export { RoomPicker } from "./world/RoomPicker";

interface ActProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** When true, omit the divider above this act (used for the first act). */
  first?: boolean;
}

interface MessageRowProps {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  /** Sample seconds value substituted into {seconds} for the preview. */
  sampleSeconds?: number;
  placeholder?: string;
}

/** Two-column message editor: input on the left, "as the player sees it" preview on the right. */
function MessageRow({ label, value, onCommit, sampleSeconds = 300, placeholder }: MessageRowProps) {
  const rendered = (value ?? "").replace(/\{seconds\}/g, String(sampleSeconds));
  return (
    <div className="py-0.5">
      <div className="mb-1 text-2xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TextInput value={value} onCommit={onCommit} placeholder={placeholder} dense />
        <div
          aria-hidden="true"
          className="min-h-[2.25rem] rounded-md border border-[var(--chrome-stroke-soft)] bg-[color:rgb(var(--accent-rgb)/0.04)] px-2.5 py-1.5 font-body text-xs italic leading-snug text-text-secondary/85"
        >
          {rendered.trim() ? rendered : <span className="text-text-muted/50 not-italic">—</span>}
        </div>
      </div>
    </div>
  );
}

function Act({ eyebrow, title, description, children, first }: ActProps) {
  return (
    <section className="mb-6">
      {!first && <div aria-hidden="true" className="ornate-divider mb-4 mt-2" />}
      <header className="mb-3">
        <div className="font-display text-2xs uppercase tracking-[0.28em] text-accent/80">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-lg font-semibold tracking-wide text-text-primary">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-2xs leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

export function WorldPanel({ config, onChange }: ConfigPanelProps) {
  const classIds = Object.keys(config.classes);
  const p = config.progression;
  const recall = config.navigation.recall;
  const death = config.death;

  const setStartRoom = (v: string) =>
    onChange({ world: { ...config.world, startRoom: v } });

  const setClassStartRoom = (classId: string, room: string) => {
    const next = { ...config.classStartRooms };
    if (room) next[classId] = room;
    else delete next[classId];
    onChange({ classStartRooms: next });
  };

  const patchProg = (patch: Partial<AppConfig["progression"]>) =>
    onChange({ progression: { ...p, ...patch } });

  const patchXp = (patch: Partial<AppConfig["progression"]["xp"]>) =>
    patchProg({ xp: { ...p.xp, ...patch } });

  const patchRewards = (patch: Partial<AppConfig["progression"]["rewards"]>) =>
    patchProg({ rewards: { ...p.rewards, ...patch } });

  const patchRecall = (patch: Partial<AppConfig["navigation"]["recall"]>) =>
    onChange({ navigation: { ...config.navigation, recall: { ...recall, ...patch } } });

  const patchRecallMessages = (
    patch: Partial<AppConfig["navigation"]["recall"]["messages"]>,
  ) => patchRecall({ messages: { ...recall.messages, ...patch } });

  const patchDeath = (patch: Partial<AppConfig["death"]>) =>
    onChange({ death: { ...death, ...patch } });

  const patchDeathMessages = (patch: Partial<AppConfig["death"]["messages"]>) =>
    patchDeath({ messages: { ...death.messages, ...patch } });

  return (
    <div className="world-panel">
      {/* ── Act I — Arrival ─────────────────────────────────────────── */}
      <Act
        first
        eyebrow="Act I"
        title="Arrival"
        description="Where every story begins. Choose the threshold new players cross when they first enter the world."
      >
        <div className="gap-4 [column-fill:balance] md:columns-2">
          <OrnateCard
            title="Default Start Room"
            description="Where new players spawn when their class has no override."
          >
            <RoomPicker
              value={config.world.startRoom}
              onChange={setStartRoom}
              placeholder="Select a default spawn room…"
            />
          </OrnateCard>

          <OrnateCard
            title="Class Start Rooms"
            description="Override the default per class. Leave empty to fall back to the default."
          >
            {classIds.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-4 text-center">
                <p className="text-2xs text-text-muted">
                  No classes are defined yet.
                </p>
                <p className="mt-0.5 text-2xs text-text-muted/60">
                  Add classes in the Class Designer to assign class-specific arrival rooms.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {classIds.map((classId) => {
                  const cls = config.classes[classId];
                  return (
                    <IconField
                      key={classId}
                      label={cls?.displayName ?? classId}
                    >
                      <RoomPicker
                        value={config.classStartRooms[classId] ?? ""}
                        onChange={(v) => setClassStartRoom(classId, v)}
                        placeholder="Use default"
                        allowClear
                      />
                    </IconField>
                  );
                })}
              </div>
            )}
          </OrnateCard>
        </div>
      </Act>

      {/* ── Act II — Ascension ──────────────────────────────────────── */}
      <Act
        eyebrow="Act II"
        title="Ascension"
        description="The arc of growth. The XP curve below is the silhouette of your players' climb — tune the inputs and watch the mountain reshape itself."
      >
        {/* Hero band: full-width XP curve */}
        <div className="mb-4">
          <XpCurveChart xp={p.xp} maxLevel={p.maxLevel} eyebrow="The Climb" />
        </div>

        {/* Curve inputs in a row directly below the chart */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--bg-panel)] p-3 sm:grid-cols-3 lg:grid-cols-5">
          <IconField label="Max Level" layout="column" hint="30 focused · 50 standard · 100 grind">
            <NumberInput
              value={p.maxLevel}
              onCommit={(v) => patchProg({ maxLevel: v ?? 50 })}
              min={1}
              dense
            />
          </IconField>
          <IconField label="Base XP" layout="column">
            <NumberInput
              value={p.xp.baseXp}
              onCommit={(v) => patchXp({ baseXp: v ?? 100 })}
              min={1}
              dense
            />
          </IconField>
          <IconField label="Exponent" layout="column">
            <NumberInput
              value={p.xp.exponent}
              onCommit={(v) => patchXp({ exponent: v ?? 2.0 })}
              min={1}
              step={0.1}
              dense
            />
          </IconField>
          <IconField label="Linear XP" layout="column">
            <NumberInput
              value={p.xp.linearXp}
              onCommit={(v) => patchXp({ linearXp: v ?? 0 })}
              min={0}
              dense
            />
          </IconField>
          <IconField label="Multiplier" layout="column">
            <NumberInput
              value={p.xp.multiplier}
              onCommit={(v) => patchXp({ multiplier: v ?? 1.0 })}
              min={0.1}
              step={0.1}
              dense
            />
          </IconField>
        </div>

        <div className="gap-4 [column-fill:balance] md:columns-2">
          <OrnateCard
            title="Default Kill XP"
            description="XP awarded per mob kill when no specific XP is set on the mob."
          >
            <IconField
              label="Default Kill XP"
              layout="column"
              hint="25 = quick kills · 50 = standard · 100 = slower climb"
            >
              <NumberInput
                value={p.xp.defaultKillXp}
                onCommit={(v) => patchXp({ defaultKillXp: v ?? 50 })}
                min={0}
                dense
              />
            </IconField>
          </OrnateCard>

          <OrnateCard
            title="Level-Up Rewards"
            description="Stat growth and rewards players receive on level up."
          >
            <div className="grid grid-cols-2 gap-2">
              <IconField label="HP / Level" layout="column">
                <NumberInput
                  value={p.rewards.hpPerLevel}
                  onCommit={(v) => patchRewards({ hpPerLevel: v ?? 2 })}
                  min={0}
                  dense
                />
              </IconField>
              <IconField label="Mana / Level" layout="column">
                <NumberInput
                  value={p.rewards.manaPerLevel}
                  onCommit={(v) => patchRewards({ manaPerLevel: v ?? 5 })}
                  min={0}
                  dense
                />
              </IconField>
              <IconField label="Base HP" layout="column">
                <NumberInput
                  value={p.rewards.baseHp}
                  onCommit={(v) => patchRewards({ baseHp: v ?? 10 })}
                  min={1}
                  dense
                />
              </IconField>
              <IconField label="Base Mana" layout="column">
                <NumberInput
                  value={p.rewards.baseMana}
                  onCommit={(v) => patchRewards({ baseMana: v ?? 20 })}
                  min={0}
                  dense
                />
              </IconField>
              <Toggle
                checked={p.rewards.fullHealOnLevelUp}
                onChange={(v) => patchRewards({ fullHealOnLevelUp: v })}
                label="Full heal on level up"
              />
              <Toggle
                checked={p.rewards.fullManaOnLevelUp}
                onChange={(v) => patchRewards({ fullManaOnLevelUp: v })}
                label="Full mana on level up"
              />
            </div>
          </OrnateCard>

          <OrnateCard
            title="Diminishing Returns"
            description="Reduce XP gains when a player has out-leveled the source. The largest matching threshold wins."
          >
            <DiminishingReturnsEditor
              value={p.xp.diminishing}
              onChange={(next) => patchXp({ diminishing: next })}
              maxLevel={p.maxLevel}
            />
          </OrnateCard>
        </div>
      </Act>

      {/* ── Act III — Recall ────────────────────────────────────────── */}
      <Act
        eyebrow="Act III"
        title="Recall"
        description="The thread that pulls weary travelers home. Set the cooldown's tempo and the words that escort them back."
      >
        <div className="gap-4 [column-fill:balance] md:columns-2">
          <OrnateCard
            title="Recall Cooldown"
            description="Controls the recall ability cooldown."
          >
            <IconField
              label="Cooldown (seconds)"
              hint="300 = 5 min classic · 600 = 10 min punishing · 0 = unlimited"
            >
              <NumberInput
                value={Math.round((recall.cooldownMs ?? 0) / 1000)}
                onCommit={(v) => patchRecall({ cooldownMs: (v ?? 300) * 1000 })}
                min={0}
                dense
              />
            </IconField>
          </OrnateCard>

          <OrnateCard
            title="Recall Messages"
            description="Customize the messages players see during recall. Use {seconds} for the cooldown placeholder."
          >
            <p className="mb-2 font-body text-xs italic leading-snug text-text-muted">
              Words the player hears at the threshold.
            </p>
            <div className="flex flex-col gap-1.5">
              <MessageRow
                label="Combat Blocked"
                value={recall.messages.combatBlocked}
                onCommit={(v) => patchRecallMessages({ combatBlocked: v })}
              />
              <MessageRow
                label="Cooldown"
                value={recall.messages.cooldownRemaining}
                onCommit={(v) => patchRecallMessages({ cooldownRemaining: v })}
                placeholder="Use {seconds} for remaining time"
              />
              <MessageRow
                label="Cast Begin"
                value={recall.messages.castBegin}
                onCommit={(v) => patchRecallMessages({ castBegin: v })}
              />
              <MessageRow
                label="Unreachable"
                value={recall.messages.unreachable}
                onCommit={(v) => patchRecallMessages({ unreachable: v })}
              />
              <MessageRow
                label="Depart Notice"
                value={recall.messages.departNotice}
                onCommit={(v) => patchRecallMessages({ departNotice: v })}
              />
              <MessageRow
                label="Arrive Notice"
                value={recall.messages.arriveNotice}
                onCommit={(v) => patchRecallMessages({ arriveNotice: v })}
              />
              <MessageRow
                label="Arrival"
                value={recall.messages.arrival}
                onCommit={(v) => patchRecallMessages({ arrival: v })}
              />
            </div>
          </OrnateCard>
        </div>
      </Act>

      {/* ── Act IV — Mortality ──────────────────────────────────────── */}
      <Act
        eyebrow="Act IV"
        title="Mortality"
        description="What death takes and what the sanctum returns. The penalties here shape how dangerous the world feels."
      >
        <div className="gap-4 [column-fill:balance] md:columns-2">
          <OrnateCard
            title="Death & Sanctum"
            description="Where players return after death. HP/Mana values are fractions of max (0–1.0). XP penalty is a fraction of total XP lost (0–0.5)."
          >
            <div className="flex flex-col gap-1.5">
              <IconField label="Sanctum Room">
                <RoomPicker
                  value={death.sanctumRoom}
                  onChange={(v) => patchDeath({ sanctumRoom: v })}
                  placeholder="Use zone start room"
                  allowClear
                />
              </IconField>
              <div className="grid grid-cols-2 gap-2">
                <IconField label="HP on Respawn" layout="column">
                  <NumberInput
                    value={death.respawnHpFraction}
                    onCommit={(v) => patchDeath({ respawnHpFraction: v ?? 0.2 })}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    dense
                  />
                </IconField>
                <IconField label="Mana on Respawn" layout="column">
                  <NumberInput
                    value={death.respawnManaFraction}
                    onCommit={(v) => patchDeath({ respawnManaFraction: v ?? 0.2 })}
                    min={0}
                    max={1.0}
                    step={0.05}
                    dense
                  />
                </IconField>
                <IconField
                  label="XP Penalty"
                  layout="column"
                  hint="Fraction of total XP deducted on death."
                >
                  <NumberInput
                    value={death.xpPenaltyFraction}
                    onCommit={(v) => patchDeath({ xpPenaltyFraction: v ?? 0 })}
                    min={0}
                    max={0.5}
                    step={0.01}
                    dense
                  />
                </IconField>
              </div>
            </div>
          </OrnateCard>

          <OrnateCard
            title="Sanctum Messages"
            description="Customize messages related to the sanctum, departure, and edge cases."
          >
            <p className="mb-2 font-body text-xs italic leading-snug text-text-muted">
              Words the player hears returning from death.
            </p>
            <div className="flex flex-col gap-1.5">
              <MessageRow
                label="Arrive Sanctum"
                value={death.messages.arriveSanctum}
                onCommit={(v) => patchDeathMessages({ arriveSanctum: v })}
              />
              <MessageRow
                label="Depart Begin"
                value={death.messages.departBegin}
                onCommit={(v) => patchDeathMessages({ departBegin: v })}
              />
              <MessageRow
                label="Depart Outside Sanctum"
                value={death.messages.departNoSanctum}
                onCommit={(v) => patchDeathMessages({ departNoSanctum: v })}
              />
              <MessageRow
                label="Depart Without Death"
                value={death.messages.departNoDeath}
                onCommit={(v) => patchDeathMessages({ departNoDeath: v })}
              />
              <MessageRow
                label="Depart Unreachable"
                value={death.messages.departUnreachable}
                onCommit={(v) => patchDeathMessages({ departUnreachable: v })}
              />
            </div>
          </OrnateCard>
        </div>
      </Act>
    </div>
  );
}

function TrashGlyph() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v7M14 11v7" />
    </svg>
  );
}

function DiminishingReturnsEditor({
  value,
  onChange,
  maxLevel,
}: {
  value: DiminishingXpConfig | undefined;
  onChange: (next: DiminishingXpConfig | undefined) => void;
  maxLevel: number;
}) {
  const enabled = !!value?.enabled;
  const thresholds = value?.thresholds ?? [];

  const setEnabled = (on: boolean) => {
    if (!on && thresholds.length === 0) onChange(undefined);
    else onChange({ enabled: on, thresholds });
  };

  const patchThresholds = (next: DiminishingXpThreshold[]) => {
    onChange({ enabled, thresholds: next });
  };

  const addThreshold = () => {
    const last = thresholds[thresholds.length - 1];
    const nextLevels = last ? last.levelsBelow + 5 : 5;
    const nextMultiplier = last ? Math.max(0, last.multiplier / 2) : 0.5;
    patchThresholds([
      ...thresholds,
      { levelsBelow: nextLevels, multiplier: Number(nextMultiplier.toFixed(2)) },
    ]);
  };

  const updateThreshold = (index: number, patch: Partial<DiminishingXpThreshold>) => {
    patchThresholds(thresholds.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const removeThreshold = (index: number) => {
    patchThresholds(thresholds.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label="Enable diminishing returns"
      />
      {enabled && (
        <div className="flex flex-col gap-2">
          {/* Inline staircase visualization */}
          <div className="flex flex-col gap-1">
            <p className="font-body text-2xs italic leading-snug text-text-muted/85">
              How XP earned compounds: each kill in this level band yields the listed fraction.
            </p>
            <DiminishingStaircase
              thresholds={thresholds}
              maxLevel={maxLevel}
              height={68}
            />
            <div className="flex items-center justify-between font-display text-[10px] uppercase tracking-[0.18em] text-text-muted/65">
              <span>0 lvl above</span>
              <span>{Math.max(5, maxLevel || 50)} lvl above</span>
            </div>
          </div>

          {thresholds.length === 0 ? (
            <p className="text-2xs leading-snug text-text-muted">
              No thresholds yet. Add one below — e.g.{" "}
              <code className="font-mono text-[11px]">levelsBelow: 5, multiplier: 0.5</code>{" "}
              halves XP once the player is 5+ levels over the mob.
            </p>
          ) : (
            <ul className="flex flex-col" role="list">
              <li
                className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--chrome-stroke-soft)] py-1 font-display text-[10px] uppercase tracking-[0.18em] text-text-muted/70"
                aria-hidden="true"
              >
                <span>Levels above</span>
                <span className="opacity-0">→</span>
                <span>Multiplier</span>
                <span className="opacity-0">·</span>
              </li>
              {thresholds.map((threshold, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--chrome-stroke-soft)] py-1.5 last:border-b-0"
                >
                  <label className="flex min-w-0 items-center gap-2">
                    <span className="sr-only">Levels above for threshold {i + 1}</span>
                    <NumberInput
                      value={threshold.levelsBelow}
                      onCommit={(v) => updateThreshold(i, { levelsBelow: v ?? 0 })}
                      min={0}
                      dense
                    />
                  </label>
                  <span
                    aria-hidden="true"
                    className="font-display text-base leading-none text-accent/60"
                  >
                    →
                  </span>
                  <label className="flex min-w-0 items-center gap-2">
                    <span className="sr-only">Multiplier for threshold {i + 1}</span>
                    <NumberInput
                      value={threshold.multiplier}
                      onCommit={(v) => updateThreshold(i, { multiplier: v ?? 1 })}
                      min={0}
                      step={0.05}
                      dense
                    />
                    <span className="font-mono text-2xs text-text-muted/80">×</span>
                  </label>
                  <IconButton
                    onClick={() => removeThreshold(i)}
                    title="Remove threshold"
                    aria-label={`Remove threshold ${i + 1}`}
                    size="sm"
                    danger
                  >
                    <TrashGlyph />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xs leading-snug text-text-muted/65">
              Largest matching <span className="font-mono">levelsBelow</span> wins.
            </p>
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={addThreshold}
            >
              Add Threshold
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
