import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigPanelProps } from "./types";
import type { EquipmentSlotDefinition } from "@/types/config";
import { useProjectStore } from "@/stores/projectStore";
import { FieldRow, TextInput, NumberInput } from "@/components/ui/FormWidgets";
import mannequinImg from "@/assets/mannequin-slots.jpg";

interface SlotPosition {
  x: number;
  y: number;
}

interface ArcanumMeta {
  wearSlotPositions: Record<string, SlotPosition>;
}

/** Default positions staggered around the mannequin for new slots */
const DEFAULT_POSITIONS: SlotPosition[] = [
  { x: 50, y: 10 },  // head
  { x: 50, y: 35 },  // body/chest
  { x: 30, y: 48 },  // left hand
  { x: 70, y: 48 },  // right hand
  { x: 40, y: 88 },  // left foot
  { x: 60, y: 88 },  // right foot
  { x: 50, y: 50 },  // waist
  { x: 50, y: 20 },  // neck
  { x: 32, y: 28 },  // left shoulder
  { x: 68, y: 28 },  // right shoulder
];

export function EquipmentSlotsPanel({ config, onChange }: ConfigPanelProps) {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSlotId, setNewSlotId] = useState("");
  const [positions, setPositions] = useState<Record<string, SlotPosition>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load arcanum meta on mount
  useEffect(() => {
    if (!mudDir) return;
    invoke<ArcanumMeta>("load_arcanum_meta", { mudDir }).then((meta) => {
      setPositions(meta.wearSlotPositions ?? {});
    });
  }, [mudDir]);

  const slots = config.equipmentSlots;
  const sortedSlots = useMemo(
    () =>
      Object.entries(slots).sort(([, a], [, b]) => a.order - b.order),
    [slots],
  );

  const savePositions = useCallback(
    async (next: Record<string, SlotPosition>) => {
      setPositions(next);
      if (!mudDir) return;
      try {
        await invoke("save_arcanum_meta", {
          mudDir,
          meta: { wearSlotPositions: next },
        });
      } catch (err) {
        console.error("Failed to save arcanum meta:", err);
      }
    },
    [mudDir],
  );

  const handleAddSlot = useCallback(() => {
    const id = newSlotId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || slots[id]) return;
    const nextOrder =
      sortedSlots.length > 0
        ? Math.max(...sortedSlots.map(([, s]) => s.order)) + 1
        : 0;
    onChange({
      equipmentSlots: {
        ...slots,
        [id]: { displayName: newSlotId.trim(), order: nextOrder },
      },
    });
    // Assign a default position
    const posIndex = Object.keys(slots).length % DEFAULT_POSITIONS.length;
    const defaultPos = DEFAULT_POSITIONS[posIndex]!;
    savePositions({ ...positions, [id]: defaultPos });
    setNewSlotId("");
    setSelectedId(id);
  }, [newSlotId, slots, sortedSlots, onChange, positions, savePositions]);

  const handleDeleteSlot = useCallback(
    (id: string) => {
      const next = { ...slots };
      delete next[id];
      onChange({ equipmentSlots: next });
      const nextPos = { ...positions };
      delete nextPos[id];
      savePositions(nextPos);
      if (selectedId === id) setSelectedId(null);
    },
    [slots, positions, selectedId, onChange, savePositions],
  );

  const handlePatchSlot = useCallback(
    (id: string, patch: Partial<EquipmentSlotDefinition>) => {
      onChange({
        equipmentSlots: { ...slots, [id]: { ...slots[id]!, ...patch } },
      });
    },
    [slots, onChange],
  );

  // ─── Drag handling ───────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, slotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(slotId);
      setSelectedId(slotId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setPositions((prev) => ({ ...prev, [dragging]: { x, y } }));
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      savePositions(positions);
      setDragging(null);
    }
  }, [dragging, positions, savePositions]);

  const selected = selectedId ? slots[selectedId] : null;

  return (
    <div className="flex gap-4" style={{ minHeight: 480 }}>
      {/* Left side: slot list + detail form */}
      <div className="flex w-72 shrink-0 flex-col gap-3">
        {/* Add new slot */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddSlot();
          }}
          className="flex items-center gap-1"
        >
          <input
            value={newSlotId}
            onChange={(e) => setNewSlotId(e.target.value)}
            placeholder="New slot id..."
            className="h-6 flex-1 rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!newSlotId.trim()}
            className="h-6 rounded bg-accent/20 px-2 text-xs text-accent transition-colors hover:bg-accent/30 disabled:opacity-30"
          >
            + Add
          </button>
        </form>

        {/* Slot list */}
        <div className="flex flex-col gap-0.5">
          {sortedSlots.map(([id, slot]) => (
            <div
              key={id}
              onClick={() => setSelectedId(id)}
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
                selectedId === id
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <span className="w-4 shrink-0 text-center text-[10px] text-text-muted">
                {slot.order}
              </span>
              <span className="font-mono text-[10px] text-text-muted">{id}</span>
              <span className="flex-1 truncate">{slot.displayName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSlot(id);
                }}
                className="text-text-muted opacity-0 transition-opacity hover:text-status-danger group-hover:opacity-100"
                title="Delete slot"
              >
                &times;
              </button>
            </div>
          ))}
          {sortedSlots.length === 0 && (
            <p className="px-2 text-xs text-text-muted">
              No equipment slots defined
            </p>
          )}
        </div>

        {/* Detail form for selected slot */}
        {selectedId && selected && (
          <div className="border-t border-border-muted pt-3">
            <h4 className="mb-2 font-display text-xs uppercase tracking-widest text-text-muted">
              Edit: {selectedId}
            </h4>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Display Name">
                <TextInput
                  value={selected.displayName}
                  onCommit={(v) => handlePatchSlot(selectedId, { displayName: v })}
                />
              </FieldRow>
              <FieldRow label="Order">
                <NumberInput
                  value={selected.order}
                  onCommit={(v) =>
                    handlePatchSlot(selectedId, { order: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Mannequin visual */}
      <div className="flex min-w-[320px] flex-1 items-start justify-center">
        <div
          ref={containerRef}
          className="relative select-none overflow-hidden rounded-lg"
          style={{ width: 420, height: 420 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Mannequin artwork */}
          <img
            src={mannequinImg}
            alt="Equipment mannequin"
            className="pointer-events-none h-full w-full object-cover"
            draggable={false}
          />

          {/* Slot markers */}
          {sortedSlots.map(([id, slot]) => {
            const pos = positions[id] ?? DEFAULT_POSITIONS[0]!;
            const isSelected = id === selectedId;
            const isDragging = id === dragging;
            return (
              <div
                key={id}
                onPointerDown={(e) => handlePointerDown(e, id)}
                onClick={() => setSelectedId(id)}
                className={`absolute flex items-center justify-center rounded-full border transition-all ${
                  isDragging
                    ? "z-20 scale-125 cursor-grabbing"
                    : "cursor-grab"
                } ${
                  isSelected
                    ? "z-10 scale-110 border-accent bg-accent/60 ring-2 ring-accent-emphasis"
                    : "border-accent/60 bg-accent/30 hover:bg-accent/50"
                } ${!isDragging && !isSelected ? "animate-aurum-pulse" : ""}`}
                style={{
                  width: 20,
                  height: 20,
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%)${isSelected ? " scale(1.1)" : ""}`,
                }}
                title={`${slot.displayName} (${id})`}
              >
                <span className="text-[7px] font-bold text-text-primary select-none">
                  {slot.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

