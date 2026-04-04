import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { EffectEntry } from "@/types/admin";

const StatRow = memo(function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
});

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-panel-light p-4 shadow-section">
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
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {effect.displayName}
          </span>
          <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
            {effect.effectType}
          </span>
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
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">{effect.displayName}</h3>
        <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
          {effect.effectType}
        </span>
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
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No effects found</p>
          <p className="mt-1 text-sm text-text-muted">
            The server has no status effects registered.
          </p>
        </div>
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
