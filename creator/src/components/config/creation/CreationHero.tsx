import type { AppConfig } from "@/types/config";
import { NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "../panels/factions/SectionCard";

interface CreationHeroProps {
  config: AppConfig;
  onPatch: (p: Partial<AppConfig["characterCreation"]>) => void;
}

export function CreationHero({ config, onPatch }: CreationHeroProps) {
  const cc = config.characterCreation;

  const raceOptions = Object.entries(config.races).map(([id, r]) => ({
    value: id,
    label: r.displayName || id,
  }));
  const classOptions = Object.entries(config.classes).map(([id, c]) => ({
    value: id,
    label: c.displayName || id,
  }));
  const genderOptions = Object.entries(config.genders).map(([id, g]) => ({
    value: id,
    label: g.displayName || id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-3xl font-semibold text-text-primary">
          Creation
        </h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-secondary">
          Configure baseline economy and new-character defaults.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Starting Resources"
          description="Set the baseline economy for new characters."
        >
          <div className="flex flex-col gap-2">
            <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
              Starting Gold
            </span>
            <NumberInput
              value={cc.startingGold}
              onCommit={(v) => onPatch({ startingGold: v ?? 0 })}
              min={0}
              dense
            />
            <p className="text-2xs leading-snug text-text-muted/80">
              Gold given to new characters. <code className="text-text-muted">0</code> = earn everything.{" "}
              <br className="hidden sm:inline" />
              <code className="text-text-muted">50–100</code> = enough for a basic weapon.{" "}
              <code className="text-text-muted">500+</code> = well-equipped start.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="New-Player Defaults"
          description="Pre-selected values for new accounts."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DefaultField
              label="Default Race"
              value={cc.defaultRace ?? ""}
              options={raceOptions}
              onCommit={(v) => onPatch({ defaultRace: v || undefined })}
              placeholder="None"
            />
            <DefaultField
              label="Default Class"
              value={cc.defaultClass ?? ""}
              options={classOptions}
              onCommit={(v) => onPatch({ defaultClass: v || undefined })}
              placeholder="None"
            />
            <DefaultField
              label="Default Gender"
              value={cc.defaultGender ?? ""}
              options={genderOptions}
              onCommit={(v) => onPatch({ defaultGender: v || undefined })}
              placeholder="None"
            />
          </div>
          <p className="mt-3 text-2xs leading-snug text-text-muted/80">
            Players can still choose during character creation, but these set
            the initial selection.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

function DefaultField({
  label,
  value,
  options,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <SelectInput
        value={value}
        options={options}
        onCommit={onCommit}
        allowEmpty
        placeholder={placeholder ?? "(none)"}
        dense
      />
    </div>
  );
}
