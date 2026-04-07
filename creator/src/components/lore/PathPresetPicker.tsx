import { ENTRANCE_PRESETS, EXIT_PRESETS } from "@/lib/movementPresets";
import type { MovementPreset } from "@/lib/movementPresets";
import type { SceneEntity } from "@/types/story";

interface PathPresetPickerProps {
  entities: SceneEntity[];
  selectedEntityId: string | null;
  onUpdateEntity: (entityId: string, patch: Partial<SceneEntity>) => void;
}

interface PresetDropdownProps {
  label: string;
  ariaLabel: string;
  presets: MovementPreset[];
  value: string | undefined;
  onChange: (presetId: string | undefined) => void;
}

function PresetDropdown({ label, ariaLabel, presets, value, onChange }: PresetDropdownProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-xs text-text-muted">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        aria-label={ariaLabel}
        className="w-full min-w-0 rounded-md border border-border-muted bg-bg-elevated px-3 py-1.5 font-body text-xs text-text-primary outline-none transition-colors duration-[180ms] hover:border-border-default focus:border-border-focus sm:max-w-[160px]"
      >
        <option value="">None</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PathPresetPicker({
  entities,
  selectedEntityId,
  onUpdateEntity,
}: PathPresetPickerProps) {
  if (entities.length === 0) {
    return (
      <p className="font-body text-xs text-text-muted italic">
        Add entities to set movement paths
      </p>
    );
  }

  const selectedEntity = selectedEntityId
    ? entities.find((entity) => entity.id === selectedEntityId)
    : undefined;

  if (!selectedEntity) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="font-display text-sm uppercase tracking-[0.18em] text-text-muted">
          Movement Paths
        </h4>
        <p className="font-body text-xs text-text-muted italic">
          Select an entity to set movement paths
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-display text-sm uppercase tracking-[0.18em] text-text-muted">
        Movement Paths
      </h4>
      <div className="flex flex-col gap-2 sm:flex-row">
        <PresetDropdown
          label="Entrance"
          ariaLabel="Entity entrance path"
          presets={ENTRANCE_PRESETS}
          value={selectedEntity.entrancePath}
          onChange={(presetId) => onUpdateEntity(selectedEntity.id, { entrancePath: presetId })}
        />
        <PresetDropdown
          label="Exit"
          ariaLabel="Entity exit path"
          presets={EXIT_PRESETS}
          value={selectedEntity.exitPath}
          onChange={(presetId) => onUpdateEntity(selectedEntity.id, { exitPath: presetId })}
        />
      </div>
    </div>
  );
}
