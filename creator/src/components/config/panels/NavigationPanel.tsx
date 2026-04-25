import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput } from "@/components/ui/FormWidgets";
import { RoomPicker } from "./WorldPanel";

export function NavigationPanel({ config, onChange }: ConfigPanelProps) {
  const recall = config.navigation.recall;
  const death = config.death;

  const patchRecall = (p: Partial<AppConfig["navigation"]["recall"]>) =>
    onChange({ navigation: { ...config.navigation, recall: { ...recall, ...p } } });

  const patchMessages = (p: Partial<AppConfig["navigation"]["recall"]["messages"]>) =>
    patchRecall({ messages: { ...recall.messages, ...p } });

  const patchDeath = (p: Partial<AppConfig["death"]>) =>
    onChange({ death: { ...death, ...p } });

  const patchDeathMessages = (p: Partial<AppConfig["death"]["messages"]>) =>
    patchDeath({ messages: { ...death.messages, ...p } });

  return (
    <>
      <Section
        title="Recall"
        description="Recall teleports a player back to their start room. The cooldown prevents abuse as an instant escape from danger. Longer cooldowns make recall a strategic decision; shorter ones prioritize convenience."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)" hint="300000ms = 5 minutes (classic MUD default). Set to 0 for unlimited recall. 600000ms (10 min) for a more punishing world.">
            <NumberInput
              value={recall.cooldownMs}
              onCommit={(v) => patchRecall({ cooldownMs: v ?? 300000 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Recall Messages"
        description="Customize the messages players see during the recall process. These add flavor and communicate state to the player. Use {seconds} as a placeholder in the cooldown message."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Combat Blocked" hint="Shown when a player tries to recall while in combat.">
            <TextInput
              value={recall.messages.combatBlocked}
              onCommit={(v) => patchMessages({ combatBlocked: v })}
            />
          </FieldRow>
          <FieldRow label="Cooldown" hint="Shown when recall is still on cooldown. Use {seconds} for the remaining time.">
            <TextInput
              value={recall.messages.cooldownRemaining}
              onCommit={(v) => patchMessages({ cooldownRemaining: v })}
              placeholder="Use {seconds} for remaining time"
            />
          </FieldRow>
          <FieldRow label="Cast Begin" hint="Shown to the player when they start casting recall.">
            <TextInput
              value={recall.messages.castBegin}
              onCommit={(v) => patchMessages({ castBegin: v })}
            />
          </FieldRow>
          <FieldRow label="Unreachable" hint="Shown when the destination room cannot be reached (e.g. deleted or inaccessible).">
            <TextInput
              value={recall.messages.unreachable}
              onCommit={(v) => patchMessages({ unreachable: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Notice" hint="Broadcast to other players in the room when someone recalls away.">
            <TextInput
              value={recall.messages.departNotice}
              onCommit={(v) => patchMessages({ departNotice: v })}
            />
          </FieldRow>
          <FieldRow label="Arrive Notice" hint="Broadcast to other players in the destination room when someone arrives via recall.">
            <TextInput
              value={recall.messages.arriveNotice}
              onCommit={(v) => patchMessages({ arriveNotice: v })}
            />
          </FieldRow>
          <FieldRow label="Arrival" hint="Shown to the player themselves upon arriving at their recall destination.">
            <TextInput
              value={recall.messages.arrival}
              onCommit={(v) => patchMessages({ arrival: v })}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Sanctum &amp; Death"
        description="When a player is slain, they wake up in the sanctum room with partial HP/mana. From the sanctum, the 'depart' command sends them back to the start of the zone where they died. Tune the recovery fractions to match how punishing you want death to feel."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Sanctum Room" hint="The room players respawn in after death. Leave empty to fall back to the dead player's zone start room.">
            <RoomPicker
              value={death.sanctumRoom}
              onChange={(v) => patchDeath({ sanctumRoom: v })}
              placeholder="Use zone start room"
              allowClear
            />
          </FieldRow>
          <FieldRow
            label="HP on Respawn"
            hint="Fraction of max HP restored when waking in the sanctum (0.05 – 1.0). 0.2 = 20%, the default — players need to rest before heading back out."
          >
            <NumberInput
              value={death.respawnHpFraction}
              onCommit={(v) => patchDeath({ respawnHpFraction: v ?? 0.2 })}
              min={0.05}
              max={1.0}
              step={0.05}
            />
          </FieldRow>
          <FieldRow
            label="Mana on Respawn"
            hint="Fraction of max mana restored when waking in the sanctum (0 – 1.0)."
          >
            <NumberInput
              value={death.respawnManaFraction}
              onCommit={(v) => patchDeath({ respawnManaFraction: v ?? 0.2 })}
              min={0}
              max={1.0}
              step={0.05}
            />
          </FieldRow>
          <FieldRow
            label="XP Penalty"
            hint="Fraction of total XP deducted on death (0 – 0.5). 0 = forgiving (default); 0.1 = lose 10% of total XP each death."
          >
            <NumberInput
              value={death.xpPenaltyFraction}
              onCommit={(v) => patchDeath({ xpPenaltyFraction: v ?? 0 })}
              min={0}
              max={0.5}
              step={0.01}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Sanctum Messages"
        description="Customize the messages players see when they die, depart from the sanctum, or hit a depart edge case."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Arrive Sanctum" hint="Shown to a player as they wake up in the sanctum after dying.">
            <TextInput
              value={death.messages.arriveSanctum}
              onCommit={(v) => patchDeathMessages({ arriveSanctum: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Begin" hint="Shown when a player successfully departs the sanctum back to the world.">
            <TextInput
              value={death.messages.departBegin}
              onCommit={(v) => patchDeathMessages({ departBegin: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Outside Sanctum" hint="Shown when a player tries to use 'depart' from somewhere other than the sanctum.">
            <TextInput
              value={death.messages.departNoSanctum}
              onCommit={(v) => patchDeathMessages({ departNoSanctum: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Without Death" hint="Shown when a player tries to depart but has no recorded death zone (fresh character).">
            <TextInput
              value={death.messages.departNoDeath}
              onCommit={(v) => patchDeathMessages({ departNoDeath: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Unreachable" hint="Shown when the spirit gate's destination room can't be reached (e.g. zone unloaded).">
            <TextInput
              value={death.messages.departUnreachable}
              onCommit={(v) => patchDeathMessages({ departUnreachable: v })}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
