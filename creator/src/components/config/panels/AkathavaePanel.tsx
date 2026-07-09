import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { AkathavaeConfig } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, CheckboxInput } from "@/components/ui/FormWidgets";

const STAT_HINT = "Stat key from your combat config (e.g. INT, STR, DEX, CON, WIS, CHA).";

export function AkathavaePanel({ config, onChange }: ConfigPanelProps) {
  const a = config.akathavae;

  const patch = useCallback(
    (p: Partial<AkathavaeConfig>) => {
      onChange({ akathavae: { ...config.akathavae, ...p } });
    },
    [config.akathavae, onChange],
  );

  const num = (value: number, set: (v: number) => void, opts?: { min?: number; max?: number; step?: number }) => (
    <NumberInput
      value={value}
      onCommit={(v) => set(v ?? 0)}
      min={opts?.min}
      max={opts?.max}
      step={opts?.step}
      dense
    />
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 py-2">
        <h2 className="font-display text-lg text-accent">The Akathavae</h2>
        <p className="mt-1 max-w-prose text-2xs leading-relaxed text-text-muted/80">
          Tuning for the pacifist explorer path. Pledging is free at any room flagged as an{" "}
          <span className="text-text-secondary">Akathavae Shrine</span>; pledged players forsake combat and
          level by illuminating creatures, rooms, and items into their Arcanum.
        </p>
      </div>

      <Section title="The Pledge">
        <FieldRow label="Enabled" hint="Master switch for the entire Akathavae path.">
          <CheckboxInput
            checked={a.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label={a.enabled ? "Path available" : "Path disabled"}
          />
        </FieldRow>
        <FieldRow label="Renounce cost" hint="Gold charged to renounce the pledge at a shrine.">
          {num(a.renounceCostGold, (v) => patch({ renounceCostGold: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Re-pledge cooldown" hint="Milliseconds before an ex-Akathavae may pledge again. Default 86,400,000 (24h).">
          {num(a.repledgeCooldownMs, (v) => patch({ repledgeCooldownMs: v }), { min: 0 })}
        </FieldRow>
      </Section>

      <Section title="Illumination — Success">
        <FieldRow label="Base success %" hint="Chance an illumination passes before stat/level adjustments.">
          {num(a.illuminateBaseSuccessPct, (v) => patch({ illuminateBaseSuccessPct: v }), { min: 0, max: 100 })}
        </FieldRow>
        <FieldRow label="Success stat" hint={STAT_HINT}>
          <TextInput value={a.successStat} onCommit={(v) => patch({ successStat: v })} dense />
        </FieldRow>
        <FieldRow label="% per stat point" hint="Success % gained per success-stat point above base (10).">
          {num(a.successPerStatPoint, (v) => patch({ successPerStatPoint: v }), { min: 0, step: 0.1 })}
        </FieldRow>
        <FieldRow label="Level-gap penalty" hint="Success % lost per level the subject is above the player.">
          {num(a.levelGapPenaltyPct, (v) => patch({ levelGapPenaltyPct: v }), { min: 0, step: 0.1 })}
        </FieldRow>
        <FieldRow label="Gap-relief stat" hint={STAT_HINT}>
          <TextInput value={a.gapReliefStat} onCommit={(v) => patch({ gapReliefStat: v })} dense />
        </FieldRow>
        <FieldRow label="Relief per point" hint="Gap penalty (per subject level) removed per gap-relief-stat point above base.">
          {num(a.gapReliefPerStatPoint, (v) => patch({ gapReliefPerStatPoint: v }), { min: 0, step: 0.1 })}
        </FieldRow>
        <FieldRow label="Min success %" hint="Lower clamp on final success chance.">
          {num(a.minSuccessPct, (v) => patch({ minSuccessPct: v }), { min: 0, max: 100 })}
        </FieldRow>
        <FieldRow label="Max success %" hint="Upper clamp on final success chance.">
          {num(a.maxSuccessPct, (v) => patch({ maxSuccessPct: v }), { min: 0, max: 100 })}
        </FieldRow>
      </Section>

      <Section title="Illumination — Failure">
        <FieldRow label="Retry cooldown" hint="Milliseconds before a failed subject can be illuminated again.">
          {num(a.failRetryCooldownMs, (v) => patch({ failRetryCooldownMs: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Escape stat" hint={STAT_HINT}>
          <TextInput value={a.escapeStat} onCommit={(v) => patch({ escapeStat: v })} dense />
        </FieldRow>
        <FieldRow label="Escape % per point" hint="Chance to avoid the subject turning hostile, per escape-stat point above base.">
          {num(a.escapePerStatPoint, (v) => patch({ escapePerStatPoint: v }), { min: 0, step: 0.1 })}
        </FieldRow>
      </Section>

      <Section title="Discovery XP">
        <FieldRow label="XP stat" hint={STAT_HINT}>
          <TextInput value={a.xpStat} onCommit={(v) => patch({ xpStat: v })} dense />
        </FieldRow>
        <FieldRow label="XP bonus per point" hint="Fractional XP bonus per XP-stat point above base (0.02 = +2%/point).">
          {num(a.xpBonusPerStatPoint, (v) => patch({ xpBonusPerStatPoint: v }), { min: 0, step: 0.01 })}
        </FieldRow>
        <FieldRow label="Repeat XP fraction" hint="Fraction of first-time XP for re-illuminating a known subject (0–1).">
          {num(a.repeatXpFraction, (v) => patch({ repeatXpFraction: v }), { min: 0, max: 1, step: 0.01 })}
        </FieldRow>
        <FieldRow label="Repeat XP cooldown" hint="Milliseconds before a repeat illumination yields XP again.">
          {num(a.repeatXpCooldownMs, (v) => patch({ repeatXpCooldownMs: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Room discovery XP" hint="XP for recording a never-before-visited room.">
          {num(a.roomDiscoveryXp, (v) => patch({ roomDiscoveryXp: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Room XP per zone level" hint="Extra room XP per average mob level of the zone — dangerous zones pay like the zone.">
          {num(a.roomDiscoveryXpPerZoneLevel, (v) => patch({ roomDiscoveryXpPerZoneLevel: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Item discovery XP" hint="XP for recording a never-before-seen item.">
          {num(a.itemDiscoveryXp, (v) => patch({ itemDiscoveryXp: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Observe NPC XP" hint="XP for observing a non-combat NPC (recorded, never removed).">
          {num(a.observeNpcXp, (v) => patch({ observeNpcXp: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="XP throttle" hint="Minimum milliseconds between discovery XP awards — anti-speedrun throttle.">
          {num(a.discoveryXpThrottleMs, (v) => patch({ discoveryXpThrottleMs: v }), { min: 0 })}
        </FieldRow>
      </Section>

      <Section title="Zone Completion">
        <FieldRow label="XP per room" hint="One-time XP per room in a zone, paid when its Arcanum record reaches 100%.">
          {num(a.zoneCompletionXpPerRoom, (v) => patch({ zoneCompletionXpPerRoom: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Completion gold" hint="One-time gold paid on zone completion — the Akathavae's gold faucet.">
          {num(a.zoneCompletionGold, (v) => patch({ zoneCompletionGold: v }), { min: 0 })}
        </FieldRow>
      </Section>

      <Section title="Unpledged Journaling">
        <FieldRow label="Success multiplier" hint="Scales illumination odds for players who never pledged (0–1) — anyone may keep a field journal.">
          {num(a.unpledgedSuccessMultiplier, (v) => patch({ unpledgedSuccessMultiplier: v }), { min: 0, max: 1, step: 0.05 })}
        </FieldRow>
        <FieldRow label="XP multiplier" hint="Scales discovery XP for unpledged players (0–1). 0 makes their journaling pure record-keeping.">
          {num(a.unpledgedXpMultiplier, (v) => patch({ unpledgedXpMultiplier: v }), { min: 0, max: 1, step: 0.05 })}
        </FieldRow>
      </Section>

      <Section title="Sketching">
        <FieldRow label="Ms per combat round" hint="Sketch time per estimated melee round-to-kill — illumination takes about as long as the fight would. All-zero sketch knobs make it instant.">
          {num(a.sketchMsPerEstimatedRound, (v) => patch({ sketchMsPerEstimatedRound: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Min duration (ms)" hint="Lower clamp on sketch time for combat-capable subjects.">
          {num(a.sketchMinMs, (v) => patch({ sketchMinMs: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Max duration (ms)" hint="Upper clamp on sketch time for combat-capable subjects.">
          {num(a.sketchMaxMs, (v) => patch({ sketchMaxMs: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Observe duration (ms)" hint="Flat sketch time for observing a non-combat NPC.">
          {num(a.observeSketchMs, (v) => patch({ observeSketchMs: v }), { min: 0 })}
        </FieldRow>
      </Section>
    </div>
  );
}
