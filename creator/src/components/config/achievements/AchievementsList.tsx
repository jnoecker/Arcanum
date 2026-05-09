import { useMemo, useState } from "react";
import type { AchievementDefFile, AchievementCategoryDefinition } from "@/types/config";
import { SearchIcon, PlusIcon, EyeOffIcon, MoreIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface AchievementsListProps {
  defs: Record<string, AchievementDefFile>;
  categories: Record<string, AchievementCategoryDefinition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const ALL_CATEGORIES = "__all__";

export function AchievementsList({
  defs,
  categories,
  selectedId,
  onSelect,
  onAdd,
}: AchievementsListProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [moreOpen, setMoreOpen] = useState(false);

  const allCategoryIds = Object.keys(categories);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(defs).filter(([id, def]) => {
      if (activeCategory !== ALL_CATEGORIES && def.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        def.displayName.toLowerCase().includes(q) ||
        (def.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [defs, query, activeCategory]);

  const visibleCategoryChips = allCategoryIds.slice(0, 3);
  const overflowCategories = allCategoryIds.slice(3);

  return (
    <aside className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Achievements
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(defs).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search achievements…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip
          active={activeCategory === ALL_CATEGORIES}
          onClick={() => setActiveCategory(ALL_CATEGORIES)}
        >
          All
        </CategoryChip>
        {visibleCategoryChips.map((cid) => {
          const cat = categories[cid];
          return (
            <CategoryChip
              key={cid}
              active={activeCategory === cid}
              onClick={() => setActiveCategory(cid)}
            >
              {cat?.displayName ?? cid}
            </CategoryChip>
          );
        })}
        {overflowCategories.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More categories"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-accent"
            >
              <MoreIcon />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated shadow-lg">
                {overflowCategories.map((cid) => {
                  const cat = categories[cid];
                  const active = activeCategory === cid;
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cid);
                        setMoreOpen(false);
                      }}
                      className={cx(
                        "flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-xs transition last:border-b-0",
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-text-secondary hover:bg-[var(--chrome-fill-soft)]",
                      )}
                    >
                      <span className="truncate">{cat?.displayName ?? cid}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        <PlusIcon />
        Add Achievement
      </button>

      <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No achievements match your filters.
            </div>
          </li>
        ) : (
          filtered.map(([id, def]) => (
            <AchievementRow
              key={id}
              id={id}
              def={def}
              categoryName={categories[def.category]?.displayName ?? def.category}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface AchievementRowProps {
  id: string;
  def: AchievementDefFile;
  categoryName: string;
  selected: boolean;
  onSelect: () => void;
}

function AchievementRow({
  id,
  def,
  categoryName,
  selected,
  onSelect,
}: AchievementRowProps) {
  const criteriaCount = def.criteria?.length ?? 0;
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-semibold text-text-primary">
              {def.displayName || id}
            </span>
            {def.hidden && (
              <span title="Hidden until unlocked" aria-label="Hidden">
                <EyeOffIcon className="h-3 w-3 text-text-muted/70" />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-text-muted/80">
            <span className="truncate">{categoryName || "—"}</span>
            <span className="text-text-muted/40">·</span>
            <span className="shrink-0">
              {criteriaCount} {criteriaCount === 1 ? "criterion" : "criteria"}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "focus-ring inline-flex items-center gap-1 rounded-full border px-2 py-1 font-display text-2xs transition",
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30 hover:text-accent",
      )}
    >
      <span>{children}</span>
    </button>
  );
}
