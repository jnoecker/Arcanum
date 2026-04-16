import { useEffect, useRef } from "react";
import { SketchCanvas } from "./SketchCanvas";

interface Props {
  open: boolean;
  title?: string;
  width?: number;
  height?: number;
  initialDataUrl?: string | null;
  assetType?: string;
  onClose: () => void;
  onSave: (entry: { file_name: string; width: number; height: number }) => void;
}

export function SketchDialog({
  open,
  title = "Sketch",
  width,
  height,
  initialDataUrl,
  assetType,
  onClose,
  onSave,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const stashedFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    stashedFocus.current = document.activeElement;
    surfaceRef.current?.focus();
    return () => {
      (stashedFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const labelId = "sketch-dialog-title";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-abyss/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col gap-3 rounded-2xl border border-text-primary/10 bg-bg-panel p-5 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <h2 id={labelId} className="font-display text-lg text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="focus-ring rounded-full px-2.5 py-1 text-xs text-text-muted hover:bg-text-primary/6 hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <SketchCanvas
          width={width}
          height={height}
          initialDataUrl={initialDataUrl}
          assetType={assetType}
          onCancel={onClose}
          onSave={(entry) => {
            onSave(entry);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
