import { useState, useCallback, useMemo, useEffect } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type {
  WeatherTypeDefinition,
  EnvironmentTheme,
  MoteColor,
  SkyGradient,
  TimePeriod,
} from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { useZoneStore } from "@/stores/zoneStore";

// ─── Constants ────────────────────────────────────────────────────

const TIME_PERIODS: TimePeriod[] = ["DAWN", "DAY", "DUSK", "NIGHT"];

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  DAWN: "Dawn",
  DAY: "Day",
  DUSK: "Dusk",
  NIGHT: "Night",
};

const PARTICLE_OPTIONS = [
  { value: "", label: "None" },
  { value: "rain", label: "Rain" },
  { value: "storm", label: "Storm" },
  { value: "snow", label: "Snow" },
  { value: "fog", label: "Fog" },
  { value: "wind", label: "Wind" },
];

const DEFAULT_MOTE: MoteColor = { core: "#c9a84c", glow: "#f5e6b8" };

const DEFAULT_SKY: SkyGradient = { top: "#0a0a2e", bottom: "#1a1a4e" };

// ─── Shared color-picker helper ──────────────────────────────────

function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
    else setText(value);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => {
          onChange(e.target.value);
          setText(e.target.value);
        }}
        className="h-8 w-10 cursor-pointer rounded border border-border-muted bg-bg-primary"
        aria-label={label}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="#000000"
        className="ornate-input w-24 font-mono text-xs"
        spellCheck={false}
      />
    </div>
  );
}

// ─── Mote color row ──────────────────────────────────────────────

function MoteColorRow({
  mote,
  index,
  onChange,
  onRemove,
}: {
  mote: MoteColor;
  index: number;
  onChange: (m: MoteColor) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-border-muted/40 bg-bg-primary/30 px-2 py-1.5">
      <span className="text-2xs text-text-muted w-5 shrink-0">{index + 1}</span>
      <div className="flex flex-1 items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs text-text-muted">Core</span>
          <ColorField
            value={mote.core}
            onChange={(core) => onChange({ ...mote, core })}
            label={`Mote ${index + 1} core color`}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs text-text-muted">Glow</span>
          <ColorField
            value={mote.glow}
            onChange={(glow) => onChange({ ...mote, glow })}
            label={`Mote ${index + 1} glow color`}
          />
        </div>
      </div>
      <IconButton onClick={onRemove} title="Remove mote color" danger>
        x
      </IconButton>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────

type Tab = "weather" | "theme" | "zones";

export function WeatherEnvironmentPanel({ config, onChange }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("weather");

  const w = config.weather;
  const env = config.environment;

  const patchWeather = useCallback(
    (p: Partial<AppConfig["weather"]>) => {
      onChange({ weather: { ...w, ...p } });
    },
    [w, onChange],
  );

  const patchEnv = useCallback(
    (p: Partial<AppConfig["environment"]>) => {
      onChange({ environment: { ...env, ...p } });
    },
    [env, onChange],
  );

  const patchDefaultTheme = useCallback(
    (p: Partial<EnvironmentTheme>) => {
      patchEnv({ defaultTheme: { ...env.defaultTheme, ...p } });
    },
    [env.defaultTheme, patchEnv],
  );

  return (
    <>
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-full border border-border-muted bg-bg-secondary/60 p-1">
        {(["weather", "theme", "zones"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-display tracking-wide transition-colors ${
              activeTab === tab
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab === "weather"
              ? "Weather Types"
              : tab === "theme"
                ? "Default Theme"
                : "Zone Overrides"}
          </button>
        ))}
      </div>

      {activeTab === "weather" && (
        <WeatherTab
          config={config}
          patchWeather={patchWeather}
        />
      )}
      {activeTab === "theme" && (
        <DefaultThemeTab
          theme={env.defaultTheme}
          patchTheme={patchDefaultTheme}
          weatherTypes={w.types}
        />
      )}
      {activeTab === "zones" && (
        <ZoneOverridesTab
          config={config}
          patchEnv={patchEnv}
          weatherTypes={w.types}
        />
      )}
    </>
  );
}

// ─── Tab 1: Weather Types ────────────────────────────────────────

function WeatherTab({
  config,
  patchWeather,
}: {
  config: AppConfig;
  patchWeather: (p: Partial<AppConfig["weather"]>) => void;
}) {
  const w = config.weather;

  const patchTypes = useCallback(
    (types: Record<string, WeatherTypeDefinition>) => {
      patchWeather({ types });
    },
    [patchWeather],
  );

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const types: Record<string, WeatherTypeDefinition> = {};
      for (const [k, v] of Object.entries(w.types)) {
        types[k === oldId ? newId : k] = v;
      }
      patchTypes(types);
    },
    [w.types, patchTypes],
  );

  return (
    <>
      <Section
        title="Weather Timing"
        description="Controls how frequently weather transitions occur per zone."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow
            label="Min Transition (ms)"
            hint="Minimum real-time milliseconds between weather changes."
          >
            <NumberInput
              value={w.minTransitionMs}
              onCommit={(v) =>
                patchWeather({ minTransitionMs: v ?? 300000 })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow
            label="Max Transition (ms)"
            hint="Maximum real-time milliseconds between weather changes."
          >
            <NumberInput
              value={w.maxTransitionMs}
              onCommit={(v) =>
                patchWeather({ maxTransitionMs: v ?? 900000 })
              }
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<WeatherTypeDefinition>
        title="Weather Types"
        description="Define weather types with weights and visual hints. Higher-weight types appear more frequently when the server rolls weather transitions."
        items={w.types}
        onItemsChange={patchTypes}
        onRenameId={handleRename}
        placeholder="New weather type"
        idTransform={(raw) =>
          raw.trim().toUpperCase().replace(/\s+/g, "_")
        }
        getDisplayName={(t) => t.displayName}
        defaultItem={(raw) => ({
          displayName: raw,
          weight: 1,
        })}
        renderSummary={(_id, t) => {
          const parts: string[] = [`w:${t.weight}`];
          if (t.particleHint) parts.push(t.particleHint);
          return parts.join(" | ");
        }}
        renderDetail={(_id, item, patch) => (
          <WeatherTypeDetail item={item} patch={patch} />
        )}
      />
    </>
  );
}

function WeatherTypeDetail({
  item,
  patch,
}: {
  item: WeatherTypeDefinition;
  patch: (p: Partial<WeatherTypeDefinition>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Display Name" hint="Name shown to players in weather messages.">
        <TextInput
          value={item.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Description" hint="Optional flavor text for this weather type.">
        <TextInput
          value={item.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="A gentle drizzle dampens the air..."
        />
      </FieldRow>
      <FieldRow
        label="Weight"
        hint="Relative probability weight. Higher values make this weather type more common."
      >
        <NumberInput
          value={item.weight}
          onCommit={(v) => patch({ weight: v ?? 1 })}
          min={0}
          step={0.1}
        />
      </FieldRow>
      <FieldRow
        label="Particle Hint"
        hint="Visual effect category for client rendering."
      >
        <SelectInput
          value={item.particleHint ?? ""}
          onCommit={(v) => patch({ particleHint: v || undefined })}
          options={PARTICLE_OPTIONS}
        />
      </FieldRow>
      <FieldRow label="Icon" hint="Optional icon identifier for UI display.">
        <TextInput
          value={item.icon ?? ""}
          onCommit={(v) => patch({ icon: v || undefined })}
          placeholder="cloud-rain"
        />
      </FieldRow>
    </div>
  );
}

// ─── Tab 2: Default Theme ────────────────────────────────────────

function DefaultThemeTab({
  theme,
  patchTheme,
  weatherTypes,
}: {
  theme: EnvironmentTheme;
  patchTheme: (p: Partial<EnvironmentTheme>) => void;
  weatherTypes: Record<string, WeatherTypeDefinition>;
}) {
  return (
    <>
      <MoteColorsSection
        motes={theme.moteColors}
        onChange={(moteColors) => patchTheme({ moteColors })}
      />
      <SkyGradientsSection
        gradients={theme.skyGradients}
        onChange={(skyGradients) => patchTheme({ skyGradients })}
      />
      <TransitionColorsSection
        colors={theme.transitionColors}
        onChange={(transitionColors) => patchTheme({ transitionColors })}
      />
      <WeatherParticleOverridesSection
        overrides={theme.weatherParticleOverrides ?? {}}
        onChange={(weatherParticleOverrides) =>
          patchTheme({
            weatherParticleOverrides:
              Object.keys(weatherParticleOverrides).length > 0
                ? weatherParticleOverrides
                : undefined,
          })
        }
        weatherTypes={weatherTypes}
      />
    </>
  );
}

// ─── Mote Colors Section ─────────────────────────────────────────

function MoteColorsSection({
  motes,
  onChange,
}: {
  motes: MoteColor[];
  onChange: (m: MoteColor[]) => void;
}) {
  const add = useCallback(() => {
    onChange([...motes, { ...DEFAULT_MOTE }]);
  }, [motes, onChange]);

  const update = useCallback(
    (index: number, m: MoteColor) => {
      const next = [...motes];
      next[index] = m;
      onChange(next);
    },
    [motes, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(motes.filter((_, i) => i !== index));
    },
    [motes, onChange],
  );

  return (
    <Section
      title={`Mote Colors (${motes.length})`}
      description="Ambient floating particle colors. Each mote has a solid core and a soft glow around it."
      actions={
        <IconButton onClick={add} title="Add mote color">
          +
        </IconButton>
      }
    >
      {motes.length === 0 ? (
        <p className="text-xs text-text-muted">No mote colors defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {motes.map((mote, i) => (
            <MoteColorRow
              key={i}
              mote={mote}
              index={i}
              onChange={(m) => update(i, m)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Sky Gradients Section ───────────────────────────────────────

function SkyGradientsSection({
  gradients,
  onChange,
}: {
  gradients: Partial<Record<TimePeriod, SkyGradient>>;
  onChange: (g: Partial<Record<TimePeriod, SkyGradient>>) => void;
}) {
  const patchPeriod = useCallback(
    (period: TimePeriod, g: SkyGradient | undefined) => {
      const next = { ...gradients };
      if (g) {
        next[period] = g;
      } else {
        delete next[period];
      }
      onChange(next);
    },
    [gradients, onChange],
  );

  return (
    <Section
      title="Sky Gradients"
      description="Vertical gradient colors for each time period. Top is the zenith, bottom is the horizon."
    >
      <div className="flex flex-col gap-3">
        {TIME_PERIODS.map((period) => {
          const g = gradients[period];
          const hasValue = !!g;
          return (
            <div
              key={period}
              className="rounded border border-border-muted/40 bg-bg-primary/30 px-3 py-2"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-display tracking-wide text-text-primary">
                  {TIME_PERIOD_LABELS[period]}
                </span>
                {hasValue ? (
                  <IconButton
                    onClick={() => patchPeriod(period, undefined)}
                    title={`Clear ${TIME_PERIOD_LABELS[period]} gradient`}
                    danger
                  >
                    x
                  </IconButton>
                ) : (
                  <button
                    onClick={() =>
                      patchPeriod(period, { ...DEFAULT_SKY })
                    }
                    className="text-2xs text-accent hover:text-accent/80"
                  >
                    + Set
                  </button>
                )}
              </div>
              {hasValue ? (
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-2xs text-text-muted">Top</span>
                    <ColorField
                      value={g.top}
                      onChange={(top) =>
                        patchPeriod(period, { ...g, top })
                      }
                      label={`${TIME_PERIOD_LABELS[period]} top color`}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-2xs text-text-muted">Bottom</span>
                    <ColorField
                      value={g.bottom}
                      onChange={(bottom) =>
                        patchPeriod(period, { ...g, bottom })
                      }
                      label={`${TIME_PERIOD_LABELS[period]} bottom color`}
                    />
                  </div>
                  {/* Preview swatch */}
                  <div
                    className="h-10 w-10 shrink-0 rounded border border-border-muted"
                    style={{
                      background: `linear-gradient(to bottom, ${g.top}, ${g.bottom})`,
                    }}
                    title={`${g.top} → ${g.bottom}`}
                  />
                </div>
              ) : (
                <p className="text-2xs text-text-muted">
                  Inherits from server defaults
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Transition Colors Section ───────────────────────────────────

function TransitionColorsSection({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (c: string[]) => void;
}) {
  const add = useCallback(() => {
    onChange([...colors, "#c9a84c"]);
  }, [colors, onChange]);

  const update = useCallback(
    (index: number, hex: string) => {
      const next = [...colors];
      next[index] = hex;
      onChange(next);
    },
    [colors, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(colors.filter((_, i) => i !== index));
    },
    [colors, onChange],
  );

  return (
    <Section
      title={`Transition Colors (${colors.length})`}
      description="Flash or blend colors used during time-period transitions. The client cycles through these when dawn turns to day, day to dusk, etc."
      actions={
        <IconButton onClick={add} title="Add transition color">
          +
        </IconButton>
      }
    >
      {colors.length === 0 ? (
        <p className="text-xs text-text-muted">No transition colors defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {colors.map((hex, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-border-muted/40 bg-bg-primary/30 px-2 py-1.5"
            >
              <span className="text-2xs text-text-muted w-5 shrink-0">
                {i + 1}
              </span>
              <ColorField
                value={hex}
                onChange={(v) => update(i, v)}
                label={`Transition color ${i + 1}`}
              />
              <IconButton
                onClick={() => remove(i)}
                title="Remove transition color"
                danger
              >
                x
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Weather Particle Overrides Section ──────────────────────────

function WeatherParticleOverridesSection({
  overrides,
  onChange,
  weatherTypes,
}: {
  overrides: Record<string, string>;
  onChange: (o: Record<string, string>) => void;
  weatherTypes: Record<string, WeatherTypeDefinition>;
}) {
  const weatherTypeOptions = useMemo(() => {
    const existing = new Set(Object.keys(overrides));
    return Object.keys(weatherTypes)
      .filter((id) => !existing.has(id))
      .map((id) => ({
        value: id,
        label: weatherTypes[id]?.displayName ?? id,
      }));
  }, [weatherTypes, overrides]);

  const add = useCallback(() => {
    const firstAvailable = weatherTypeOptions[0];
    if (!firstAvailable) return;
    onChange({ ...overrides, [firstAvailable.value]: "" });
  }, [overrides, onChange, weatherTypeOptions]);

  const update = useCallback(
    (key: string, value: string) => {
      onChange({ ...overrides, [key]: value });
    },
    [overrides, onChange],
  );

  const remove = useCallback(
    (key: string) => {
      const next = { ...overrides };
      delete next[key];
      onChange(next);
    },
    [overrides, onChange],
  );

  const changeKey = useCallback(
    (oldKey: string, newKey: string) => {
      if (oldKey === newKey || overrides[newKey] !== undefined) return;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(overrides)) {
        next[k === oldKey ? newKey : k] = v;
      }
      onChange(next);
    },
    [overrides, onChange],
  );

  const allWeatherOptions = useMemo(
    () =>
      Object.keys(weatherTypes).map((id) => ({
        value: id,
        label: weatherTypes[id]?.displayName ?? id,
      })),
    [weatherTypes],
  );

  const entries = Object.entries(overrides);

  return (
    <Section
      title={`Weather Particle Overrides (${entries.length})`}
      description="Override the default particle effect for specific weather types in this theme. Useful for zone-specific visual variations."
      actions={
        weatherTypeOptions.length > 0 ? (
          <IconButton onClick={add} title="Add particle override">
            +
          </IconButton>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <p className="text-xs text-text-muted">
          No particle overrides — all weather types use their default hints
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded border border-border-muted/40 bg-bg-primary/30 px-2 py-1.5"
            >
              <div className="flex-1">
                <SelectInput
                  value={key}
                  onCommit={(v) => changeKey(key, v)}
                  options={[
                    ...allWeatherOptions.filter(
                      (o) => o.value === key || !overrides[o.value],
                    ),
                  ]}
                />
              </div>
              <span className="text-2xs text-text-muted">=</span>
              <div className="flex-1">
                <SelectInput
                  value={value}
                  onCommit={(v) => update(key, v)}
                  options={PARTICLE_OPTIONS}
                />
              </div>
              <IconButton
                onClick={() => remove(key)}
                title="Remove override"
                danger
              >
                x
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Tab 3: Zone Overrides ───────────────────────────────────────

function ZoneOverridesTab({
  config,
  patchEnv,
  weatherTypes,
}: {
  config: AppConfig;
  patchEnv: (p: Partial<AppConfig["environment"]>) => void;
  weatherTypes: Record<string, WeatherTypeDefinition>;
}) {
  const zones = useZoneStore((s) => s.zones);
  const env = config.environment;

  const zoneOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const [, entry] of zones) {
      const zoneId = entry.data.zone;
      if (zoneId) {
        opts.push({ value: zoneId, label: zoneId });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [zones]);

  const overrideIds = useMemo(
    () => Object.keys(env.zones).sort(),
    [env.zones],
  );

  const [selectedZone, setSelectedZone] = useState<string>(
    overrideIds[0] ?? "",
  );

  const patchZones = useCallback(
    (zones: Record<string, Partial<EnvironmentTheme>>) => {
      patchEnv({ zones });
    },
    [patchEnv],
  );

  const addOverride = useCallback(() => {
    if (!selectedZone || env.zones[selectedZone]) return;
    patchZones({ ...env.zones, [selectedZone]: {} });
  }, [selectedZone, env.zones, patchZones]);

  const removeOverride = useCallback(
    (zoneId: string) => {
      const next = { ...env.zones };
      delete next[zoneId];
      patchZones(next);
      if (selectedZone === zoneId) {
        const remaining = Object.keys(next);
        setSelectedZone(remaining[0] ?? "");
      }
    },
    [env.zones, selectedZone, patchZones],
  );

  const patchOverride = useCallback(
    (zoneId: string, p: Partial<EnvironmentTheme>) => {
      patchZones({
        ...env.zones,
        [zoneId]: { ...env.zones[zoneId], ...p },
      });
    },
    [env.zones, patchZones],
  );

  const clearField = useCallback(
    (zoneId: string, field: keyof EnvironmentTheme) => {
      const current = { ...env.zones[zoneId] };
      delete current[field];
      patchZones({ ...env.zones, [zoneId]: current });
    },
    [env.zones, patchZones],
  );

  const currentOverride = selectedZone ? env.zones[selectedZone] : undefined;
  const hasOverride = currentOverride !== undefined;

  // Zone options that don't already have overrides
  const availableZones = useMemo(
    () => zoneOptions.filter((z) => !env.zones[z.value]),
    [zoneOptions, env.zones],
  );

  return (
    <>
      <Section
        title="Zone Theme Overrides"
        description="Override default theme settings for individual zones. Unset fields inherit from the default theme."
      >
        {/* Override list */}
        {overrideIds.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {overrideIds.map((id) => (
              <button
                key={id}
                onClick={() => setSelectedZone(id)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  selectedZone === id
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-bg-secondary/60 text-text-secondary border border-border-muted/40 hover:border-border-muted hover:text-text-primary"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        )}

        {/* Add new override */}
        <div className="flex items-center gap-2 mb-3">
          {availableZones.length > 0 ? (
            <>
              <div className="flex-1">
                <SelectInput
                  value={
                    availableZones.some((z) => z.value === selectedZone)
                      ? selectedZone
                      : ""
                  }
                  onCommit={setSelectedZone}
                  options={availableZones}
                  placeholder="Select zone..."
                />
              </div>
              <button
                onClick={addOverride}
                disabled={
                  !selectedZone || !!env.zones[selectedZone]
                }
                className="rounded bg-accent/20 px-2.5 py-1 text-xs text-accent hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Override
              </button>
            </>
          ) : overrideIds.length === 0 ? (
            <p className="text-xs text-text-muted">
              Load zones to add environment overrides, or type a zone ID manually.
            </p>
          ) : null}
          {/* Manual ID entry when no zones are loaded */}
          {zoneOptions.length === 0 && (
            <ManualZoneEntry
              onAdd={(zoneId) => {
                if (!zoneId || env.zones[zoneId]) return;
                patchZones({ ...env.zones, [zoneId]: {} });
                setSelectedZone(zoneId);
              }}
            />
          )}
        </div>

        {overrideIds.length === 0 && (
          <p className="text-xs text-text-muted">
            No zone overrides configured. All zones use the default theme.
          </p>
        )}
      </Section>

      {/* Selected zone override editor */}
      {hasOverride && selectedZone && (
        <ZoneOverrideEditor
          zoneId={selectedZone}
          override={currentOverride}
          defaultTheme={env.defaultTheme}
          weatherTypes={weatherTypes}
          onPatch={(p) => patchOverride(selectedZone, p)}
          onClear={(field) => clearField(selectedZone, field)}
          onRemove={() => removeOverride(selectedZone)}
        />
      )}
    </>
  );
}

function ManualZoneEntry({ onAdd }: { onAdd: (zoneId: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-1">
      <input
        className="w-32 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        placeholder="zone_id"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <IconButton
        onClick={() => {
          onAdd(value.trim());
          setValue("");
        }}
        title="Add zone override"
      >
        +
      </IconButton>
    </div>
  );
}

// ─── Zone Override Editor ────────────────────────────────────────

function ZoneOverrideEditor({
  zoneId,
  override,
  defaultTheme,
  weatherTypes,
  onPatch,
  onClear,
  onRemove,
}: {
  zoneId: string;
  override: Partial<EnvironmentTheme>;
  defaultTheme: EnvironmentTheme;
  weatherTypes: Record<string, WeatherTypeDefinition>;
  onPatch: (p: Partial<EnvironmentTheme>) => void;
  onClear: (field: keyof EnvironmentTheme) => void;
  onRemove: () => void;
}) {
  const hasMotes = override.moteColors !== undefined;
  const hasSky = override.skyGradients !== undefined;
  const hasTransitions = override.transitionColors !== undefined;
  const hasParticles = override.weatherParticleOverrides !== undefined;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-display text-sm tracking-wide text-accent">
          {zoneId}
        </h4>
        <button
          onClick={onRemove}
          className="rounded px-2 py-0.5 text-2xs text-status-error hover:bg-status-error/10"
        >
          Remove Override
        </button>
      </div>

      {/* Mote Colors */}
      <OverrideToggleSection
        label="Mote Colors"
        enabled={hasMotes}
        onToggle={(on) => {
          if (on) {
            onPatch({ moteColors: [...defaultTheme.moteColors] });
          } else {
            onClear("moteColors");
          }
        }}
      >
        {hasMotes && (
          <MoteColorsSection
            motes={override.moteColors!}
            onChange={(moteColors) => onPatch({ moteColors })}
          />
        )}
      </OverrideToggleSection>

      {/* Sky Gradients */}
      <OverrideToggleSection
        label="Sky Gradients"
        enabled={hasSky}
        onToggle={(on) => {
          if (on) {
            onPatch({ skyGradients: { ...defaultTheme.skyGradients } });
          } else {
            onClear("skyGradients");
          }
        }}
      >
        {hasSky && (
          <SkyGradientsSection
            gradients={override.skyGradients!}
            onChange={(skyGradients) => onPatch({ skyGradients })}
          />
        )}
      </OverrideToggleSection>

      {/* Transition Colors */}
      <OverrideToggleSection
        label="Transition Colors"
        enabled={hasTransitions}
        onToggle={(on) => {
          if (on) {
            onPatch({
              transitionColors: [...defaultTheme.transitionColors],
            });
          } else {
            onClear("transitionColors");
          }
        }}
      >
        {hasTransitions && (
          <TransitionColorsSection
            colors={override.transitionColors!}
            onChange={(transitionColors) =>
              onPatch({ transitionColors })
            }
          />
        )}
      </OverrideToggleSection>

      {/* Weather Particle Overrides */}
      <OverrideToggleSection
        label="Weather Particle Overrides"
        enabled={hasParticles}
        onToggle={(on) => {
          if (on) {
            onPatch({
              weatherParticleOverrides: {
                ...(defaultTheme.weatherParticleOverrides ?? {}),
              },
            });
          } else {
            onClear("weatherParticleOverrides");
          }
        }}
      >
        {hasParticles && (
          <WeatherParticleOverridesSection
            overrides={override.weatherParticleOverrides!}
            onChange={(weatherParticleOverrides) =>
              onPatch({
                weatherParticleOverrides:
                  Object.keys(weatherParticleOverrides).length > 0
                    ? weatherParticleOverrides
                    : undefined,
              })
            }
            weatherTypes={weatherTypes}
          />
        )}
      </OverrideToggleSection>
    </div>
  );
}

function OverrideToggleSection({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded border border-border-muted/40 bg-bg-primary/20 p-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="accent-accent"
        />
        <span className="text-xs font-display tracking-wide text-text-primary">
          {label}
        </span>
        {!enabled && (
          <span className="text-2xs text-text-muted ml-1">
            — Inherits from default
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
