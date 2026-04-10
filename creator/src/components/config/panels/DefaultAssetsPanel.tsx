import { useState, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ConfigPanelProps } from "./types";
import { Section } from "@/components/ui/FormWidgets";
import { useImageSrc } from "@/lib/useImageSrc";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import {
  REQUIRED_DEFAULT_ASSETS,
  DEFAULT_ASSET_CATEGORIES,
  type RequiredDefaultAsset,
} from "@/lib/requiredDefaultAssets";
import type { RequiredGlobalAsset } from "@/lib/requiredGlobalAssets";
import { GlobalAssetGeneratorModal } from "./GlobalAssetGeneratorModal";

function AssetThumbnail({ filename }: { filename: string }) {
  const src = useImageSrc(filename);
  if (!src) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border-default bg-bg-primary text-[8px] text-text-muted">
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded border border-border-default object-cover"
    />
  );
}

export function DefaultAssetsPanel({ config, onChange }: ConfigPanelProps) {
  const assets = config.defaultAssets;
  const importAsset = useAssetStore((s) => s.importAsset);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<RequiredDefaultAsset | null>(null);

  const updateAssets = (next: Record<string, string>) => {
    onChange({ defaultAssets: next });
  };

  const handleValueChange = (key: string, value: string) => {
    updateAssets({ ...assets, [key]: value });
  };

  const handleClear = (key: string) => {
    updateAssets({ ...assets, [key]: "" });
  };

  const handlePickFromFile = useCallback(async (key: string) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!selected) return;
    const filePath = Array.isArray(selected) ? selected[0] : selected;
    if (!filePath) return;
    const entry = await importAsset(
      filePath,
      "background",
      { zone: "", entity_type: "default_asset", entity_id: key },
      `default:${key}`,
      true,
    );
    if (entry) {
      const latest = useConfigStore.getState().config;
      const currentAssets = latest?.defaultAssets ?? {};
      onChange({ defaultAssets: { ...currentAssets, [key]: entry.file_name } });
    }
  }, [importAsset, onChange]);

  const byCategory = useMemo(() => {
    const map = new Map<string, RequiredDefaultAsset[]>();
    for (const cat of DEFAULT_ASSET_CATEGORIES) {
      map.set(cat.id, []);
    }
    for (const spec of REQUIRED_DEFAULT_ASSETS) {
      const list = map.get(spec.category);
      if (list) list.push(spec);
    }
    return map;
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; assigned: number }> = {};
    for (const cat of DEFAULT_ASSET_CATEGORIES) {
      const catAssets = byCategory.get(cat.id) ?? [];
      counts[cat.id] = {
        total: catAssets.length,
        assigned: catAssets.filter((a) => !!assets[a.key]?.trim()).length,
      };
    }
    return counts;
  }, [assets, byCategory]);

  const renderRow = (spec: RequiredDefaultAsset) => {
    const value = assets[spec.key] ?? "";
    const unset = !value.trim();
    return (
      <div
        key={spec.key}
        className="flex items-start gap-3 rounded border border-border-default bg-bg-primary/50 px-3 py-2"
      >
        <AssetThumbnail filename={value} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-medium text-accent">
              {spec.key}
            </span>
            <span className="text-2xs text-text-secondary">
              {spec.label}
            </span>
            <span className="rounded border border-border-default px-1 text-[9px] font-mono text-text-muted">
              {spec.width}x{spec.height}
            </span>
            {unset && (
              <span className="rounded border border-text-muted/40 px-1 text-[9px] uppercase tracking-wide text-text-muted">
                Using MUD default
              </span>
            )}
          </div>
          <span className="text-2xs text-text-muted">
            {spec.description}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-2xs text-text-muted">
              {value || "No override selected"}
            </span>
            <button
              onClick={() => setGeneratingFor(spec)}
              className="shrink-0 rounded border border-accent/40 px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10"
              title="Generate with default prompt"
            >
              Generate
            </button>
            <button
              onClick={() => setPickingFor(spec.key)}
              className="shrink-0 rounded border border-border-default px-2 py-0.5 text-2xs text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
              title="Pick from asset gallery"
            >
              Gallery
            </button>
            <button
              onClick={() => handlePickFromFile(spec.key)}
              className="shrink-0 rounded border border-border-default px-2 py-0.5 text-2xs text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
              title="Import from file system"
            >
              File...
            </button>
            {!unset && (
              <button
                onClick={() => handleClear(spec.key)}
                className="shrink-0 rounded border border-border-default px-2 py-0.5 text-2xs text-text-muted transition-colors hover:border-status-error/50 hover:text-status-error"
                title="Clear override and use MUD default"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Section title="Default Assets">
        <p className="mb-4 text-xs text-text-secondary">
          Default fallback sprites shipped with AmbonMUD. The server uses these when a zone
          entity has no custom image assigned. Override any default by generating or importing
          a replacement.
        </p>

        {DEFAULT_ASSET_CATEGORIES.map((cat) => {
          const catAssets = byCategory.get(cat.id) ?? [];
          const counts = categoryCounts[cat.id];
          if (catAssets.length === 0) return null;
          return (
            <div key={cat.id} className="mb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="font-display text-xs uppercase tracking-wider text-accent">
                  {cat.label}
                </h4>
                <span className="text-2xs text-text-muted">
                  {counts ? `${counts.assigned} of ${counts.total} assigned` : ""}
                </span>
              </div>
              <p className="mb-2 text-2xs text-text-muted">
                {cat.description}
              </p>
              <div className="flex flex-col gap-2">
                {catAssets.map((spec) => renderRow(spec))}
              </div>
            </div>
          );
        })}
      </Section>

      {pickingFor && (
        <AssetPickerModal
          onSelect={(fileName) => {
            handleValueChange(pickingFor, fileName);
          }}
          onClose={() => setPickingFor(null)}
        />
      )}

      {generatingFor && (
        <GlobalAssetGeneratorModal
          asset={generatingFor as unknown as RequiredGlobalAsset}
          onClose={() => setGeneratingFor(null)}
          onComplete={(fileName) => {
            const latest = useConfigStore.getState().config;
            const currentAssets = latest?.defaultAssets ?? {};
            onChange({
              defaultAssets: { ...currentAssets, [generatingFor.key]: fileName },
            });
          }}
        />
      )}
    </>
  );
}
