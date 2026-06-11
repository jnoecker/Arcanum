import { useState, useCallback, useMemo, useEffect, memo } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type {
  WeatherTypeDefinition,
  EnvironmentTheme,
  MoteColor,
  SkyGradient,
  TimePeriod,
  MobVariantDefinition,
} from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { BUILTIN_MOB_VARIANTS } from "@/lib/mobVariantDefaults";
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

const VARIANT_OVERLAY_OPTIONS = [
  { value: "", label: "None" },
  { value: "swirl", label: "Swirl" },
  { value: "embers", label: "Embers" },
  { value: "sparkle", label: "Sparkle" },
  { value: "frost", label: "Frost" },
  { value: "mist", label: "Mist" },
];

const VARIANT_RARITY_OPTIONS = [
  { value: "", label: "Unset" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "legendary", label: "Legendary" },
];

const VARIANT_ANNOUNCE_OPTIONS = [
  { value: "", label: "Default (by rarity)" },
  { value: "ROOM", label: "Room" },
  { value: "ZONE", label: "Zone" },
  { value: "SERVER", label: "Server" },
];

const DEFAULT_VARIANT_TINT = "#c9a84c";

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

const MoteColorRow = memo(function MoteColorRow({
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
});

// ─── Main panel ──────────────────────────────────────────────────

type Tab = "weather" | "cycle" | "variants" | "theme" | "zones";

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

  const patchTime = useCallback(
    (p: Partial<AppConfig["worldTime"]>) => {
      onChange({ worldTime: { ...config.worldTime, ...p } });
    },
    [config.worldTime, onChange],
  );

  const patchSeason = useCallback(
    (p: Partial<AppConfig["season"]>) => {
      onChange({ season: { ...config.season, ...p } });
    },
    [config.season, onChange],
  );

  const patchMobVariants = useCallback(
    (p: Partial<AppConfig["mobVariants"]>) => {
      onChange({ mobVariants: { ...config.mobVariants, ...p } });
    },
    [config.mobVariants, onChange],
  );

  return (
    <>
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-full border border-border-muted bg-bg-secondary/60 p-1">
        {(["weather", "cycle", "variants", "theme", "zones"] as const).map((tab) => (
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
              : tab === "cycle"
                ? "Time & Seasons"
                : tab === "variants"
                  ? "Rare Variants"
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
      {activeTab === "cycle" && (
        <CycleTab
          worldTime={config.worldTime}
          patchTime={patchTime}
          season={config.season}
          patchSeason={patchSeason}
        />
      )}
      {activeTab === "variants" && (
        <MobVariantsTab mobVariants={config.mobVariants} patch={patchMobVariants} />
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

// ─── Tab: Day/Night Cycle ────────────────────────────────────────

function CycleTab({
  worldTime: wt,
  patchTime,
  season,
  patchSeason,
}: {
  worldTime: AppConfig["worldTime"];
  patchTime: (p: Partial<AppConfig["worldTime"]>) => void;
  season: AppConfig["season"];
  patchSeason: (p: Partial<AppConfig["season"]>) => void;
}) {
  const perSeasonMin = Math.round((season.cycleLengthMs / 4 / 60000) * 10) / 10;
  return (
    <>
    <Section
      title="Day/Night Cycle"
      description="One game day cycles through dawn, day, dusk, and night. The cycle length controls how long a full day takes in real time."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Cycle Length (ms)" hint="Real-time milliseconds for one full game day. 3600000 = 1 hour.">
          <NumberInput value={wt.cycleLengthMs} onCommit={(v) => patchTime({ cycleLengthMs: v ?? 3600000 })} min={1000} />
        </FieldRow>
        <FieldRow label="Dawn Hour" hint="Game hour when dawn begins (0-23).">
          <NumberInput value={wt.dawnHour} onCommit={(v) => patchTime({ dawnHour: v ?? 5 })} min={0} max={23} />
        </FieldRow>
        <FieldRow label="Day Hour" hint="Game hour when day begins.">
          <NumberInput value={wt.dayHour} onCommit={(v) => patchTime({ dayHour: v ?? 8 })} min={0} max={23} />
        </FieldRow>
        <FieldRow label="Dusk Hour" hint="Game hour when dusk begins.">
          <NumberInput value={wt.duskHour} onCommit={(v) => patchTime({ duskHour: v ?? 18 })} min={0} max={23} />
        </FieldRow>
        <FieldRow label="Night Hour" hint="Game hour when night begins.">
          <NumberInput value={wt.nightHour} onCommit={(v) => patchTime({ nightHour: v ?? 21 })} min={0} max={23} />
        </FieldRow>
      </div>

      <div className="mt-3 rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
        <p className="text-2xs font-display uppercase tracking-widest text-text-muted mb-2">Time Periods</p>
        <div className="grid grid-cols-4 gap-2 text-2xs">
          {[
            { label: "Dawn", from: wt.dawnHour, to: wt.dayHour - 1, color: "text-status-warning" },
            { label: "Day", from: wt.dayHour, to: wt.duskHour - 1, color: "text-warm-pale" },
            { label: "Dusk", from: wt.duskHour, to: wt.nightHour - 1, color: "text-warm" },
            { label: "Night", from: wt.nightHour, to: wt.dawnHour - 1, color: "text-accent-muted" },
          ].map((p) => (
            <div key={p.label} className="text-center">
              <span className={`font-display ${p.color}`}>{p.label}</span>
              <div className="text-text-muted">{String(p.from).padStart(2, "0")}:00–{String(((p.to % 24) + 24) % 24).padStart(2, "0")}:59</div>
            </div>
          ))}
        </div>
      </div>
    </Section>

    <Section
      title="Seasonal Cycle"
      description="One game year cycles through spring, summer, autumn, and winter. Mobs can be gated to specific seasons via their spawn conditions."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow
          label="Year Length (ms)"
          hint="Real-time milliseconds for one full game year (all four seasons). 14400000 = 4 hours."
        >
          <NumberInput
            value={season.cycleLengthMs}
            onCommit={(v) => patchSeason({ cycleLengthMs: v ?? 14_400_000 })}
            min={1000}
          />
        </FieldRow>
        <p className="text-2xs text-text-muted">
          Each season lasts about {perSeasonMin} minute{perSeasonMin === 1 ? "" : "s"} in real time.
        </p>
      </div>
    </Section>
    </>
  );
}

// ─── Tab: Rare Mob Variants ──────────────────────────────────────

function MobVariantsTab({
  mobVariants: mv,
  patch,
}: {
  mobVariants: AppConfig["mobVariants"];
  patch: (p: Partial<AppConfig["mobVariants"]>) => void;
}) {
  const hasCustom = Object.keys(mv.variants).length > 0;

  const patchVariants = useCallback(
    (variants: Record<string, MobVariantDefinition>) => {
      patch({ variants });
    },
    [patch],
  );

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const variants: Record<string, MobVariantDefinition> = {};
      for (const [k, v] of Object.entries(mv.variants)) {
        variants[k === oldId ? newId : k] = v;
      }
      patchVariants(variants);
    },
    [mv.variants, patchVariants],
  );

  const missingBuiltins = useMemo(
    () => Object.keys(BUILTIN_MOB_VARIANTS).filter((id) => !(id in mv.variants)),
    [mv.variants],
  );

  const loadBuiltins = useCallback(() => {
    // Built-ins first, then existing entries so the author's edits win on ID clash.
    patchVariants({ ...BUILTIN_MOB_VARIANTS, ...mv.variants });
  }, [mv.variants, patchVariants]);

  return (
    <>
      <Section
        title="Rare Mob Variants"
        description="The server may spawn any eligible combat mob as a rare cosmetic variant — a tint, overlay, name prefix, and modest stat bump — so explorers always find richer sightings. Authors opt individual mobs out in the mob editor."
      >
        <div className="flex flex-col gap-2">
          <CheckboxInput
            checked={mv.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Spawn rare variants"
          />
          <FieldRow
            label="Base Chance"
            hint="Probability an eligible mob rolls as a rare variant on each spawn opportunity (cold start, zone reset, respawn, conditional spawn). 0–1; default 0.04."
          >
            <NumberInput
              value={mv.chance}
              onCommit={(v) => patch({ chance: v ?? 0.04 })}
              min={0}
              max={1}
              step={0.01}
            />
          </FieldRow>
          <p className="text-2xs text-text-muted">
            {hasCustom
              ? "This palette replaces the server's built-ins entirely — only the archetypes below can spawn. Load the built-ins to combine them with your own."
              : "No custom archetypes defined — the server's built-in palette (albino, verdant, shadow-touched, ember, glimmering, frostbound, spectral, ancient) is used and tracks future server updates. Load it below to tweak or extend it; once the palette is non-empty it fully replaces the built-ins, so include any you still want."}
          </p>
          {missingBuiltins.length > 0 && (
            <button
              onClick={loadBuiltins}
              className="self-start rounded bg-accent/20 px-2.5 py-1 text-xs text-accent hover:bg-accent/30"
            >
              {hasCustom
                ? `Add ${missingBuiltins.length} built-in archetype${missingBuiltins.length === 1 ? "" : "s"}`
                : "Load built-in palette"}
            </button>
          )}
        </div>
      </Section>

      <RegistryPanel<MobVariantDefinition>
        title="Custom Variant Palette"
        description="Define your own rare-variant archetypes. Each is chosen by relative weight when a mob rolls rare. Leaving this empty falls back to the server's built-in palette."
        items={mv.variants}
        onItemsChange={patchVariants}
        onRenameId={handleRename}
        placeholder="New variant (e.g. molten)"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(v) => v.displayName ?? ""}
        defaultItem={(raw) => ({ displayName: raw, weight: 1 })}
        renderSummary={(_id, v) => {
          const parts: string[] = [`w:${v.weight}`];
          if (v.rarity) parts.push(v.rarity);
          if (v.namePrefix) parts.push(`"${v.namePrefix.trim()}"`);
          return parts.join(" | ");
        }}
        renderDetail={(_id, item, patchItem) => (
          <MobVariantDetail item={item} patch={patchItem} />
        )}
      />
    </>
  );
}

function MobVariantDetail({
  item,
  patch,
}: {
  item: MobVariantDefinition;
  patch: (p: Partial<MobVariantDefinition>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Display Name" hint="Name shown for this archetype in tooling.">
        <TextInput
          value={item.displayName ?? ""}
          onCommit={(v) => patch({ displayName: v || undefined })}
          placeholder="Molten"
        />
      </FieldRow>
      <FieldRow label="Name Prefix" hint='Prepended to the base mob name, e.g. "Molten ".'>
        <TextInput
          value={item.namePrefix ?? ""}
          onCommit={(v) => patch({ namePrefix: v || undefined })}
          placeholder="Molten "
        />
      </FieldRow>
      <FieldRow label="Tint" hint="Hex color multiplied onto the client sprite. Leave unset for no tint.">
        {item.tint ? (
          <div className="flex items-center gap-2">
            <ColorField
              value={item.tint}
              onChange={(tint) => patch({ tint })}
              label="Variant sprite tint"
            />
            <IconButton onClick={() => patch({ tint: undefined })} title="Clear tint" danger>
              x
            </IconButton>
          </div>
        ) : (
          <button
            onClick={() => patch({ tint: DEFAULT_VARIANT_TINT })}
            className="text-2xs text-accent hover:text-accent/80"
          >
            + Set tint
          </button>
        )}
      </FieldRow>
      <FieldRow label="Overlay" hint="Client particle/overlay effect.">
        <SelectInput
          value={item.overlay ?? ""}
          onCommit={(v) => patch({ overlay: v || undefined })}
          options={VARIANT_OVERLAY_OPTIONS}
        />
      </FieldRow>
      <FieldRow label="Rarity" hint="Flavor tier and default announce loudness.">
        <SelectInput
          value={item.rarity ?? ""}
          onCommit={(v) => patch({ rarity: v || undefined })}
          options={VARIANT_RARITY_OPTIONS}
        />
      </FieldRow>
      <FieldRow label="Weight" hint="Relative selection weight among variants. Higher = more common.">
        <NumberInput
          value={item.weight}
          onCommit={(v) => patch({ weight: v ?? 1 })}
          min={0}
          step={0.1}
        />
      </FieldRow>
      <FieldRow label="HP Multiplier" hint="Optional. Multiplies the base mob's HP.">
        <NumberInput
          value={item.hpMultiplier}
          onCommit={(v) => patch({ hpMultiplier: v })}
          min={0}
          step={0.1}
          placeholder="1.0"
        />
      </FieldRow>
      <FieldRow label="XP Multiplier" hint="Optional. Multiplies XP awarded on kill.">
        <NumberInput
          value={item.xpMultiplier}
          onCommit={(v) => patch({ xpMultiplier: v })}
          min={0}
          step={0.1}
          placeholder="1.0"
        />
      </FieldRow>
      <FieldRow label="Loot Multiplier" hint="Optional. Multiplies drop chances and gold.">
        <NumberInput
          value={item.lootMultiplier}
          onCommit={(v) => patch({ lootMultiplier: v })}
          min={0}
          step={0.1}
          placeholder="1.0"
        />
      </FieldRow>
      <FieldRow label="Announce" hint="Broadcast scope when this variant appears.">
        <SelectInput
          value={item.announce ?? ""}
          onCommit={(v) => patch({ announce: v || undefined })}
          options={VARIANT_ANNOUNCE_OPTIONS}
        />
      </FieldRow>
    </div>
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
