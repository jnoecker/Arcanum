import "./EntityArtGenerator.css";
import { useEffect, useRef, useState } from "react";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

/** Click-to-zoom modal with scroll-zoom and drag-pan. Click outside or Esc closes. */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragMovedRef = useRef(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(8, z * 1.2));
      } else if (e.key === "-" || e.key === "_") {
        setZoom((z) => Math.max(0.5, z / 1.2));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((z) => Math.max(0.5, Math.min(8, z * factor)));
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragMovedRef.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMovedRef.current = true;
    }
    setPan({
      x: dragStart.current.panX + dx,
      y: dragStart.current.panY + dy,
    });
  };
  const onMouseUp = () => {
    setDragging(false);
    if (!dragMovedRef.current) {
      onClose();
    }
  };
  const onMouseLeave = () => setDragging(false);

  return (
    <div
      className="art-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        ref={stageRef}
        className={`art-lightbox__stage${dragging ? " art-lightbox__stage--grabbing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <img
          src={src}
          alt=""
          className="art-lightbox__img"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>
      <div className="art-lightbox__hud" onClick={(e) => e.stopPropagation()}>
        <button
          className="art-lightbox__btn"
          onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))}
          title="Zoom out"
        >
          −
        </button>
        <span className="art-lightbox__zoom">{Math.round(zoom * 100)}%</span>
        <button
          className="art-lightbox__btn"
          onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="art-lightbox__btn"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset zoom"
        >
          Reset
        </button>
        <span className="art-lightbox__hint">scroll to zoom · drag to pan</span>
        <button
          ref={closeBtnRef}
          className="art-lightbox__btn"
          onClick={onClose}
        >
          Close · Esc
        </button>
      </div>
    </div>
  );
}
