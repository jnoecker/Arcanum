import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import type { WorldFile } from "@/types/world";
import type { AssetEntry } from "@/types/assets";

// ─── Types ──────────────────────────────────────────────────────────

type EntityKind = "room" | "mob" | "item" | "shop";

interface BrowseEntity {
  kind: EntityKind;
  id: string;
  label: string;
  image?: string;
}

interface AssetBrowserProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

// ─── Entity list builder ────────────────────────────────────────────

function collectEntities(world: WorldFile): BrowseEntity[] {
  const entities: BrowseEntity[] = [];

  for (const [id, room] of Object.entries(world.rooms)) {
    entities.push({
      kind: "room",
      id,
      label: room.title || id,
      image: room.image,
    });
  }
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    entities.push({
      kind: "mob",
      id,
      label: mob.name || id,
      image: mob.image,
    });
  }
  for (const [id, item] of Object.entries(world.items ?? {})) {
    entities.push({
      kind: "item",
      id,
      label: item.displayName || id,
      image: item.image,
    });
  }
  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    entities.push({
      kind: "shop",
      id,
      label: shop.name || id,
      image: shop.image,
    });
  }

  return entities;
}

const KIND_LABELS: Record<EntityKind, string> = {
  room: "ROOMS",
  mob: "MOBS",
  item: "ITEMS",
  shop: "SHOPS",
};

const KIND_ORDER: EntityKind[] = ["room", "mob", "item", "shop"];

// ─── Main component ────────────────────────────────────────────────

export function AssetBrowser({ zoneId, world, onWorldChange }: AssetBrowserProps) {
  const entities = useMemo(() => collectEntities(world), [world]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<EntityKind | null>(null);
  const [collapsedKinds, setCollapsedKinds] = useState<Set<EntityKind>>(
    new Set(),
  );

  // Auto-select first entity with an image, or just first entity
  useEffect(() => {
    if (selectedId && entities.some((e) => e.id === selectedId)) return;
    const withImage = entities.find((e) => e.image);
    const first = withImage ?? entities[0];
    if (first) {
      setSelectedId(first.id);
      setSelectedKind(first.kind);
    }
  }, [entities, selectedId]);

  const selected = useMemo(
    () => entities.find((e) => e.id === selectedId && e.kind === selectedKind),
    [entities, selectedId, selectedKind],
  );

  // Keyboard navigation
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const visible = entities.filter((ent) => !collapsedKinds.has(ent.kind));
      const idx = visible.findIndex(
        (ent) => ent.id === selectedId && ent.kind === selectedKind,
      );
      const next =
        e.key === "ArrowDown"
          ? Math.min(idx + 1, visible.length - 1)
          : Math.max(idx - 1, 0);
      const target = visible[next];
      if (target) {
        setSelectedId(target.id);
        setSelectedKind(target.kind);
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [entities, selectedId, selectedKind, collapsedKinds]);

  const toggleCollapse = (kind: EntityKind) => {
    setCollapsedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  // Group entities by kind
  const grouped = useMemo(() => {
    const map = new Map<EntityKind, BrowseEntity[]>();
    for (const kind of KIND_ORDER) map.set(kind, []);
    for (const entity of entities) {
      map.get(entity.kind)?.push(entity);
    }
    return map;
  }, [entities]);

  // Stats
  const totalCount = entities.length;
  const withImageCount = entities.filter((e) => e.image).length;

  return (
    <div ref={containerRef} tabIndex={-1} className="flex min-h-0 flex-1 outline-none">
      {/* Left sidebar — entity list */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
        <div className="shrink-0 border-b border-border-default px-3 py-2">
          <span className="font-display text-xs tracking-wide text-text-muted">
            {zoneId}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {KIND_ORDER.map((kind) => {
            const items = grouped.get(kind) ?? [];
            if (items.length === 0) return null;
            const collapsed = collapsedKinds.has(kind);

            return (
              <div key={kind}>
                <button
                  onClick={() => toggleCollapse(kind)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left"
                >
                  <span
                    className={`text-[8px] text-text-muted transition-transform ${collapsed ? "" : "rotate-90"}`}
                  >
                    &#9654;
                  </span>
                  <span className="flex-1 font-display text-2xs font-semibold uppercase tracking-widest text-text-secondary">
                    {KIND_LABELS[kind]}
                  </span>
                  <span className="text-2xs text-text-muted">
                    {items.length}
                  </span>
                </button>

                {!collapsed && (
                  <div className="flex flex-col">
                    {items.map((entity) => (
                      <button
                        key={`${entity.kind}:${entity.id}`}
                        onClick={() => {
                          setSelectedId(entity.id);
                          setSelectedKind(entity.kind);
                        }}
                        className={`flex items-center gap-2 px-3 py-1 text-left text-xs transition-colors ${
                          selectedId === entity.id &&
                          selectedKind === entity.kind
                            ? "bg-accent/15 text-accent-emphasis"
                            : "text-text-primary hover:bg-bg-elevated/60"
                        }`}
                      >
                        <span
                          className={`text-[8px] ${entity.image ? "text-status-success" : "text-text-muted"}`}
                        >
                          {entity.image ? "\u25CF" : "\u25CB"}
                        </span>
                        <span className="truncate">{entity.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom stats */}
        <div className="shrink-0 border-t border-border-default px-3 py-2">
          <div className="flex items-center gap-2 text-2xs text-text-muted">
            <span>
              {withImageCount}/{totalCount} with art
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${totalCount > 0 ? (withImageCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex min-h-0 flex-1 flex-col bg-bg-primary">
        {selected ? (
          <PreviewPanel
            key={`${selected.kind}:${selected.id}`}
            entity={selected}
            zoneId={zoneId}
            world={world}
            onWorldChange={onWorldChange}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
            No entities in this zone
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preview panel ──────────────────────────────────────────────────

function PreviewPanel({
  entity,
  zoneId,
  world,
  onWorldChange,
}: {
  entity: BrowseEntity;
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}) {
  const src = useImageSrc(entity.image);
  const variantGroup = `${entity.kind}:${zoneId}:${entity.id}`;
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const assetCount = useAssetStore((s) => s.assets.length);
  const [variants, setVariants] = useState<AssetEntry[]>([]);

  const loadVariants = useCallback(async () => {
    try {
      const v = await listVariants(variantGroup);
      setVariants(v);
    } catch {
      setVariants([]);
    }
  }, [variantGroup, listVariants]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants, assetCount]);

  const activeVariant = variants.find((v) => v.is_active);

  const handleSelectVariant = async (entry: AssetEntry) => {
    await setActiveVariant(variantGroup, entry.id);
    loadVariants();

    // Update the zone data so the entity's image field reflects the new active variant
    const { kind, id } = entity;
    if (kind === "room" && world.rooms[id]) {
      onWorldChange({
        ...world,
        rooms: {
          ...world.rooms,
          [id]: { ...world.rooms[id]!, image: entry.file_name },
        },
      });
    } else {
      const collection =
        kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
      const entities = world[collection] as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (entities?.[id]) {
        onWorldChange({
          ...world,
          [collection]: {
            ...entities,
            [id]: { ...entities[id], image: entry.file_name },
          },
        });
      }
    }
  };

  // Use active variant image if entity.image doesn't resolve
  const displayImage = src;
  const activeVariantPath = activeVariant
    ? `${assetsDir}\\images\\${activeVariant.file_name}`
    : undefined;
  const activeVariantSrc = useImageSrc(activeVariantPath);
  const finalSrc = displayImage || activeVariantSrc;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default px-4 py-2">
        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
          {entity.kind}
        </span>
        <span className="font-display text-sm tracking-wide text-text-primary">
          {entity.label}
        </span>
        <span className="text-xs text-text-muted">{entity.id}</span>
      </div>

      {/* Image area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {finalSrc ? (
          <img
            src={finalSrc}
            alt={entity.label}
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <span className="text-4xl opacity-30">&#x1F5BC;</span>
            <span className="text-xs">No image generated</span>
          </div>
        )}
      </div>

      {/* Variant strip */}
      {variants.length > 0 && (
        <div className="shrink-0 border-t border-border-default px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-2xs text-text-muted">
              {variants.length} variant{variants.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {variants.map((v) => (
                <VariantThumb
                  key={v.id}
                  entry={v}
                  assetsDir={assetsDir}
                  onSelect={() => handleSelectVariant(v)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variant thumbnail ──────────────────────────────────────────────

function VariantThumb({
  entry,
  assetsDir,
  onSelect,
}: {
  entry: AssetEntry;
  assetsDir: string;
  onSelect: () => void;
}) {
  const imagePath = `${assetsDir}\\images\\${entry.file_name}`;
  const src = useImageSrc(imagePath);

  return (
    <button
      onClick={onSelect}
      title={entry.created_at}
      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 transition-all ${
        entry.is_active
          ? "border-accent shadow-[0_0_6px_var(--color-accent)]"
          : "border-border-default hover:border-accent/50"
      }`}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-bg-elevated" />
      )}
    </button>
  );
}
