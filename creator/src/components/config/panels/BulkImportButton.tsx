import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";

interface BulkImportResult {
  imported: number;
  skipped: number;
  mapping: Array<{ original_name: string; file_name: string }>;
  errors: string[];
}

interface BulkImportButtonProps {
  assetType: string;
  entityType: string;
  label: string;
  onImported: (mapping: BulkImportResult["mapping"]) => void;
}

export function BulkImportButton({
  assetType,
  entityType,
  label,
  onImported,
}: BulkImportButtonProps) {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const handleImport = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    setImporting(true);
    setLastResult(null);
    try {
      const result = await invoke<BulkImportResult>("bulk_import_images", {
        sourceDir: selected,
        assetType,
        entityType,
      });

      if (result.errors.length > 0) {
        console.warn(`[bulk-import] Errors:`, result.errors);
      }

      setLastResult(
        `${result.imported} imported, ${result.skipped} skipped` +
          (result.errors.length > 0 ? `, ${result.errors.length} errors` : ""),
      );

      if (result.mapping.length > 0) {
        onImported(result.mapping);
        await loadAssets();
      }
    } catch (e) {
      setLastResult(`Error: ${e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-2 flex items-center gap-3">
      <button
        type="button"
        className="rounded border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-display text-accent hover:bg-accent/20 disabled:opacity-50"
        onClick={handleImport}
        disabled={importing}
      >
        {importing ? "Importing..." : label}
      </button>
      {lastResult && (
        <span className="text-2xs text-text-muted">{lastResult}</span>
      )}
    </div>
  );
}
