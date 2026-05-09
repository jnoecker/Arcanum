import { useMemo, useState } from "react";
import type { ClassDefinitionConfig } from "@/types/config";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { SearchIcon, PlusIcon, CopyIcon, TrashIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface ClassesListProps {
  classes: Record<string, ClassDefinitionConfig>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ClassesList({
  classes,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: ClassesListProps) {
  const [query, setQuery] = useState("");
  const hasSelection = selectedId !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(classes).filter(([id, cls]) => {
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        cls.displayName.toLowerCase().includes(q) ||
        (cls.description ?? "").toLowerCase().includes(q) ||
        (cls.primaryStat ?? "").toLowerCase().includes(q)
      );
    });
  }, [classes, query]);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Classes
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(classes).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search classes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate the selected class"
          aria-label="Duplicate the selected class"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected class"
          aria-label="Delete the selected class"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No classes match your search.
            </div>
          </li>
        ) : (
          filtered.map(([id, cls]) => (
            <ClassRow
              key={id}
              id={id}
              cls={cls}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface ClassRowProps {
  id: string;
  cls: ClassDefinitionConfig;
  selected: boolean;
  onSelect: () => void;
}

function ClassRow({ id, cls, selected, onSelect }: ClassRowProps) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath =
    cls.image && assetsDir ? `${assetsDir}\\images\\${cls.image}` : undefined;
  const portraitSrc = useImageSrc(imagePath);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
          selected
            ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)]"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <ClassThumb src={portraitSrc} fallback={cls.displayName || id} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-text-primary">
            {cls.displayName || id}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <StatPill label={`HP +${cls.hpPerLevel}`} />
            <StatPill label={`MP +${cls.manaPerLevel}`} />
            {cls.primaryStat && <StatPill label={cls.primaryStat} accent />}
          </div>
        </div>
      </button>
    </li>
  );
}

function ClassThumb({
  src,
  fallback,
}: {
  src: string | null;
  fallback: string;
}) {
  const initials = fallback
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]"
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="font-display text-xs font-semibold text-text-muted">
          {initials || "—"}
        </span>
      )}
    </span>
  );
}

function StatPill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[0.6rem] leading-none",
        accent
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted",
      )}
    >
      {label}
    </span>
  );
}
