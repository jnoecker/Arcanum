import { useState } from "react";
import type { WizardData } from "@/lib/useProjectWizard";
import type {
  StatDefinition,
  ClassDefinitionConfig,
  RaceDefinitionConfig,
  StatBindings,
} from "@/types/config";

interface CharacterSystemStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
}

export function CharacterSystemStep({
  data,
  onChange,
}: CharacterSystemStepProps) {
  const [showBindings, setShowBindings] = useState(false);

  const statEntries = Object.entries(data.stats);
  const classEntries = Object.entries(data.classes);
  const raceEntries = Object.entries(data.races);
  const statIds = Object.keys(data.stats);

  // ─── Stat helpers ──────────────────────────────────────────
  const updateStat = (id: string, field: keyof StatDefinition, value: string | number) => {
    const updated = { ...data.stats };
    updated[id] = { ...updated[id]!, [field]: value };
    onChange({ stats: updated });
  };

  const addStat = () => {
    const newId = `STAT_${Object.keys(data.stats).length + 1}`;
    onChange({
      stats: {
        ...data.stats,
        [newId]: {
          id: newId,
          displayName: "New Stat",
          abbreviation: "NEW",
          description: "",
          baseStat: 10,
        },
      },
    });
  };

  const removeStat = (id: string) => {
    const updated = { ...data.stats };
    delete updated[id];
    onChange({ stats: updated });
  };

  // ─── Class helpers ─────────────────────────────────────────
  const updateClass = (id: string, field: keyof ClassDefinitionConfig, value: string | number) => {
    const updated = { ...data.classes };
    updated[id] = { ...updated[id]!, [field]: value };
    onChange({ classes: updated });
  };

  const addClass = () => {
    const newId = `CLASS_${Object.keys(data.classes).length + 1}`;
    onChange({
      classes: {
        ...data.classes,
        [newId]: {
          displayName: "New Class",
          hpPerLevel: 2,
          manaPerLevel: 2,
        },
      },
    });
  };

  const removeClass = (id: string) => {
    const updated = { ...data.classes };
    delete updated[id];
    onChange({ classes: updated });
  };

  // ─── Race helpers ──────────────────────────────────────────
  const updateRace = (id: string, field: keyof RaceDefinitionConfig, value: string) => {
    const updated = { ...data.races };
    updated[id] = { ...updated[id]!, [field]: value };
    onChange({ races: updated });
  };

  const updateRaceStatMod = (raceId: string, statId: string, value: number) => {
    const updated = { ...data.races };
    const race = { ...updated[raceId]! };
    const mods = { ...(race.statMods ?? {}) };
    if (value === 0) {
      delete mods[statId];
    } else {
      mods[statId] = value;
    }
    race.statMods = mods;
    updated[raceId] = race;
    onChange({ races: updated });
  };

  const addRace = () => {
    const newId = `RACE_${Object.keys(data.races).length + 1}`;
    onChange({
      races: {
        ...data.races,
        [newId]: {
          displayName: "New Race",
          description: "",
        },
      },
    });
  };

  const removeRace = (id: string) => {
    const updated = { ...data.races };
    delete updated[id];
    onChange({ races: updated });
  };

  // ─── Equipment slot helpers ────────────────────────────────
  const toggleSlot = (id: string) => {
    const updated = { ...data.equipmentSlots };
    if (updated[id]) {
      delete updated[id];
    } else {
      updated[id] = {
        displayName: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        order: Object.keys(updated).length + 1,
      };
    }
    onChange({ equipmentSlots: updated });
  };

  // ─── Binding helpers ───────────────────────────────────────
  const updateBinding = (key: keyof StatBindings, value: string | number) => {
    onChange({
      statBindings: { ...data.statBindings, [key]: value },
    });
  };

  const ALL_SLOTS = [
    "HEAD", "CHEST", "LEGS", "FEET", "HANDS",
    "MAIN_HAND", "OFF_HAND", "RING", "NECK",
    "WAIST", "BACK", "SHOULDERS", "WRISTS",
  ];

  const STAT_BINDING_KEYS: { key: keyof StatBindings; label: string; type: "stat" | "number" }[] = [
    { key: "meleeDamageStat", label: "Melee damage stat", type: "stat" },
    { key: "dodgeStat", label: "Dodge stat", type: "stat" },
    { key: "spellDamageStat", label: "Spell damage stat", type: "stat" },
    { key: "hpScalingStat", label: "HP scaling stat", type: "stat" },
    { key: "manaScalingStat", label: "Mana scaling stat", type: "stat" },
    { key: "hpRegenStat", label: "HP regen stat", type: "stat" },
    { key: "manaRegenStat", label: "Mana regen stat", type: "stat" },
    { key: "xpBonusStat", label: "XP bonus stat", type: "stat" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Stats table */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">Stats</label>
          <button
            onClick={addStat}
            className="text-2xs text-accent hover:text-accent-emphasis"
          >
            + Add Stat
          </button>
        </div>
        <div className="overflow-hidden rounded border border-border-default">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated text-2xs text-text-muted">
                <th className="px-2 py-1 text-left font-normal">Display Name</th>
                <th className="px-2 py-1 text-left font-normal w-16">Abbrev</th>
                <th className="px-2 py-1 text-left font-normal w-16">Base</th>
                <th className="w-8 px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {statEntries.map(([id, stat]) => (
                <tr
                  key={id}
                  className="border-b border-border-default/50 last:border-0"
                >
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={stat.displayName}
                      onChange={(e) => updateStat(id, "displayName", e.target.value)}
                      className="w-full bg-transparent text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={stat.abbreviation}
                      onChange={(e) => updateStat(id, "abbreviation", e.target.value)}
                      className="w-full bg-transparent text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                      maxLength={4}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={stat.baseStat}
                      onChange={(e) => updateStat(id, "baseStat", Number(e.target.value))}
                      className="w-full bg-transparent text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeStat(id)}
                      className="text-text-muted hover:text-status-error"
                      title="Remove stat"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
              {statEntries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-center text-text-muted">
                    No stats defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Classes table */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">Classes</label>
          <button
            onClick={addClass}
            className="text-2xs text-accent hover:text-accent-emphasis"
          >
            + Add Class
          </button>
        </div>
        <div className="overflow-hidden rounded border border-border-default">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated text-2xs text-text-muted">
                <th className="px-2 py-1 text-left font-normal">Display Name</th>
                <th className="px-2 py-1 text-left font-normal w-16">HP/Lvl</th>
                <th className="px-2 py-1 text-left font-normal w-16">MP/Lvl</th>
                <th className="px-2 py-1 text-left font-normal w-20">Primary</th>
                <th className="w-8 px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {classEntries.map(([id, cls]) => (
                <tr
                  key={id}
                  className="border-b border-border-default/50 last:border-0"
                >
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={cls.displayName}
                      onChange={(e) => updateClass(id, "displayName", e.target.value)}
                      className="w-full bg-transparent text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={cls.hpPerLevel}
                      onChange={(e) => updateClass(id, "hpPerLevel", Number(e.target.value))}
                      className="w-full bg-transparent text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={cls.manaPerLevel}
                      onChange={(e) => updateClass(id, "manaPerLevel", Number(e.target.value))}
                      className="w-full bg-transparent text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={cls.primaryStat ?? ""}
                      onChange={(e) => updateClass(id, "primaryStat", e.target.value)}
                      className="w-full bg-transparent text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    >
                      <option value="">None</option>
                      {statIds.map((s) => (
                        <option key={s} value={s}>
                          {data.stats[s]?.abbreviation ?? s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeClass(id)}
                      className="text-text-muted hover:text-status-error"
                      title="Remove class"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
              {classEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-center text-text-muted">
                    No classes defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Races table */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">Races</label>
          <button
            onClick={addRace}
            className="text-2xs text-accent hover:text-accent-emphasis"
          >
            + Add Race
          </button>
        </div>
        <div className="overflow-hidden rounded border border-border-default">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated text-2xs text-text-muted">
                <th className="px-2 py-1 text-left font-normal">Display Name</th>
                <th className="px-2 py-1 text-left font-normal">Stat Modifiers</th>
                <th className="w-8 px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {raceEntries.map(([id, race]) => (
                <tr
                  key={id}
                  className="border-b border-border-default/50 last:border-0"
                >
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={race.displayName}
                      onChange={(e) => updateRace(id, "displayName", e.target.value)}
                      className="w-full bg-transparent text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {statIds.map((statId) => {
                        const val = race.statMods?.[statId] ?? 0;
                        return (
                          <span
                            key={statId}
                            className="inline-flex items-center gap-0.5 rounded bg-bg-elevated px-1 py-0.5 text-2xs"
                          >
                            <span className="text-text-muted">
                              {data.stats[statId]?.abbreviation ?? statId}
                            </span>
                            <input
                              type="number"
                              value={val}
                              onChange={(e) =>
                                updateRaceStatMod(id, statId, Number(e.target.value))
                              }
                              className="w-8 bg-transparent text-center text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                            />
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeRace(id)}
                      className="text-text-muted hover:text-status-error"
                      title="Remove race"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
              {raceEntries.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-2 text-center text-text-muted">
                    No races defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment Slots */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Equipment Slots
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SLOTS.map((slot) => {
            const active = !!data.equipmentSlots[slot];
            return (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className={`rounded border px-2 py-1 text-2xs transition-colors ${
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-default bg-bg-primary text-text-muted hover:border-border-hover"
                }`}
              >
                {slot.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced: Stat Bindings */}
      <div>
        <button
          onClick={() => setShowBindings(!showBindings)}
          className="flex items-center gap-1 text-2xs text-text-muted hover:text-text-secondary"
        >
          <span className={`transition-transform ${showBindings ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          Advanced: Stat Bindings
        </button>
        {showBindings && (
          <div className="mt-2 rounded border border-border-default bg-bg-primary p-3">
            <div className="grid grid-cols-2 gap-2">
              {STAT_BINDING_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="min-w-0 flex-1 text-2xs text-text-muted">
                    {label}
                  </label>
                  <select
                    value={(data.statBindings[key] as string) ?? ""}
                    onChange={(e) => updateBinding(key, e.target.value)}
                    className="rounded border border-border-default bg-bg-elevated px-1.5 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                  >
                    <option value="">Default</option>
                    {statIds.map((s) => (
                      <option key={s} value={s}>
                        {data.stats[s]?.abbreviation ?? s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
