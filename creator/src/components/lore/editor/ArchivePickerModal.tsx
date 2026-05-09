import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAssetStore } from "@/stores/assetStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { AssetEntry } from "@/types/assets";

export type ArchivePickerMode = "single" | "multi";

interface ArchivePickerModalProps {
  open: boolean;
  mode: ArchivePickerMode;
  /** Filenames already in the target section (shown as disabled "already added"). */
  alreadySelected: string[];
  /** Optional title override; falls back to "Choose a Visage" / "Add to Gallery". */
  title?: string;
  onClose: () => void;
  /** Returns picked filename(s) — string for single-mode, string[] for multi. */
  onConfirm: (picked: string | string[]) => void;
}

interface AssetGroup {
  entityId: string;
  entityType: string;
  entityTitle: string;
  items: AssetEntry[];
}

const ENTITY_TYPE_FILTERS = [
  { id: "all",       label: "All" },
  { id: "species",   label: "Species" },
  { id: "character", label: "Characters" },
  { id: "location",  label: "Places" },
  { id: "organization", label: "Orgs" },
  { id: "item",      label: "Items" },
  { id: "event",     label: "Events" },
] as const;

type FilterId = typeof ENTITY_TYPE_FILTERS[number]["id"];

function shortenEntityType(type: string): string {
  return type.replace(/^lore_/, "");
}

function ArchiveTile({
  asset,
  selected,
  already,
  onClick,
}: {
  asset: AssetEntry;
  selected: boolean;
  already: boolean;
  onClick: () => void;
}) {
  const src = useImageSrc(asset.file_name);
  const title = asset.prompt.split(/[.,]/)[0]?.slice(0, 60) || asset.file_name;
  return (
    <button
      type="button"
      className="ae-libtile"
      data-selected={selected || undefined}
      data-already={already || undefined}
      onClick={onClick}
      title={already ? "Already in this section" : title}
    >
      {src ? <img src={src} alt={title} loading="lazy" /> : null}
      <span className="ae-libtile__check">
        {already ? "✓" : selected ? "✓" : ""}
      </span>
      <span className="ae-libtile__strap">{title}</span>
    </button>
  );
}

export function ArchivePickerModal({
  open,
  mode,
  alreadySelected,
  title,
  onClose,
  onConfirm,
}: ArchivePickerModalProps) {
  const assets = useAssetStore((s) => s.assets);
  const articles = useLoreStore(selectArticles);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setQuery("");
    setFilter("all");
  }, [open]);

  // Filter to lore-zone assets.
  const loreAssets = useMemo(() => assets.filter((a) => a.context.zone === "lore"), [assets]);

  // Apply text/type filters.
  const lower = query.trim().toLowerCase();
  const matches = useMemo(() => {
    return loreAssets.filter((asset) => {
      if (filter !== "all") {
        const short = shortenEntityType(asset.context.entity_type);
        if (short !== filter) return false;
      }
      if (!lower) return true;
      const promptText = asset.prompt.toLowerCase();
      const fileName = asset.file_name.toLowerCase();
      const entityTitle = (articles[asset.context.entity_id]?.title || "").toLowerCase();
      return (
        promptText.includes(lower) ||
        fileName.includes(lower) ||
        entityTitle.includes(lower) ||
        asset.context.entity_id.toLowerCase().includes(lower)
      );
    });
  }, [loreAssets, lower, filter, articles]);

  // Group by entity (article) for visual grouping.
  const groups: AssetGroup[] = useMemo(() => {
    const map = new Map<string, AssetGroup>();
    for (const asset of matches) {
      const key = asset.context.entity_id;
      let g = map.get(key);
      if (!g) {
        g = {
          entityId: key,
          entityType: shortenEntityType(asset.context.entity_type),
          entityTitle: articles[key]?.title || key,
          items: [],
        };
        map.set(key, g);
      }
      g.items.push(asset);
    }
    return Array.from(map.values()).sort((a, b) => a.entityTitle.localeCompare(b.entityTitle));
  }, [matches, articles]);

  // Counts per filter (computed from full lore-zone set, ignoring text query).
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: loreAssets.length };
    for (const a of loreAssets) {
      const k = shortenEntityType(a.context.entity_type);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [loreAssets]);

  if (!open) return null;

  const alreadySet = new Set(alreadySelected);

  const togglePick = (filename: string) => {
    if (alreadySet.has(filename)) return;
    if (mode === "single") {
      setPicked([filename]);
    } else {
      setPicked((prev) =>
        prev.includes(filename) ? prev.filter((x) => x !== filename) : [...prev, filename],
      );
    }
  };

  const handleConfirm = () => {
    if (picked.length === 0) return;
    onConfirm(mode === "single" ? picked[0]! : picked);
  };

  const headingId = "ae-archive-heading";

  return createPortal(
    <div className="ae-modal__scrim" onClick={onClose}>
      <div
        ref={dialogRef}
        className="ae-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ae-modal__head">
          <div>
            <div id={headingId} className="ae-modal__title">
              {title ?? (mode === "single" ? "Choose a Visage" : "Add to Gallery")}
            </div>
            <span className="ae-modal__sub">
              {mode === "single"
                ? "Pick one image from the Forge's archive — it becomes this section's portrait."
                : "Select one or more images already summoned for this world. The same image may appear in many places."}
            </span>
          </div>
          <button className="ae-modal__close" onClick={onClose} aria-label="Close picker">
            ×
          </button>
        </div>

        <div className="ae-modal__filter">
          <input
            type="text"
            placeholder="Search by name, entity or filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search archive"
          />
          {ENTITY_TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="ae-chip"
              data-active={filter === f.id || undefined}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="ae-chip__count">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ae-modal__body">
          {groups.length === 0 ? (
            <div className="ae-empty-block">
              {loreAssets.length === 0
                ? "The archive is empty. Generate art for any lore article and it will appear here."
                : "No images match that query."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.entityId}>
                <div className="ae-libgroup__title">
                  {g.entityTitle}
                  <span className="ae-libgroup__count">
                    {g.entityType} · {g.items.length}
                  </span>
                </div>
                <div className="ae-libgrid">
                  {g.items.map((asset) => {
                    const selected = picked.includes(asset.file_name);
                    const already = alreadySet.has(asset.file_name);
                    return (
                      <ArchiveTile
                        key={asset.id}
                        asset={asset}
                        selected={selected}
                        already={already}
                        onClick={() => togglePick(asset.file_name)}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="ae-modal__foot">
          <span className="ae-modal__foot__count">
            {picked.length === 0
              ? "Nothing chosen"
              : picked.length === 1
                ? "1 chosen"
                : `${picked.length} chosen`}
          </span>
          <span className="ae-modal__foot__spacer" />
          <button className="ae-btn" onClick={onClose}>Cancel</button>
          <button
            className="ae-btn"
            data-variant="ember"
            onClick={handleConfirm}
            disabled={picked.length === 0}
          >
            {mode === "single" ? "Set Visage" : `Add ${picked.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
