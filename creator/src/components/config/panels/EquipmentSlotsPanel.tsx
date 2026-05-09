import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigPanelProps } from "./types";
import type { EquipmentSlotDefinition } from "@/types/config";
import { useProjectStore } from "@/stores/projectStore";
import { TextInput, NumberInput } from "@/components/ui/FormWidgets";
import mannequinImg from "@/assets/mannequin-slots.png";
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "../achievements/icons";

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

function getSlotPosition(
  slot: EquipmentSlotDefinition,
  fallbackIndex: number,
): SlotPosition {
  if (slot.x != null && slot.y != null) return { x: slot.x, y: slot.y };
  return DEFAULT_POSITIONS[fallbackIndex % DEFAULT_POSITIONS.length]!;
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function defaultDisplayName(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EquipmentSlotsPanel({ config, onChange }: ConfigPanelProps) {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const slots = config.equipmentSlots;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);

  const sortedSlots = useMemo(
    () => Object.entries(slots).sort(([, a], [, b]) => a.order - b.order),
    [slots],
  );

  // Auto-select first slot whenever selection becomes invalid.
  useEffect(() => {
    if (selectedId && slots[selectedId]) return;
    setSelectedId(sortedSlots[0]?.[0] ?? null);
  }, [slots, selectedId, sortedSlots]);

  // One-time migration: pull x/y from legacy arcanum-meta if any slot is missing them.
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
        if (changed) onChange({ equipmentSlots: patched });
        setMigrated(true);
      })
      .catch(() => setMigrated(true));
  }, [mudDir, migrated, slots, onChange]);

  const handlePatchSlot = useCallback(
    (id: string, patch: Partial<EquipmentSlotDefinition>) => {
      onChange({
        equipmentSlots: { ...slots, [id]: { ...slots[id]!, ...patch } },
      });
    },
    [slots, onChange],
  );

  const handleAddSlot = useCallback(() => {
    let base = "new_slot";
    let id = base;
    let n = 2;
    while (slots[id]) {
      id = `${base}_${n}`;
      n += 1;
    }
    const orders = Object.values(slots).map((s) => s.order);
    const nextOrder = orders.length > 0 ? Math.max(...orders) + 1 : 0;
    const posIndex = Object.keys(slots).length % DEFAULT_POSITIONS.length;
    const seed = DEFAULT_POSITIONS[posIndex]!;
    onChange({
      equipmentSlots: {
        ...slots,
        [id]: {
          displayName: "New Slot",
          order: nextOrder,
          x: seed.x,
          y: seed.y,
        },
      },
    });
    setSelectedId(id);
  }, [slots, onChange]);

  const handleDeleteSlot = useCallback(
    (id: string) => {
      const next = { ...slots };
      delete next[id];
      onChange({ equipmentSlots: next });
      if (selectedId === id) setSelectedId(null);
    },
    [slots, selectedId, onChange],
  );

  const handleRenameSlot = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || slots[newId]) return;
      const next: Record<string, EquipmentSlotDefinition> = {};
      for (const [k, v] of Object.entries(slots)) {
        next[k === oldId ? newId : k] = v;
      }
      onChange({ equipmentSlots: next });
      if (selectedId === oldId) setSelectedId(newId);
    },
    [slots, selectedId, onChange],
  );

  // Reorder by swapping `order` values with the neighbour above/below.
  const handleMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const idx = sortedSlots.findIndex(([sid]) => sid === id);
      if (idx === -1) return;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= sortedSlots.length) return;
      const [aId, aSlot] = sortedSlots[idx]!;
      const [bId, bSlot] = sortedSlots[targetIdx]!;
      onChange({
        equipmentSlots: {
          ...slots,
          [aId]: { ...aSlot, order: bSlot.order },
          [bId]: { ...bSlot, order: aSlot.order },
        },
      });
    },
    [slots, sortedSlots, onChange],
  );

  const selected = selectedId ? slots[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <SlotsList
          sortedSlots={sortedSlots}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAddSlot}
          onMove={handleMove}
          onDelete={handleDeleteSlot}
        />
      </div>

      <div className="xl:col-span-5">
        <MannequinView
          sortedSlots={sortedSlots}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPatch={handlePatchSlot}
        />
      </div>

      <div className="xl:col-span-4">
        {selectedId && selected ? (
          <SlotEditor
            id={selectedId}
            slot={selected}
            onPatch={(p) => handlePatchSlot(selectedId, p)}
            onRename={(v) => handleRenameSlot(selectedId, v)}
          />
        ) : (
          <EmptyEditor onAdd={handleAddSlot} />
        )}
      </div>
    </div>
  );
}

// ─── Mannequin ─────────────────────────────────────────────────────

interface MannequinViewProps {
  sortedSlots: Array<[string, EquipmentSlotDefinition]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<EquipmentSlotDefinition>) => void;
}

function MannequinView({
  sortedSlots,
  selectedId,
  onSelect,
  onPatch,
}: MannequinViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<SlotPosition | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, slotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(slotId);
      setDragPos(null);
      onSelect(slotId);
    },
    [onSelect],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      );
      const y = Math.max(
        0,
        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
      );
      setDragPos({ x, y });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (dragging && dragPos) {
      onPatch(dragging, { x: dragPos.x, y: dragPos.y });
    }
    setDragging(null);
    setDragPos(null);
  }, [dragging, dragPos, onPatch]);

  return (
    <section className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Position Reference
          </h3>
          <p className="mt-0.5 text-2xs leading-snug text-text-muted">
            Drag a marker to reposition.
          </p>
        </div>
      </header>

      <div
        ref={containerRef}
        className="relative aspect-square w-full select-none overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={mannequinImg}
          alt="Equipment mannequin"
          loading="lazy"
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />

        {sortedSlots.map(([id, slot], index) => {
          const isDraggingThis = id === dragging;
          const pos =
            isDraggingThis && dragPos
              ? dragPos
              : getSlotPosition(slot, index);
          const isSelected = id === selectedId;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`${slot.displayName || id} slot position`}
              title={`${slot.displayName || id} (${id})`}
              onPointerDown={(e) => handlePointerDown(e, id)}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 5 : 1;
                let dx = 0;
                let dy = 0;
                if (e.key === "ArrowLeft") dx = -step;
                else if (e.key === "ArrowRight") dx = step;
                else if (e.key === "ArrowUp") dy = -step;
                else if (e.key === "ArrowDown") dy = step;
                else return;
                e.preventDefault();
                onSelect(id);
                const cur = getSlotPosition(slot, index);
                onPatch(id, {
                  x: Math.max(0, Math.min(100, cur.x + dx)),
                  y: Math.max(0, Math.min(100, cur.y + dy)),
                });
              }}
              className={cx(
                "focus-ring absolute flex items-center justify-center rounded-full transition-[transform,border-color,background-color,box-shadow] duration-150",
                isDraggingThis
                  ? "z-20 cursor-grabbing shadow-lg ring-1 ring-accent/30"
                  : "cursor-grab",
              )}
              style={{
                width: 44,
                height: 44,
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span
                className={cx(
                  "flex h-7 w-7 select-none items-center justify-center rounded-full border text-[9px] font-bold text-text-primary shadow-glow",
                  isSelected
                    ? "border-accent bg-accent/70 ring-2 ring-accent"
                    : "border-accent/60 bg-accent/40",
                )}
              >
                {(slot.displayName || id).charAt(0).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── List ──────────────────────────────────────────────────────────

interface SlotsListProps {
  sortedSlots: Array<[string, EquipmentSlotDefinition]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
}

function SlotsList({
  sortedSlots,
  selectedId,
  onSelect,
  onAdd,
  onMove,
  onDelete,
}: SlotsListProps) {
  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Equipment Positions
          </h3>
          <span className="font-mono text-2xs text-text-muted/70">
            {sortedSlots.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          title="Add slot"
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add
        </button>
      </div>

      <ul className="-mx-0.5 flex max-h-[calc(100vh-12rem)] flex-col gap-1 overflow-y-auto px-0.5 pb-0.5">
        {sortedSlots.length === 0 ? (
          <li>
            <div className="rounded-lg border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-5 text-center text-2xs italic text-text-muted/70">
              No equipment slots defined yet.
            </div>
          </li>
        ) : (
          sortedSlots.map(([id, slot], index) => (
            <SlotRow
              key={id}
              id={id}
              slot={slot}
              index={index}
              total={sortedSlots.length}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
              onMoveUp={() => onMove(id, -1)}
              onMoveDown={() => onMove(id, 1)}
              onDelete={() => onDelete(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface SlotRowProps {
  id: string;
  slot: EquipmentSlotDefinition;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function SlotRow({
  id,
  slot,
  index,
  total,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SlotRowProps) {
  return (
    <li>
      <div
        className={cx(
          "group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition",
          selected
            ? "selected-pill"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.6rem] font-semibold",
            selected
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted",
          )}
        >
          {index + 1}
        </span>

        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="focus-ring flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
        >
          <span className="truncate font-display text-xs font-semibold text-text-primary">
            {slot.displayName || id}
          </span>
          <span className="truncate font-mono text-[0.6rem] text-text-muted/70">
            {id}
          </span>
        </button>

        <div className="flex items-center opacity-50 transition group-hover:opacity-100">
          <IconAction
            label="Move up"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ArrowUpIcon />
          </IconAction>
          <IconAction
            label="Move down"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDownIcon />
          </IconAction>
          <IconAction label="Delete slot" onClick={onDelete} danger>
            <TrashIcon />
          </IconAction>
        </div>
      </div>
    </li>
  );
}

// ─── Editor ────────────────────────────────────────────────────────

interface SlotEditorProps {
  id: string;
  slot: EquipmentSlotDefinition;
  onPatch: (p: Partial<EquipmentSlotDefinition>) => void;
  onRename: (newId: string) => void;
}

function SlotEditor({ id, slot, onPatch, onRename }: SlotEditorProps) {
  return (
    <section className="panel-surface flex flex-col gap-3 rounded-2xl p-3 shadow-section">
      <header className="flex items-baseline justify-between gap-2 border-b border-[var(--chrome-stroke)] pb-2">
        <div className="min-w-0">
          <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
            Editing
          </span>
          <h3 className="truncate font-display text-base font-semibold text-text-primary">
            {slot.displayName || id}
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-mono text-[0.6rem] text-text-muted">
          {id}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Display Name" required>
          <TextInput
            value={slot.displayName}
            onCommit={(v) =>
              onPatch({ displayName: v || defaultDisplayName(id) })
            }
            placeholder={defaultDisplayName(id) || "Head"}
            dense
          />
        </FieldLabel>

        <FieldLabel label="Order" required>
          <NumberInput
            value={slot.order}
            onCommit={(v) => onPatch({ order: v ?? 0 })}
            min={0}
            dense
          />
        </FieldLabel>
      </div>

      <FieldLabel label="Internal ID (slug)" required>
        <SlugRenamer id={id} onRename={onRename} />
        <p className="mt-1 text-[0.6rem] leading-snug text-text-muted/70">
          Canonical slot key — items reference this. Renaming is destructive.
        </p>
      </FieldLabel>
    </section>
  );
}

function SlugRenamer({
  id,
  onRename,
}: {
  id: string;
  onRename: (v: string) => void;
}) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="head"
    />
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-8 text-center shadow-section">
      <p className="font-display text-sm text-text-primary">No slot selected</p>
      <p className="max-w-xs text-2xs text-text-muted/80">
        Choose an equipment position from the list, or add a new one.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring mt-1 inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
      >
        <PlusIcon />
        Add Slot
      </button>
    </div>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        "focus-ring inline-flex h-5 w-5 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "text-text-muted/70 hover:bg-status-error/15 hover:text-status-error"
          : "text-text-muted/70 hover:bg-[var(--chrome-fill)] hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
