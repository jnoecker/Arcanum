import { useState, useEffect, useRef } from "react";

const DIR_LABELS: Record<string, string> = {
  n: "N", s: "S", e: "E", w: "W",
  ne: "NE", nw: "NW", se: "SE", sw: "SW",
  u: "Up", d: "Down",
};

interface DirectionPickerProps {
  source: string;
  target: string;
  initialDirection: string;
  onConfirm: (direction: string) => void;
  onCancel: () => void;
}

export function DirectionPicker({
  source,
  target,
  initialDirection,
  onConfirm,
  onCancel,
}: DirectionPickerProps) {
  const [selected, setSelected] = useState(initialDirection);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm(selected);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, onConfirm, onCancel]);

  // Close if clicking outside the picker
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    // Delay to avoid catching the same click that opened it
    const id = setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={panelRef}
        className="rounded-lg border border-border-default bg-bg-secondary p-4 shadow-xl"
      >
        <p className="mb-1 text-xs font-medium text-text-primary">
          New exit direction
        </p>
        <p className="mb-3 text-[10px] text-text-muted">
          {source} &rarr; {target}
        </p>

        {/* Compass grid */}
        <div className="mb-2 grid grid-cols-3 gap-1" style={{ width: 132 }}>
          {(["nw", "n", "ne", "w", null, "e", "sw", "s", "se"] as const).map(
            (dir, i) =>
              dir ? (
                <button
                  key={dir}
                  onClick={() => setSelected(dir)}
                  className={`h-10 w-10 rounded text-[11px] font-medium transition-colors ${
                    selected === dir
                      ? "bg-accent text-white"
                      : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  {DIR_LABELS[dir]}
                </button>
              ) : (
                <div key={`empty-${i}`} className="h-10 w-10" />
              ),
          )}
        </div>

        {/* Up / Down row */}
        <div className="mb-3 flex gap-1">
          <button
            onClick={() => setSelected("u")}
            className={`h-8 flex-1 rounded text-[11px] font-medium transition-colors ${
              selected === "u"
                ? "bg-accent text-white"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            Up
          </button>
          <button
            onClick={() => setSelected("d")}
            className={`h-8 flex-1 rounded text-[11px] font-medium transition-colors ${
              selected === "d"
                ? "bg-accent text-white"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            Down
          </button>
        </div>

        {/* Confirm / Cancel */}
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 rounded bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/30"
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
