import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActionButton } from "./FormWidgets";

type Tool = "pen" | "eraser" | "fill";

const PALETTE = [
  "#1a1f24", // near-black
  "#5a4a36", // earth
  "#8b5e3c", // clay
  "#c87f4b", // ember
  "#e7c477", // aurum
  "#6a7f5b", // moss
  "#3a6b80", // tide
  "#b34d4d", // rust
  "#d8c8b2", // parchment
  "#f4ecdc", // paper
];

const SIZES = [2, 4, 8, 16, 28];

interface Props {
  width?: number;
  height?: number;
  initialDataUrl?: string | null;
  onCancel: () => void;
  onSave: (entry: { file_name: string; width: number; height: number }) => void;
  assetType?: string;
}

export function SketchCanvas({
  width = 1024,
  height = 768,
  initialDataUrl = null,
  onCancel,
  onSave,
  assetType = "lore_map",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(PALETTE[0]!);
  const [size, setSize] = useState<number>(SIZES[1]!);
  const [bgColor, setBgColor] = useState<string>("#f4ecdc");
  const [saving, setSaving] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);

  // Prime the canvas with the background + optional initial image.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        pushHistory();
      };
      img.src = initialDataUrl;
    } else {
      pushHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(snap);
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const current = historyRef.current.pop();
    if (current) redoRef.current.push(current);
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev) ctx.putImageData(prev, 0, 0);
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const next = redoRef.current.pop();
    if (!next) return;
    ctx.putImageData(next, 0, 0);
    historyRef.current.push(next);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }, [bgColor, pushHistory]);

  // Fill the whole canvas with a color (useful before sketching).
  const fillBackground = useCallback(
    (newColor: string) => {
      setBgColor(newColor);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Composite new bg under the current strokes so lines remain visible.
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = newColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(snap, 0, 0, 0, 0, canvas.width, canvas.height);
      pushHistory();
    },
    [pushHistory],
  );

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = getPoint(e);
    drawSegment(lastPoint.current, lastPoint.current, e.pressure || 0.5);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPoint.current) return;
    const p = getPoint(e);
    drawSegment(lastPoint.current, p, e.pressure || 0.5);
    lastPoint.current = p;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    drawing.current = false;
    lastPoint.current = null;
    pushHistory();
  };

  function drawSegment(a: { x: number; y: number }, b: { x: number; y: number }, pressure: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const effectiveSize = Math.max(1, size * (0.5 + pressure));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = effectiveSize;
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = bgColor;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const bytesB64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      const entry = await invoke<{ file_name: string; width: number; height: number }>(
        "save_bytes_as_asset",
        {
          bytesB64,
          assetType,
        },
      );
      onSave(entry);
    } catch (err) {
      console.error("Failed to save sketch:", err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, undo, redo]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-text-primary/8 bg-bg-abyss/20 p-2">
        {/* Tool */}
        <div className="flex items-center gap-0.5 rounded-lg border border-text-primary/8 p-0.5">
          {(["pen", "eraser"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`focus-ring rounded px-2.5 py-1 text-xs ${
                tool === t
                  ? "bg-accent/20 text-accent"
                  : "text-text-secondary hover:bg-text-primary/5"
              }`}
            >
              {t === "pen" ? "Pen" : "Eraser"}
            </button>
          ))}
        </div>

        {/* Size */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted">Size</span>
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`focus-ring flex h-7 w-7 items-center justify-center rounded ${
                size === s
                  ? "bg-accent/20"
                  : "hover:bg-text-primary/5"
              }`}
              title={`${s}px`}
            >
              <span
                className="block rounded-full bg-text-primary"
                style={{
                  width: `${Math.min(s, 20)}px`,
                  height: `${Math.min(s, 20)}px`,
                  opacity: size === s ? 1 : 0.65,
                }}
              />
            </button>
          ))}
        </div>

        {/* Color palette */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted">Color</span>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`focus-ring h-6 w-6 rounded-full border transition ${
                color === c ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-abyss" : ""
              }`}
              style={{ background: c, borderColor: "rgb(var(--text-rgb) / 0.3)" }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-text-primary/20 bg-transparent"
            title="Custom color"
          />
        </div>

        {/* Background */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted">BG</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => fillBackground(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-text-primary/20 bg-transparent"
            title="Background color"
          />
        </div>

        <div className="flex-1" />

        {/* History + clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            className="focus-ring rounded px-2.5 py-1 text-xs text-text-secondary hover:bg-text-primary/5"
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            onClick={redo}
            className="focus-ring rounded px-2.5 py-1 text-xs text-text-secondary hover:bg-text-primary/5"
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
          <button
            onClick={clear}
            className="focus-ring rounded px-2.5 py-1 text-xs text-text-muted hover:text-status-danger"
            title="Clear canvas"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-text-primary/10 bg-bg-abyss/40 p-3">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block max-h-full max-w-full cursor-crosshair touch-none"
          style={{
            background: bgColor,
            boxShadow: "0 8px 24px rgb(var(--shadow-rgb) / 0.35)",
            aspectRatio: `${width} / ${height}`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <span className="text-2xs text-text-muted">
          {width} × {height} · Pointer-aware (pen pressure supported)
        </span>
        <div className="flex items-center gap-2">
          <ActionButton onClick={onCancel} variant="ghost">
            Cancel
          </ActionButton>
          <ActionButton onClick={handleSave} variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save sketch"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
