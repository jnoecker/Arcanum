import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ConfigPanelProps } from "./types";
import { Section } from "@/components/ui/FormWidgets";
import { useImageSrc } from "@/lib/useImageSrc";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import {
  REQUIRED_GLOBAL_ASSETS,
  REQUIRED_GLOBAL_ASSET_KEYS,
  type RequiredGlobalAsset,
} from "@/lib/requiredGlobalAssets";
import { BUNDLED_GLOBAL_ASSETS } from "@/assets/global_assets";
import type { SyncProgress } from "@/types/assets";
import { GlobalAssetGeneratorModal } from "./GlobalAssetGeneratorModal";

function AssetThumbnail({ filename, fallback }: { filename: string; fallback?: string }) {
  const src = useImageSrc(filename);
  if (!src && fallback) {
    return (
      <img
        src={fallback}
        alt=""
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded border border-border-default object-cover opacity-60"
      />
    );
  }
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

export function GlobalAssetsPanel({ config, onChange }: ConfigPanelProps) {
  const assets = config.globalAssets;
  const importAsset = useAssetStore((s) => s.importAsset);
  const [newKey, setNewKey] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<RequiredGlobalAsset | null>(null);

  const updateAssets = (next: Record<string, string>) => {
    onChange({ globalAssets: next });
  };

  const handleAdd = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || key in assets) return;
    updateAssets({ ...assets, [key]: "" });
    setNewKey("");
  };

  const handleRemove = (key: string) => {
    const next = { ...assets };
    delete next[key];
    updateAssets(next);
  };

  const handleValueChange = (key: string, value: string) => {
    updateAssets({ ...assets, [key]: value });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await invoke<SyncProgress>("deploy_global_assets_to_r2", {
        globalAssets: assets,
      });
      setDeployResult(result);
    } catch (e) {
      setDeployResult({ total: 0, uploaded: 0, skipped: 0, failed: 1, errors: [String(e)] });
    } finally {
      setDeploying(false);
    }
  }, [assets]);

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
      { zone: "", entity_type: "global_asset", entity_id: key },
      `custom:global:${key}`,
      true,
    );
    if (entry) {
      const latest = useConfigStore.getState().config;
      const currentAssets = latest?.globalAssets ?? {};
      onChange({ globalAssets: { ...currentAssets, [key]: entry.file_name } });
    }
  }, [importAsset, onChange]);

  const customEntries = useMemo(
    () =>
      Object.entries(assets)
        .filter(([key]) => !REQUIRED_GLOBAL_ASSET_KEYS.has(key))
        .sort(([a], [b]) => a.localeCompare(b)),
    [assets],
  );

  const requiredMissingCount = useMemo(
    () => REQUIRED_GLOBAL_ASSETS.filter((a) => !assets[a.key]?.trim()).length,
    [assets],
  );

  const renderRow = (
    key: string,
    value: string,
    options: {
      label?: string;
      description?: string;
      removable: boolean;
      generateSpec?: RequiredGlobalAsset;
      fallback?: string;
    },
  ) => {
    const unset = !value?.trim();
    return (
      <div
        key={key}
        className="flex items-start gap-3 rounded border border-border-default bg-bg-primary/50 px-3 py-2"
      >
        <AssetThumbnail filename={value} fallback={options.fallback} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-medium text-accent">
              {key}
            </span>
            {options.label && (
              <span className="text-2xs text-text-secondary">
                {options.label}
              </span>
            )}
            {unset && !options.removable && (
              <span className="rounded border border-status-warning/40 px-1 text-[9px] uppercase tracking-wide text-status-warning">
                Missing
              </span>
            )}
          </div>
          {options.description && (
            <span className="text-2xs text-text-muted">
              {options.description}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-2xs text-text-muted">
              {value || "No image selected"}
            </span>
            {options.generateSpec && (
              <button
                onClick={() => setGeneratingFor(options.generateSpec!)}
                className="shrink-0 rounded border border-accent/40 px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10"
                title="Generate with default prompt"
              >
                Generate
              </button>
            )}
            <button
              onClick={() => setPickingFor(key)}
              className="shrink-0 rounded border border-border-default px-2 py-0.5 text-2xs text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
              title="Pick from asset gallery"
            >
              Gallery
            </button>
            <button
              onClick={() => handlePickFromFile(key)}
              className="shrink-0 rounded border border-border-default px-2 py-0.5 text-2xs text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
              title="Import from file system"
            >
              File...
            </button>
          </div>
        </div>
        {options.removable && (
          <button
            onClick={() => handleRemove(key)}
            className="shrink-0 rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-status-error/20 hover:text-status-error"
            title="Remove asset"
          >
            &times;
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <Section title="Global Assets">
        <p className="mb-3 text-xs text-text-secondary">
          Key-value pairs saved to <code className="font-mono text-accent">application.yaml</code> under{" "}
          <code className="font-mono text-accent">ambonmud.images.globalAssets</code>.
          Use the asset generator to create images, then register them here by key name.
        </p>

        {/* Deploy controls */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={handleDeploy}
            disabled={
              deploying ||
              (Object.keys(assets).length === 0 && customEntries.length === 0)
            }
            className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {deploying ? "Deploying..." : "Deploy to R2"}
          </button>
        </div>

        {/* Deploy result banner */}
        {deployResult && (
          <div className="mb-4 rounded border border-border-default bg-bg-elevated px-3 py-2">
            <div className="flex items-center gap-3 text-xs">
              {deployResult.uploaded > 0 && (
                <span className="text-status-success">
                  {deployResult.uploaded} uploaded
                </span>
              )}
              {deployResult.skipped > 0 && (
                <span className="text-text-muted">
                  {deployResult.skipped} already synced
                </span>
              )}
              {deployResult.failed > 0 && (
                <span className="text-status-error">
                  {deployResult.failed} failed
                </span>
              )}
              <button
                onClick={() => setDeployResult(null)}
                className="ml-auto text-text-muted hover:text-text-primary"
              >
                &times;
              </button>
            </div>
            {deployResult.errors.length > 0 && (
              <div className="mt-1 max-h-20 overflow-y-auto text-2xs text-status-error">
                {deployResult.errors.slice(0, 10).map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
                {deployResult.errors.length > 10 && (
                  <div>...and {deployResult.errors.length - 10} more</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Required section */}
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="font-display text-xs uppercase tracking-wider text-accent">
              Required by MUD
            </h4>
            <span className="text-2xs text-text-muted">
              {requiredMissingCount > 0
                ? `${requiredMissingCount} missing`
                : "All assigned"}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {REQUIRED_GLOBAL_ASSETS.map((spec: RequiredGlobalAsset) =>
              renderRow(spec.key, assets[spec.key] ?? "", {
                label: spec.label,
                description: spec.description,
                removable: false,
                generateSpec: spec,
                fallback: BUNDLED_GLOBAL_ASSETS[spec.key],
              }),
            )}
          </div>
        </div>

        {/* Custom section */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="font-display text-xs uppercase tracking-wider text-text-secondary">
              Custom
            </h4>
            <span className="text-2xs text-text-muted">
              {customEntries.length} {customEntries.length === 1 ? "key" : "keys"}
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="new_asset_key"
              className="flex-1 rounded border border-border-default bg-bg-primary px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,opacity] hover:bg-accent/90 disabled:opacity-40"
            >
              + Add
            </button>
          </div>
          {customEntries.length === 0 ? (
            <p className="py-3 text-center text-2xs italic text-text-muted">
              No custom global assets. Add a key above for project-specific overlays.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {customEntries.map(([key, value]) =>
                renderRow(key, value, { removable: true }),
              )}
            </div>
          )}
        </div>
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
          asset={generatingFor}
          onClose={() => setGeneratingFor(null)}
          onComplete={(fileName) => {
            const latest = useConfigStore.getState().config;
            const currentAssets = latest?.globalAssets ?? {};
            onChange({
              globalAssets: { ...currentAssets, [generatingFor.key]: fileName },
            });
          }}
        />
      )}
    </>
  );
}
