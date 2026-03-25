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
  { id: "art", label: "Art", description: "Zone vibes, entity art, defaults, and free-form generation." },
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
  const dirtyZones = [...zones.values()].filter((zone) => zone.dirty).length;

  const renderAtlas = (compact = false) => (
    <div className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-text-primary">World atlas</h2>
        <span className="text-[11px] uppercase tracking-ui text-text-muted">{zones.size} zones</span>
      </div>

      <div className={`flex flex-col gap-2 overflow-y-auto pr-1 ${compact ? "max-h-[18rem]" : "max-h-[38rem]"}`}>
        {sortedZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-6 text-sm text-text-muted">
            Open a world folder to load zones and assets.
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
                    ? "border-border-active bg-gradient-active-strong"
                    : "border-white/8 bg-white/4 hover:bg-white/7"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{zoneState.data.zone || zoneId}</div>
                    <div className="mt-1 truncate text-xs text-text-secondary">{zoneId}</div>
                  </div>
                  {zoneState.dirty && (
                    <span className="rounded-full bg-badge-dirty-bg px-2 py-1 text-2xs uppercase tracking-label text-text-dirty">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted">
                  <span className="rounded-full bg-black/15 px-2 py-1">{Object.keys(zoneState.data.rooms).length} rooms</span>
                  <span className="rounded-full bg-black/15 px-2 py-1">{linkedAssets} assets</span>
                  <span className={`rounded-full px-2 py-1 ${hasVibe ? "bg-badge-success-bg text-badge-success" : "bg-black/15"}`}>
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
    <div className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
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
              <div className="text-[11px] uppercase tracking-ui text-text-muted">{asset.asset_type.replace(/_/g, " ")}</div>
              <div className="mt-2 truncate text-sm text-text-primary">{asset.context?.entity_id || asset.file_name}</div>
              <div className="mt-1 truncate text-[11px] text-text-secondary">{asset.context?.zone || "Global"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSelectedZoneCard = () => (
    <div className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">{selectedZone ? selectedZone.data.zone : "Select a zone"}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {selectedZone
              ? "Open the selected zone or jump into art."
              : "Open a world folder and pick a zone."}
          </p>
        </div>
        {selectedZone && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setStudioSubView("art")}
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
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
          <span>{Object.keys(selectedZone.data.rooms).length} rooms</span>
          <span>{Object.keys(selectedZone.data.mobs ?? {}).length} creatures</span>
          <span>{Object.keys(selectedZone.data.items ?? {}).length} items</span>
          <span>{selectedZoneAssets.filter((asset) => asset.is_active).length} approved assets</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
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
            <div className="ml-auto flex items-center gap-3 text-xs text-text-muted">
              <span>{zones.size} zone{zones.size !== 1 ? "s" : ""}{dirtyZones > 0 ? ` · ${dirtyZones} modified` : ""}</span>
              <span>{assets.length} asset{assets.length !== 1 ? "s" : ""}</span>
              {selectedZoneId && <span className="text-text-secondary">Zone: {selectedZoneId}</span>}
            </div>
          </div>
        </section>

        {studioSubView === "home" && (
          <section className="grid items-start gap-6 xl:grid-cols-12">
            <div className="studio-parallax xl:col-span-3">{renderAtlas()}</div>
            <div className="studio-parallax-slow flex flex-col gap-6 xl:col-span-5">
              {renderSelectedZoneCard()}
              <div className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
                {selectedZone ? (
                  <ZoneVibePanel
                    zoneId={selectedZoneId!}
                    world={selectedZone.data}
                    onWorldChange={(world) => updateZone(selectedZoneId!, world)}
                  />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
                    Select a zone to edit its vibe.
                  </div>
                )}
              </div>
            </div>
            <div className="studio-parallax xl:col-span-4">
              {renderRecentAssets()}
            </div>
          </section>
        )}

        {studioSubView === "art" && (
          selectedZone ? (
            <>
              <section className="grid items-start gap-6 xl:grid-cols-[0.78fr_1.22fr]">
                <div>{renderAtlas(true)}</div>
                <div className="flex flex-col gap-6">
                  <div className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
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

              {/* Free-form asset generation below zone art */}
              <CustomAssetStudio selectedZoneId={selectedZoneId} />
            </>
          ) : (
            <>
              <section className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
                <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
                  Open a world folder and select a zone to start generating zone art.
                </div>
              </section>
              <CustomAssetStudio selectedZoneId={selectedZoneId} />
            </>
          )
        )}

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
