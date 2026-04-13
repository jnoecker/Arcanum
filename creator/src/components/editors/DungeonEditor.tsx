import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  WorldFile,
  DungeonFile,
  DungeonRoomTemplate,
  DungeonLootTable,
  DungeonMobPool,
  MobFile,
  ItemFile,
} from "@/types/world";
import { updateDungeon, addMob, addItem, generateEntityId } from "@/lib/zoneEdits";
import {
  FieldRow,
  TextInput,
  NumberInput,
  IconButton,
  CommitTextarea,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import { useVibeStore } from "@/stores/vibeStore";
import {
  dungeonContext,
  dungeonPrompt,
  dungeonRoomTemplateContext,
  dungeonRoomTemplatePrompt,
} from "@/lib/entityPrompts";
import sidebarBg from "@/assets/sidebar-bg.png";

type EntityJumpKind = "mob" | "item";

interface DungeonEditorProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  onJumpToEntity: (kind: EntityJumpKind, id: string) => void;
}

// ─── Valid dungeon enums (must match Kotlin DungeonRoomType / DungeonDifficulty) ──

const ROOM_TYPE_OPTIONS = [
  { value: "entrance", label: "Entrance" },
  { value: "corridor", label: "Corridor" },
  { value: "chamber", label: "Chamber" },
  { value: "treasure", label: "Treasure" },
  { value: "boss", label: "Boss" },
];

const DIFFICULTY_OPTIONS = [
  { value: "lore", label: "Lore" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
  { value: "heroic", label: "Heroic" },
];

const MOB_POOL_KEYS = ["common", "elite", "boss"] as const;

const DIFFICULTY_ACCENT: Record<string, string> = {
  lore: "text-status-info",
  normal: "text-text-secondary",
  hard: "text-warm",
  heroic: "text-accent",
};

const POOL_ACCENT: Record<(typeof MOB_POOL_KEYS)[number], string> = {
  common: "text-text-secondary",
  elite: "text-warm",
  boss: "text-accent",
};

// ─── Icons ────────────────────────────────────────────────────────

const GateIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M3 21V8l9-5 9 5v13" />
    <path d="M9 21v-8a3 3 0 0 1 6 0v8" />
    <path d="M3 21h18" />
  </svg>
);

const SkullIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M22 13a10 10 0 1 0-20 0c0 3.1 1.4 5.9 3.6 7.7a2 2 0 0 0 1.2.3h10.4a2 2 0 0 0 1.2-.3C20.6 18.9 22 16.1 22 13Z" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M12 17v3" />
    <path d="M8 20v2" />
    <path d="M16 20v2" />
  </svg>
);

const ChestIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <rect x="3" y="8" width="18" height="12" rx="1" />
    <path d="M3 12h18" />
    <path d="M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4" />
    <path d="M10 12v4" />
    <path d="M14 12v4" />
  </svg>
);

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <circle cx="12" cy="12" r="10" />
    <path d="m16 8-2 6-6 2 2-6 6-2Z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="1.5" />
    <path d="m21 17-5-5-9 9" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

// ─── Shared card shell ────────────────────────────────────────────

function Card({
  icon,
  title,
  description,
  children,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-border-muted bg-[var(--chrome-fill-soft)] p-4 shadow-[0_1px_0_var(--chrome-highlight)_inset] ${className ?? ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-accent">
          {icon}
          <h3 className="font-display text-sm uppercase tracking-widest">{title}</h3>
        </div>
        {actions}
      </div>
      {description && <p className="mb-3 text-xs text-text-muted">{description}</p>}
      {children}
    </div>
  );
}

function StatsPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border-muted bg-[var(--chrome-fill-soft)] px-2.5 py-1 text-2xs text-text-secondary">
      <span className="text-accent">{icon}</span>
      <span className="uppercase tracking-wider">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </div>
  );
}

// ─── Hero image preview ──────────────────────────────────────────

function HeroImage({ image }: { image: string | undefined }) {
  const src = useImageSrc(image);
  return (
    <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded border border-border-muted bg-bg-primary/40">
      {src ? (
        <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-muted">
          <ImageIcon />
          <span className="text-2xs uppercase tracking-wider">No image yet</span>
        </div>
      )}
    </div>
  );
}

// ─── Entity picker combobox ───────────────────────────────────────

interface EntityPickerOption {
  id: string;
  label: string;
}

function EntityPicker({
  value,
  onChange,
  options,
  placeholder,
  onOpenEntity,
  onCreateNew,
  createLabel,
  unknownHint,
}: {
  value: string;
  onChange: (value: string) => void;
  options: EntityPickerOption[];
  placeholder?: string;
  onOpenEntity?: (id: string) => void;
  onCreateNew?: () => void;
  createLabel?: string;
  unknownHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => options.find((o) => o.id === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? options
      : options.filter(
          (o) => o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
        );
    return list.slice(0, 12);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const display = value ? (matched ? matched.label : value) : "";
  const unknown = value.length > 0 && !matched;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            className={`ornate-input min-h-9 w-full px-2 py-1 text-xs text-text-primary ${unknown ? "border-warm/60" : ""}`}
            value={open ? query : display}
            placeholder={placeholder}
            onFocus={() => {
              setQuery("");
              setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          {!open && value && matched && (
            <span
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-2xs text-text-muted"
              title={value}
            >
              {value}
            </span>
          )}
        </div>
        {unknown && (
          <span
            className="text-warm"
            title={unknownHint ?? `"${value}" — not in this zone`}
            aria-label="Unknown entity"
          >
            !
          </span>
        )}
        {value && matched && onOpenEntity && (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-[var(--chrome-highlight)] hover:text-accent"
            title="Open in editor"
            onClick={() => onOpenEntity(value)}
          >
            <ExternalLinkIcon />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border-default bg-bg-elevated shadow-xl">
          {filtered.length === 0 && !query.trim() && (
            <div className="px-3 py-2 text-2xs italic text-text-muted">No matches.</div>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              <span className="font-mono text-2xs text-text-muted">{opt.id}</span>
            </button>
          ))}
          {query.trim() && !filtered.some((o) => o.id === query.trim()) && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border-muted px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(query.trim());
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }}
            >
              <span className="text-text-muted">Use</span>
              <span className="font-mono text-text-primary">{query.trim()}</span>
              <span className="text-2xs text-text-muted">(external ID)</span>
            </button>
          )}
          {onCreateNew && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border-muted px-3 py-1.5 text-left text-xs text-accent transition-colors hover:bg-[var(--chrome-highlight)]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
            >
              <span className="font-mono">+</span>
              <span>{createLabel ?? "Create new"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Room templates sub-editor ────────────────────────────────────

function RoomTemplatesEditor({
  zoneId,
  dungeon,
  vibe,
  onChange,
}: {
  zoneId: string;
  dungeon: DungeonFile;
  vibe?: string;
  onChange: (t: Record<string, DungeonRoomTemplate[]>) => void;
}) {
  const templates = dungeon.roomTemplates ?? {};
  const existingKeys = new Set(Object.keys(templates));
  const available = ROOM_TYPE_OPTIONS.filter((o) => !existingKeys.has(o.value));

  const addCategory = (key: string) => {
    if (!key || templates[key]) return;
    onChange({ ...templates, [key]: [] });
  };

  const removeCategory = (key: string) => {
    const next = { ...templates };
    delete next[key];
    onChange(next);
  };

  const addTemplate = (category: string) => {
    onChange({
      ...templates,
      [category]: [...(templates[category] ?? []), { title: "", description: "" }],
    });
  };

  const updateTemplate = (category: string, idx: number, patch: Partial<DungeonRoomTemplate>) => {
    const list = [...(templates[category] ?? [])];
    list[idx] = { ...list[idx]!, ...patch } as DungeonRoomTemplate;
    onChange({ ...templates, [category]: list });
  };

  const removeTemplate = (category: string, idx: number) => {
    const list = (templates[category] ?? []).filter((_, i) => i !== idx);
    onChange({ ...templates, [category]: list });
  };

  const orderedEntries = Object.entries(templates).sort(([a], [b]) => {
    const ai = ROOM_TYPE_OPTIONS.findIndex((o) => o.value === a);
    const bi = ROOM_TYPE_OPTIONS.findIndex((o) => o.value === b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="flex flex-col gap-3">
      {orderedEntries.length === 0 && (
        <p className="rounded border border-dashed border-border-muted px-3 py-4 text-center text-2xs italic text-text-muted">
          No room categories yet — add one below.
        </p>
      )}
      {orderedEntries.map(([category, list]) => (
        <div key={category} className="rounded border border-border-muted bg-bg-primary/30 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
              <span className="font-display text-xs uppercase tracking-[0.15em] text-accent">{category}</span>
              <span className="text-2xs text-text-muted">
                {list.length} {list.length === 1 ? "template" : "templates"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <IconButton title="Add room template" onClick={() => addTemplate(category)}>+</IconButton>
              <IconButton title="Remove category" onClick={() => removeCategory(category)}>&times;</IconButton>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {list.map((tpl, i) => (
              <RoomTemplateRow
                key={i}
                zoneId={zoneId}
                dungeon={dungeon}
                category={category}
                index={i}
                template={tpl}
                vibe={vibe}
                onPatch={(patch) => updateTemplate(category, i, patch)}
                onRemove={() => removeTemplate(category, i)}
              />
            ))}
            {list.length === 0 && (
              <p className="rounded border border-dashed border-border-muted/60 px-2 py-2 text-center text-2xs italic text-text-muted">
                No templates yet.
              </p>
            )}
          </div>
        </div>
      ))}
      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <SelectInput
            value=""
            onCommit={addCategory}
            options={available}
            placeholder="Add room type..."
            allowEmpty
          />
        </div>
      )}
    </div>
  );
}

const RoomTemplateRow = memo(function RoomTemplateRow({
  zoneId,
  dungeon,
  category,
  index,
  template,
  vibe,
  onPatch,
  onRemove,
}: {
  zoneId: string;
  dungeon: DungeonFile;
  category: string;
  index: number;
  template: DungeonRoomTemplate;
  vibe?: string;
  onPatch: (patch: Partial<DungeonRoomTemplate>) => void;
  onRemove: () => void;
}) {
  const [showArt, setShowArt] = useState(false);
  const src = useImageSrc(template.image);
  const entityId = `${category}_${index}`;

  return (
    <div className="flex items-start gap-2 rounded border border-border-muted/60 bg-[var(--chrome-fill-soft)] px-2 py-2">
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded border border-border-muted/60 bg-bg-primary/40">
        {src ? (
          <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <ImageIcon />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <TextInput
          value={template.title}
          onCommit={(v) => onPatch({ title: v })}
          placeholder="Room title"
          dense
        />
        <CommitTextarea
          label=""
          value={template.description}
          onCommit={(v) => onPatch({ description: v })}
          placeholder="Room description"
          rows={2}
        />
        <div className="flex items-center gap-2">
          <TextInput
            value={template.image ?? ""}
            onCommit={(v) => onPatch({ image: v || undefined })}
            placeholder="Image filename"
            dense
          />
          <button
            type="button"
            onClick={() => setShowArt((v) => !v)}
            className="shrink-0 rounded border border-border-muted bg-[var(--chrome-fill-soft)] px-2 py-1 text-2xs uppercase tracking-wider text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
          >
            {showArt ? "Hide Art" : "Generate"}
          </button>
        </div>
        {showArt && (
          <div className="mt-1 rounded border border-border-muted/60 bg-bg-primary/30 p-2">
            <EntityArtGenerator
              getPrompt={(style) => dungeonRoomTemplatePrompt(category, template, style)}
              entityContext={dungeonRoomTemplateContext(category, template, dungeon)}
              currentImage={template.image}
              onAccept={(filePath) => onPatch({ image: filePath })}
              assetType="background"
              context={{ zone: zoneId, entity_type: "dungeon_room", entity_id: entityId }}
              vibe={vibe}
              surface="worldbuilding"
            />
          </div>
        )}
      </div>
      <IconButton title="Remove" onClick={onRemove}>&times;</IconButton>
    </div>
  );
});

// ─── Mob pool sub-editor ──────────────────────────────────────────

function MobPoolsEditor({
  pools,
  mobOptions,
  onChange,
  onJumpToEntity,
  onCreateMob,
}: {
  pools: DungeonMobPool;
  mobOptions: EntityPickerOption[];
  onChange: (p: DungeonMobPool) => void;
  onJumpToEntity: (kind: EntityJumpKind, id: string) => void;
  onCreateMob: () => void;
}) {
  const addItem = (pool: (typeof MOB_POOL_KEYS)[number]) => {
    onChange({ ...pools, [pool]: [...(pools[pool] ?? []), ""] });
  };

  const updateItem = (pool: (typeof MOB_POOL_KEYS)[number], idx: number, value: string) => {
    const list = [...(pools[pool] ?? [])];
    list[idx] = value;
    onChange({ ...pools, [pool]: list });
  };

  const removeItem = (pool: (typeof MOB_POOL_KEYS)[number], idx: number) => {
    onChange({ ...pools, [pool]: (pools[pool] ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {MOB_POOL_KEYS.map((pool) => {
        const items = pools[pool] ?? [];
        return (
          <div key={pool} className="rounded border border-border-muted bg-bg-primary/30 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-current ${POOL_ACCENT[pool]}`} />
                <span className={`font-display text-xs uppercase tracking-[0.15em] ${POOL_ACCENT[pool]}`}>
                  {pool}
                </span>
                <span className="text-2xs text-text-muted">{items.length}</span>
              </div>
              <IconButton title="Add mob" onClick={() => addItem(pool)}>+</IconButton>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <EntityPicker
                    value={item}
                    onChange={(v) => updateItem(pool, i, v)}
                    options={mobOptions}
                    placeholder="Pick a mob..."
                    onOpenEntity={(id) => onJumpToEntity("mob", id)}
                    onCreateNew={onCreateMob}
                    createLabel="Create new mob…"
                    unknownHint="not in this zone — will resolve at runtime if defined elsewhere"
                  />
                  <IconButton title="Remove" onClick={() => removeItem(pool, i)}>&times;</IconButton>
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded border border-dashed border-border-muted/60 px-2 py-2 text-center text-2xs italic text-text-muted">
                  Empty pool.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Loot tables sub-editor ───────────────────────────────────────

function LootTablesEditor({
  tables,
  itemOptions,
  onChange,
  onJumpToEntity,
  onCreateItem,
}: {
  tables: Record<string, DungeonLootTable>;
  itemOptions: EntityPickerOption[];
  onChange: (t: Record<string, DungeonLootTable>) => void;
  onJumpToEntity: (kind: EntityJumpKind, id: string) => void;
  onCreateItem: () => void;
}) {
  const existingKeys = new Set(Object.keys(tables));
  const available = DIFFICULTY_OPTIONS.filter((o) => !existingKeys.has(o.value));

  const addTier = (key: string) => {
    if (!key || tables[key]) return;
    onChange({ ...tables, [key]: {} });
  };

  const removeTier = (key: string) => {
    const next = { ...tables };
    delete next[key];
    onChange(next);
  };

  const updateList = (tier: string, field: keyof DungeonLootTable, list: string[]) => {
    onChange({ ...tables, [tier]: { ...tables[tier], [field]: list } });
  };

  const addToList = (tier: string, field: keyof DungeonLootTable) => {
    const current = tables[tier]?.[field] ?? [];
    updateList(tier, field, [...current, ""]);
  };

  const updateInList = (tier: string, field: keyof DungeonLootTable, idx: number, value: string) => {
    const current = [...(tables[tier]?.[field] ?? [])];
    current[idx] = value;
    updateList(tier, field, current);
  };

  const removeFromList = (tier: string, field: keyof DungeonLootTable, idx: number) => {
    updateList(
      tier,
      field,
      (tables[tier]?.[field] ?? []).filter((_, i) => i !== idx),
    );
  };

  const orderedEntries = Object.entries(tables).sort(([a], [b]) => {
    const ai = DIFFICULTY_OPTIONS.findIndex((o) => o.value === a);
    const bi = DIFFICULTY_OPTIONS.findIndex((o) => o.value === b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="flex flex-col gap-3">
      {orderedEntries.length === 0 && (
        <p className="rounded border border-dashed border-border-muted px-3 py-4 text-center text-2xs italic text-text-muted">
          No difficulty tiers yet — add one below.
        </p>
      )}
      {orderedEntries.map(([tier, table]) => {
        const accent = DIFFICULTY_ACCENT[tier] ?? "text-text-secondary";
        return (
          <div key={tier} className="rounded border border-border-muted bg-bg-primary/30 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-current ${accent}`} />
                <span className={`font-display text-xs uppercase tracking-[0.15em] ${accent}`}>
                  {tier}
                </span>
              </div>
              <IconButton title="Remove tier" onClick={() => removeTier(tier)}>&times;</IconButton>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(["mobDrops", "completionRewards"] as (keyof DungeonLootTable)[]).map((field) => {
                const items = table[field] ?? [];
                return (
                  <div key={field} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs uppercase tracking-wider text-text-muted">
                        {field === "mobDrops" ? "Mob Drops" : "Completion Rewards"}
                      </span>
                      <IconButton title={`Add ${field} item`} onClick={() => addToList(tier, field)}>
                        +
                      </IconButton>
                    </div>
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <EntityPicker
                          value={item}
                          onChange={(v) => updateInList(tier, field, i, v)}
                          options={itemOptions}
                          placeholder="Pick an item..."
                          onOpenEntity={(id) => onJumpToEntity("item", id)}
                          onCreateNew={onCreateItem}
                          createLabel="Create new item…"
                          unknownHint="not in this zone — will resolve at runtime if defined elsewhere"
                        />
                        <IconButton title="Remove" onClick={() => removeFromList(tier, field, i)}>
                          &times;
                        </IconButton>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="rounded border border-dashed border-border-muted/60 px-2 py-1.5 text-center text-2xs italic text-text-muted">
                        None.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <SelectInput
            value=""
            onCommit={addTier}
            options={available}
            placeholder="Add difficulty tier..."
            allowEmpty
          />
        </div>
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────

const DEFAULT_ROOM_CATEGORIES = ["entrance", "corridor", "chamber", "treasure", "boss"];
const DEFAULT_LOOT_TIERS = ["lore", "normal", "hard", "heroic"];

export function DungeonEditor({
  zoneId,
  world,
  onWorldChange,
  onDelete,
  onJumpToEntity,
}: DungeonEditorProps) {
  const dungeon = world.dungeon;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const vibe = useVibeStore((s) => s.getVibe(zoneId));

  const patch = useCallback(
    (p: Partial<DungeonFile>) => onWorldChange(updateDungeon(world, p)),
    [world, onWorldChange],
  );

  const mobOptions = useMemo<EntityPickerOption[]>(
    () =>
      Object.entries(world.mobs ?? {})
        .map(([id, mob]: [string, MobFile]) => ({ id, label: mob.name || id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [world.mobs],
  );

  const itemOptions = useMemo<EntityPickerOption[]>(
    () =>
      Object.entries(world.items ?? {})
        .map(([id, item]: [string, ItemFile]) => ({ id, label: item.displayName || id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [world.items],
  );

  const stats = useMemo(() => {
    if (!dungeon) return { templates: 0, mobs: 0, tiers: 0 };
    const templates = Object.values(dungeon.roomTemplates ?? {}).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    const pools = dungeon.mobPools ?? {};
    const mobs = (pools.common?.length ?? 0) + (pools.elite?.length ?? 0) + (pools.boss?.length ?? 0);
    const tiers = Object.keys(dungeon.lootTables ?? {}).length;
    return { templates, mobs, tiers };
  }, [dungeon]);

  const handleCreateMob = useCallback(() => {
    const id = generateEntityId(world, "mobs");
    const firstRoom = Object.keys(world.rooms)[0] ?? "";
    const next = addMob(world, id, { name: "New Mob", room: firstRoom, tier: "standard", level: 1 } as MobFile);
    onWorldChange(next);
    onJumpToEntity("mob", id);
  }, [world, onWorldChange, onJumpToEntity]);

  const handleCreateItem = useCallback(() => {
    const id = generateEntityId(world, "items");
    const firstRoom = Object.keys(world.rooms)[0] ?? "";
    const next = addItem(world, id, { displayName: "New Item", room: firstRoom } as ItemFile);
    onWorldChange(next);
    onJumpToEntity("item", id);
  }, [world, onWorldChange, onJumpToEntity]);

  if (!dungeon) return null;

  const roomRange =
    dungeon.roomCountMin && dungeon.roomCountMax
      ? `${dungeon.roomCountMin}–${dungeon.roomCountMax}`
      : "—";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <img
        src={sidebarBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
      />
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border-muted pb-4">
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl uppercase tracking-widest text-accent">
                {dungeon.name || "Untitled Dungeon"}
              </h2>
              <p className="mt-1 text-xs uppercase tracking-wider text-text-muted">
                Procedural Instance Template
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-2xs">
              <StatsPill icon={<CompassIcon />} label="rooms" value={roomRange} />
              <StatsPill icon={<GateIcon />} label="templates" value={stats.templates} />
              <StatsPill icon={<SkullIcon />} label="mobs" value={stats.mobs} />
              <StatsPill icon={<ChestIcon />} label="tiers" value={stats.tiers} />
              <button
                onClick={() => setConfirmingDelete(true)}
                className="ml-1 flex items-center gap-1.5 rounded-full border border-status-danger/40 px-2.5 py-1 text-status-danger/80 transition-colors hover:bg-status-danger/10 hover:text-status-danger"
                title="Remove dungeon template"
              >
                <TrashIcon />
                <span className="uppercase tracking-wider">Remove</span>
              </button>
            </div>
          </div>

          {/* Hero image + Basics row */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card
              icon={<ImageIcon />}
              title="Hero Image"
              description="Title card used on dungeon listings and the load-in screen."
            >
              <HeroImage image={dungeon.image} />
              <div className="flex flex-col gap-1.5">
                <FieldRow label="Filename">
                  <TextInput
                    value={dungeon.image ?? ""}
                    onCommit={(v) => patch({ image: v || undefined })}
                    placeholder="Asset filename"
                    dense
                  />
                </FieldRow>
                <EntityArtGenerator
                  getPrompt={(style) => dungeonPrompt(dungeon, style)}
                  entityContext={dungeonContext(dungeon, world.zone)}
                  currentImage={dungeon.image}
                  onAccept={(filePath) => patch({ image: filePath })}
                  assetType="background"
                  context={{ zone: zoneId, entity_type: "dungeon", entity_id: "main" }}
                  vibe={vibe}
                  surface="worldbuilding"
                />
              </div>
            </Card>

            <Card icon={<CompassIcon />} title="Basics" description="Core identity and sizing.">
              <div className="flex flex-col gap-1.5">
                <FieldRow label="Name">
                  <TextInput
                    value={dungeon.name}
                    onCommit={(v) => patch({ name: v })}
                    placeholder="Dungeon name"
                    dense
                  />
                </FieldRow>
                <CommitTextarea
                  label="Description"
                  value={dungeon.description ?? ""}
                  onCommit={(v) => patch({ description: v || undefined })}
                  placeholder="Dungeon description..."
                  rows={4}
                />
                <FieldRow label="Portal Room">
                  <TextInput
                    value={dungeon.portalRoom ?? ""}
                    onCommit={(v) => patch({ portalRoom: v || undefined })}
                    placeholder="Room ID players return to"
                    dense
                  />
                </FieldRow>
                <FieldRow label="Min Level">
                  <NumberInput
                    value={dungeon.minLevel ?? 1}
                    onCommit={(v) => patch({ minLevel: v ?? 1 })}
                    min={1}
                    dense
                  />
                </FieldRow>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Rooms Min">
                    <NumberInput
                      value={dungeon.roomCountMin ?? 20}
                      onCommit={(v) => patch({ roomCountMin: v ?? 20 })}
                      min={3}
                      dense
                    />
                  </FieldRow>
                  <FieldRow label="Rooms Max">
                    <NumberInput
                      value={dungeon.roomCountMax ?? 25}
                      onCommit={(v) => patch({ roomCountMax: v ?? 25 })}
                      min={3}
                      dense
                    />
                  </FieldRow>
                </div>
              </div>
            </Card>
          </div>

          {/* Room Templates (full width) */}
          <div className="mb-6">
            <Card
              icon={<GateIcon />}
              title="Room Templates"
              description="Grouped by room type. The server draws from these pools when assembling an instance. Each template can have its own generated background."
            >
              <RoomTemplatesEditor
                zoneId={zoneId}
                dungeon={{
                  ...dungeon,
                  roomTemplates:
                    dungeon.roomTemplates ??
                    Object.fromEntries(DEFAULT_ROOM_CATEGORIES.map((c) => [c, []])),
                }}
                vibe={vibe}
                onChange={(roomTemplates) => patch({ roomTemplates })}
              />
            </Card>
          </div>

          {/* Mob Pools */}
          <div className="mb-6">
            <Card
              icon={<SkullIcon />}
              title="Mob Pools"
              description="Encounters drawn per room. Common fills chambers and corridors; elite guards treasure; boss anchors the finale."
            >
              <MobPoolsEditor
                pools={dungeon.mobPools ?? { common: [], elite: [], boss: [] }}
                mobOptions={mobOptions}
                onChange={(mobPools) => patch({ mobPools })}
                onJumpToEntity={onJumpToEntity}
                onCreateMob={handleCreateMob}
              />
            </Card>
          </div>

          {/* Loot Tables */}
          <Card
            icon={<ChestIcon />}
            title="Loot Tables"
            description="Rewards per difficulty tier. Mob drops roll on kills; completion rewards roll on dungeon clear."
          >
            <LootTablesEditor
              tables={
                dungeon.lootTables ?? Object.fromEntries(DEFAULT_LOOT_TIERS.map((t) => [t, {}]))
              }
              itemOptions={itemOptions}
              onChange={(lootTables) => patch({ lootTables })}
              onJumpToEntity={onJumpToEntity}
              onCreateItem={handleCreateItem}
            />
          </Card>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Remove Dungeon Template"
          message="Remove this dungeon template? This action cannot be undone."
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

/** Empty state shown when a zone has no dungeon template. */
export function DungeonEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <img
        src={sidebarBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
      />
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-muted bg-[var(--chrome-fill-soft)] text-accent shadow-[0_1px_0_var(--chrome-highlight)_inset]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M3 21V8l9-5 9 5v13" />
              <path d="M9 21v-8a3 3 0 0 1 6 0v8" />
              <path d="M3 21h18" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-xl uppercase tracking-widest text-accent">
              No Dungeon Template
            </h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-text-muted">
              Procedural Instance Template
            </p>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Add a procedural dungeon template to this zone. It defines room pools, mob sets, and loot
            tables that the server assembles into unique instances at runtime.
          </p>
          <button
            onClick={onAdd}
            className="rounded-full border border-[rgb(var(--accent-rgb)/0.35)] bg-gradient-active-strong px-5 py-2 text-xs uppercase tracking-widest text-text-primary transition hover:shadow-glow"
          >
            Add Dungeon Template
          </button>
        </div>
      </div>
    </div>
  );
}
