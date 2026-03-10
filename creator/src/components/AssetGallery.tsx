import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import type { AssetEntry, AssetType, SyncProgress } from "@/types/assets";

/** Triggers image loading when the element scrolls into view. */
function LazyImage({
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
      <div className="h-4 w-4 rounded-full border border-border-default border-t-accent animate-spin" />
    </div>
  );
}

type SortKey = "newest" | "oldest" | "type";

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
  const [filter, setFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [syncResult, setSyncResult] = useState<SyncProgress | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasR2 = !!(settings?.r2_account_id && settings?.r2_bucket && settings?.r2_access_key_id);
  const unsyncedCount = assets.filter((a) => a.sync_status !== "synced").length;

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const types = Array.from(new Set(assets.map((a) => a.asset_type)));
  const zones = Array.from(new Set(assets.map((a) => a.context?.zone).filter(Boolean))) as string[];
  const hasGlobalAssets = assets.some((a) => !a.context?.zone);

  const filtered = assets.filter(
    (a) =>
      (filter === "all" || a.asset_type === filter) &&
      (zoneFilter === "all" ||
        (zoneFilter === "__global__" ? !a.context?.zone : a.context?.zone === zoneFilter)),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "newest") return b.created_at.localeCompare(a.created_at);
    if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
    return a.asset_type.localeCompare(b.asset_type);
  });

  const loadImage = useCallback(
    (entry: AssetEntry) => {
      if (imageCache[entry.id]) return;
      const path = `${assetsDir}\\images\\${entry.file_name}`;
      invoke<string>("read_image_data_url", { path }).then((dataUrl) => {
        setImageCache((prev) => ({ ...prev, [entry.id]: dataUrl }));
      }).catch(() => {});
    },
    [assetsDir, imageCache],
  );

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
    const files = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!files) return;
    const paths = Array.isArray(files) ? files : [files];
    setImporting(true);
    try {
      for (const filePath of paths) {
        // Infer asset type from current filter, default to "background"
        const assetType: AssetType = filter !== "all" ? filter as AssetType : "background";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm tracking-wide text-text-primary">
              Asset Gallery
            </h2>
            <span className="text-xs text-text-muted">
              {sorted.length} asset{sorted.length !== 1 ? "s" : ""}
            </span>
            <div className="mx-1 h-4 w-px bg-border-default" />
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
            {hasR2 && (
              <>
                <div className="mx-1 h-4 w-px bg-border-default" />
                <button
                  onClick={async () => {
                    const result = await syncToR2();
                    setSyncResult(result);
                  }}
                  disabled={syncing || unsyncedCount === 0}
                  className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors enabled:bg-accent/15 enabled:text-accent enabled:hover:bg-accent/25 disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-50"
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
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {/* Filters */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border-default px-5 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                filter === "all"
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              All
            </button>
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                  filter === type
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {(zones.length > 0 || hasGlobalAssets) && (
            <>
              <div className="mx-1 h-4 w-px bg-border-default" />
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setZoneFilter("all")}
                  className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                    zoneFilter === "all"
                      ? "bg-accent/20 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  All zones
                </button>
                {hasGlobalAssets && (
                  <button
                    onClick={() => setZoneFilter("__global__")}
                    className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                      zoneFilter === "__global__"
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    Global
                  </button>
                )}
                {zones.map((zone) => (
                  <button
                    key={zone}
                    onClick={() => setZoneFilter(zone)}
                    className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                      zoneFilter === zone
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {zone.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="ml-auto flex gap-1">
            {(["newest", "oldest", "type"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                  sort === key
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1">
          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {sorted.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-muted">
                  No assets yet. Generate some art to see them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {sorted.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelected(asset)}
                    className={`group overflow-hidden rounded-lg border transition-all ${
                      selected?.id === asset.id
                        ? "border-accent shadow-[var(--glow-aurum)]"
                        : "border-border-default hover:border-border-hover"
                    }`}
                  >
                    <div className="aspect-square bg-bg-primary">
                      {imageCache[asset.id] ? (
                        <img
                          src={imageCache[asset.id]}
                          alt={asset.prompt.slice(0, 60)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <LazyImage asset={asset} onVisible={loadImage} />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-[10px] text-text-secondary">
                        {asset.asset_type.replace(/_/g, " ")}
                      </p>
                      <p className="truncate text-[9px] text-text-muted">
                        {asset.model.split("/").pop()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="flex w-72 shrink-0 flex-col border-l border-border-default bg-bg-primary">
              {/* Preview */}
              <div className="shrink-0 border-b border-border-default p-3">
                <div className="overflow-hidden rounded border border-border-default">
                  {imageCache[selected.id] && (
                    <img
                      src={imageCache[selected.id]}
                      alt="Selected asset"
                      className="w-full"
                    />
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Type
                    </p>
                    <p className="text-xs text-text-secondary">
                      {selected.asset_type.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Model
                    </p>
                    <p className="text-xs text-text-secondary">
                      {selected.model.split("/").pop()}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Size
                    </p>
                    <p className="text-xs text-text-secondary">
                      {selected.width}x{selected.height}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Created
                    </p>
                    <p className="text-xs text-text-secondary">
                      {formatDate(selected.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Hash
                    </p>
                    <p className="truncate font-mono text-[10px] text-text-muted">
                      {selected.hash.slice(0, 16)}...
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Sync
                    </p>
                    <p className={`text-xs ${selected.sync_status === "synced" ? "text-status-success" : "text-text-muted"}`}>
                      {selected.sync_status === "synced" ? "Synced to R2" : "Local only"}
                    </p>
                  </div>

                  {selected.sync_status === "synced" && settings?.r2_custom_domain && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        R2 URL
                      </p>
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

                  {selected.context?.zone && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Context
                      </p>
                      <p className="text-xs text-text-secondary">
                        {selected.context.zone.replace(/_/g, " ")}
                        {selected.context.entity_type && (
                          <span className="text-text-muted">
                            {" / "}{selected.context.entity_type}{selected.context.entity_id ? `: ${selected.context.entity_id}` : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Prompt
                    </p>
                    <p className="text-[10px] leading-relaxed text-text-secondary">
                      {selected.prompt.length > 300
                        ? `${selected.prompt.slice(0, 300)}...`
                        : selected.prompt}
                    </p>
                  </div>

                  {selected.enhanced_prompt && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Enhanced Prompt
                      </p>
                      <p className="text-[10px] leading-relaxed text-text-secondary">
                        {selected.enhanced_prompt.length > 300
                          ? `${selected.enhanced_prompt.slice(0, 300)}...`
                          : selected.enhanced_prompt}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
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
