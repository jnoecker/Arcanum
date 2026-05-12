import { useEffect, useMemo, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useLoreStore } from "@/stores/loreStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useImageSrc } from "@/lib/useImageSrc";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { deriveWorldVisualStyle, type DeriveResult } from "@/lib/loreDerive";
import type { AssetEntry } from "@/types/assets";

const DEFAULT_PICK_COUNT = 4;
const MAX_PICKABLE = 4;
const CANDIDATE_POOL_SIZE = 24;

interface DeriveVisualStyleDialogProps {
  currentValue: string;
  onAccept: (value: string) => void;
  onClose: () => void;
}

export function DeriveVisualStyleDialog({
  currentValue,
  onAccept,
  onClose,
}: DeriveVisualStyleDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const assets = useAssetStore((s) => s.assets);
  const lore = useLoreStore((s) => s.lore);

  const activeStyle = useMemo(() => {
    if (!lore?.activeArtStyleId) return undefined;
    return (lore.artStyles ?? []).find((s) => s.id === lore.activeArtStyleId);
  }, [lore?.activeArtStyleId, lore?.artStyles]);

  const candidates = useMemo<AssetEntry[]>(() => {
    return [...assets]
      .filter((a) => a.is_active && !!a.file_name)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, CANDIDATE_POOL_SIZE);
  }, [assets]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.slice(0, DEFAULT_PICK_COUNT).map((a) => a.file_name)),
  );

  // If the candidate pool changes (project switch), reseed defaults.
  useEffect(() => {
    setSelected(new Set(candidates.slice(0, DEFAULT_PICK_COUNT).map((a) => a.file_name)));
  }, [candidates]);

  const [synthesizing, setSynthesizing] = useState(false);
  const [result, setResult] = useState<DeriveResult | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggle = (fileName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        if (next.size >= MAX_PICKABLE) return prev;
        next.add(fileName);
      }
      return next;
    });
  };

  const handleSynthesize = async () => {
    if (selected.size === 0) return;
    setSynthesizing(true);
    setError(null);
    setResult(null);
    try {
      const r = await deriveWorldVisualStyle({
        assetFileNames: Array.from(selected),
      });
      setResult(r);
      setDraft(r.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSynthesizing(false);
    }
  };

  const handleAccept = () => {
    onAccept(draft);
    onClose();
  };

  const willReplace = currentValue.trim().length > 0;

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="derive-visual-style-title"
      title="Derive Visual Style from Art"
      subtitle="Synthesized from a few rendered images plus the active art style"
      widthClassName="max-w-4xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          {result ? (
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleAccept}
              disabled={!draft.trim()}
            >
              {willReplace ? "Replace Visual Style" : "Use as Visual Style"}
            </ActionButton>
          ) : (
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleSynthesize}
              disabled={selected.size === 0 || synthesizing}
            >
              {synthesizing ? (
                <><Spinner /> Synthesizing…</>
              ) : (
                `Synthesize (${selected.size})`
              )}
            </ActionButton>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ActiveStyleBanner styleName={activeStyle?.name} description={activeStyle?.description} />

        {candidates.length === 0 ? (
          <p className="text-sm text-status-warning">
            No generated art yet — make a few images in the Forge first, then come back.
          </p>
        ) : (
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
                Source images
              </span>
              <span className="text-2xs text-text-muted">
                {selected.size} of {MAX_PICKABLE} selected · {candidates.length} recent shown
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {candidates.map((a) => (
                <AssetThumb
                  key={a.file_name}
                  asset={a}
                  selected={selected.has(a.file_name)}
                  onToggle={() => toggle(a.file_name)}
                />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-status-error">{error}</p>}

        {result && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="derive-visual-style-draft"
              className="font-display text-2xs uppercase tracking-wider text-accent"
            >
              Proposed visual style
            </label>
            <textarea
              id="derive-visual-style-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="ornate-input w-full resize-y rounded border border-accent/30 bg-bg-primary px-3 py-2 text-sm leading-relaxed text-text-secondary"
            />
            <p className="text-2xs text-text-muted">
              Edit before accepting if you want to soften phrasing or tweak emphasis.
            </p>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function ActiveStyleBanner({
  styleName,
  description,
}: {
  styleName?: string;
  description?: string;
}) {
  if (!styleName) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
        No active art style — synthesis will describe the rendered images on their own terms.
        Set one in the Forge for stronger results.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs text-text-secondary">
      Anchored to <span className="text-accent">{styleName}</span>
      {description ? ` — ${description}` : ""}.
    </div>
  );
}

function AssetThumb({
  asset,
  selected,
  onToggle,
}: {
  asset: AssetEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const src = useImageSrc(asset.file_name);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      title={`${asset.asset_type} · ${asset.file_name}`}
      className={`focus-ring group relative aspect-square overflow-hidden rounded-md border transition ${
        selected
          ? "border-accent ring-2 ring-accent/40"
          : "border-[var(--chrome-stroke)] hover:border-accent/40"
      }`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-bg-tertiary text-3xs text-text-muted">
          loading
        </div>
      )}
      <span
        aria-hidden="true"
        className={`absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold transition ${
          selected
            ? "border-accent bg-accent text-bg-primary"
            : "border-[var(--chrome-stroke)] bg-bg-primary/80 text-text-muted opacity-0 group-hover:opacity-100"
        }`}
      >
        {selected ? "✓" : "+"}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-primary/85 to-transparent px-1 py-0.5 text-[10px] text-text-muted">
        {asset.asset_type}
      </span>
    </button>
  );
}
