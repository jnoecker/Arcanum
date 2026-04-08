import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useLoreStore, selectArticles, selectMaps, selectColorLabels } from "@/stores/loreStore";
import { useImageSrcStatus } from "@/lib/useImageSrc";
import type { LoreMap, Article } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { ActionButton, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { MapViewer } from "./MapViewer";
import { MapEnhancer } from "./MapEnhancer";
import { MapAnalysisPanel } from "./MapAnalysisPanel";

// ─── Color palette picker ──────────────────────────────────────────

const DEFAULT_MAP_COLOR = "var(--color-template-world)";
const DEFAULT_MAP_COLOR_HEX = "#a897d2"; // hex fallback for <input type="color">

function ColorPalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const colorLabels = useLoreStore(selectColorLabels);
  const addColorLabel = useLoreStore((s) => s.addColorLabel);
  const removeColorLabel = useLoreStore((s) => s.removeColorLabel);
  const updateColorLabel = useLoreStore((s) => s.updateColorLabel);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_MAP_COLOR_HEX);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && nameRef.current) nameRef.current.focus();
  }, [adding]);

  const commitAdd = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    addColorLabel({ id: `cl_${Date.now()}`, name, color: newColor });
    onChange(newColor);
    setNewName("");
    setNewColor(DEFAULT_MAP_COLOR_HEX);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Saved palette swatches */}
      {colorLabels.length > 0 && (
        <div className="flex flex-col gap-1">
          {colorLabels.map((cl) => (
            <div key={cl.id} className="group flex items-center gap-1.5">
              <button
                onClick={() => onChange(cl.color)}
                className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-2xs transition ${
                  value === cl.color
                    ? "bg-[var(--chrome-highlight-strong)] text-text-primary"
                    : "text-text-secondary hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
                }`}
                title={cl.name}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm border border-[var(--chrome-stroke-emphasis)]"
                  style={{ backgroundColor: cl.color }}
                />
                {editingId === cl.id ? (
                  <input
                    autoFocus
                    className="ornate-input min-h-9 w-24 rounded-xl px-2 py-1 text-2xs text-text-primary"
                    value={editName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      if (editName.trim()) updateColorLabel(cl.id, { name: editName.trim() });
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editName.trim()) updateColorLabel(cl.id, { name: editName.trim() });
                        setEditingId(null);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(cl.id);
                      setEditName(cl.name);
                    }}
                  >
                    {cl.name}
                  </span>
                )}
              </button>
              <input
                type="color"
                value={cl.color}
                onChange={(e) => {
                  updateColorLabel(cl.id, { color: e.target.value });
                  if (value === cl.color) onChange(e.target.value);
                }}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-full border border-[var(--chrome-stroke)] bg-transparent p-1 opacity-0 transition group-hover:opacity-100"
                title="Change color"
              />
              <button
                onClick={() => removeColorLabel(cl.id)}
                className="shrink-0 text-2xs text-text-muted opacity-0 transition hover:text-status-danger group-hover:opacity-100"
                title="Remove label"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new labeled color */}
      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-11 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--chrome-stroke)] bg-transparent p-1"
          />
          <input
            ref={nameRef}
            className="ornate-input min-h-10 min-w-0 flex-1 rounded-2xl px-3 py-2 text-xs text-text-primary"
            placeholder="Label name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <ActionButton
            onClick={commitAdd}
            variant="secondary"
            size="sm"
          >
            Save
          </ActionButton>
        </div>
      ) : (
        <ActionButton
          onClick={() => setAdding(true)}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          Add Label
        </ActionButton>
      )}

      {/* Fallback: raw color picker */}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-11 cursor-pointer rounded-full border border-[var(--chrome-stroke)] bg-bg-primary p-1"
        />
        <span className="text-2xs text-text-muted">Custom</span>
      </div>
    </div>
  );
}

// ─── Filterable article combobox ───────────────────────────────────

function ArticleCombobox({
  value,
  onChange,
  articles,
}: {
  value: string;
  onChange: (articleId: string | undefined) => void;
  articles: Record<string, Article>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group articles by template, sorted by template label then title
  const grouped = useMemo(() => {
    const all = Object.values(articles);
    const lc = filter.toLowerCase();
    const filtered = lc ? all.filter((a) => a.title.toLowerCase().includes(lc)) : all;

    const groups: { template: string; label: string; items: Article[] }[] = [];
    const byTemplate = new Map<string, Article[]>();
    for (const a of filtered) {
      const list = byTemplate.get(a.template) ?? [];
      list.push(a);
      byTemplate.set(a.template, list);
    }
    // Sort templates by schema label
    const templateOrder = Object.keys(TEMPLATE_SCHEMAS);
    for (const t of templateOrder) {
      const items = byTemplate.get(t);
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.title.localeCompare(b.title));
      const schema = TEMPLATE_SCHEMAS[t as keyof typeof TEMPLATE_SCHEMAS];
      groups.push({ template: t, label: schema?.pluralLabel ?? t, items });
    }
    return groups;
  }, [articles, filter]);

  const selectedTitle = value ? articles[value]?.title : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="ornate-input flex min-h-11 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm"
      >
        <span className={selectedTitle ? "text-text-secondary" : "text-text-muted"}>
          {selectedTitle ?? "Unmarked"}
        </span>
        <span className="text-[9px] text-text-muted">{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-60 flex-col overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-lg">
          <div className="shrink-0 border-b border-[var(--chrome-stroke)] p-1.5">
            <input
              ref={inputRef}
              type="text"
            className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted"
              placeholder="Search legends..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            <button
              onClick={() => { onChange(undefined); setOpen(false); setFilter(""); }}
              className={`w-full rounded px-2 py-1 text-left text-xs transition ${
                !value ? "bg-[var(--chrome-highlight-strong)] text-text-primary" : "text-text-muted hover:bg-[var(--chrome-highlight)] hover:text-text-secondary"
              }`}
            >
              Unmarked
            </button>
            {grouped.map((group) => (
              <div key={group.template}>
                <p className="mt-1.5 px-2 pb-0.5 text-3xs font-medium uppercase tracking-wide-ui text-text-muted">
                  {group.label}
                </p>
                {group.items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { onChange(a.id); setOpen(false); setFilter(""); }}
                    className={`w-full rounded px-2 py-1 text-left text-xs transition ${
                      value === a.id
                        ? "bg-[var(--chrome-highlight-strong)] text-text-primary"
                        : "text-text-secondary hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
                    }`}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            ))}
            {grouped.length === 0 && filter && (
              <p className="px-2 py-2 text-xs text-text-muted">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm text-text-primary">Edit Pin</h4>
        <button
          onClick={onClose}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-xs text-text-muted hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
        >
          Done
        </button>
      </div>

      <FieldRow label="Label">
        <TextInput
          value={pin.label ?? ""}
          onCommit={(v) => updatePin(map.id, pinId, { label: v || undefined })}
          placeholder="Name this place"
        />
      </FieldRow>

      <FieldRow label="Article">
        <ArticleCombobox
          value={pin.articleId ?? ""}
          onChange={(id) => updatePin(map.id, pinId, { articleId: id })}
          articles={articles}
        />
      </FieldRow>

      <div className="py-0.5">
        <label className="text-xs text-text-muted">Color</label>
        <div className="mt-1">
          <ColorPalettePicker
            value={pin.color || DEFAULT_MAP_COLOR}
            onChange={(c) => updatePin(map.id, pinId, { color: c })}
          />
        </div>
      </div>

      <ActionButton
        onClick={() => {
          removePin(map.id, pinId);
          onClose();
        }}
        variant="danger"
        size="sm"
        className="mt-2"
      >
        Delete Pin
      </ActionButton>
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
  const [replacing, setReplacing] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedMap = useMemo(
    () => maps.find((m) => m.id === selectedMapId) ?? null,
    [maps, selectedMapId],
  );

  const { src: mapImage, status: mapImageStatus } = useImageSrcStatus(selectedMap?.imageAsset);

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

  const handleReplaceImage = useCallback(async () => {
    if (!selectedMap) return;
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!filePath) return;

      setReplacing(true);
      const result = await invoke<{
        hash: string;
        file_name: string;
        width: number;
        height: number;
      }>("import_asset", {
        sourcePath: filePath,
        assetType: "lore_map",
      });

      // Update image and dimensions, pins are preserved by updateMap's spread
      updateMap(selectedMap.id, {
        imageAsset: result.file_name,
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      console.error("Failed to replace map image:", err);
    } finally {
      setReplacing(false);
    }
  }, [selectedMap, updateMap]);

  return (
    <div className="flex flex-col gap-5">
      {/* Map selector + upload */}
      <div className="flex items-center gap-3">
        <select
          className="ornate-input min-h-11 min-w-[14rem] rounded-2xl px-4 py-3 text-sm text-text-secondary"
          value={selectedMapId ?? ""}
          onChange={(e) => {
            selectMap(e.target.value || null);
            setSelectedPinId(null);
          }}
        >
          <option value="">Choose a map...</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>

        <ActionButton
          onClick={handleUploadMap}
          disabled={uploading}
          variant="primary"
        >
          {uploading ? "Importing..." : "Upload Map"}
        </ActionButton>

        {selectedMap && (
          <>
            <ActionButton
              onClick={() => {
                const clone: LoreMap = {
                  ...selectedMap,
                  id: `map_${Date.now()}`,
                  title: `${selectedMap.title} (copy)`,
                  pins: selectedMap.pins.map((p) => ({ ...p, id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })),
                };
                createMap(clone);
              }}
              title="Duplicate map with all pins"
              variant="secondary"
            >
              Duplicate
            </ActionButton>
            <ActionButton
              onClick={handleReplaceImage}
              disabled={replacing}
              title="Replace image (keeps all pins)"
              variant="secondary"
            >
              {replacing ? "Replacing..." : "Replace Image"}
            </ActionButton>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5">
                <span className="text-2xs text-status-danger">Delete this map?</span>
                <ActionButton
                  onClick={() => {
                    deleteMap(selectedMap.id);
                    setSelectedPinId(null);
                    setConfirmDelete(false);
                  }}
                  variant="danger"
                  size="sm"
                >
                  Yes
                </ActionButton>
                <ActionButton
                  onClick={() => setConfirmDelete(false)}
                  variant="ghost"
                  size="sm"
                >
                  No
                </ActionButton>
              </span>
            ) : (
              <ActionButton
                onClick={() => setConfirmDelete(true)}
                variant="danger"
              >
                Delete
              </ActionButton>
            )}
          </>
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
              <ActionButton
                onClick={() => setAddPinMode(!addPinMode)}
                variant={addPinMode ? "primary" : "secondary"}
              >
                {addPinMode ? "Click map to place pin..." : "Add Pin"}
              </ActionButton>
              <ActionButton
                onClick={() => setShowEnhancer(true)}
                variant="secondary"
              >
                Enhance Region
              </ActionButton>
            </div>
          </div>

          {/* Pin sidebar */}
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
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
                          style={{ backgroundColor: pin.color || DEFAULT_MAP_COLOR }}
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
      ) : selectedMap && mapImageStatus === "error" ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-status-danger/50 px-6 text-center text-sm text-text-muted">
          <p className="font-display text-base text-status-danger">
            Map image not found in asset cache
          </p>
          <p className="max-w-md text-xs text-text-muted">
            The file <code className="font-mono text-2xs text-text-secondary">{selectedMap.imageAsset}</code> is
            referenced by this map but no longer exists locally. Use{" "}
            <span className="text-text-secondary">Replace Image</span> above to re-import it
            (uploading the same source file will restore it with the same hash).
          </p>
          <ActionButton
            onClick={handleReplaceImage}
            disabled={replacing}
            variant="primary"
            size="sm"
          >
            {replacing ? "Replacing..." : "Replace Image"}
          </ActionButton>
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

      {/* Vision-powered map analysis */}
      {selectedMap && mapImage && (
        <MapAnalysisPanel map={selectedMap} imageDataUrl={mapImage} />
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
