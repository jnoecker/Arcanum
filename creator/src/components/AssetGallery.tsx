import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import type { AssetEntry, AssetType, SyncProgress, SyncScope } from "@/types/assets";

type SortKey = "newest" | "oldest" | "type";
type MediaKind = "all" | "image" | "audio" | "video";
type ViewMode = "curated" | "all";

const AUDIO_EXTENSIONS = ["mp3", "ogg", "flac", "wav"];
const VIDEO_EXTENSIONS = ["mp4", "webm"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function mediaKindForAsset(asset: AssetEntry): Exclude<MediaKind, "all"> {
  const ext = getExtension(asset.file_name);
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "image";
}

function shouldShowInCuratedView(asset: AssetEntry): boolean {
  return asset.is_active || !asset.variant_group;
}

function shouldSyncAsset(asset: AssetEntry, scope: SyncScope): boolean {
  return scope === "all" || shouldShowInCuratedView(asset);
}

function localAssetPath(assetsDir: string, asset: AssetEntry): string {
  const kind = mediaKindForAsset(asset);
  const subdir = kind === "image" ? "images" : kind;
  return `${assetsDir}\\${subdir}\\${asset.file_name}`;
}

function LazyThumb({
  asset,
  onVisible,
}: {
  asset: AssetEntry;
  onVisible: (entry: AssetEntry) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onVisible(asset);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [asset, onVisible]);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <div className="h-4 w-4 animate-spin rounded-full border border-border-default border-t-accent" />
    </div>
  );
}

export function AssetGallery({ onClose }: { onClose: () => void }) {
  const assets = useAssetStore((s) => s.assets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const importAsset = useAssetStore((s) => s.importAsset);
  const syncing = useAssetStore((s) => s.syncing);
  const syncToR2 = useAssetStore((s) => s.syncToR2);
  const settings = useAssetStore((s) => s.settings);

  const [selected, setSelected] = useState<AssetEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [mediaFilter, setMediaFilter] = useState<MediaKind>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("curated");
  const [syncScope, setSyncScope] = useState<SyncScope>("approved");
  const [sort, setSort] = useState<SortKey>("newest");
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [syncResult, setSyncResult] = useState<SyncProgress | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasR2 = !!(settings?.r2_account_id && settings?.r2_bucket && settings?.r2_access_key_id);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (selected && !assets.some((asset) => asset.id === selected.id)) {
      setSelected(null);
    }
  }, [assets, selected]);

  const types = Array.from(new Set(assets.map((a) => a.asset_type)));
  const zones = Array.from(new Set(assets.map((a) => a.context?.zone).filter(Boolean))) as string[];
  const hasGlobalAssets = assets.some((a) => !a.context?.zone);

  const filtered = useMemo(
    () =>
      assets.filter((asset) => {
        if (typeFilter !== "all" && asset.asset_type !== typeFilter) return false;
        if (zoneFilter !== "all") {
          if (zoneFilter === "__global__" ? !!asset.context?.zone : asset.context?.zone !== zoneFilter) {
            return false;
          }
        }
        if (mediaFilter !== "all" && mediaKindForAsset(asset) !== mediaFilter) return false;
        if (viewMode === "curated" && !shouldShowInCuratedView(asset)) return false;
        return true;
      }),
    [assets, mediaFilter, typeFilter, viewMode, zoneFilter],
  );

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      if (sort === "newest") return b.created_at.localeCompare(a.created_at);
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      return a.asset_type.localeCompare(b.asset_type);
    });
    return next;
  }, [filtered, sort]);

  const unsyncedCount = useMemo(
    () => assets.filter((asset) => asset.sync_status !== "synced" && shouldSyncAsset(asset, syncScope)).length,
    [assets, syncScope],
  );

  const loadPreview = useCallback(
    (entry: AssetEntry) => {
      if (previewCache[entry.id] || !assetsDir) return;
      const path = localAssetPath(assetsDir, entry);
      invoke<string>("read_media_data_url", { path })
        .then((dataUrl) => {
          setPreviewCache((prev) => ({ ...prev, [entry.id]: dataUrl }));
        })
        .catch(() => {});
    },
    [assetsDir, previewCache],
  );

  useEffect(() => {
    if (selected) loadPreview(selected);
  }, [loadPreview, selected]);

  const handleDelete = async (entry: AssetEntry) => {
    setDeleting(true);
    try {
      await deleteAsset(entry.id);
      if (selected?.id === entry.id) setSelected(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleImport = async () => {
    const mediaFilterLabel = mediaFilter === "all" ? "Media" : `${mediaFilter.charAt(0).toUpperCase()}${mediaFilter.slice(1)}`;
    const extensions = mediaFilter === "audio"
      ? AUDIO_EXTENSIONS
      : mediaFilter === "video"
        ? VIDEO_EXTENSIONS
        : [...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];
    const files = await open({
      multiple: true,
      filters: [{
        name: mediaFilterLabel,
        extensions,
      }],
    });
    if (!files) return;

    const paths = Array.isArray(files) ? files : [files];
    setImporting(true);
    try {
      for (const filePath of paths) {
        const assetType: AssetType =
          typeFilter !== "all"
            ? typeFilter as AssetType
            : mediaFilter === "audio"
              ? "music"
              : mediaFilter === "video"
                ? "video"
                : "background";
        await importAsset(filePath, assetType);
      }
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const renderThumb = (asset: AssetEntry) => {
    const kind = mediaKindForAsset(asset);
    if (kind === "image") {
      return previewCache[asset.id] ? (
        <img
          src={previewCache[asset.id]}
          alt={asset.prompt.slice(0, 60)}
          className="h-full w-full object-cover"
        />
      ) : (
        <LazyThumb asset={asset} onVisible={loadPreview} />
      );
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,rgba(183,204,231,0.2),rgba(15,18,30,0.82))] px-3 text-center">
        <div className="font-display text-lg text-text-primary">{kind === "audio" ? "Audio" : "Video"}</div>
        <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">
          {asset.asset_type.replace(/_/g, " ")}
        </div>
      </div>
    );
  };

  const renderDetailPreview = (asset: AssetEntry) => {
    const preview = previewCache[asset.id];
    const kind = mediaKindForAsset(asset);
    if (!preview) {
      return (
        <div className="flex aspect-square items-center justify-center bg-bg-primary">
          <div className="h-4 w-4 animate-spin rounded-full border border-border-default border-t-accent" />
        </div>
      );
    }
    if (kind === "audio") {
      return <audio controls src={preview} className="w-full" />;
    }
    if (kind === "video") {
      return <video controls src={preview} className="w-full rounded" />;
    }
    return <img src={preview} alt="Selected asset" className="w-full" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-6xl flex-col rounded-[24px] border border-border-default bg-bg-secondary shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg tracking-wide text-text-primary">Asset Gallery</h2>
            <span className="text-xs text-text-muted">
              {sorted.length} visible of {assets.length}
            </span>
            <div className="mx-1 h-4 w-px bg-border-default" />
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
            {hasR2 && (
              <>
                <select
                  value={syncScope}
                  onChange={(event) => setSyncScope(event.target.value as SyncScope)}
                  className="rounded-full border border-border-default bg-bg-primary px-3 py-1.5 text-[10px] text-text-secondary outline-none"
                >
                  <option value="approved">Sync curated</option>
                  <option value="all">Sync everything</option>
                </select>
                <button
                  onClick={async () => {
                    const result = await syncToR2(syncScope);
                    setSyncResult(result);
                  }}
                  disabled={syncing || unsyncedCount === 0}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-medium transition-colors enabled:bg-accent/15 enabled:text-accent enabled:hover:bg-accent/25 disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : unsyncedCount > 0 ? `Sync ${unsyncedCount} to R2` : "All synced"}
                </button>
                {syncResult && !syncing && (
                  <span className="text-[10px] text-text-muted">
                    {syncResult.uploaded} uploaded, {syncResult.skipped} deduped
                    {syncResult.failed > 0 && (
                      <span className="text-status-error"> ({syncResult.failed} failed)</span>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary">
            &times;
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-b border-border-default px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">View</span>
              <div className="flex gap-1 rounded-full border border-white/10 bg-black/10 p-1">
                {(["curated", "all"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-full px-3 py-1.5 text-[10px] transition-colors ${
                      viewMode === mode
                        ? "bg-[linear-gradient(135deg,rgba(168,151,210,0.24),rgba(140,174,201,0.16))] text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {mode === "curated" ? "Curated" : "Everything"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Sort</span>
              <div className="flex gap-1 rounded-full border border-white/10 bg-black/10 p-1">
                {(["newest", "oldest", "type"] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`rounded-full px-3 py-1.5 text-[10px] transition-colors ${
                      sort === key
                        ? "bg-[linear-gradient(135deg,rgba(168,151,210,0.24),rgba(140,174,201,0.16))] text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Media</span>
            <div className="flex flex-wrap gap-1">
              {(["all", "image", "audio", "video"] as MediaKind[]).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setMediaFilter(kind)}
                  className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                    mediaFilter === kind
                      ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                      : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-[16rem] flex-1 flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Types</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                    typeFilter === "all"
                      ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                      : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                  }`}
                >
                  All types
                </button>
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                      typeFilter === type
                        ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                        : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {type.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {(zones.length > 0 || hasGlobalAssets) && (
              <div className="flex min-w-[14rem] flex-1 flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Zone</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setZoneFilter("all")}
                    className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                      zoneFilter === "all"
                        ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                        : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    All zones
                  </button>
                  {hasGlobalAssets && (
                    <button
                      onClick={() => setZoneFilter("__global__")}
                      className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                        zoneFilter === "__global__"
                          ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                          : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      Global
                    </button>
                  )}
                  {zones.map((zone) => (
                    <button
                      key={zone}
                      onClick={() => setZoneFilter(zone)}
                      className={`rounded-full border px-3 py-1 text-[10px] transition-colors ${
                        zoneFilter === zone
                          ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.18),rgba(140,174,201,0.14))] text-text-primary"
                          : "border-white/10 bg-black/10 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {zone.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto p-4">
            {sorted.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-muted">
                  No assets match the current filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {sorted.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelected(asset)}
                    className={`group overflow-hidden rounded-lg border text-left transition-all ${
                      selected?.id === asset.id
                        ? "border-accent shadow-[var(--glow-aurum)]"
                        : "border-border-default hover:border-border-hover"
                    }`}
                  >
                    <div className="aspect-square bg-bg-primary">{renderThumb(asset)}</div>
                    <div className="space-y-1 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[10px] text-text-secondary">
                          {asset.asset_type.replace(/_/g, " ")}
                        </p>
                        {asset.is_active && (
                          <span className="rounded-full bg-status-success/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-status-success">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[9px] text-text-muted">
                        {asset.context?.entity_id || asset.file_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="flex w-80 shrink-0 flex-col border-l border-border-default bg-bg-primary">
              <div className="shrink-0 border-b border-border-default p-3">
                <div className="overflow-hidden rounded border border-border-default">
                  {renderDetailPreview(selected)}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Type</p>
                    <p className="text-xs text-text-secondary">{selected.asset_type.replace(/_/g, " ")}</p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Media</p>
                    <p className="text-xs text-text-secondary">{mediaKindForAsset(selected)}</p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Status</p>
                    <p className="text-xs text-text-secondary">
                      {shouldShowInCuratedView(selected) ? "Curated" : "Draft variant"}
                      {selected.sync_status === "synced" ? " • Synced to R2" : " • Local only"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Model</p>
                    <p className="text-xs text-text-secondary">{selected.model.split("/").pop()}</p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Size</p>
                    <p className="text-xs text-text-secondary">
                      {selected.width > 0 && selected.height > 0 ? `${selected.width}x${selected.height}` : "n/a"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Created</p>
                    <p className="text-xs text-text-secondary">{formatDate(selected.created_at)}</p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Variant group</p>
                    <p className="truncate font-mono text-[10px] text-text-muted">
                      {selected.variant_group || "single asset"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Hash</p>
                    <p className="truncate font-mono text-[10px] text-text-muted">{selected.hash.slice(0, 16)}...</p>
                  </div>

                  {selected.sync_status === "synced" && settings?.r2_custom_domain && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">R2 URL</p>
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-accent">
                          {`${settings.r2_custom_domain.replace(/\/$/, "")}/${selected.file_name}`}
                        </p>
                        <button
                          onClick={() => {
                            const url = `${settings.r2_custom_domain.replace(/\/$/, "")}/${selected.file_name}`;
                            navigator.clipboard.writeText(url);
                            setCopiedId(selected.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
                          title="Copy URL"
                        >
                          {copiedId === selected.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {(selected.context?.zone || selected.context?.entity_type) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">Context</p>
                      <p className="text-xs text-text-secondary">
                        {selected.context?.zone || "Global"}
                        {selected.context?.entity_type && (
                          <span className="text-text-muted">
                            {" / "}{selected.context.entity_type}{selected.context.entity_id ? `: ${selected.context.entity_id}` : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Prompt</p>
                    <p className="text-[10px] leading-relaxed text-text-secondary">
                      {selected.prompt.length > 320 ? `${selected.prompt.slice(0, 320)}...` : selected.prompt}
                    </p>
                  </div>

                  {selected.enhanced_prompt && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">Enhanced Prompt</p>
                      <p className="text-[10px] leading-relaxed text-text-secondary">
                        {selected.enhanced_prompt.length > 320
                          ? `${selected.enhanced_prompt.slice(0, 320)}...`
                          : selected.enhanced_prompt}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-border-default p-3">
                <button
                  onClick={() => handleDelete(selected)}
                  disabled={deleting}
                  className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Asset"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
