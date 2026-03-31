import { useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useLoreStore, selectArticles, selectMaps } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import type { LoreMap } from "@/types/lore";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { MapViewer } from "./MapViewer";
import { MapEnhancer } from "./MapEnhancer";

// ─── Map image hook ─────────────────────────────────────────────────

function useMapImage(imageAsset: string | undefined): string | null {
  return useImageSrc(imageAsset);
}

// ─── Pin editor sidebar ────────────────────────────────────────────

function PinEditor({
  map,
  pinId,
  onClose,
}: {
  map: LoreMap;
  pinId: string;
  onClose: () => void;
}) {
  const updatePin = useLoreStore((s) => s.updatePin);
  const removePin = useLoreStore((s) => s.removePin);
  const articles = useLoreStore(selectArticles);

  const pin = map.pins.find((p) => p.id === pinId);
  if (!pin) return null;

  const articleOptions = Object.values(articles).map((a) => ({
    value: a.id,
    label: a.title,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm text-text-primary">Edit Pin</h4>
        <button
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Done
        </button>
      </div>

      <FieldRow label="Label">
        <TextInput
          value={pin.label ?? ""}
          onCommit={(v) => updatePin(map.id, pinId, { label: v || undefined })}
          placeholder="Pin label"
        />
      </FieldRow>

      <FieldRow label="Article">
        <select
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          value={pin.articleId ?? ""}
          onChange={(e) => updatePin(map.id, pinId, { articleId: e.target.value || undefined })}
        >
          <option value="">— none —</option>
          {articleOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="Color">
        <input
          type="color"
          value={pin.color || "#a897d2"}
          onChange={(e) => updatePin(map.id, pinId, { color: e.target.value })}
          className="h-7 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
        />
      </FieldRow>

      <button
        onClick={() => {
          removePin(map.id, pinId);
          onClose();
        }}
        className="mt-2 rounded border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger hover:bg-status-danger/15"
      >
        Delete Pin
      </button>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function MapPanel() {
  const maps = useLoreStore(selectMaps);
  const selectedMapId = useLoreStore((s) => s.selectedMapId);
  const selectMap = useLoreStore((s) => s.selectMap);
  const createMap = useLoreStore((s) => s.createMap);
  const updateMap = useLoreStore((s) => s.updateMap);
  const deleteMap = useLoreStore((s) => s.deleteMap);

  const [addPinMode, setAddPinMode] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);

  const selectedMap = useMemo(
    () => maps.find((m) => m.id === selectedMapId) ?? null,
    [maps, selectedMapId],
  );

  const mapImage = useMapImage(selectedMap?.imageAsset);

  const handleUploadMap = useCallback(async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!filePath) return;

      setUploading(true);

      // Import the image as an asset
      const result = await invoke<{
        hash: string;
        file_name: string;
        width: number;
        height: number;
      }>("import_asset", {
        sourcePath: filePath,
        assetType: "lore_map",
      });

      // Create a map entry
      const id = `map_${Date.now()}`;
      const title = typeof filePath === "string"
        ? filePath.split(/[/\\]/).pop()?.replace(/\.\w+$/, "") ?? "Map"
        : "Map";

      createMap({
        id,
        title: title.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        imageAsset: result.file_name,
        width: result.width,
        height: result.height,
        pins: [],
      });
    } catch (err) {
      console.error("Failed to import map image:", err);
    } finally {
      setUploading(false);
    }
  }, [createMap]);

  return (
    <div className="flex flex-col gap-5">
      {/* Map selector + upload */}
      <div className="flex items-center gap-3">
        <select
          className="min-w-[12rem] rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-accent/50"
          value={selectedMapId ?? ""}
          onChange={(e) => {
            selectMap(e.target.value || null);
            setSelectedPinId(null);
          }}
        >
          <option value="">— select a map —</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>

        <button
          onClick={handleUploadMap}
          disabled={uploading}
          className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-4 py-1.5 text-xs text-text-primary transition hover:shadow-glow-sm disabled:opacity-50"
        >
          {uploading ? "Importing..." : "Upload Map"}
        </button>

        {selectedMap && (
          <button
            onClick={() => {
              deleteMap(selectedMap.id);
              setSelectedPinId(null);
            }}
            className="rounded border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger hover:bg-status-danger/15"
          >
            Delete
          </button>
        )}
      </div>

      {/* Map title editor */}
      {selectedMap && (
        <FieldRow label="Map title">
          <TextInput
            value={selectedMap.title}
            onCommit={(v) => updateMap(selectedMap.id, { title: v })}
          />
        </FieldRow>
      )}

      {/* Map viewer + pin editor */}
      {selectedMap && mapImage ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
          {/* Map */}
          <div className="relative" style={{ height: "min(70vh, 600px)" }}>
            <MapViewer
              map={selectedMap}
              imageUrl={mapImage}
              onSelectPin={setSelectedPinId}
              addMode={addPinMode}
              onAddComplete={() => setAddPinMode(false)}
            />

            {/* Pin mode toolbar */}
            <div className="absolute left-3 top-3 z-[1000] flex gap-2">
              <button
                onClick={() => setAddPinMode(!addPinMode)}
                className={`rounded-full px-3 py-1.5 text-2xs font-medium shadow-panel transition ${
                  addPinMode
                    ? "bg-accent text-bg-primary"
                    : "border border-border-default bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                {addPinMode ? "Click map to place pin..." : "Add Pin"}
              </button>
              <button
                onClick={() => setShowEnhancer(true)}
                className="rounded-full border border-border-default bg-bg-secondary px-3 py-1.5 text-2xs font-medium text-text-secondary shadow-panel transition hover:bg-bg-tertiary"
              >
                Enhance Region
              </button>
            </div>
          </div>

          {/* Pin sidebar */}
          <div className="rounded-[20px] border border-white/8 bg-black/12 p-4">
            {selectedPinId && selectedMap ? (
              <PinEditor
                map={selectedMap}
                pinId={selectedPinId}
                onClose={() => setSelectedPinId(null)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <h4 className="font-display text-sm text-text-primary">
                  Pins ({selectedMap.pins.length})
                </h4>
                {selectedMap.pins.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No pins yet. Click "Add Pin" then click the map.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {selectedMap.pins.map((pin) => (
                      <button
                        key={pin.id}
                        onClick={() => setSelectedPinId(pin.id)}
                        className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-text-secondary transition hover:bg-bg-tertiary"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: pin.color || "#a897d2" }}
                        />
                        <span className="min-w-0 truncate">
                          {pin.label || "(unnamed)"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : selectedMap && !mapImage ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-muted text-sm text-text-muted">
          Loading map image...
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-muted text-sm text-text-muted">
          Select a map or upload a new one to get started.
        </div>
      )}

      {/* Map enhancer dialog */}
      {showEnhancer && selectedMap && mapImage && (
        <MapEnhancer
          imageUrl={mapImage}
          onClose={() => setShowEnhancer(false)}
        />
      )}
    </div>
  );
}
