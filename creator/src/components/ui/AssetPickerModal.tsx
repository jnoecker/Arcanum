import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { AssetEntry } from "@/types/assets";

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
      <div className="h-4 w-4 rounded-full border border-border-default border-t-accent animate-spin" />
    </div>
  );
}

export type AssetPickerMediaKind = "image" | "audio" | "video";

interface AssetPickerModalProps {
  onSelect: (fileName: string) => void;
  onClose: () => void;
  /** Which kind of media to show — defaults to "image" */
  mediaKind?: AssetPickerMediaKind;
  /** Pre-select a filter tab by asset_type (e.g. "entity_portrait") */
  initialFilter?: string;
}

const MEDIA_KIND_EXTENSIONS: Record<AssetPickerMediaKind, RegExp> = {
  image: /\.(png|jpe?g|webp)$/i,
  audio: /\.(mp3|ogg|flac|wav)$/i,
  video: /\.(mp4|webm)$/i,
};

const MEDIA_KIND_LABELS: Record<AssetPickerMediaKind, { title: string; noun: string; plural: string }> = {
  image: { title: "Pick an Asset", noun: "image", plural: "images" },
  audio: { title: "Pick an Audio Clip", noun: "clip", plural: "clips" },
  video: { title: "Pick a Video", noun: "video", plural: "videos" },
};

export function AssetPickerModal({
  onSelect,
  onClose,
  mediaKind = "image",
  initialFilter,
}: AssetPickerModalProps) {
  const assets = useAssetStore((s) => s.assets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const [filter, setFilter] = useState<string>(initialFilter ?? "all");
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const kindLabels = MEDIA_KIND_LABELS[mediaKind];
  const extensionPattern = MEDIA_KIND_EXTENSIONS[mediaKind];

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Only surface filter tabs for types that actually contain this media kind
  const types = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter((a) => extensionPattern.test(a.file_name))
            .map((a) => a.asset_type),
        ),
      ),
    [assets, extensionPattern],
  );

  const sorted = useMemo(() => {
    const matching = assets.filter(
      (a) =>
        (filter === "all" || a.asset_type === filter) &&
        extensionPattern.test(a.file_name),
    );
    return [...matching].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }, [assets, filter, extensionPattern]);

  const loadImage = useCallback(
    (entry: AssetEntry) => {
      if (imageCache[entry.id]) return;
      const path = `${assetsDir}\\images\\${entry.file_name}`;
      invoke<string>("read_image_data_url", { path })
        .then((dataUrl) => {
          setImageCache((prev) => ({ ...prev, [entry.id]: dataUrl }));
        })
        .catch(() => {});
    },
    [assetsDir, imageCache],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="asset-picker-title" className="mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 id="asset-picker-title" className="font-display text-sm tracking-wide text-text-primary">
              {kindLabels.title}
            </h2>
            <span className="text-xs text-text-muted">
              {sorted.length} {sorted.length === 1 ? kindLabels.noun : kindLabels.plural}
            </span>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {/* Type filters */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border-default px-5 py-2" role="group" aria-label="Filter assets by type">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-0.5 text-2xs transition-colors ${
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
              className={`rounded px-2 py-0.5 text-2xs transition-colors ${
                filter === type
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {type.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-text-muted">
                {mediaKind === "image"
                  ? "No images in the library yet. Use the Generator to conjure some."
                  : `No ${kindLabels.plural} in the library yet. Import one to get started.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {sorted.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset.file_name);
                    onClose();
                  }}
                  className="group overflow-hidden rounded-lg border border-border-default transition-[border-color,box-shadow] hover:border-accent hover:shadow-[var(--glow-aurum)]"
                  title={`${asset.asset_type} — ${asset.file_name}`}
                >
                  <div className="aspect-square bg-bg-primary">
                    {mediaKind === "image" ? (
                      imageCache[asset.id] ? (
                        <img
                          src={imageCache[asset.id]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <LazyThumb asset={asset} onVisible={loadImage} />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-text-muted" aria-label={mediaKind === "audio" ? "Audio file" : "Video file"}>
                        {mediaKind === "audio" ? "♪" : "▶"}
                      </div>
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <p className="truncate text-3xs text-text-muted">
                      {asset.asset_type.replace(/_/g, " ")}
                    </p>
                    {mediaKind !== "image" && (
                      <p className="truncate text-3xs text-text-secondary" title={asset.file_name}>
                        {asset.file_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
