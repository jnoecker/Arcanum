import type { ReputationTier } from "@/types/config";
import { DEFAULT_REPUTATION_TIERS } from "@/types/config";
import { ActionButton, TextInput, NumberInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, TrashIcon } from "@/components/config/icons";
import reputation1 from "@/assets/ui/reputation/reputation-1.png";
import reputation2 from "@/assets/ui/reputation/reputation-2.png";
import reputation3 from "@/assets/ui/reputation/reputation-3.png";
import reputation4 from "@/assets/ui/reputation/reputation-4.png";
import reputation5 from "@/assets/ui/reputation/reputation-5.png";
import reputation6 from "@/assets/ui/reputation/reputation-6.png";
import reputation7 from "@/assets/ui/reputation/reputation-7.png";
import reputation8 from "@/assets/ui/reputation/reputation-8.png";
import reputation9 from "@/assets/ui/reputation/reputation-9.png";
import reputation10 from "@/assets/ui/reputation/reputation-10.png";

const REPUTATION_TIER_ICONS = [
  reputation1,
  reputation2,
  reputation3,
  reputation4,
  reputation5,
  reputation6,
  reputation7,
  reputation8,
  reputation9,
  reputation10,
] as const;

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function derivedTierId(label: string, index: number, tiers: ReputationTier[]): string {
  const base = normalizeId(label) || `tier_${index + 1}`;
  const used = new Set(tiers.map((tier, i) => (i === index ? "" : tier.id)));
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function formatRep(value: number): string {
  return value.toLocaleString("en-US");
}

function formatUpperBound(value: number | undefined): string {
  return value == null ? "No ceiling" : formatRep(value - 1);
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

  const patchTitle = (index: number, label: string) => {
    const trimmed = label.trim() || `Tier ${index + 1}`;
    patchTier(index, {
      label: trimmed,
      id: derivedTierId(trimmed, index, effective),
    });
  };

  const addTier = () => {
    const last = effective[effective.length - 1];
    const label = `Tier ${effective.length + 1}`;
    const next: ReputationTier = {
      id: derivedTierId(label, effective.length, effective),
      label,
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
      description="Named bands of standing. Each tier runs from its threshold up to the next. Shops and quests gate on these names."
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
      <div className="overflow-x-auto rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]">
        <div className="min-w-[31rem]">
          <div className="grid grid-cols-[3.25rem_minmax(9rem,1fr)_7.5rem_7.5rem_2rem] items-center border-b border-[var(--chrome-stroke)] px-2 py-1.5 font-display text-3xs font-semibold uppercase tracking-wider text-text-muted">
            <span>Tier</span>
            <span>Title</span>
            <span>From</span>
            <span>Up to</span>
            <span aria-hidden="true" />
          </div>

          <div className="divide-y divide-[var(--chrome-stroke)]">
            {effective.map((tier, i) => {
              const nextMin = effective[i + 1]?.minReputation;
              const icon = REPUTATION_TIER_ICONS[Math.min(i, REPUTATION_TIER_ICONS.length - 1)];
              return (
                <div
                  key={`${tier.id}-${i}`}
                  className="grid grid-cols-[3.25rem_minmax(9rem,1fr)_7.5rem_7.5rem_2rem] items-center gap-2 px-2 py-2 transition hover:bg-[var(--chrome-highlight)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.18),transparent_64%)]">
                    <img
                      src={icon}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.18)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <TextInput
                      value={tier.label}
                      onCommit={(v) => patchTitle(i, v)}
                      placeholder="Title"
                      dense
                    />
                  </div>

                  <NumberInput
                    value={tier.minReputation}
                    onCommit={(v) => patchTier(i, { minReputation: v ?? 0 })}
                    dense
                  />

                  <div className="whitespace-nowrap rounded-md border border-[var(--chrome-stroke)] bg-[var(--bg-panel)] px-2 py-1.5 font-mono text-2xs text-text-muted/80">
                    {formatUpperBound(nextMin)}
                  </div>

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
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {isDefault && (
        <p className="mt-2 text-2xs italic text-text-muted/70">
          Showing the default ladder. Edit any title or threshold to make it your own.
        </p>
      )}
    </SectionCard>
  );
}
