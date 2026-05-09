import type { ReputationTier } from "@/types/config";
import { DEFAULT_REPUTATION_TIERS } from "@/types/config";
import { ActionButton, TextInput, NumberInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "./SectionCard";
import { GripIcon, PlusIcon, TrashIcon } from "./icons";

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface ReputationTiersTableProps {
  tiers: ReputationTier[] | undefined;
  onChange: (tiers: ReputationTier[] | undefined) => void;
}

export function ReputationTiersTable({ tiers, onChange }: ReputationTiersTableProps) {
  const effective = tiers && tiers.length > 0 ? tiers : DEFAULT_REPUTATION_TIERS;
  const isDefault = !tiers || tiers.length === 0;

  const patchTier = (index: number, p: Partial<ReputationTier>) => {
    const next = [...effective];
    next[index] = { ...next[index]!, ...p };
    next.sort((a, b) => a.minReputation - b.minReputation);
    onChange(next);
  };

  const addTier = () => {
    const last = effective[effective.length - 1];
    const next: ReputationTier = {
      id: `tier_${effective.length + 1}`,
      label: `Tier ${effective.length + 1}`,
      minReputation: (last?.minReputation ?? 0) + 5000,
    };
    onChange([...effective, next]);
  };

  const deleteTier = (index: number) => {
    if (effective.length <= 2) return;
    onChange(effective.filter((_, i) => i !== index));
  };

  const resetToDefaults = () => onChange(undefined);

  return (
    <SectionCard
      title="Reputation Tiers"
      description="Named bands of standing. Each tier covers everything from its threshold up to the next one. Referenced by reputation gates on shops and quests."
      actions={
        <div className="flex items-center gap-1.5">
          {!isDefault && (
            <ActionButton variant="ghost" size="sm" onClick={resetToDefaults}>
              Reset
            </ActionButton>
          )}
          <ActionButton variant="primary" size="sm" onClick={addTier}>
            <PlusIcon />
            Add Tier
          </ActionButton>
        </div>
      }
    >
      <div className="overflow-hidden rounded-xl border border-[var(--chrome-stroke)]">
        <table className="w-full text-xs">
          <thead className="bg-[var(--chrome-fill-soft)]">
            <tr className="text-left">
              <th className="w-6 px-2 py-1.5"></th>
              <th className="px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Name
              </th>
              <th className="px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Key
              </th>
              <th className="px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Threshold
              </th>
              <th className="px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Range
              </th>
              <th className="w-8 px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {effective.map((tier, i) => {
              const nextMin = effective[i + 1]?.minReputation;
              return (
                <tr
                  key={i}
                  className="border-t border-[var(--chrome-stroke)] hover:bg-[var(--chrome-fill-soft)]"
                >
                  <td className="px-2 py-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 cursor-grab items-center justify-center text-text-muted/50"
                      title="Drag to reorder (sorted by threshold)"
                    >
                      <GripIcon className="h-3 w-3" />
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={tier.label}
                      onCommit={(v) => patchTier(i, { label: v })}
                      placeholder="Label"
                      dense
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={tier.id}
                      onCommit={(v) => patchTier(i, { id: normalizeId(v) })}
                      placeholder="id"
                      dense
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumberInput
                      value={tier.minReputation}
                      onCommit={(v) => patchTier(i, { minReputation: v ?? 0 })}
                      dense
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-2xs text-text-muted/70">
                    {nextMin != null ? `→ ${nextMin - 1}` : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => deleteTier(i)}
                      disabled={effective.length <= 2}
                      aria-label={`Delete ${tier.label}`}
                      title={effective.length <= 2 ? "Need at least 2 tiers" : "Delete tier"}
                      className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isDefault && (
        <p className="mt-2 text-2xs italic text-text-muted/70">
          Using built-in defaults. Edit any value to override.
        </p>
      )}
    </SectionCard>
  );
}
