import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigPanelProps } from "./types";
import type { EquipmentSlotDefinition } from "@/types/config";
import { useProjectStore } from "@/stores/projectStore";
import { ActionButton, FieldRow, TextInput, NumberInput } from "@/components/ui/FormWidgets";
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

/** Get the position for a slot, reading from its config x/y fields. */
function getSlotPosition(slot: EquipmentSlotDefinition, fallbackIndex: number): SlotPosition {
  if (slot.x != null && slot.y != null) {
    return { x: slot.x, y: slot.y };
  }
  return DEFAULT_POSITIONS[fallbackIndex % DEFAULT_POSITIONS.length]!;
}

export function EquipmentSlotsPanel({ config, onChange }: ConfigPanelProps) {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSlotId, setNewSlotId] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<SlotPosition | null>(null);
  const [migrated, setMigrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slots = config.equipmentSlots;
  const sortedSlots = useMemo(
    () =>
      Object.entries(slots).sort(([, a], [, b]) => a.order - b.order),
    [slots],
  );

  // One-time migration: if any slot is missing x/y but arcanum-meta has
  // positions, migrate them into the config store.
  useEffect(() => {
    if (migrated || !mudDir) return;
    const slotEntries = Object.entries(slots);
    const anyMissing = slotEntries.some(([, s]) => s.x == null || s.y == null);
    if (!anyMissing) {
      setMigrated(true);
      return;
    }
    invoke<ArcanumMeta>("load_arcanum_meta", { mudDir })
      .then((meta) => {
        const metaPositions = meta.wearSlotPositions ?? {};
        // Lowercase keys to match config slot IDs
        const normalized: Record<string, SlotPosition> = {};
        for (const [id, pos] of Object.entries(metaPositions)) {
          normalized[id.trim().toLowerCase()] = pos;
        }
        let changed = false;
        const patched: Record<string, EquipmentSlotDefinition> = {};
        for (const [id, slot] of slotEntries) {
          if (slot.x == null || slot.y == null) {
            const metaPos = normalized[id];
            if (metaPos) {
              patched[id] = { ...slot, x: metaPos.x, y: metaPos.y };
              changed = true;
            } else {
              patched[id] = slot;
            }
          } else {
            patched[id] = slot;
          }
        }
        if (changed) {
          onChange({ equipmentSlots: patched });
        }
        setMigrated(true);
      })
      .catch(() => {
        setMigrated(true);
      });
  }, [mudDir, migrated, slots, onChange]);

  const handleAddSlot = useCallback(() => {
    const id = newSlotId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || slots[id]) return;
    const nextOrder =
      sortedSlots.length > 0
        ? Math.max(...sortedSlots.map(([, s]) => s.order)) + 1
        : 0;
    const posIndex = Object.keys(slots).length % DEFAULT_POSITIONS.length;
    const defaultPos = DEFAULT_POSITIONS[posIndex]!;
    onChange({
      equipmentSlots: {
        ...slots,
        [id]: { displayName: newSlotId.trim(), order: nextOrder, x: defaultPos.x, y: defaultPos.y },
      },
    });
    setNewSlotId("");
    setSelectedId(id);
  }, [newSlotId, slots, sortedSlots, onChange]);

  const handleDeleteSlot = useCallback(
    (id: string) => {
      const next = { ...slots };
      delete next[id];
      onChange({ equipmentSlots: next });
      if (selectedId === id) setSelectedId(null);
    },
    [slots, selectedId, onChange],
  );

  const handlePatchSlot = useCallback(
    (id: string, patch: Partial<EquipmentSlotDefinition>) => {
      onChange({
        equipmentSlots: { ...slots, [id]: { ...slots[id]!, ...patch } },
      });
    },
    [slots, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, slotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(slotId);
      setDragPos(null);
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
      setDragPos({ x, y });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (dragging && dragPos) {
      handlePatchSlot(dragging, { x: dragPos.x, y: dragPos.y });
    }
    setDragging(null);
    setDragPos(null);
  }, [dragging, dragPos, handlePatchSlot]);

  const selected = selectedId ? slots[selectedId] : null;

  return (
    <div className="flex flex-col gap-5 xl:flex-row" style={{ minHeight: "min(520px, 64vh)" }}>
      {/* Left side: slot list + detail form */}
      <div className="flex w-full shrink-0 flex-col gap-4 xl:w-80">
        {/* Add new slot */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddSlot();
          }}
          className="panel-surface-light flex items-center gap-2 rounded-3xl p-3"
        >
          <input
            value={newSlotId}
            onChange={(e) => setNewSlotId(e.target.value)}
            aria-label="New slot ID"
            placeholder="New slot id..."
            className="ornate-input min-h-11 flex-1 rounded-2xl px-4 py-3 text-sm"
          />
          <ActionButton
            type="submit"
            disabled={!newSlotId.trim()}
            variant="primary"
          >
            Add Slot
          </ActionButton>
        </form>

        {/* Slot list */}
        <div className="panel-surface-light flex flex-col gap-1 rounded-3xl p-3">
          {sortedSlots.map(([id, slot]) => (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(id);
                }
              }}
              className={`group focus-ring flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ${
                selectedId === id
                  ? "border border-[var(--border-glow-strong)] bg-[linear-gradient(145deg,rgb(var(--accent-rgb)/0.18),rgb(var(--bg-rgb)/0.9))] text-text-primary shadow-glow"
                  : "border border-transparent text-text-secondary hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
              }`}
              aria-label={`${slot.displayName} slot`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-2xs text-text-muted">
                {slot.order}
              </span>
              <span className="font-mono text-2xs text-text-muted">{id}</span>
              <span className="flex-1 truncate">{slot.displayName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSlot(id);
                }}
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-text-muted opacity-0 transition hover:bg-status-danger/10 hover:text-status-danger group-hover:opacity-100"
                title="Delete slot"
              >
                x
              </button>
            </div>
          ))}
          {sortedSlots.length === 0 && (
            <p className="px-2 py-4 text-sm text-text-muted">
              No equipment slots defined yet.
            </p>
          )}
        </div>

        {/* Detail form for selected slot */}
        {selectedId && selected && (
          <div className="panel-surface-light rounded-3xl p-4">
            <h4 className="mb-3 font-display text-xs uppercase tracking-widest text-text-muted">
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
      <div className="flex min-w-0 flex-1 items-start justify-center">
        <div
          ref={containerRef}
          className="panel-surface-light relative aspect-square w-full max-w-[480px] select-none overflow-hidden rounded-3xl p-3"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Mannequin artwork */}
          <img
            src={mannequinImg}
            alt="Equipment mannequin"
            loading="lazy"
            className="pointer-events-none h-full w-full rounded-3xl object-cover"
            draggable={false}
          />

          {/* Slot markers */}
          {sortedSlots.map(([id, slot], index) => {
            const isDraggingThis = id === dragging;
            const pos = isDraggingThis && dragPos
              ? dragPos
              : getSlotPosition(slot, index);
            const isSelected = id === selectedId;
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                aria-label={`${slot.displayName} slot position`}
                onPointerDown={(e) => handlePointerDown(e, id)}
                onClick={() => setSelectedId(id)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 5 : 1;
                  let dx = 0, dy = 0;
                  if (e.key === "ArrowLeft") dx = -step;
                  else if (e.key === "ArrowRight") dx = step;
                  else if (e.key === "ArrowUp") dy = -step;
                  else if (e.key === "ArrowDown") dy = step;
                  else return;
                  e.preventDefault();
                  setSelectedId(id);
                  const cur = getSlotPosition(slot, index);
                  handlePatchSlot(id, {
                    x: Math.max(0, Math.min(100, cur.x + dx)),
                    y: Math.max(0, Math.min(100, cur.y + dy)),
                  });
                }}
                className={`focus-ring absolute flex items-center justify-center rounded-full transition-[transform,border-color,background-color,box-shadow] duration-150 ${
                  isDraggingThis ? "z-20 cursor-grabbing shadow-lg ring-1 ring-accent/30" : "cursor-grab"
                }`}
                style={{
                  width: 44,
                  height: 44,
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                title={`${slot.displayName} (${id})`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold text-text-primary shadow-glow select-none ${
                    isSelected
                      ? "border-accent bg-accent/70 ring-2 ring-accent-emphasis"
                      : "border-accent/60 bg-accent/40"
                  } ${!isDraggingThis && !isSelected ? "animate-aurum-pulse" : ""}`}
                >
                  {slot.displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
