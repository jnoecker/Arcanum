import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GeneratedImage } from "@/types/assets";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function MapEnhancer({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.65);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(generating ? undefined : onClose);

  // Load the map image onto canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawCanvas(img, null);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawCanvas = useCallback(
    (img: HTMLImageElement, rect: CropRect | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Scale to fit the container
      const maxW = 800;
      const scale = Math.min(maxW / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (rect) {
        // Darken outside the crop
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Clear the crop area to show original
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        ctx.drawImage(
          img,
          rect.x / scale, rect.y / scale, rect.w / scale, rect.h / scale,
          rect.x, rect.y, rect.w, rect.h,
        );
        // Draw crop border
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.setLineDash([]);
      }
    },
    [],
  );

  const getCanvasScale = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return 1;
    return canvas.width / img.width;
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDragStart({ x, y });
      setDragging(true);
      setCrop(null);
      setPreviewUrl(null);
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || !dragStart || !imgRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cropRect: CropRect = {
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        w: Math.abs(x - dragStart.x),
        h: Math.abs(y - dragStart.y),
      };
      setCrop(cropRect);
      drawCanvas(imgRef.current, cropRect);
    },
    [dragging, dragStart, drawCanvas],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragStart(null);
  }, []);

  const extractCropBase64 = useCallback((): string | null => {
    if (!crop || !imgRef.current) return null;
    const scale = getCanvasScale();
    // Extract from the original image at full resolution
    const srcX = crop.x / scale;
    const srcY = crop.y / scale;
    const srcW = crop.w / scale;
    const srcH = crop.h / scale;

    const offscreen = document.createElement("canvas");
    offscreen.width = Math.round(srcW);
    offscreen.height = Math.round(srcH);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      imgRef.current,
      srcX, srcY, srcW, srcH,
      0, 0, offscreen.width, offscreen.height,
    );
    return offscreen.toDataURL("image/png");
  }, [crop]);

  const handleGenerate = useCallback(async () => {
    if (!crop || !prompt.trim()) return;
    const base64 = extractCropBase64();
    if (!base64) return;

    setGenerating(true);
    setError(null);
    try {
      // Round dimensions to nearest 64 for model compatibility
      const scale = getCanvasScale();
      const w = Math.round((crop.w / scale) / 64) * 64 || 512;
      const h = Math.round((crop.h / scale) / 64) * 64 || 512;

      const result = await invoke<GeneratedImage>("img2img_generate", {
        prompt: prompt.trim(),
        imageBase64: base64,
        width: Math.min(w, 1920),
        height: Math.min(h, 1920),
        strength,
        assetType: "zone_map",
      });

      setPreviewUrl(result.data_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [crop, prompt, strength, extractCropBase64]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-abyss/70"
      onClick={(e) => {
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-enhance-title"
        aria-describedby="map-enhance-description"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-3xl border border-[var(--chrome-stroke)] bg-bg-secondary p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <h3 id="map-enhance-title" className="font-display text-xl text-text-primary">Enhance Map Region</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-tertiary hover:text-text-primary">
            Close
          </button>
        </div>

        <p id="map-enhance-description" className="text-xs text-text-muted">
          Draw a rectangle on the map to select a region, then describe how the AI should enhance it.
        </p>

        {/* Canvas */}
        <div className="overflow-auto rounded-lg border border-border-muted bg-bg-abyss">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Map region selector — draw a rectangle to select an area"
            className="cursor-crosshair touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              if (!touch) return;
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) return;
              handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as unknown as React.MouseEvent<HTMLCanvasElement>);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              if (!touch) return;
              handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as unknown as React.MouseEvent<HTMLCanvasElement>);
            }}
            onTouchEnd={() => handleMouseUp()}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Enhancement prompt</label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Detailed fantasy forest with ancient ruins, hand-drawn map style..."
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="enhance-strength" className="text-xs text-text-muted">Strength:</label>
              <input
                id="enhance-strength"
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="w-24 accent-accent"
              />
              <span className="w-8 text-xs text-text-secondary">{strength.toFixed(2)}</span>
            </div>
            <span className="text-2xs text-text-muted">
              Lower = keep more of original, higher = more AI creativity
            </span>
          </div>

          {error && <p role="alert" className="text-xs text-status-error">{error}</p>}

          {/* Preview */}
          {previewUrl && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              <p className="mb-2 text-xs text-accent">Preview — enhanced region:</p>
              <img src={previewUrl} alt="Enhanced" className="max-h-64 rounded" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !crop || !prompt.trim()}
            className="rounded-full border border-[rgb(var(--accent-rgb)/0.28)] bg-gradient-active-strong px-5 py-2 text-xs font-medium text-text-primary transition enabled:hover:shadow-glow disabled:opacity-40"
          >
            {generating ? "Enhancing..." : "Enhance Region"}
          </button>
        </div>
      </div>
    </div>
  );
}
