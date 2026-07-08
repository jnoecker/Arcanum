import { useEffect, useState } from "react";
import type { AssetEntry } from "@/types/assets";
import { useImageSrc } from "@/lib/useImageSrc";
import { ImageLightbox } from "./ImageLightbox";

interface VariantLightboxProps {
  variants: AssetEntry[];
  initialIndex: number;
  assetsDir: string;
  onSetPrimary: (entry: AssetEntry) => void | Promise<void>;
  onClose: () => void;
  /** Overrides the default `entry.is_active` primary check. */
  isPrimary?: (entry: AssetEntry) => boolean;
}

/**
 * Full-screen preview for an asset's variant group: pan/zoom via
 * ImageLightbox, ◀ ▶ / arrow-key navigation between variants, and an
 * explicit "Set as primary" action so browsing never commits a change.
 */
export function VariantLightbox({
  variants,
  initialIndex,
  assetsDir,
  onSetPrimary,
  onClose,
  isPrimary,
}: VariantLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [setting, setSetting] = useState(false);

  const count = variants.length;
  const clamped = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const entry = variants[clamped];
  const src = useImageSrc(entry ? `${assetsDir}\\images\\${entry.file_name}` : undefined);

  useEffect(() => {
    if (count === 0) onClose();
  }, [count, onClose]);

  if (!entry) return null;

  const primary = isPrimary ? isPrimary(entry) : entry.is_active;
  const multi = count > 1;

  const handleSetPrimary = async () => {
    if (primary || setting) return;
    setSetting(true);
    try {
      await onSetPrimary(entry);
    } finally {
      setSetting(false);
    }
  };

  return (
    <ImageLightbox
      src={src ?? ""}
      onClose={onClose}
      caption={multi ? `${clamped + 1} / ${count}` : undefined}
      onPrev={multi ? () => setIndex((i) => (i - 1 + count) % count) : undefined}
      onNext={multi ? () => setIndex((i) => (i + 1) % count) : undefined}
      actions={
        <button
          className="art-lightbox__btn art-lightbox__btn--primary"
          onClick={handleSetPrimary}
          disabled={primary || setting}
        >
          {primary ? "✦ Primary" : setting ? "Setting…" : "✦ Set as primary"}
        </button>
      }
    />
  );
}
