import { useCallback, useMemo, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import type { FactionConfig, FactionDefinition } from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  ActionButton,
  IconButton,
  CommitTextarea,
} from "@/components/ui/FormWidgets";

const DEFAULT_FACTION_CONFIG: FactionConfig = {
  defaultReputation: 0,
  killPenalty: 5,
  killBonus: 3,
  definitions: {},
};

export function FactionPanel() {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [newFactionId, setNewFactionId] = useState("");

  const factions = config?.factions ?? DEFAULT_FACTION_CONFIG;

  const patch = useCallback(
    (p: Partial<FactionConfig>) => {
      if (!config) return;
      updateConfig({ ...config, factions: { ...factions, ...p } });
    },
    [config, factions, updateConfig],
  );

  const patchDefinition = useCallback(
    (id: string, p: Partial<FactionDefinition>) => {
      const defs = { ...factions.definitions };
      defs[id] = { ...(defs[id] ?? { name: id }), ...p };
      patch({ definitions: defs });
    },
    [factions.definitions, patch],
  );

  const addFaction = useCallback(() => {
    const id = newFactionId.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!id || factions.definitions[id]) return;
    const defs = { ...factions.definitions, [id]: { name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) } };
    patch({ definitions: defs });
    setNewFactionId("");
  }, [newFactionId, factions.definitions, patch]);

  const deleteFaction = useCallback(
    (id: string) => {
      const { [id]: _, ...rest } = factions.definitions;
      // Also remove from enemies lists
      for (const def of Object.values(rest)) {
        if (def.enemies) {
          def.enemies = def.enemies.filter((e) => e !== id);
        }
      }
      patch({ definitions: rest });
    },
    [factions.definitions, patch],
  );

  const factionIds = useMemo(() => Object.keys(factions.definitions), [factions.definitions]);

  if (!config) return null;

  return (
    <>
      <Section
        title="Global Settings"
        description="Factions are political and social groups in your world — thieves guilds, royal courts, mercenary companies. Players earn or lose reputation by completing quests and killing mobs, which unlocks shops, quests, and areas tied to each faction."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow
            label="Default Reputation"
            hint="Starting reputation each new player has with every faction. 0 is neutral. Positive values make the world friendlier to newcomers; negative values create a harsher debut."
          >
            <NumberInput
              value={factions.defaultReputation}
              onCommit={(v) => patch({ defaultReputation: v ?? 0 })}
            />
          </FieldRow>
          <FieldRow
            label="Kill Penalty"
            hint="Base reputation lost with a mob's own faction when a player kills it, scaled by mob level. 5 is a modest penalty — try 10 for a harsher consequence or 2 for a forgiving world."
          >
            <NumberInput
              value={factions.killPenalty}
              onCommit={(v) => patch({ killPenalty: v ?? 5 })}
              min={0}
            />
          </FieldRow>
          <FieldRow
            label="Kill Bonus"
            hint="Base reputation gained with the mob's enemy factions per kill, scaled by level. Encourages players to pick sides. 3 is a gentle nudge; raise to speed up faction alignment."
          >
            <NumberInput
              value={factions.killBonus}
              onCommit={(v) => patch({ killBonus: v ?? 3 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Factions (${factionIds.length})`}
        description="Define each faction's name, flavor text, and rival factions. Mobs and quests reference these IDs, and players accrue reputation with each one over the course of play."
        actions={
          <div className="flex items-center gap-1.5">
            <TextInput
              value={newFactionId}
              onCommit={setNewFactionId}
              placeholder="new_faction_id"
              dense
            />
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={addFaction}
              disabled={!newFactionId.trim()}
            >
              + Add
            </ActionButton>
          </div>
        }
      >
        {factionIds.length === 0 ? (
          <p className="text-2xs leading-relaxed text-text-muted/70">
            No factions defined yet. Enter an ID above (like "thieves_guild" or "royal_court") and click Add.
          </p>
        ) : (
          <div className="flex flex-col">
            {factionIds.map((id) => {
              const def = factions.definitions[id]!;
              return (
                <div
                  key={id}
                  className="flex flex-col gap-1.5 border-b border-border-muted/30 pb-3 pt-3 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                      {id}
                    </span>
                    <IconButton
                      onClick={() => deleteFaction(id)}
                      title="Delete faction"
                      size="sm"
                      danger
                    >
                      &times;
                    </IconButton>
                  </div>
                  <FieldRow
                    label="Name"
                    hint="Display name shown to players in reputation readouts and quest text."
                  >
                    <TextInput
                      value={def.name}
                      onCommit={(v) => patchDefinition(id, { name: v })}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Description"
                    hint="Short flavor summary. Shown in faction info commands and help text."
                  >
                    <TextInput
                      value={def.description ?? ""}
                      onCommit={(v) => patchDefinition(id, { description: v || undefined })}
                      placeholder="A secretive order of..."
                    />
                  </FieldRow>
                  <FieldRow
                    label="Enemies"
                    hint="Comma-separated faction IDs. Killing a member of this faction grants reputation with its enemies, and vice versa."
                  >
                    <TextInput
                      value={(def.enemies ?? []).join(", ")}
                      onCommit={(v) =>
                        patchDefinition(id, {
                          enemies: v
                            ? v.split(",").map((s) => s.trim()).filter(Boolean)
                            : undefined,
                        })
                      }
                      placeholder="thieves_guild, shadow_cabal"
                    />
                  </FieldRow>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title="Quest Rewards"
        description="Map quest IDs to faction reputation changes granted on completion. Use this to push players toward or away from factions based on the jobs they take."
        defaultExpanded={false}
      >
        <div className="flex flex-col gap-1.5">
          <CommitTextarea
            label="Rewards (YAML)"
            value={
              factions.questRewards
                ? Object.entries(factions.questRewards)
                    .map(
                      ([qid, rewards]) =>
                        `${qid}:\n${Object.entries(rewards)
                          .map(([fid, amt]) => `  ${fid}: ${amt}`)
                          .join("\n")}`,
                    )
                    .join("\n")
                : ""
            }
            onCommit={(v) => {
              // Simple key-value parser for quest rewards
              if (!v.trim()) {
                patch({ questRewards: undefined });
                return;
              }
              try {
                const rewards: Record<string, Record<string, number>> = {};
                let currentQuest = "";
                for (const line of v.split("\n")) {
                  const trimmed = line.trimEnd();
                  if (!trimmed) continue;
                  if (!trimmed.startsWith(" ")) {
                    currentQuest = trimmed.replace(/:$/, "").trim();
                    rewards[currentQuest] = {};
                  } else if (currentQuest) {
                    const match = trimmed.match(/^\s+(\S+)\s*:\s*(-?\d+)/);
                    if (match && match[1] && match[2])
                      rewards[currentQuest]![match[1]] = parseInt(match[2]);
                  }
                }
                patch({
                  questRewards:
                    Object.keys(rewards).length > 0 ? rewards : undefined,
                });
              } catch {
                // Ignore parse errors
              }
            }}
            placeholder={"rescue_the_merchant:\n  royal_court: 100\n  thieves_guild: -50"}
            rows={6}
          />
        </div>
      </Section>
    </>
  );
}
