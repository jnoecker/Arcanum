import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { ActionButton, Badge, EmptyState } from "@/components/ui/FormWidgets";
import type { EffectEntry } from "@/types/admin";

const StatRow = memo(function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
});

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
      <h4 className="mb-2 text-2xs uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

const EffectRow = memo(function EffectRow({
  effect,
  onSelect,
}: {
  effect: EffectEntry;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(effect.id)}
      className="admin-list-item"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {effect.displayName}
          </span>
          <Badge variant="info">
            {effect.effectType}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs">
          <span className="text-text-muted">
            {(effect.durationMs / 1000).toFixed(1)}s
          </span>
          <span className="text-text-muted">{effect.stackBehavior}</span>
          <span className="text-text-muted">Max {effect.maxStacks}</span>
        </div>
      </div>
    </button>
  );
});

function EffectDetail({
  effect,
  onBack,
}: {
  effect: EffectEntry;
  onBack: () => void;
}) {
  const statModEntries = Object.entries(effect.statMods);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ActionButton variant="ghost" size="sm" onClick={onBack}>
          &#x2190; Back
        </ActionButton>
        <h3 className="font-display text-xl text-text-primary">{effect.displayName}</h3>
        <Badge variant="info">
          {effect.effectType}
        </Badge>
      </div>

      <Section title="Properties">
        <StatRow label="Display Name" value={effect.displayName} />
        <StatRow label="Effect Type" value={effect.effectType} />
        <StatRow label="Duration" value={`${(effect.durationMs / 1000).toFixed(1)}s`} />
        <StatRow label="Tick Interval" value={`${(effect.tickIntervalMs / 1000).toFixed(1)}s`} />
        <StatRow label="Tick Value" value={`${effect.tickMinValue} - ${effect.tickMaxValue}`} />
        <StatRow label="Shield Amount" value={effect.shieldAmount} />
        <StatRow label="Stack Behavior" value={effect.stackBehavior} />
        <StatRow label="Max Stacks" value={effect.maxStacks} />
      </Section>

      {statModEntries.length > 0 && (
        <Section title="Stat Modifiers">
          {statModEntries.map(([stat, mod]) => (
            <StatRow
              key={stat}
              label={stat}
              value={mod > 0 ? `+${mod}` : String(mod)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

export function AdminEffectList() {
  const effects = useAdminStore((s) => s.effects);
  const selectedEffect = useAdminStore((s) => s.selectedEffect);
  const fetchEffects = useAdminStore((s) => s.fetchEffects);
  const fetchEffectDetail = useAdminStore((s) => s.fetchEffectDetail);
  const clearSelectedEffect = useAdminStore((s) => s.clearSelectedEffect);

  useEffect(() => {
    fetchEffects();
  }, [fetchEffects]);

  if (selectedEffect) {
    return <EffectDetail effect={selectedEffect} onBack={clearSelectedEffect} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Effects</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered status effects. Click to inspect.
          </p>
        </div>
        <span className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {effects.length} registered
        </span>
      </div>

      {effects.length === 0 ? (
        <EmptyState title="No effects found" description="The server has no status effects registered." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {effects.map((e) => (
            <EffectRow key={e.id} effect={e} onSelect={fetchEffectDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
