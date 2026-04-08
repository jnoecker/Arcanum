import type { ConfigPanelProps, AppConfig } from "./types";
import type { GuildHallRoomTemplate } from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  CheckboxInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const defaultTemplate = (raw: string): GuildHallRoomTemplate => ({
  displayName: raw,
  description: "",
  cost: 0,
});

function summarize(_id: string, t: GuildHallRoomTemplate): string {
  return `${t.cost}g`;
}

export function GuildHallsPanel({ config, onChange }: ConfigPanelProps) {
  const guildHalls = {
    enabled: false,
    baseCost: 0,
    roomTemplates: {} as Record<string, GuildHallRoomTemplate>,
    ...config.guildHalls,
  };

  const patchGuildHalls = (p: Partial<AppConfig["guildHalls"]>) =>
    onChange({ guildHalls: { ...guildHalls, ...p } });

  return (
    <>
      <Section
        title="Guild Halls"
        description="Guild halls give player-run guilds a shared home base they can expand over time. Members can meet, share storage, and unlock perks tied to their hall. Toggle the system off if you don't want housing in your MUD."
      >
        <div className="flex flex-col gap-1.5">
          <CheckboxInput
            checked={guildHalls.enabled}
            onCommit={(v) => patchGuildHalls({ enabled: v })}
            label="Enable guild halls"
          />
          <FieldRow
            label="Base Cost"
            hint="Gold a guild must pay to purchase its initial hall. Balance this against your economy — a price too low trivializes the perk, too high locks out casual guilds. Try 10000g for mid-tier MUDs."
          >
            <NumberInput
              value={guildHalls.baseCost}
              onCommit={(v) => patchGuildHalls({ baseCost: v ?? 0 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<GuildHallRoomTemplate>
        title="Room Templates"
        description="Expandable rooms guilds can add to their hall — vaults, training rooms, crafting stations, libraries. Each template defines its display name, flavor text, and gold cost. Rooms unlock guild perks when added."
        items={guildHalls.roomTemplates}
        onItemsChange={(roomTemplates) => patchGuildHalls({ roomTemplates })}
        defaultItem={defaultTemplate}
        renderSummary={summarize}
        getDisplayName={(t) => t.displayName ?? ""}
        placeholder="template_id"
        renderDetail={(_id, t, patch) => (
          <div className="flex flex-col gap-1.5">
            <FieldRow
              label="Display Name"
              hint="Name shown to players when browsing available room upgrades."
            >
              <TextInput
                value={t.displayName ?? ""}
                onCommit={(v) => patch({ displayName: v })}
              />
            </FieldRow>
            <FieldRow
              label="Cost"
              hint="Gold cost for a guild to add this room. Scale this against your Base Cost — room upgrades should feel like meaningful investments, not throwaway purchases."
            >
              <NumberInput
                value={t.cost}
                onCommit={(v) => patch({ cost: v ?? 0 })}
                min={0}
              />
            </FieldRow>
            <CommitTextarea
              label="Description"
              value={t.description}
              onCommit={(v) => patch({ description: v })}
              placeholder="A fortified vault lined with enchanted stone..."
              rows={3}
            />
          </div>
        )}
      />
    </>
  );
}
