import { useMemo, useState } from "react";
import type { EnchantmentDefinitionConfig, AppConfig } from "@/types/config";
import { Section } from "./Section";
import { PlusIcon, SearchIcon, FilterIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface EnchantmentListProps {
  enchanting: AppConfig["enchanting"];
  craftingSkills: AppConfig["craftingSkills"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const ALL_SKILLS = "__all__";

export function EnchantmentList({
  enchanting,
  craftingSkills,
  selectedId,
  onSelect,
  onAdd,
}: EnchantmentListProps) {
  const [query, setQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState<string>(ALL_SKILLS);

  const ids = Object.keys(enchanting.definitions);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ids.filter((id) => {
      const def = enchanting.definitions[id]!;
      if (skillFilter !== ALL_SKILLS && def.skill !== skillFilter) return false;
      if (!q) return true;
      return id.toLowerCase().includes(q) || def.displayName.toLowerCase().includes(q);
    });
  }, [ids, query, skillFilter, enchanting.definitions]);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={
          <span className="inline-flex items-baseline gap-2">
            <span>Known Enchantments</span>
            <span className="font-display text-2xs font-normal tracking-normal text-text-muted/70">
              ·
            </span>
            <span className="font-display text-2xs font-bold tabular-nums text-accent">
              {ids.length}
            </span>
          </span>
        }
        description="Every enchantment a player can learn and inscribe."
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="ornate-input flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
              <SearchIcon className="text-text-muted/70" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
                placeholder="Search enchantments…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <SkillFilterSelect
              value={skillFilter}
              skills={craftingSkills}
              onChange={setSkillFilter}
            />
            <button
              type="button"
              aria-label="More filters"
              title="Filter"
              className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-accent"
            >
              <FilterIcon />
            </button>
          </div>

          <ul className="-mx-1 flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-1 pb-1">
            {filtered.length === 0 ? (
              <li>
                <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-8 text-center text-2xs italic text-text-muted/70">
                  {ids.length === 0
                    ? "No enchantments known. Scribe the first ward below."
                    : "No enchantments match your filters."}
                </div>
              </li>
            ) : (
              filtered.map((id) => (
                <EnchantmentRow
                  key={id}
                  id={id}
                  def={enchanting.definitions[id]!}
                  skillLabel={craftingSkills[enchanting.definitions[id]!.skill]?.displayName}
                  selected={selectedId === id}
                  onSelect={() => onSelect(id)}
                />
              ))
            )}
          </ul>

          <button
            type="button"
            onClick={onAdd}
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-3 py-2.5 text-xs font-medium text-accent transition hover:bg-accent/15"
          >
            <PlusIcon />
            New Enchantment
          </button>
        </div>
      </Section>
    </div>
  );
}

interface EnchantmentRowProps {
  id: string;
  def: EnchantmentDefinitionConfig;
  skillLabel: string | undefined;
  selected: boolean;
  onSelect: () => void;
}

function EnchantmentRow({ id, def, skillLabel, selected, onSelect }: EnchantmentRowProps) {
  const slotsText =
    def.targetSlots && def.targetSlots.length > 0
      ? def.targetSlots.length === 1
        ? def.targetSlots[0]
        : `${def.targetSlots.length} slots`
      : "Any slot";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-text-primary">
                {def.displayName || id}
              </p>
              <p className="truncate font-mono text-2xs text-text-muted/70">{id}</p>
            </div>
            <span className="inline-flex shrink-0 items-baseline gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5">
              <span className="font-display text-[0.55rem] font-semibold uppercase tracking-wider text-accent/85">
                {skillLabel ?? def.skill}
              </span>
              <span className="font-display text-2xs font-bold tabular-nums text-accent">
                {def.skillRequired}
              </span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-2xs text-text-muted/80">
            <span className="font-mono">XP {def.xpReward}</span>
            <span className="text-text-muted/40">·</span>
            <span className="truncate">{slotsText}</span>
          </div>
        </div>
      </button>
    </li>
  );
}

function SkillFilterSelect({
  value,
  skills,
  onChange,
}: {
  value: string;
  skills: AppConfig["craftingSkills"];
  onChange: (v: string) => void;
}) {
  return (
    <div className="ornate-input shrink-0 px-1 py-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-8 cursor-pointer appearance-none border-none bg-transparent px-2 py-0 pr-6 text-xs text-text-primary outline-none"
        aria-label="Filter by crafting skill"
        style={{
          backgroundImage:
            'url("data:image/svg+xml;charset=utf-8,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%23999\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.5rem center",
        }}
      >
        <option value={ALL_SKILLS}>All</option>
        {Object.entries(skills).map(([id, s]) => (
          <option key={id} value={id}>
            {s.displayName || id}
          </option>
        ))}
      </select>
    </div>
  );
}
