import { useMemo, memo } from "react";
import type { ReputationRequirement } from "@/types/world";
import { useConfigStore } from "@/stores/configStore";
import { getTiers } from "@/lib/reputationTiers";
import {
  Section,
  FieldRow,
  SelectInput,
  NumberInput,
  IconButton,
} from "@/components/ui/FormWidgets";

interface ReputationGateEditorProps {
  value: ReputationRequirement | undefined;
  onChange: (next: ReputationRequirement | undefined) => void;
  /** Section label — defaults to "Reputation gate". */
  label?: string;
  /** Section hint — renders inside the Section. */
  hint?: string;
}

export const ReputationGateEditor = memo(function ReputationGateEditor({
  value,
  onChange,
  label = "Reputation gate",
  hint,
}: ReputationGateEditorProps) {
  const factions = useConfigStore((s) => s.config?.factions);

  const factionOptions = useMemo(() => {
    const defs = factions?.definitions ?? {};
    return Object.entries(defs).map(([id, def]) => ({
      value: id,
      label: def.name || id,
    }));
  }, [factions]);

  const tierOptions = useMemo(() => {
    const tiers = getTiers(factions);
    return tiers.map((t) => ({
      value: String(t.minReputation),
      label: `${t.label} (${t.minReputation >= 0 ? "+" : ""}${t.minReputation})`,
    }));
  }, [factions]);

  if (factionOptions.length === 0) {
    return (
      <Section title={label} defaultExpanded={false}>
        <p className="text-2xs italic text-text-muted/70">
          No factions defined. Add one in the Factions panel to enable gating.
        </p>
      </Section>
    );
  }

  if (!value) {
    return (
      <Section title={label} defaultExpanded={false}>
        {hint && <p className="mb-2 text-2xs text-text-muted/70">{hint}</p>}
        <button
          type="button"
          onClick={() =>
            onChange({ faction: factionOptions[0]!.value, min: 0 })
          }
          className="focus-ring self-start rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          + Add rep gate
        </button>
      </Section>
    );
  }

  const handleMinSelect = (raw: string) => {
    const min = raw === "" ? undefined : Number(raw);
    onChange({ ...value, min });
  };

  return (
    <Section
      title={label}
      defaultExpanded={true}
      actions={
        <IconButton
          onClick={() => onChange(undefined)}
          title="Remove rep gate"
          danger
        >
          &times;
        </IconButton>
      }
    >
      {hint && <p className="mb-2 text-2xs text-text-muted/70">{hint}</p>}
      <FieldRow label="Faction">
        <SelectInput
          value={value.faction}
          options={factionOptions}
          onCommit={(v) => onChange({ ...value, faction: v })}
        />
      </FieldRow>
      <FieldRow label="Min tier" hint="Lowest reputation tier the player needs.">
        <SelectInput
          value={value.min != null ? String(value.min) : ""}
          options={[{ value: "", label: "— any —" }, ...tierOptions]}
          onCommit={handleMinSelect}
          allowEmpty
        />
      </FieldRow>
      <FieldRow
        label="Max rep"
        hint="Optional ceiling. Use for enemies-only content (e.g. rebel quests that disappear once you're Honored with the crown)."
      >
        <NumberInput
          value={value.max}
          onCommit={(v) => onChange({ ...value, max: v })}
          placeholder="— none —"
        />
      </FieldRow>
    </Section>
  );
});
