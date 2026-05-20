import { useEffect, useMemo, useState } from "react";
import type {
  ClassDefinitionConfig,
  StarterEquipmentEntry,
} from "@/types/config";
import { SectionCard } from "@/components/ui/SectionCard";
import { cx } from "@/components/ui/FormWidgets";
import { PlusIcon, TrashIcon } from "@/components/config/icons";
import {
  ItemPickerDialog,
  useItemCatalog,
  type ItemCatalogEntry,
} from "@/components/ui/ItemPickerDialog";

interface StarterEquipmentTabProps {
  classes: Record<string, ClassDefinitionConfig>;
  onPatchClass: (id: string, p: Partial<ClassDefinitionConfig>) => void;
}

export function StarterEquipmentTab({ classes, onPatchClass }: StarterEquipmentTabProps) {
  const classIds = useMemo(
    () => Object.keys(classes).filter((id) => classes[id]!.selectable !== false),
    [classes],
  );
  const allClassIds = useMemo(() => Object.keys(classes), [classes]);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => {
    return classIds[0] ?? allClassIds[0] ?? null;
  });

  // Keep selection valid if classes change.
  useEffect(() => {
    if (selectedClassId && classes[selectedClassId]) return;
    setSelectedClassId(classIds[0] ?? allClassIds[0] ?? null);
  }, [classes, classIds, allClassIds, selectedClassId]);

  const catalog = useItemCatalog();
  const catalogById = useMemo(() => {
    const map = new Map<string, ItemCatalogEntry>();
    for (const c of catalog) map.set(c.fullId, c);
    return map;
  }, [catalog]);

  if (allClassIds.length === 0) {
    return (
      <SectionCard
        title="Starter Equipment"
        description="Items granted to a new character at creation."
      >
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center text-2xs italic text-text-muted/70">
          No classes defined yet. Add a class in the Classes panel first.
        </div>
      </SectionCard>
    );
  }

  const selected = selectedClassId ? classes[selectedClassId] : undefined;

  return (
    <SectionCard
      title="Starter Equipment"
      description="Items granted to a new character at creation. Pick a class to edit its kit."
    >
      <ClassPills
        classes={classes}
        ids={allClassIds}
        selected={selectedClassId}
        onSelect={setSelectedClassId}
      />

      {selectedClassId && selected ? (
        <StarterEditor
          classId={selectedClassId}
          cls={selected}
          catalog={catalog}
          catalogById={catalogById}
          onPatch={(p) => onPatchClass(selectedClassId, p)}
        />
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center text-2xs italic text-text-muted/70">
          Choose a class above.
        </div>
      )}
    </SectionCard>
  );
}

// ─── Class pills ────────────────────────────────────────────────────

function ClassPills({
  classes,
  ids,
  selected,
  onSelect,
}: {
  classes: Record<string, ClassDefinitionConfig>;
  ids: string[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const cls = classes[id]!;
        const hidden = cls.selectable === false;
        const isSelected = selected === id;
        const count = cls.starterEquipment?.length ?? 0;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isSelected}
            title={hidden ? "Hidden from character creation" : undefined}
            className={cx(
              "focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
              isSelected
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-secondary hover:border-accent/30 hover:text-accent",
              hidden && !isSelected && "opacity-50",
            )}
          >
            <span className="font-display tracking-wide">
              {cls.displayName || id}
            </span>
            <span
              className={cx(
                "rounded-full px-1.5 py-px font-mono text-[0.55rem]",
                isSelected
                  ? "bg-accent/20 text-accent"
                  : "bg-[var(--chrome-fill)] text-text-muted",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Starter editor for a single class ──────────────────────────────

function StarterEditor({
  classId,
  cls,
  catalog,
  catalogById,
  onPatch,
}: {
  classId: string;
  cls: ClassDefinitionConfig;
  catalog: ItemCatalogEntry[];
  catalogById: Map<string, ItemCatalogEntry>;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  const entries = cls.starterEquipment ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateEntries = (next: StarterEquipmentEntry[]) => {
    onPatch({ starterEquipment: next.length > 0 ? next : undefined });
  };

  const handleAdd = (fullId: string) => {
    if (entries.some((e) => e.itemId === fullId)) {
      setPickerOpen(false);
      return;
    }
    const meta = catalogById.get(fullId);
    const equip: boolean | undefined = meta?.hasSlot ? undefined : false;
    const entry: StarterEquipmentEntry = { itemId: fullId };
    if (equip === false) entry.equip = false;
    updateEntries([...entries, entry]);
    setPickerOpen(false);
  };

  const handleRemove = (idx: number) => {
    const next = entries.slice();
    next.splice(idx, 1);
    updateEntries(next);
  };

  const handleToggleEquip = (idx: number, equip: boolean) => {
    const next = entries.slice();
    const cur = next[idx]!;
    if (equip) {
      const { equip: _, ...rest } = cur;
      next[idx] = rest;
    } else {
      next[idx] = { ...cur, equip: false };
    }
    updateEntries(next);
  };

  const handleMove = (from: number, to: number) => {
    if (to < 0 || to >= entries.length) return;
    const next = entries.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    updateEntries(next);
  };

  const usedIds = useMemo(() => new Set(entries.map((e) => e.itemId)), [entries]);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="border-b border-[var(--chrome-stroke)] pb-2">
        <p className="font-display text-base font-semibold tracking-[0.04em] text-text-primary">
          {cls.displayName || classId}
        </p>
        <p className="text-2xs text-text-muted/70">
          Order matches the order on the character sheet.{" "}
          <span className="font-mono">Equip</span> tries to slot the item; items
          without a slot stay in inventory.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center text-2xs italic text-text-muted/70">
          No starter equipment. Add the first item below.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry, idx) => {
            const meta = catalogById.get(entry.itemId);
            const equipFlag = entry.equip !== false; // default true
            return (
              <li key={`${entry.itemId}-${idx}`}>
                <EquipmentRow
                  entry={entry}
                  meta={meta}
                  equipFlag={equipFlag}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < entries.length - 1}
                  onMoveUp={() => handleMove(idx, idx - 1)}
                  onMoveDown={() => handleMove(idx, idx + 1)}
                  onToggleEquip={(v) => handleToggleEquip(idx, v)}
                  onRemove={() => handleRemove(idx)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add Item
        </button>
      </div>

      {pickerOpen && (
        <ItemPickerDialog
          catalog={catalog}
          excludeIds={usedIds}
          title="Add Starter Item"
          description="Items from every loaded zone. Use the search to narrow by id, name, or slot."
          onPick={(entry) => handleAdd(entry.fullId)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Equipment row ──────────────────────────────────────────────────

function EquipmentRow({
  entry,
  meta,
  equipFlag,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleEquip,
  onRemove,
}: {
  entry: StarterEquipmentEntry;
  meta: ItemCatalogEntry | undefined;
  equipFlag: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleEquip: (v: boolean) => void;
  onRemove: () => void;
}) {
  const missing = !meta;
  const equipDisabled = meta != null && !meta.hasSlot;

  return (
    <div
      className={cx(
        "group flex items-center gap-2 rounded-xl border px-3 py-2 transition",
        missing
          ? "border-status-error/40 bg-status-error/5"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Move up"
          className="focus-ring inline-flex h-4 w-4 items-center justify-center rounded text-text-muted/70 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Move down"
          className="focus-ring inline-flex h-4 w-4 items-center justify-center rounded text-text-muted/70 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          ▼
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "truncate font-display text-sm",
              missing ? "text-status-error" : "text-text-primary",
            )}
          >
            {meta?.displayName ?? entry.itemId}
          </span>
          {meta?.slot && (
            <span className="rounded-full bg-[var(--chrome-fill)] px-1.5 py-px font-display text-[0.55rem] uppercase tracking-wider text-text-muted">
              {meta.slot}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-2xs text-text-muted/70">
          {entry.itemId}
          {missing && " · not found in loaded zones"}
        </p>
      </div>

      <EquipToggle
        checked={equipFlag}
        disabled={equipDisabled}
        onChange={onToggleEquip}
      />

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${meta?.displayName ?? entry.itemId}`}
        className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted/60 transition hover:bg-status-error/10 hover:text-status-error"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function EquipToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const effective = checked && !disabled;
  const title = disabled
    ? "Item has no equip slot — stays in inventory"
    : effective
      ? "Equipped on creation. Click for inventory only."
      : "Inventory only. Click to equip on creation.";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={effective}
      aria-label="Equip on creation"
      disabled={disabled}
      title={title}
      onClick={() => onChange(!effective)}
      className={cx(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-2xs transition",
        disabled
          ? "cursor-not-allowed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted/50"
          : effective
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30",
      )}
    >
      <span
        className={cx(
          "relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors",
          effective ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-2.5 w-2.5 rounded-full bg-bg-primary shadow-md transition-transform",
            effective ? "translate-x-[0.7rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="font-display uppercase tracking-[0.18em]">
        {effective ? "Equip" : "Bag"}
      </span>
    </button>
  );
}
