import { useCallback, useMemo, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import type { FactionConfig, FactionDefinition } from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
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
    <div className="space-y-6">
      <Section title="Global Settings" defaultExpanded>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Default Reputation" hint="Starting reputation with all factions">
            <NumberInput value={factions.defaultReputation} onCommit={(v) => patch({ defaultReputation: v ?? 0 })} />
          </FieldRow>
          <FieldRow label="Kill Penalty" hint="Base rep lost with a mob's faction per kill (scaled by level)">
            <NumberInput value={factions.killPenalty} onCommit={(v) => patch({ killPenalty: v ?? 5 })} min={0} />
          </FieldRow>
          <FieldRow label="Kill Bonus" hint="Base rep gained with enemy factions per kill (scaled by level)">
            <NumberInput value={factions.killBonus} onCommit={(v) => patch({ killBonus: v ?? 3 })} min={0} />
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Factions (${factionIds.length})`}
        defaultExpanded
        actions={
          <div className="flex items-center gap-1.5">
            <input
              value={newFactionId}
              onChange={(e) => setNewFactionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFaction()}
              placeholder="new_faction_id"
              className="w-36 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <IconButton onClick={addFaction} title="Add faction">+</IconButton>
          </div>
        }
      >
        {factionIds.length === 0 ? (
          <p className="text-xs text-text-muted">No factions defined. Add one above.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {factionIds.map((id) => {
              const def = factions.definitions[id]!;
              return (
                <div key={id} className="rounded-lg border border-border-muted bg-bg-secondary/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-text-muted">{id}</span>
                    <IconButton onClick={() => deleteFaction(id)} title="Delete faction" danger>&times;</IconButton>
                  </div>
                  <FieldRow label="Name">
                    <TextInput value={def.name} onCommit={(v) => patchDefinition(id, { name: v })} />
                  </FieldRow>
                  <FieldRow label="Description">
                    <TextInput value={def.description ?? ""} onCommit={(v) => patchDefinition(id, { description: v || undefined })} placeholder="Faction description" />
                  </FieldRow>
                  <FieldRow label="Enemies" hint="Comma-separated faction IDs">
                    <TextInput
                      value={(def.enemies ?? []).join(", ")}
                      onCommit={(v) => patchDefinition(id, { enemies: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined })}
                      placeholder="faction_a, faction_b"
                    />
                  </FieldRow>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Quest Rewards" defaultExpanded={false} description="Map quest IDs to faction reputation changes.">
        <CommitTextarea
          label="Quest Rewards (YAML)"
          value={factions.questRewards ? Object.entries(factions.questRewards).map(([qid, rewards]) =>
            `${qid}:\n${Object.entries(rewards).map(([fid, amt]) => `  ${fid}: ${amt}`).join("\n")}`
          ).join("\n") : ""}
          onCommit={(v) => {
            // Simple key-value parser for quest rewards
            if (!v.trim()) { patch({ questRewards: undefined }); return; }
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
                  if (match && match[1] && match[2]) rewards[currentQuest]![match[1]] = parseInt(match[2]);
                }
              }
              patch({ questRewards: Object.keys(rewards).length > 0 ? rewards : undefined });
            } catch {
              // Ignore parse errors
            }
          }}
          placeholder="quest_id:\n  faction_id: 100\n  other_faction: -50"
          rows={6}
        />
      </Section>
    </div>
  );
}
