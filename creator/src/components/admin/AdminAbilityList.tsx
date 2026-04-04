import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { AbilityEntry } from "@/types/admin";

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

const AbilityRow = memo(function AbilityRow({
  ability,
  onSelect,
}: {
  ability: AbilityEntry;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(ability.id)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {ability.displayName}
          </span>
          <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
            {ability.effectType}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs">
          <span className="text-text-muted">
            Mana {ability.manaCost}
          </span>
          <span className="text-text-muted">
            CD {(ability.cooldownMs / 1000).toFixed(1)}s
          </span>
          <span className="text-text-muted">Lv {ability.levelRequired}</span>
          {ability.requiredClass && (
            <span className="text-stellar-blue">{ability.requiredClass}</span>
          )}
        </div>
      </div>
    </button>
  );
});

function AbilityDetail({
  ability,
  onBack,
}: {
  ability: AbilityEntry;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">{ability.displayName}</h3>
        <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
          {ability.effectType}
        </span>
      </div>

      {ability.description && (
        <p className="text-sm leading-6 text-text-secondary">{ability.description}</p>
      )}

      <Section title="Properties">
        <StatRow label="Display Name" value={ability.displayName} />
        <StatRow label="Effect Type" value={ability.effectType} />
        <StatRow label="Target Type" value={ability.targetType} />
        <StatRow label="Mana Cost" value={ability.manaCost} />
        <StatRow label="Cooldown" value={`${(ability.cooldownMs / 1000).toFixed(1)}s`} />
        <StatRow label="Level Required" value={ability.levelRequired} />
        {ability.requiredClass && (
          <StatRow label="Required Class" value={ability.requiredClass} />
        )}
      </Section>
    </div>
  );
}

export function AdminAbilityList() {
  const abilities = useAdminStore((s) => s.abilities);
  const selectedAbility = useAdminStore((s) => s.selectedAbility);
  const fetchAbilities = useAdminStore((s) => s.fetchAbilities);
  const fetchAbilityDetail = useAdminStore((s) => s.fetchAbilityDetail);
  const clearSelectedAbility = useAdminStore((s) => s.clearSelectedAbility);

  useEffect(() => {
    fetchAbilities();
  }, [fetchAbilities]);

  if (selectedAbility) {
    return <AbilityDetail ability={selectedAbility} onBack={clearSelectedAbility} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Abilities</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered abilities. Click to inspect.
          </p>
        </div>
        <span className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {abilities.length} registered
        </span>
      </div>

      {abilities.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No abilities found</p>
          <p className="mt-1 text-sm text-text-muted">
            The server has no abilities registered.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {abilities.map((a) => (
            <AbilityRow key={a.id} ability={a} onSelect={fetchAbilityDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
