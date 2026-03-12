import { useEffect, useMemo, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useVibeStore } from "@/stores/vibeStore";
import { BatchArtGenerator } from "@/components/zone/BatchArtGenerator";
import { ZoneVibePanel } from "@/components/zone/ZoneVibePanel";
import { ZoneAssetWorkbench } from "@/components/zone/ZoneAssetWorkbench";
import { CustomAssetStudio } from "@/components/CustomAssetStudio";
import { PortraitStudio } from "@/components/PortraitStudio";
import { AbilityStudio } from "@/components/AbilityStudio";
import { MediaStudio } from "@/components/MediaStudio";
import type { StudioSubView } from "@/types/project";

const STUDIO_VIEWS: Array<{ id: StudioSubView; label: string; description: string }> = [
  { id: "home", label: "Home", description: "Atlas, recent assets, and world direction at a glance." },
  { id: "zoneArt", label: "Zone Art", description: "Vibes, fallback defaults, and entity art workbench." },
  { id: "customAssets", label: "Custom Assets", description: "Free-form asset generation with optional zone grounding." },
  { id: "media", label: "Media", description: "Music, ambience, and cinematic staging." },
  { id: "portraits", label: "Portraits", description: "Race and class portrait creation." },
  { id: "abilities", label: "Abilities", description: "Ability and status-effect icon generation." },
];

export function StudioWorkspace() {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const openGallery = useAssetStore((s) => s.openGallery);
  const openTab = useProjectStore((s) => s.openTab);
  const setConfigSubTab = useProjectStore((s) => s.setConfigSubTab);
  const studioSubView = useProjectStore((s) => s.studioSubView);
  const setStudioSubView = useProjectStore((s) => s.setStudioSubView);
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const vibeMap = useVibeStore((s) => s.vibes);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showBatchArt, setShowBatchArt] = useState(false);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const sortedZones = useMemo(
    () => [...zones.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [zones],
  );

  useEffect(() => {
    if (selectedZoneId && zones.has(selectedZoneId)) return;
    setSelectedZoneId(sortedZones[0]?.[0] ?? null);
  }, [selectedZoneId, sortedZones, zones]);

  useEffect(() => {
    if (!selectedZoneId) return;
    loadVibe(selectedZoneId).catch(() => {});
  }, [selectedZoneId, loadVibe]);

  const selectedZone = selectedZoneId ? zones.get(selectedZoneId) ?? null : null;
  const selectedZoneAssets = useMemo(
    () => assets.filter((asset) => asset.context?.zone === selectedZoneId),
    [assets, selectedZoneId],
  );
  const recentAssets = useMemo(
    () => [...assets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
    [assets],
  );
  const vibeCount = [...vibeMap.values()].filter(Boolean).length;
  const dirtyZones = [...zones.values()].filter((zone) => zone.dirty).length;
  const activeStudioView = STUDIO_VIEWS.find((view) => view.id === studioSubView) ?? STUDIO_VIEWS[0]!;

  const quickActions: Array<{ label: string; description: string; onClick: () => void; emphasis: "primary" | "secondary" }> = [
    {
      label: selectedZone ? "Continue zone art" : "Open zone art",
      description: selectedZone ? `Resume ${selectedZoneId} art direction and fallbacks.` : "Pick a zone and generate vibes, fallbacks, and entity art.",
      onClick: () => setStudioSubView("zoneArt"),
      emphasis: "primary",
    },
    {
      label: "Review gallery",
      description: "Approve variants and keep the curated library clean.",
      onClick: openGallery,
      emphasis: "primary",
    },
    {
      label: "Player sprites",
      description: "Manage race and tier forms without leaving the studio.",
      onClick: () => openTab({ id: "sprites", kind: "sprites", label: "Sprites" }),
      emphasis: "secondary",
    },
    {
      label: "World systems",
      description: "Open the config designers for combat, rules, and content.",
      onClick: () => {
        setConfigSubTab("worldSystems");
        openTab({ id: "config", kind: "config", label: "Config" });
      },
      emphasis: "secondary",
    },
  ];

  const metrics = [
    { label: "Zones", value: String(zones.size), note: dirtyZones > 0 ? `${dirtyZones} modified` : "All saved" },
    { label: "Assets", value: String(assets.length), note: `${recentAssets.length} recent` },
    { label: "Vibes", value: String(vibeCount), note: `${Math.max(zones.size - vibeCount, 0)} pending` },
    {
      label: "Selected zone",
      value: selectedZoneId ?? "None",
      note: selectedZone ? `${selectedZoneAssets.length} linked assets` : "Open a zone to start",
    },
  ];

  const renderMetricsStrip = () => (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-[22px] border border-white/10 bg-[linear-gradient(155deg,rgba(56,67,96,0.92),rgba(39,48,73,0.92))] px-4 py-3 shadow-[0_14px_34px_rgba(9,12,24,0.18)]"
        >
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{metric.label}</div>
          <div className="mt-2 truncate font-display text-2xl text-text-primary">{metric.value}</div>
          <div className="mt-1 text-xs text-text-secondary">{metric.note}</div>
        </div>
      ))}
    </section>
  );

  const renderSubviewHeader = () => (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] px-5 py-4 shadow-[0_18px_60px_rgba(9,12,24,0.28)]">
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Studio</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-text-primary">{activeStudioView.label}</h1>
          <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
            Focused workbench
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{activeStudioView.description}</p>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] px-5 py-4 shadow-[0_18px_60px_rgba(9,12,24,0.28)]">
        <div className="text-[11px] uppercase tracking-[0.26em] text-text-muted">Selected zone</div>
        <div className="mt-2 truncate font-display text-2xl text-text-primary">
          {selectedZone ? selectedZone.data.zone : "No zone selected"}
        </div>
        <div className="mt-1 truncate text-xs text-text-secondary">
          {selectedZoneId ?? "Pick a zone from the atlas to ground the studio."}
        </div>
        {selectedZone && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => openTab({ id: `zone:${selectedZoneId}`, kind: "zone", label: selectedZoneId! })}
              className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10"
            >
              Open editor
            </button>
            <button
              onClick={() => setShowBatchArt(true)}
              className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[rgba(168,151,210,0.14)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[rgba(168,151,210,0.2)]"
            >
              Batch generate
            </button>
          </div>
        )}
      </div>
    </section>
  );

  const renderAtlas = (compact = false) => (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-text-primary">World atlas</h2>
        <span className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{zones.size} zones</span>
      </div>

      <div className={`flex flex-col gap-2 overflow-y-auto pr-1 ${compact ? "max-h-[18rem]" : "max-h-[38rem]"}`}>
        {sortedZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-6 text-sm text-text-muted">
            Open a world folder to begin curating zones and assets.
          </div>
        ) : (
          sortedZones.map(([zoneId, zoneState]) => {
            const linkedAssets = assets.filter((asset) => asset.context?.zone === zoneId).length;
            const hasVibe = !!(vibeMap.get(zoneId) ?? "").trim();
            const selected = selectedZoneId === zoneId;

            return (
              <button
                key={zoneId}
                onClick={() => setSelectedZoneId(zoneId)}
                className={`rounded-[22px] border px-4 py-4 text-left transition ${
                  selected
                    ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))]"
                    : "border-white/8 bg-white/4 hover:bg-white/7"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{zoneState.data.zone || zoneId}</div>
                    <div className="mt-1 truncate text-xs text-text-secondary">{zoneId}</div>
                  </div>
                  {zoneState.dirty && (
                    <span className="rounded-full bg-[rgba(184,143,170,0.16)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[rgb(214,177,193)]">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted">
                  <span className="rounded-full bg-black/15 px-2 py-1">{Object.keys(zoneState.data.rooms).length} rooms</span>
                  <span className="rounded-full bg-black/15 px-2 py-1">{linkedAssets} assets</span>
                  <span className={`rounded-full px-2 py-1 ${hasVibe ? "bg-[rgba(141,169,123,0.16)] text-[rgb(174,204,152)]" : "bg-black/15"}`}>
                    {hasVibe ? "Vibe ready" : "Vibe pending"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderRecentAssets = () => (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-text-primary">Recent assets</h2>
        <button onClick={openGallery} className="text-xs text-text-secondary transition hover:text-text-primary">
          Open gallery
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {recentAssets.length === 0 ? (
          <div className="col-span-2 rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
            Assets accepted into the library will appear here for quick review.
          </div>
        ) : (
          recentAssets.map((asset) => (
            <div key={asset.id} className="rounded-[20px] border border-white/8 bg-black/12 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{asset.asset_type.replace(/_/g, " ")}</div>
              <div className="mt-2 truncate text-sm text-text-primary">{asset.context?.entity_id || asset.file_name}</div>
              <div className="mt-1 truncate text-[11px] text-text-secondary">{asset.context?.zone || "Global"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSelectedZoneCard = () => (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">{selectedZone ? selectedZone.data.zone : "Select a zone"}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {selectedZone
              ? "Move into a focused workbench for this zone instead of scrolling through every studio surface at once."
              : "Open a world folder and pick a zone to start using the studio."}
          </p>
        </div>
        {selectedZone && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setStudioSubView("zoneArt")}
              className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[rgba(168,151,210,0.14)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[rgba(168,151,210,0.2)]"
            >
              Open zone art
            </button>
            <button
              onClick={() => openTab({ id: `zone:${selectedZoneId}`, kind: "zone", label: selectedZoneId! })}
              className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10"
            >
              Open editor
            </button>
          </div>
        )}
      </div>

      {selectedZone && (
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Rooms</div>
            <div className="mt-2 font-display text-2xl text-text-primary">{Object.keys(selectedZone.data.rooms).length}</div>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Creatures</div>
            <div className="mt-2 font-display text-2xl text-text-primary">{Object.keys(selectedZone.data.mobs ?? {}).length}</div>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Items</div>
            <div className="mt-2 font-display text-2xl text-text-primary">{Object.keys(selectedZone.data.items ?? {}).length}</div>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Approved assets</div>
            <div className="mt-2 font-display text-2xl text-text-primary">{selectedZoneAssets.filter((asset) => asset.is_active).length}</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {studioSubView === "home" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-5 shadow-[0_18px_60px_rgba(9,12,24,0.38)]">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(17rem,0.95fr)] lg:items-start">
                <div className="max-w-2xl">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Surreal Gentle Magic</p>
                  <h1 className="mt-3 font-display text-3xl leading-[1.04] text-text-primary lg:text-[2.6rem]">Build the world from one place.</h1>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">
                    Move between focused workbenches instead of one giant scroll. Pick the surface you want,
                    then stay in that mode until the task is done.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={action.onClick}
                        className={`rounded-[20px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                          action.emphasis === "primary"
                            ? "border-[rgba(168,151,210,0.38)] bg-[linear-gradient(135deg,rgba(168,151,210,0.2),rgba(140,174,201,0.14))] hover:bg-[linear-gradient(135deg,rgba(168,151,210,0.28),rgba(140,174,201,0.18))]"
                            : "border-[rgba(216,222,241,0.14)] bg-white/6 hover:bg-white/10"
                        }`}
                      >
                        <div className="text-sm font-medium text-text-primary">{action.label}</div>
                        <div className="mt-1 text-xs leading-5 text-text-secondary">{action.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-text-muted">Current mode</div>
                  <div className="mt-3 font-display text-2xl text-text-primary">{activeStudioView.label}</div>
                  <div className="mt-2 text-sm leading-6 text-text-secondary">{activeStudioView.description}</div>
                  <div className="mt-4 rounded-[18px] border border-white/8 bg-white/5 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Selected zone</div>
                    <div className="mt-2 truncate text-lg text-text-primary">{selectedZone ? selectedZone.data.zone : "No zone selected"}</div>
                    <div className="mt-1 truncate text-xs text-text-secondary">{selectedZoneId ?? "Pick a zone from the atlas to ground the studio."}</div>
                    {selectedZone && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => openTab({ id: `zone:${selectedZoneId}`, kind: "zone", label: selectedZoneId! })}
                          className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10"
                        >
                          Open editor
                        </button>
                        <button
                          onClick={() => setShowBatchArt(true)}
                          className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[rgba(168,151,210,0.14)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[rgba(168,151,210,0.2)]"
                        >
                          Batch generate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          renderSubviewHeader()
        )}

        {renderMetricsStrip()}

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(49,58,84,0.9),rgba(39,48,73,0.9))] p-3 shadow-[0_18px_40px_rgba(9,12,24,0.2)]">
          <div className="flex flex-wrap items-center gap-2">
            {STUDIO_VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => setStudioSubView(view.id)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  studioSubView === view.id
                    ? "border-[rgba(184,216,232,0.48)] bg-[linear-gradient(135deg,rgba(168,151,210,0.3),rgba(140,174,201,0.2))] text-white shadow-[0_10px_24px_rgba(137,155,214,0.18)]"
                    : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                }`}
              >
                {view.label}
              </button>
            ))}
            <div className="ml-auto rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs text-text-secondary">
              {selectedZone ? `Selected zone: ${selectedZoneId}` : "No zone selected"}
            </div>
          </div>
          <div className="mt-3 text-sm text-text-secondary">
            {STUDIO_VIEWS.find((view) => view.id === studioSubView)?.description}
          </div>
        </section>

        {studioSubView === "home" && (
          <section className="grid items-start gap-6 xl:grid-cols-12">
            <div className="xl:col-span-3">{renderAtlas()}</div>
            <div className="flex flex-col gap-6 xl:col-span-5">
              {renderSelectedZoneCard()}
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
                {selectedZone ? (
                  <ZoneVibePanel
                    zoneId={selectedZoneId!}
                    world={selectedZone.data}
                    onWorldChange={(world) => updateZone(selectedZoneId!, world)}
                  />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
                    Select a zone to generate or edit its Surreal Gentle Magic vibe summary.
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-6 xl:col-span-4">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-xl text-text-primary">Focused workbenches</h2>
                  <span className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Quick switch</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STUDIO_VIEWS.filter((view) => view.id !== "home").map((view) => (
                    <button
                      key={view.id}
                      onClick={() => setStudioSubView(view.id)}
                      className={`rounded-[20px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                        studioSubView === view.id
                          ? "border-[rgba(184,216,232,0.3)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))]"
                          : "border-white/8 bg-black/12 hover:bg-white/8"
                      }`}
                    >
                      <div className="font-display text-lg text-text-primary">{view.label}</div>
                      <div className="mt-2 text-xs leading-6 text-text-secondary">{view.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              {renderRecentAssets()}
            </div>
          </section>
        )}

        {studioSubView === "zoneArt" && (
          selectedZone ? (
            <>
              <section className="grid items-start gap-6 xl:grid-cols-[0.78fr_1.22fr]">
                <div>{renderAtlas(true)}</div>
                <div className="flex flex-col gap-6">
                  <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-display text-xl text-text-primary">Zone direction</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openTab({ id: `zone:${selectedZoneId}`, kind: "zone", label: selectedZoneId! })}
                          className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10"
                        >
                          Open editor
                        </button>
                        <button
                          onClick={() => setShowBatchArt(true)}
                          className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[rgba(168,151,210,0.14)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[rgba(168,151,210,0.2)]"
                        >
                          Batch generate
                        </button>
                      </div>
                    </div>
                    <ZoneVibePanel
                      zoneId={selectedZoneId!}
                      world={selectedZone.data}
                      onWorldChange={(world) => updateZone(selectedZoneId!, world)}
                    />
                  </div>
                </div>
              </section>

              <ZoneAssetWorkbench
                zoneId={selectedZoneId!}
                world={selectedZone.data}
                onWorldChange={(world) => updateZone(selectedZoneId!, world)}
              />
            </>
          ) : (
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
              <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
                Open a world folder and select a zone to start using the zone art workbench.
              </div>
            </section>
          )
        )}

        {studioSubView === "customAssets" && <CustomAssetStudio selectedZoneId={selectedZoneId} />}

        {studioSubView === "media" && (
          <MediaStudio
            zoneId={selectedZoneId}
            world={selectedZone?.data ?? null}
            onWorldChange={(world) => {
              if (selectedZoneId) updateZone(selectedZoneId, world);
            }}
          />
        )}

        {studioSubView === "portraits" && <PortraitStudio selectedZoneId={selectedZoneId} />}

        {studioSubView === "abilities" && <AbilityStudio />}
      </div>

      {showBatchArt && selectedZone && (
        <BatchArtGenerator
          zoneId={selectedZoneId!}
          world={selectedZone.data}
          onWorldChange={(world) => updateZone(selectedZoneId!, world)}
          onClose={() => setShowBatchArt(false)}
        />
      )}
    </div>
  );
}
