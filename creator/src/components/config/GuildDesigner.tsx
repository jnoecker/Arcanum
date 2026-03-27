import { useCallback } from "react";
import type { AppConfig, GuildRankDefinition } from "@/types/config";
import { FieldRow, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  GuildRankDetail,
  defaultGuildRankDefinition,
  summarizeGuildRank,
} from "@/components/config/panels/GroupPanel";

export function GuildDesigner({
  config,
  onChange,
  section,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  section?: "groups" | "guilds";
}) {
  const togglePermission = useCallback(
    (rank: GuildRankDefinition, perm: string, patchRank: (p: Partial<GuildRankDefinition>) => void) => {
      const perms = rank.permissions ?? [];
      if (perms.includes(perm)) {
        patchRank({ permissions: perms.filter((entry) => entry !== perm) });
      } else {
        patchRank({ permissions: [...perms, perm] });
      }
    },
    [],
  );

  const rankOptions = Object.keys(config.guildRanks).map((id) => ({
    value: id,
    label: config.guildRanks[id]!.displayName,
  }));

  const showGroups = !section || section === "groups";
  const showGuilds = !section || section === "guilds";

  return (
    <div className="flex flex-col gap-6">
      {showGroups && <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <p className="text-[11px] uppercase tracking-ui text-text-muted">Group rules</p>
          <h4 className="mt-2 font-display text-2xl text-text-primary">Party pacing</h4>
          <div className="mt-4 flex flex-col gap-1.5">
            <FieldRow label="Max Size">
              <NumberInput
                value={config.group.maxSize}
                onCommit={(v) => onChange({ group: { ...config.group, maxSize: v ?? 5 } })}
                min={2}
              />
            </FieldRow>
            <FieldRow label="Invite Timeout">
              <NumberInput
                value={config.group.inviteTimeoutMs}
                onCommit={(v) => onChange({ group: { ...config.group, inviteTimeoutMs: v ?? 60000 } })}
                min={1000}
              />
            </FieldRow>
            <FieldRow label="XP Bonus / Member">
              <NumberInput
                value={config.group.xpBonusPerMember}
                onCommit={(v) => onChange({ group: { ...config.group, xpBonusPerMember: v ?? 0.1 } })}
                min={0}
                step={0.01}
              />
            </FieldRow>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <p className="text-[11px] uppercase tracking-ui text-text-muted">Friends</p>
          <h4 className="mt-2 font-display text-2xl text-text-primary">Social reach</h4>
          <div className="mt-4 flex flex-col gap-1.5">
            <FieldRow label="Max Friends">
              <NumberInput
                value={config.friends.maxFriends}
                onCommit={(v) => onChange({ friends: { ...config.friends, maxFriends: v ?? 50 } })}
                min={1}
              />
            </FieldRow>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <p className="text-[11px] uppercase tracking-ui text-text-muted">Guild defaults</p>
          <h4 className="mt-2 font-display text-2xl text-text-primary">Rank assignment</h4>
          <div className="mt-4 flex flex-col gap-1.5">
            <FieldRow label="Founder Rank">
              <SelectInput
                value={config.guild.founderRank}
                onCommit={(v) => onChange({ guild: { ...config.guild, founderRank: v } })}
                options={rankOptions}
              />
            </FieldRow>
            <FieldRow label="Default Rank">
              <SelectInput
                value={config.guild.defaultRank}
                onCommit={(v) => onChange({ guild: { ...config.guild, defaultRank: v } })}
                options={rankOptions}
              />
            </FieldRow>
          </div>
        </div>
      </div>}

      {showGuilds && <DefinitionWorkbench
        title="Guild rank designer"
        countLabel="Guild ranks"
        description="Define hierarchy, authority, and permission bundles for player organizations."
        addPlaceholder="New guild rank id"
        searchPlaceholder="Search guild ranks"
        emptyMessage="No guild ranks match the current search."
        items={config.guildRanks}
        defaultItem={defaultGuildRankDefinition}
        getDisplayName={(rank) => rank.displayName}
        renderSummary={summarizeGuildRank}
        renderBadges={(rank) => rank.permissions?.length ? [`${rank.permissions.length} perms`] : ["No perms"]}
        renderDetail={(rank, patch) => (
          <GuildRankDetail rank={rank} patchRank={patch} togglePermission={togglePermission} />
        )}
        onItemsChange={(guildRanks) => onChange({ guildRanks })}
      />}
    </div>
  );
}
