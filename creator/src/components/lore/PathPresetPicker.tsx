import { useState, useEffect, useCallback, useRef } from "react";
import { ENTRANCE_PRESETS, EXIT_PRESETS } from "@/lib/movementPresets";
import type { MovementPreset } from "@/lib/movementPresets";
import type { SceneEntity } from "@/types/story";

// ─── Types ────────────────────────────────────────────────────────

interface PathPresetPickerProps {
  entities: SceneEntity[];
  selectedEntityId: string | null;
  onUpdateEntity: (entityId: string, patch: Partial<SceneEntity>) => void;
}

// ─── Reusable preset dropdown ─────────────────────────────────────

interface PresetDropdownProps {
  label: string;
  ariaLabel: string;
  presets: MovementPreset[];
  value: string | undefined;
  onChange: (presetId: string | undefined) => void;
}

function PresetDropdown({ label, ariaLabel, presets, value, onChange }: PresetDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = useCallback(
    (presetId: string | undefined) => {
      onChange(presetId);
      setOpen(false);
    },
    [onChange],
  );

  const selectedPreset = presets.find((p) => p.id === value);
  const displayLabel = selectedPreset?.label ?? "None";

  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-xs text-text-muted">{label}</span>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          role="listbox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="flex items-center justify-between gap-2 w-[160px] border border-border-muted rounded-md px-3 py-1.5 font-body text-xs cursor-pointer hover:border-border-default transition-colors duration-[180ms]"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span
            className={selectedPreset ? "text-text-primary truncate" : "text-text-muted italic truncate"}
          >
            {displayLabel}
          </span>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-text-muted shrink-0">
            <path
              d="M1.5 3L4 5.5L6.5 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full mt-1 left-0 w-[160px] bg-bg-elevated border border-border-muted rounded-md shadow-[0_8px_32px_rgba(4,6,18,0.7)] z-50">
            {/* None option */}
            <div
              role="option"
              aria-selected={!value}
              className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-hover transition-colors duration-[180ms] ${
                !value ? "text-accent" : "text-text-muted italic"
              }`}
              onClick={() => handleSelect(undefined)}
            >
              <span className="font-body text-xs italic">None</span>
              {!value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            {/* Preset options */}
            {presets.map((preset) => {
              const selected = preset.id === value;
              return (
                <div
                  key={preset.id}
                  role="option"
                  aria-selected={selected}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-hover transition-colors duration-[180ms] ${
                    selected ? "text-accent" : "text-text-primary"
                  }`}
                  onClick={() => handleSelect(preset.id)}
                >
                  <span className="font-body text-xs truncate">{preset.label}</span>
                  {selected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PathPresetPicker ─────────────────────────────────────────────

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

  // Determine which entity to show controls for
  const selectedEntity = selectedEntityId
    ? entities.find((e) => e.id === selectedEntityId)
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
      <div className="flex gap-2">
        <PresetDropdown
          label="Entrance"
          ariaLabel="Entity entrance path"
          presets={ENTRANCE_PRESETS}
          value={selectedEntity.entrancePath}
          onChange={(presetId) =>
            onUpdateEntity(selectedEntity.id, { entrancePath: presetId })
          }
        />
        <PresetDropdown
          label="Exit"
          ariaLabel="Entity exit path"
          presets={EXIT_PRESETS}
          value={selectedEntity.exitPath}
          onChange={(presetId) =>
            onUpdateEntity(selectedEntity.id, { exitPath: presetId })
          }
        />
      </div>
    </div>
  );
}
