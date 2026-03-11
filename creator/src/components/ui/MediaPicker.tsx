import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useMediaSrc } from "@/lib/useMediaSrc";
import type { AssetContext } from "@/types/assets";

interface MediaPickerProps {
  /** Current media path (R2 hash, legacy relative, or absolute) */
  value?: string;
  /** Called when user picks a file — receives the local asset path */
  onChange: (path: string | undefined) => void;
  /** "audio" or "video" */
  mediaType: "audio" | "video";
  /** Asset type for manifest */
  assetType?: string;
  context?: AssetContext;
  variantGroup?: string;
  isActive?: boolean;
}

const AUDIO_EXTENSIONS = ["mp3", "ogg", "flac", "wav"];
const VIDEO_EXTENSIONS = ["mp4", "webm"];

export function MediaPicker({
  value,
  onChange,
  mediaType,
  assetType,
  context,
  variantGroup,
  isActive,
}: MediaPickerProps) {
  const importAsset = useAssetStore((s) => s.importAsset);
  const [importing, setImporting] = useState(false);

  const dataSrc = useMediaSrc(value);

  const extensions = mediaType === "audio" ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;

  const handlePick = async () => {
    const path = await open({
      filters: [{
        name: mediaType === "audio" ? "Audio" : "Video",
        extensions,
      }],
      multiple: false,
    });
    if (!path) return;

    setImporting(true);
    try {
      const entry = await importAsset(path, assetType ?? mediaType, context, variantGroup, isActive);
      onChange(entry.file_name);
    } catch (e) {
      console.error("Failed to import media:", e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Preview */}
      {dataSrc && mediaType === "audio" && (
        <audio
          src={dataSrc}
          controls
          className="h-8 w-full"
          preload="metadata"
        />
      )}
      {dataSrc && mediaType === "video" && (
        <video
          src={dataSrc}
          controls
          className="w-full rounded border border-border-default"
          preload="metadata"
        />
      )}

      {/* Pick button */}
      <div className="flex gap-1">
        <button
          onClick={handlePick}
          disabled={importing}
          className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
        >
          {importing ? "Importing..." : `Pick ${mediaType === "audio" ? "Audio" : "Video"}`}
        </button>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            className="rounded px-1.5 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
