import { useCallback } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { GuildRankDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const GUILD_PERMISSIONS = [
  "invite", "kick", "promote", "demote", "disband", "set_motd",
];

export function defaultGuildRankDefinition(raw: string): GuildRankDefinition {
  return { displayName: raw, level: 0 };
}

export function summarizeGuildRank(rank: GuildRankDefinition): string {
  return `level ${rank.level}`;
}

export function GuildRankDetail({
  rank,
  patchRank,
  togglePermission,
}: {
  rank: GuildRankDefinition;
  patchRank: (p: Partial<GuildRankDefinition>) => void;
  togglePermission: (rank: GuildRankDefinition, perm: string, patchRank: (p: Partial<GuildRankDefinition>) => void) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={rank.displayName}
          onCommit={(v) => patchRank({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Level" hint="Numeric rank level used for ordering. Higher = more authority. The founder rank should have the highest level.">
        <NumberInput
          value={rank.level}
          onCommit={(v) => patchRank({ level: v ?? 0 })}
        />
      </FieldRow>
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Permissions
        </h5>
        <div className="flex flex-wrap gap-1">
          {GUILD_PERMISSIONS.map((perm) => {
            const has = (rank.permissions ?? []).includes(perm);
            return (
              <button
                key={perm}
                onClick={() => togglePermission(rank, perm, patchRank)}
                className={`rounded px-1.5 py-0.5 text-2xs transition-colors ${
                  has
                    ? "bg-accent/20 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                }`}
              >
                {perm}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function GroupPanel({ config, onChange }: ConfigPanelProps) {
  const g = config.group;
  const patch = (p: Partial<AppConfig["group"]>) =>
    onChange({ group: { ...g, ...p } });

  const togglePermission = useCallback(
    (rank: GuildRankDefinition, perm: string, patchRank: (p: Partial<GuildRankDefinition>) => void) => {
      const perms = rank.permissions ?? [];
      if (perms.includes(perm)) {
        patchRank({ permissions: perms.filter((p) => p !== perm) });
      } else {
        patchRank({ permissions: [...perms, perm] });
      }
    },
    [],
  );

  return (
    <>
      <Section
        title="Group Settings"
        description="Groups let players team up for combat and exploration. Members in a group share XP from kills. Larger groups are more powerful but split XP more ways — the XP bonus per member offsets this to encourage grouping."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Size" hint="Maximum players in a group. 5 is the classic party size. Larger groups (8-10) suit raid-style content.">
            <NumberInput
              value={g.maxSize}
              onCommit={(v) => patch({ maxSize: v ?? 5 })}
              min={2}
            />
          </FieldRow>
          <FieldRow label="Invite Timeout" hint="Milliseconds before a group invite expires. 60000ms (1 minute) is standard. Shorter timeouts prevent stale invites.">
            <NumberInput
              value={g.inviteTimeoutMs}
              onCommit={(v) => patch({ inviteTimeoutMs: v ?? 60000 })}
              min={1000}
            />
          </FieldRow>
          <FieldRow label="XP Bonus / Member" hint="Fractional XP bonus per additional group member. 0.1 = +10% per member, so a 5-person group gets +40% total XP. Encourages grouping without making it mandatory.">
            <NumberInput
              value={g.xpBonusPerMember}
              onCommit={(v) => patch({ xpBonusPerMember: v ?? 0.1 })}
              min={0}
              step={0.01}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Friends"
        description="The friends system lets players add each other to a friends list to see online status and quickly send messages."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Friends" hint="Maximum number of friends a player can have. 50 is a reasonable default to keep lists manageable.">
            <NumberInput
              value={config.friends.maxFriends}
              onCommit={(v) => onChange({ friends: { ...config.friends, maxFriends: v ?? 50 } })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Guild Settings"
        description="Guilds are persistent player organizations. The founder rank is assigned to the guild creator, and new members receive the default rank. Configure rank names and permissions below."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Founder Rank" hint="Rank automatically assigned to the player who creates a new guild. Should have all permissions.">
            <SelectInput
              value={config.guild.founderRank}
              onCommit={(v) => onChange({ guild: { ...config.guild, founderRank: v } })}
              options={Object.keys(config.guildRanks).map((id) => ({
                value: id,
                label: config.guildRanks[id]!.displayName,
              }))}
            />
          </FieldRow>
          <FieldRow label="Default Rank" hint="Rank given to new guild members when they join. Should have minimal permissions.">
            <SelectInput
              value={config.guild.defaultRank}
              onCommit={(v) => onChange({ guild: { ...config.guild, defaultRank: v } })}
              options={Object.keys(config.guildRanks).map((id) => ({
                value: id,
                label: config.guildRanks[id]!.displayName,
              }))}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<GuildRankDefinition>
        title="Guild Ranks"
        items={config.guildRanks}
        onItemsChange={(guildRanks) => onChange({ guildRanks })}
        placeholder="New rank"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(r) => r.displayName}
        defaultItem={defaultGuildRankDefinition}
        renderSummary={(_id, r) => summarizeGuildRank(r)}
        renderDetail={(_id, r, patchRank) => (
          <GuildRankDetail rank={r} patchRank={patchRank} togglePermission={togglePermission} />
        )}
      />
    </>
  );
}
