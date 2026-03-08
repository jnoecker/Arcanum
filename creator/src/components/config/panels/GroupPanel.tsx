import { useCallback } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { GuildRankDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const GUILD_PERMISSIONS = [
  "invite", "kick", "promote", "demote", "disband", "set_motd",
];

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
      <Section title="Group Settings">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Size">
            <NumberInput
              value={g.maxSize}
              onCommit={(v) => patch({ maxSize: v ?? 5 })}
              min={2}
            />
          </FieldRow>
          <FieldRow label="Invite Timeout">
            <NumberInput
              value={g.inviteTimeoutMs}
              onCommit={(v) => patch({ inviteTimeoutMs: v ?? 60000 })}
              min={1000}
            />
          </FieldRow>
          <FieldRow label="XP Bonus / Member">
            <NumberInput
              value={g.xpBonusPerMember}
              onCommit={(v) => patch({ xpBonusPerMember: v ?? 0.1 })}
              min={0}
              step={0.01}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Guild Settings">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Founder Rank">
            <SelectInput
              value={config.guild.founderRank}
              onCommit={(v) => onChange({ guild: { ...config.guild, founderRank: v } })}
              options={Object.keys(config.guildRanks).map((id) => ({
                value: id,
                label: config.guildRanks[id]!.displayName,
              }))}
            />
          </FieldRow>
          <FieldRow label="Default Rank">
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
        defaultItem={(raw) => ({ displayName: raw, level: 0 })}
        renderSummary={(_id, r) => `level ${r.level}`}
        renderDetail={(_id, r, patchRank) => (
          <>
            <FieldRow label="Display Name">
              <TextInput
                value={r.displayName}
                onCommit={(v) => patchRank({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Level">
              <NumberInput
                value={r.level}
                onCommit={(v) => patchRank({ level: v ?? 0 })}
              />
            </FieldRow>
            <div className="mt-1 border-t border-border-muted pt-1.5">
              <h5 className="mb-1 text-[10px] font-display uppercase tracking-widest text-text-muted">
                Permissions
              </h5>
              <div className="flex flex-wrap gap-1">
                {GUILD_PERMISSIONS.map((perm) => {
                  const has = (r.permissions ?? []).includes(perm);
                  return (
                    <button
                      key={perm}
                      onClick={() => togglePermission(r, perm, patchRank)}
                      className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
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
        )}
      />
    </>
  );
}
