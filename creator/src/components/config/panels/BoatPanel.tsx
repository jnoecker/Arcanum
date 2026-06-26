import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { BoatMessagesConfig } from "@/types/config";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

export function BoatPanel({ config, onChange }: ConfigPanelProps) {
  const b = config.boat;

  const patchMsg = useCallback(
    (p: Partial<BoatMessagesConfig>) => {
      onChange({ boat: { ...config.boat, messages: { ...config.boat.messages, ...p } } });
    },
    [config.boat, onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 py-2">
        <h2 className="font-display text-lg text-accent">Boat Docks</h2>
        <p className="mt-1 max-w-prose text-2xs leading-relaxed text-text-muted/80">
          Tuning for gold fast-travel harbors. Players pay a flat fare to sail between docks flagged
          as a <span className="text-text-secondary">Boat Dock</span>. Unlike flight masters, every
          route is authored on the dock itself — open a room&rsquo;s{" "}
          <span className="text-text-secondary">Boat Dock</span> panel to set each route&rsquo;s
          destination and price. There are no distance-scaled fares here, so this block is just the
          player-facing messages.
        </p>
      </div>

      <Section title="Messages">
        <p className="px-1 pb-2 text-2xs leading-relaxed text-text-muted/80">
          Player-facing flavor text. The server substitutes{" "}
          <span className="font-mono text-text-secondary">{"{cost}"}</span>,{" "}
          <span className="font-mono text-text-secondary">{"{gold}"}</span>, and{" "}
          <span className="font-mono text-text-secondary">{"{dest}"}</span> where noted.
        </p>
        <FieldRow label="Combat blocked" hint="Shown when a player tries to sail mid-battle.">
          <TextInput value={b.messages.combatBlocked} onCommit={(v) => patchMsg({ combatBlocked: v })} dense />
        </FieldRow>
        <FieldRow label="Not at dock" hint="Shown when voyages/sail is used away from a boat dock.">
          <TextInput value={b.messages.notAtDock} onCommit={(v) => patchMsg({ notAtDock: v })} dense />
        </FieldRow>
        <FieldRow label="No routes" hint="Shown at a dock that has no authored routes.">
          <TextInput value={b.messages.noRoutes} onCommit={(v) => patchMsg({ noRoutes: v })} dense />
        </FieldRow>
        <FieldRow label="Unknown destination" hint="Shown when the named/numbered destination doesn't resolve.">
          <TextInput value={b.messages.unknownDestination} onCommit={(v) => patchMsg({ unknownDestination: v })} dense />
        </FieldRow>
        <FieldRow label="Already here" hint="Shown when sailing to the dock you're standing on.">
          <TextInput value={b.messages.alreadyHere} onCommit={(v) => patchMsg({ alreadyHere: v })} dense />
        </FieldRow>
        <FieldRow label="Not enough gold" hint="Insufficient funds. Uses {cost} and {gold}.">
          <TextInput value={b.messages.notEnoughGold} onCommit={(v) => patchMsg({ notEnoughGold: v })} dense />
        </FieldRow>
        <FieldRow label="Depart notice" hint="Broadcast to the origin room as the player leaves.">
          <TextInput value={b.messages.departNotice} onCommit={(v) => patchMsg({ departNotice: v })} dense />
        </FieldRow>
        <FieldRow label="Arrive notice" hint="Broadcast to the destination room as the player arrives.">
          <TextInput value={b.messages.arriveNotice} onCommit={(v) => patchMsg({ arriveNotice: v })} dense />
        </FieldRow>
        <FieldRow label="Depart" hint="Shown to the traveling player on casting off. Uses {dest}.">
          <TextInput value={b.messages.depart} onCommit={(v) => patchMsg({ depart: v })} dense />
        </FieldRow>
        <FieldRow label="Arrival" hint="Shown to the traveling player on stepping ashore. Uses {dest} and {cost}.">
          <TextInput value={b.messages.arrival} onCommit={(v) => patchMsg({ arrival: v })} dense />
        </FieldRow>
      </Section>
    </div>
  );
}
