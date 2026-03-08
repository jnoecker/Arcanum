import { useState } from "react";
import type { WizardData } from "@/lib/useProjectWizard";
import type { RoomFile, MobFile, ItemFile } from "@/types/world";
import { generateZoneContent, createFallbackZone } from "@/lib/generateZoneContent";

interface DemoZoneStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
  hasLlmKey: boolean;
}

export function DemoZoneStep({ data, onChange, hasLlmKey }: DemoZoneStepProps) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const zone = await generateZoneContent({
        zoneName: data.zoneName,
        zoneTheme: data.zoneTheme,
        worldTheme: data.worldTheme,
        roomCount: data.roomCount,
        mobCount: data.mobCount,
        itemCount: data.itemCount,
        statNames: Object.keys(data.stats),
        equipmentSlots: Object.keys(data.equipmentSlots),
        classNames: Object.values(data.classes).map((c) => c.displayName),
      });
      onChange({ demoZone: zone });
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateFallback = () => {
    const zone = createFallbackZone(data.zoneName, data.roomCount);
    onChange({ demoZone: zone });
  };

  const updateRoom = (id: string, field: keyof RoomFile, value: string) => {
    if (!data.demoZone) return;
    const rooms = { ...data.demoZone.rooms };
    rooms[id] = { ...rooms[id]!, [field]: value };
    onChange({ demoZone: { ...data.demoZone, rooms } });
  };

  const updateMob = (id: string, field: keyof MobFile, value: string) => {
    if (!data.demoZone) return;
    const mobs = { ...(data.demoZone.mobs ?? {}) };
    mobs[id] = { ...mobs[id]!, [field]: value };
    onChange({ demoZone: { ...data.demoZone, mobs } });
  };

  const updateItem = (id: string, field: keyof ItemFile, value: string) => {
    if (!data.demoZone) return;
    const items = { ...(data.demoZone.items ?? {}) };
    items[id] = { ...items[id]!, [field]: value };
    onChange({ demoZone: { ...data.demoZone, items } });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Left: configuration */}
      <div className="flex flex-col gap-3 lg:w-1/2">
        <div>
          <label className="mb-0.5 block text-[10px] text-text-muted">
            Zone Name
          </label>
          <input
            type="text"
            value={data.zoneName}
            onChange={(e) => onChange({ zoneName: e.target.value })}
            className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[10px] text-text-muted">
            Zone Theme
          </label>
          <textarea
            value={data.zoneTheme}
            onChange={(e) => onChange({ zoneTheme: e.target.value })}
            placeholder="A peaceful town square where adventurers gather..."
            rows={3}
            className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-0.5 block text-[10px] text-text-muted">
              Rooms ({data.roomCount})
            </label>
            <input
              type="range"
              min={3}
              max={8}
              value={data.roomCount}
              onChange={(e) =>
                onChange({ roomCount: Number(e.target.value) })
              }
              className="w-full accent-accent"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-text-muted">
              Mobs ({data.mobCount})
            </label>
            <input
              type="range"
              min={0}
              max={4}
              value={data.mobCount}
              onChange={(e) =>
                onChange({ mobCount: Number(e.target.value) })
              }
              className="w-full accent-accent"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-text-muted">
              Items ({data.itemCount})
            </label>
            <input
              type="range"
              min={0}
              max={4}
              value={data.itemCount}
              onChange={(e) =>
                onChange({ itemCount: Number(e.target.value) })
              }
              className="w-full accent-accent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {hasLlmKey ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110 disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-accent-emphasis border-t-transparent" />
                  Generating...
                </span>
              ) : (
                "Generate Zone"
              )}
            </button>
          ) : (
            <div className="text-[10px] text-text-muted">
              Configure an API key in Settings to generate content with AI.
            </div>
          )}
          <button
            onClick={handleCreateFallback}
            className="rounded border border-border-default bg-bg-elevated px-3 py-1.5 text-[10px] text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Use Template
          </button>
        </div>

        {genError && (
          <p className="text-[10px] text-status-error">{genError}</p>
        )}
      </div>

      {/* Right: editable preview */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:w-1/2">
        {data.demoZone ? (
          <div className="flex flex-col gap-3">
            {/* Rooms */}
            <div>
              <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Rooms ({Object.keys(data.demoZone.rooms).length})
              </h4>
              <div className="flex flex-col gap-1.5">
                {Object.entries(data.demoZone.rooms).map(([id, room]) => (
                  <div
                    key={id}
                    className="rounded border border-border-default/50 bg-bg-primary p-2"
                  >
                    <input
                      type="text"
                      value={room.title}
                      onChange={(e) => updateRoom(id, "title", e.target.value)}
                      className="mb-0.5 w-full bg-transparent text-xs font-medium text-text-primary outline-none"
                    />
                    <textarea
                      value={room.description}
                      onChange={(e) =>
                        updateRoom(id, "description", e.target.value)
                      }
                      rows={2}
                      className="w-full bg-transparent text-[10px] text-text-secondary outline-none"
                    />
                    {room.exits && (
                      <div className="mt-0.5 flex gap-1">
                        {Object.entries(room.exits).map(([dir, target]) => (
                          <span
                            key={dir}
                            className="rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-muted"
                          >
                            {dir} &rarr;{" "}
                            {typeof target === "string" ? target : target.to}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobs */}
            {data.demoZone.mobs &&
              Object.keys(data.demoZone.mobs).length > 0 && (
                <div>
                  <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Mobs ({Object.keys(data.demoZone.mobs).length})
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(data.demoZone.mobs).map(([id, mob]) => (
                      <div
                        key={id}
                        className="rounded border border-border-default/50 bg-bg-primary p-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={mob.name}
                            onChange={(e) =>
                              updateMob(id, "name", e.target.value)
                            }
                            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-text-primary outline-none"
                          />
                          <span className="rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-muted">
                            {mob.tier ?? "standard"}
                          </span>
                        </div>
                        <textarea
                          value={mob.description ?? ""}
                          onChange={(e) =>
                            updateMob(id, "description", e.target.value)
                          }
                          rows={1}
                          className="mt-0.5 w-full bg-transparent text-[10px] text-text-secondary outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Items */}
            {data.demoZone.items &&
              Object.keys(data.demoZone.items).length > 0 && (
                <div>
                  <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Items ({Object.keys(data.demoZone.items).length})
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(data.demoZone.items).map(([id, item]) => (
                      <div
                        key={id}
                        className="rounded border border-border-default/50 bg-bg-primary p-2"
                      >
                        <input
                          type="text"
                          value={item.displayName}
                          onChange={(e) =>
                            updateItem(id, "displayName", e.target.value)
                          }
                          className="w-full bg-transparent text-xs font-medium text-text-primary outline-none"
                        />
                        <textarea
                          value={item.description ?? ""}
                          onChange={(e) =>
                            updateItem(id, "description", e.target.value)
                          }
                          rows={1}
                          className="mt-0.5 w-full bg-transparent text-[10px] text-text-secondary outline-none"
                        />
                        <div className="mt-0.5 flex gap-1">
                          {item.slot && (
                            <span className="rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-muted">
                              {item.slot}
                            </span>
                          )}
                          {item.damage != null && item.damage > 0 && (
                            <span className="rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-muted">
                              dmg:{item.damage}
                            </span>
                          )}
                          {item.armor != null && item.armor > 0 && (
                            <span className="rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-muted">
                              arm:{item.armor}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-text-muted">
              Generate or use a template to preview zone content
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
