import { useEffect, useMemo, useRef, useState } from "react";
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
import { loadArtSubTab, saveArtSubTab } from "@/lib/uiPersistence";

type ArtSubTab = "direction" | "assets" | "custom";

function ZoneSelector({
  zones,
  selectedZoneId,
  onSelect,
  assets,
  vibeMap,
}: {
  zones: [string, { data: { zone?: string; rooms: Record<string, unknown> }; dirty: boolean }][];
  selectedZoneId: string | null;
  onSelect: (id: string) => void;
  assets: { context?: { zone?: string } }[];
  vibeMap: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const selectedZone = zones.find(([id]) => id === selectedZoneId);
  const selectedLabel = selectedZone
    ? (selectedZone[1].data.zone || selectedZoneId)
    : "Select a zone";

  const filtered = search.trim()
    ? zones.filter(([id, z]) =>
        id.toLowerCase().includes(search.toLowerCase()) ||
        (z.data.zone || "").toLowerCase().includes(search.toLowerCase()))
    : zones;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-left transition ${
          open
            ? "border-border-active bg-gradient-active"
            : "border-white/10 bg-white/[0.04] hover:bg-white/7"
        }`}
      >
        <span className="text-[11px] uppercase tracking-ui text-text-muted">Zone</span>
        <span className="truncate text-xs font-medium text-text-primary" style={{ maxWidth: "14rem" }}>{selectedLabel}</span>
        {selectedZone && (
          <span className="text-[11px] text-text-muted">
            {Object.keys(selectedZone[1].data.rooms).length} rooms
          </span>
        )}
        <svg className={`h-3.5 w-3.5 shrink-0 text-text-muted transition ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-[18px] border border-white/12 bg-bg-secondary shadow-xl">
          {zones.length > 6 && (
            <div className="border-b border-white/8 px-3 py-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search zones..."
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
          )}
          <div className="max-h-[20rem] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-text-muted">No matching zones.</div>
            ) : (
              filtered.map(([zoneId, zoneState]) => {
                const selected = selectedZoneId === zoneId;
                const linkedAssets = assets.filter((a) => a.context?.zone === zoneId).length;
                const hasVibe = !!(vibeMap.get(zoneId) ?? "").trim();

                return (
                  <button
                    key={zoneId}
                    onClick={() => { onSelect(zoneId); setOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition ${
                      selected
                        ? "bg-gradient-active text-text-primary"
                        : "text-text-secondary hover:bg-white/6"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{zoneState.data.zone || zoneId}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                        <span>{zoneId}</span>
                        <span>· {Object.keys(zoneState.data.rooms).length} rooms</span>
                        {linkedAssets > 0 && <span>· {linkedAssets} assets</span>}
                      </div>
                    </div>
                    {hasVibe && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" title="Vibe set" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function StudioWorkspace({ panelId }: { panelId: string }) {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const openTab = useProjectStore((s) => s.openTab);
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const vibeMap = useVibeStore((s) => s.vibes);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showBatchArt, setShowBatchArt] = useState(false);
  const [artSubTab, setArtSubTab] = useState<ArtSubTab>(() => loadArtSubTab());

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

  const zoneSelector = (
    <ZoneSelector
      zones={sortedZones as [string, { data: { zone?: string; rooms: Record<string, unknown> }; dirty: boolean }][]}
      selectedZoneId={selectedZoneId}
      onSelect={setSelectedZoneId}
      assets={assets}
      vibeMap={vibeMap}
    />
  );


  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {panelId === "art" && (
          <>
            {/* Sub-tab strip + zone selector */}
            <div className="flex items-center gap-2">
              {([
                { id: "direction" as const, label: "Direction" },
                { id: "assets" as const, label: "Zone Assets" },
                { id: "custom" as const, label: "Custom Studio" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setArtSubTab(tab.id); saveArtSubTab(tab.id); }}
                  className={`focus-ring rounded-full border px-4 py-2 text-xs font-medium transition ${
                    artSubTab === tab.id
                      ? "border-[var(--border-glow-strong)] bg-[linear-gradient(135deg,rgba(168,151,210,0.25),rgba(140,174,201,0.15))] text-text-primary shadow-glow-sm"
                      : "border-white/8 bg-white/[0.04] text-text-muted hover:border-white/14 hover:bg-white/8 hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto">{zoneSelector}</div>
            </div>

            {selectedZone ? (
              <>
                {artSubTab === "direction" && (
                  <div className="panel-surface rounded-[28px] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-display text-xl text-text-primary">Zone direction</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openTab({ id: `zone:${selectedZoneId}`, kind: "zone", label: selectedZoneId! })}
                          className="focus-ring shell-pill rounded-full px-4 py-2 text-xs font-medium"
                        >
                          Open editor
                        </button>
                        <button
                          onClick={() => setShowBatchArt(true)}
                          className="focus-ring shell-pill-primary rounded-full px-4 py-2 text-xs font-medium"
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
                )}

                {artSubTab === "assets" && (
                  <ZoneAssetWorkbench
                      zoneId={selectedZoneId!}
                      world={selectedZone.data}
                      onWorldChange={(world) => updateZone(selectedZoneId!, world)}
                    />
                )}

                {artSubTab === "custom" && (
                  <CustomAssetStudio selectedZoneId={selectedZoneId} />
                )}
              </>
            ) : (
              <>
                {artSubTab !== "custom" && (
                  <section className="panel-surface rounded-[28px] p-5">
                    <div className="panel-surface-light rounded-[22px] border-dashed px-4 py-8 text-sm text-text-muted">
                      Open a world folder and select a zone to start generating zone art.
                    </div>
                  </section>
                )}
                {artSubTab === "custom" && (
                  <CustomAssetStudio selectedZoneId={selectedZoneId} />
                )}
              </>
            )}
          </>
        )}

        {panelId === "media" && (
          <>
            <div className="flex justify-end">{zoneSelector}</div>
            <MediaStudio
              zoneId={selectedZoneId}
              world={selectedZone?.data ?? null}
              onWorldChange={(world) => {
                if (selectedZoneId) updateZone(selectedZoneId, world);
              }}
            />
          </>
        )}

        {panelId === "portraits" && <PortraitStudio selectedZoneId={selectedZoneId} />}

        {panelId === "studioAbilities" && <AbilityStudio />}
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
