import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ConfigPanelProps } from "./types";
import { Section } from "@/components/ui/FormWidgets";
import { useImageSrc } from "@/lib/useImageSrc";
import { useAssetStore } from "@/stores/assetStore";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import type { SyncProgress } from "@/types/assets";

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
    const entry = await importAsset(selected as string, "background");
    if (entry) {
      updateAssets({ ...assets, [key]: entry.file_name });
    }
  }, [assets, importAsset]);

  const sortedEntries = Object.entries(assets).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <>
      <Section title="Global Assets">
        <p className="mb-3 text-xs text-text-secondary">
          Key-value pairs saved to <code className="font-mono text-accent">application.yaml</code> under{" "}
          <code className="font-mono text-accent">ambonmud.images.globalAssets</code>.
          Use the asset generator to create images, then register them here by key name.
        </p>

        {/* Add new */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="new_asset_key"
            className="flex-1 rounded border border-border-default bg-bg-primary px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="rounded bg-gradient-to-r from-accent-muted to-accent px-3 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-40"
          >
            + Add
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || sortedEntries.length === 0}
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
              <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-status-error">
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

        {/* Asset list */}
        {sortedEntries.length === 0 ? (
          <p className="py-4 text-center text-xs italic text-text-muted">
            No global assets registered. Generate art and save it as a global asset, or add a key above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedEntries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded border border-border-default bg-bg-primary/50 px-3 py-2"
              >
                <AssetThumbnail filename={value} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-mono text-xs font-medium text-accent">
                    {key}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-muted">
                      {value || "No image selected"}
                    </span>
                    <button
                      onClick={() => setPickingFor(key)}
                      className="shrink-0 rounded border border-border-default px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
                      title="Pick from asset gallery"
                    >
                      Gallery
                    </button>
                    <button
                      onClick={() => handlePickFromFile(key)}
                      className="shrink-0 rounded border border-border-default px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
                      title="Import from file system"
                    >
                      File...
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(key)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-status-error/20 hover:text-status-error"
                  title="Remove asset"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {pickingFor && (
        <AssetPickerModal
          onSelect={(fileName) => {
            handleValueChange(pickingFor, fileName);
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
    </>
  );
}
