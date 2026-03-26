import { memo, useState, useEffect } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import type { AssetEntry } from "@/types/assets";

interface VariantStripProps {
  variantGroup: string;
  onSelect: (entry: AssetEntry) => void;
}

export function VariantStrip({ variantGroup, onSelect }: VariantStripProps) {
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [variants, setVariants] = useState<AssetEntry[]>([]);

  useEffect(() => {
    if (!variantGroup) return;
    listVariants(variantGroup).then(setVariants).catch(() => {});
  }, [variantGroup, listVariants]);

  // Also refresh when assets change
  const assetCount = useAssetStore((s) => s.assets.length);
  useEffect(() => {
    if (!variantGroup) return;
    listVariants(variantGroup).then(setVariants).catch(() => {});
  }, [assetCount, variantGroup, listVariants]);

  if (variants.length === 0) return null;

  const handleSelect = async (entry: AssetEntry) => {
    await setActiveVariant(variantGroup, entry.id);
    onSelect(entry);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs text-text-muted">
        Variants ({variants.length})
      </span>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {variants.map((v) => (
          <VariantThumb
            key={v.id}
            entry={v}
            assetsDir={assetsDir}
            onSelect={() => handleSelect(v)}
          />
        ))}
      </div>
    </div>
  );
}

const VariantThumb = memo(function VariantThumb({
  entry,
  assetsDir,
  onSelect,
}: {
  entry: AssetEntry;
  assetsDir: string;
  onSelect: () => void;
}) {
  const imagePath = `${assetsDir}\\images\\${entry.file_name}`;
  const src = useImageSrc(imagePath);

  return (
    <button
      onClick={onSelect}
      title={`${entry.created_at}\n${entry.prompt}`}
      className={`relative h-10 w-10 shrink-0 overflow-hidden rounded border transition-colors ${
        entry.is_active
          ? "border-accent ring-1 ring-accent/50"
          : "border-border-default hover:border-accent/50"
      }`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-bg-elevated" />
      )}
    </button>
  );
});
