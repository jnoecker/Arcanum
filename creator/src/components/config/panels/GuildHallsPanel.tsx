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
        description="Enable guild housing and configure the base cost for purchasing a guild hall. Guild halls give guilds a shared home with expandable rooms."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Toggle the guild halls system on or off.">
            <CheckboxInput
              checked={guildHalls.enabled}
              onCommit={(v) => patchGuildHalls({ enabled: v })}
              label="Guild halls enabled"
            />
          </FieldRow>
          <FieldRow label="Base Cost" hint="Gold cost for a guild to purchase its initial hall.">
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
        items={guildHalls.roomTemplates}
        onItemsChange={(roomTemplates) => patchGuildHalls({ roomTemplates })}
        defaultItem={defaultTemplate}
        renderSummary={summarize}
        getDisplayName={(t) => t.displayName}
        placeholder="template_id"
        renderDetail={(_id, t, patch) => (
          <>
            <FieldRow label="Display Name" hint="Name shown to players for this room type.">
              <TextInput
                value={t.displayName}
                onCommit={(v) => patch({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Description">
              <CommitTextarea
                label="Description"
                value={t.description}
                onCommit={(v) => patch({ description: v })}
                placeholder="Room description..."
                rows={3}
              />
            </FieldRow>
            <FieldRow label="Cost" hint="Gold cost to add this room to a guild hall.">
              <NumberInput
                value={t.cost}
                onCommit={(v) => patch({ cost: v ?? 0 })}
                min={0}
              />
            </FieldRow>
          </>
        )}
      />
    </>
  );
}
