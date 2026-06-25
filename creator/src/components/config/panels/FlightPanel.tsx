import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { FlightConfig, FlightMessagesConfig } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput } from "@/components/ui/FormWidgets";

/** Mirror of the server's FlightSystem.costForDistance:
 *  clamp(baseCost + costPerRoom * distance, minCost, maxCost). */
function fareForDistance(f: FlightConfig, distance: number): number {
  const raw = f.baseCost + f.costPerRoom * distance;
  return Math.min(Math.max(raw, f.minCost), f.maxCost);
}

const PREVIEW_HOPS = [1, 2, 3, 5, 10];

export function FlightPanel({ config, onChange }: ConfigPanelProps) {
  const f = config.flight;

  const patch = useCallback(
    (p: Partial<FlightConfig>) => {
      onChange({ flight: { ...config.flight, ...p } });
    },
    [config.flight, onChange],
  );

  const patchMsg = useCallback(
    (p: Partial<FlightMessagesConfig>) => {
      onChange({ flight: { ...config.flight, messages: { ...config.flight.messages, ...p } } });
    },
    [config.flight, onChange],
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
        <h2 className="font-display text-lg text-accent">Flight Masters</h2>
        <p className="mt-1 max-w-prose text-2xs leading-relaxed text-text-muted/80">
          Tuning for gold fast-travel kiosks. Players pay to fly between flight points they have
          personally discovered by visiting a room flagged as a{" "}
          <span className="text-text-secondary">Flight Master</span>. The fare scales with travel
          distance — the shortest-path hop count from where the player is standing to the
          destination — so the same place costs more the farther you fly from it.
        </p>
      </div>

      <Section title="Fare">
        <FieldRow label="Base cost" hint="Flat gold fare added to every flight before distance scaling.">
          {num(f.baseCost, (v) => patch({ baseCost: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Cost per room" hint="Extra gold per hop of travel distance — this is what makes farther destinations pricier.">
          {num(f.costPerRoom, (v) => patch({ costPerRoom: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Min cost" hint="Floor for the total fare after scaling. With min = base, only bites if you set base below it.">
          {num(f.minCost, (v) => patch({ minCost: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Max cost" hint="Ceiling for the total fare — caps long cross-zone hauls.">
          {num(f.maxCost, (v) => patch({ maxCost: v }), { min: 0 })}
        </FieldRow>
        <FieldRow label="Unreachable cost" hint="Flat fare charged when distance can't be computed (destination not loaded on this engine).">
          {num(f.unreachableCost, (v) => patch({ unreachableCost: v }), { min: 0 })}
        </FieldRow>
      </Section>

      <Section title="Fare preview">
        <p className="px-1 pb-2 text-2xs leading-relaxed text-text-muted/80">
          <span className="font-mono text-text-secondary">
            clamp({f.baseCost} + {f.costPerRoom} × hops, {f.minCost}, {f.maxCost})
          </span>
        </p>
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          {PREVIEW_HOPS.map((hops) => (
            <div
              key={hops}
              className="flex flex-col items-center rounded-md border border-border-default/60 bg-bg-secondary/40 px-3 py-1.5"
            >
              <span className="text-2xs text-text-muted/70">{hops} {hops === 1 ? "hop" : "hops"}</span>
              <span className="font-mono text-sm text-accent">{fareForDistance(f, hops)}g</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Messages" defaultExpanded={false}>
        <p className="px-1 pb-2 text-2xs leading-relaxed text-text-muted/80">
          Player-facing flavor text. The server substitutes{" "}
          <span className="font-mono text-text-secondary">{"{cost}"}</span>,{" "}
          <span className="font-mono text-text-secondary">{"{gold}"}</span>, and{" "}
          <span className="font-mono text-text-secondary">{"{dest}"}</span> where noted.
        </p>
        <FieldRow label="Combat blocked" hint="Shown when a player tries to fly mid-battle.">
          <TextInput value={f.messages.combatBlocked} onCommit={(v) => patchMsg({ combatBlocked: v })} dense />
        </FieldRow>
        <FieldRow label="Not at flight master" hint="Shown when flights/fly is used away from a flight master.">
          <TextInput value={f.messages.notAtFlightMaster} onCommit={(v) => patchMsg({ notAtFlightMaster: v })} dense />
        </FieldRow>
        <FieldRow label="No destinations" hint="Shown when the player hasn't discovered any other flight points yet.">
          <TextInput value={f.messages.noDestinations} onCommit={(v) => patchMsg({ noDestinations: v })} dense />
        </FieldRow>
        <FieldRow label="Unknown destination" hint="Shown when the named/numbered destination doesn't resolve.">
          <TextInput value={f.messages.unknownDestination} onCommit={(v) => patchMsg({ unknownDestination: v })} dense />
        </FieldRow>
        <FieldRow label="Already here" hint="Shown when flying to the flight point you're standing on.">
          <TextInput value={f.messages.alreadyHere} onCommit={(v) => patchMsg({ alreadyHere: v })} dense />
        </FieldRow>
        <FieldRow label="Not enough gold" hint="Insufficient funds. Uses {cost} and {gold}.">
          <TextInput value={f.messages.notEnoughGold} onCommit={(v) => patchMsg({ notEnoughGold: v })} dense />
        </FieldRow>
        <FieldRow label="Discovered" hint="Shown the first time a player visits a flight master.">
          <TextInput value={f.messages.discovered} onCommit={(v) => patchMsg({ discovered: v })} dense />
        </FieldRow>
        <FieldRow label="Depart notice" hint="Broadcast to the origin room as the player leaves.">
          <TextInput value={f.messages.departNotice} onCommit={(v) => patchMsg({ departNotice: v })} dense />
        </FieldRow>
        <FieldRow label="Arrive notice" hint="Broadcast to the destination room as the player arrives.">
          <TextInput value={f.messages.arriveNotice} onCommit={(v) => patchMsg({ arriveNotice: v })} dense />
        </FieldRow>
        <FieldRow label="Depart" hint="Shown to the traveling player on takeoff. Uses {dest}.">
          <TextInput value={f.messages.depart} onCommit={(v) => patchMsg({ depart: v })} dense />
        </FieldRow>
        <FieldRow label="Arrival" hint="Shown to the traveling player on landing. Uses {dest} and {cost}.">
          <TextInput value={f.messages.arrival} onCommit={(v) => patchMsg({ arrival: v })} dense />
        </FieldRow>
      </Section>
    </div>
  );
}
