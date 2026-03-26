import { useRef, useEffect, useCallback, useState } from "react";

interface SketchCanvasProps {
  width?: number;
  height?: number;
  onExport: (base64: string) => void;
}

export function SketchCanvas({
  width = 600,
  height = 400,
  onExport,
}: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

  // Initialize white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * width) / rect.width,
        y: ((e.clientY - rect.top) * height) / rect.height,
      };
    },
    [width, height],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const erasing = e.button === 2;
      setIsDrawing(true);
      setIsErasing(erasing);

      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = erasing ? "#ffffff" : "#000000";
      ctx.lineWidth = erasing ? 20 : 3;
    },
    [getPos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getPos],
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setIsErasing(false);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
    },
    [],
  );

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    if (base64) onExport(base64);
  }, [onExport]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-lg border border-border-default">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`block ${isErasing ? "cursor-cell" : "cursor-crosshair"}`}
          style={{ width: `${width}px`, height: `${height}px` }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
      </div>
      <p className="text-2xs text-text-muted">
        Left-click to draw &middot; Right-click to erase
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
        >
          Analyze Sketch
        </button>
      </div>
    </div>
  );
}
