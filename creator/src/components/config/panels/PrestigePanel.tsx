import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput, CheckboxInput, IconButton } from "@/components/ui/FormWidgets";

export function PrestigePanel({ config, onChange }: ConfigPanelProps) {
  const prestige = config.prestige ?? { enabled: false, xpCostBase: 500000, xpCostMultiplier: 1.5, maxRank: 20, perks: {} };
  const patch = (p: Partial<typeof prestige>) =>
    onChange({ prestige: { ...prestige, ...p } } as Partial<AppConfig>);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Prestige System">
        <div className="flex flex-col gap-3">
          <CheckboxInput label="Enabled" checked={prestige.enabled} onCommit={(v) => patch({ enabled: v })} />
          <FieldRow label="XP Cost (Rank 1)">
            <NumberInput value={prestige.xpCostBase} onCommit={(v) => patch({ xpCostBase: v ?? 500000 })} />
          </FieldRow>
          <FieldRow label="Cost Multiplier" hint="Each rank costs this much more than the previous">
            <NumberInput value={prestige.xpCostMultiplier} onCommit={(v) => patch({ xpCostMultiplier: v ?? 1.5 })} />
          </FieldRow>
          <FieldRow label="Max Rank">
            <NumberInput value={prestige.maxRank} onCommit={(v) => patch({ maxRank: v ?? 20 })} />
          </FieldRow>
        </div>
      </Section>

      <Section title="Perks">
        <div className="flex flex-col gap-2">
          {Object.entries(prestige.perks).map(([rank, perk]) => (
            <div key={rank} className="flex items-center gap-2 rounded border border-border-muted bg-bg-primary p-2">
              <span className="w-8 shrink-0 text-center text-xs font-medium text-accent">{rank}</span>
              <TextInput value={perk.type} onCommit={(v) => {
                const perks = { ...prestige.perks, [rank]: { ...perk, type: v } };
                patch({ perks });
              }} placeholder="STAT_BONUS" />
              <TextInput value={perk.description ?? ""} onCommit={(v) => {
                const perks = { ...prestige.perks, [rank]: { ...perk, description: v || undefined } };
                patch({ perks });
              }} placeholder="Description" />
              <IconButton onClick={() => {
                const perks = { ...prestige.perks };
                delete perks[rank];
                patch({ perks });
              }} title="Remove">&times;</IconButton>
            </div>
          ))}
          <button
            onClick={() => {
              const nextRank = String(Object.keys(prestige.perks).length + 1);
              patch({ perks: { ...prestige.perks, [nextRank]: { type: "STAT_BONUS", description: "" } } });
            }}
            className="self-start rounded border border-border-default px-3 py-1 text-2xs text-text-secondary hover:bg-bg-tertiary"
          >
            + Add Perk
          </button>
        </div>
      </Section>
    </div>
  );
}
