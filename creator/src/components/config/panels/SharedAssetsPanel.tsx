import { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { useImageSrc } from "@/lib/useImageSrc";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import {
  REQUIRED_GLOBAL_ASSETS,
  REQUIRED_GLOBAL_ASSET_KEYS,
  type RequiredGlobalAsset,
} from "@/lib/requiredGlobalAssets";
import { BUNDLED_GLOBAL_ASSETS } from "@/assets/global_assets";
import {
  REQUIRED_DEFAULT_ASSETS,
  DEFAULT_ASSET_CATEGORIES,
} from "@/lib/requiredDefaultAssets";
import { BUNDLED_DEFAULT_ASSETS } from "@/assets/defaults";
import type { SyncProgress } from "@/types/assets";
import { GlobalAssetGeneratorModal } from "./GlobalAssetGeneratorModal";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── Types ──────────────────────────────────────────────────────────

type TabId = "ui" | "defaults" | "custom";

interface SharedAssetSlot {
  /** Config key written to `globalAssets` or `defaultAssets`. */
  key: string;
  /** Human-readable label shown under the thumbnail. */
  label: string;
  /** One-sentence description — shown in the tooltip. */
  description: string;
  /** Current filename (or empty string if unbound). */
  filename: string;
  /** Bundled fallback shown at reduced opacity when unbound. */
  fallback?: string;
  /** Spec used by the generator modal (global asset shape). */
  generateSpec?: RequiredGlobalAsset;
  /** True when the slot is a user-defined custom key (removable). */
  removable?: boolean;
  /** Pixel size shown as a chip on default assets. */
  sizeLabel?: string;
  /** Whether the preview should tile (terrain). */
  tileable?: boolean;
  /** Unbound slots get "Using MUD default" pip instead of "Missing". */
  optional?: boolean;
  /** Which config field the slot belongs to. */
  scope: "global" | "default";
}

// ─── Thumbnail ──────────────────────────────────────────────────────

function AssetThumbnail({
  filename,
  fallback,
  size = 56,
  tileable = false,
}: {
  filename: string;
  fallback?: string;
  size?: number;
  tileable?: boolean;
}) {
  const src = useImageSrc(filename);
  const effective = src ?? fallback ?? null;
  const dim = `${size}px`;

  if (!effective) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded border border-border-default bg-bg-primary text-[10px] text-text-muted"
        style={{ width: dim, height: dim }}
      >
        ?
      </div>
    );
  }

  if (tileable) {
    return (
      <div
        className="shrink-0 overflow-hidden rounded border border-border-default"
        style={{ width: dim, height: dim }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url(${effective})`,
            backgroundSize: `${size / 2}px ${size / 2}px`,
            backgroundRepeat: "repeat",
            imageRendering: "pixelated",
            opacity: src ? 1 : 0.55,
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <img
      src={effective}
      alt=""
      loading="lazy"
      className={`shrink-0 rounded border border-border-default object-cover ${src ? "" : "opacity-60"}`}
      style={{ width: dim, height: dim }}
    />
  );
}

// ─── Card ───────────────────────────────────────────────────────────

interface AssetCardProps {
  slot: SharedAssetSlot;
  onPickGallery: () => void;
  onPickFile: () => void;
  onGenerate: () => void;
  onClear: () => void;
  onRemove: () => void;
}

function AssetCard({
  slot,
  onPickGallery,
  onPickFile,
  onGenerate,
  onClear,
  onRemove,
}: AssetCardProps) {
  const unset = !slot.filename.trim();
  const thumbSize = slot.tileable ? 72 : 56;

  return (
    <div
      className="group/card relative flex flex-col gap-2 rounded-lg border border-border-default bg-bg-primary/50 p-3 transition-colors hover:border-accent/40 hover:bg-bg-primary"
      title={slot.description}
    >
      <div className="flex items-start gap-3">
        <AssetThumbnail
          filename={slot.filename}
          fallback={slot.fallback}
          size={thumbSize}
          tileable={slot.tileable}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary">
              {slot.label}
            </span>
            {slot.sizeLabel && (
              <span className="shrink-0 rounded border border-border-default px-1 font-mono text-[9px] text-text-muted">
                {slot.sizeLabel}
              </span>
            )}
          </div>
          <span className="block max-w-full truncate font-mono text-[10px] text-text-muted">
            {slot.key}
          </span>
          {unset ? (
            <span
              className={`mt-0.5 w-fit shrink-0 rounded border px-1 text-[9px] uppercase tracking-wide ${
                slot.optional
                  ? "border-text-muted/40 text-text-muted"
                  : "border-status-warning/40 text-status-warning"
              }`}
            >
              {slot.optional ? "Using MUD default" : "Missing"}
            </span>
          ) : (
            <span
              className="mt-0.5 block max-w-full truncate font-mono text-[9px] text-text-muted/70"
              title={slot.filename}
            >
              {slot.filename}
            </span>
          )}
        </div>
        {slot.removable && (
          <button
            onClick={onRemove}
            className="focus-ring absolute right-1 top-1 rounded px-1.5 py-0.5 text-xs text-text-muted opacity-0 transition-colors hover:bg-status-error/20 hover:text-status-error focus:opacity-100 group-hover/card:opacity-100"
            title="Delete this custom key"
            aria-label={`Delete ${slot.key}`}
          >
            &times;
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
        {AI_ENABLED && slot.generateSpec && (
          <button
            onClick={onGenerate}
            className="focus-ring rounded border border-accent/40 px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10"
            title="Generate with default prompt"
          >
            Generate
          </button>
        )}
        <button
          onClick={onPickGallery}
          className="focus-ring rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
          title="Pick from asset gallery"
        >
          Gallery
        </button>
        <button
          onClick={onPickFile}
          className="focus-ring rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
          title="Import from file system"
        >
          File…
        </button>
        {!unset && slot.scope === "default" && (
          <button
            onClick={onClear}
            className="focus-ring ml-auto rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-status-error/50 hover:text-status-error"
            title="Clear override and use MUD default"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ui", label: "UI Icons" },
  { id: "defaults", label: "Default Sprites" },
  { id: "custom", label: "Custom Keys" },
];

export function SharedAssetsPanel({ config, onChange }: ConfigPanelProps) {
  const [active, setActive] = useState<TabId>("ui");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [pickingFor, setPickingFor] =
    useState<{ key: string; scope: "global" | "default" } | null>(null);
  const [generatingFor, setGeneratingFor] =
    useState<{ spec: RequiredGlobalAsset; scope: "global" | "default" } | null>(
      null,
    );

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const globalAssets = config.globalAssets;
  const defaultAssets = config.defaultAssets;
  const importAsset = useAssetStore((s) => s.importAsset);

  // ── Mutation helpers ─────────────────────────────────────────────
  const setGlobalAsset = useCallback(
    (key: string, value: string) => {
      const latest = useConfigStore.getState().config;
      const current = latest?.globalAssets ?? globalAssets;
      onChange({ globalAssets: { ...current, [key]: value } });
    },
    [globalAssets, onChange],
  );

  const setDefaultAsset = useCallback(
    (key: string, value: string) => {
      const latest = useConfigStore.getState().config;
      const current = latest?.defaultAssets ?? defaultAssets;
      onChange({ defaultAssets: { ...current, [key]: value } });
    },
    [defaultAssets, onChange],
  );

  const setSlot = useCallback(
    (key: string, scope: "global" | "default", value: string) => {
      if (scope === "global") setGlobalAsset(key, value);
      else setDefaultAsset(key, value);
    },
    [setGlobalAsset, setDefaultAsset],
  );

  const removeCustom = useCallback(
    (key: string) => {
      const next = { ...globalAssets };
      delete next[key];
      onChange({ globalAssets: next });
    },
    [globalAssets, onChange],
  );

  // ── File import ──────────────────────────────────────────────────
  const handlePickFile = useCallback(
    async (key: string, scope: "global" | "default") => {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!selected) return;
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return;
      const entry = await importAsset(
        filePath,
        "background",
        {
          zone: "",
          entity_type: scope === "global" ? "global_asset" : "default_asset",
          entity_id: key,
        },
        `${scope}:${key}`,
        true,
      );
      if (entry) setSlot(key, scope, entry.file_name);
    },
    [importAsset, setSlot],
  );

  // ── Deploy ───────────────────────────────────────────────────────
  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await invoke<SyncProgress>("deploy_global_assets_to_r2", {
        globalAssets,
      });
      setDeployResult(result);
    } catch (e) {
      setDeployResult({
        total: 0,
        uploaded: 0,
        skipped: 0,
        failed: 1,
        errors: [String(e)],
      });
    } finally {
      setDeploying(false);
    }
  }, [globalAssets]);

  // ── Build slot lists ─────────────────────────────────────────────
  const uiSlots = useMemo<SharedAssetSlot[]>(
    () =>
      REQUIRED_GLOBAL_ASSETS.map((spec) => ({
        key: spec.key,
        label: spec.label,
        description: spec.description,
        filename: globalAssets[spec.key] ?? "",
        fallback: BUNDLED_GLOBAL_ASSETS[spec.key],
        generateSpec: spec,
        scope: "global" as const,
      })),
    [globalAssets],
  );

  const defaultSlotsByCategory = useMemo(() => {
    const grouped = new Map<string, SharedAssetSlot[]>();
    for (const cat of DEFAULT_ASSET_CATEGORIES) grouped.set(cat.id, []);
    for (const spec of REQUIRED_DEFAULT_ASSETS) {
      const list = grouped.get(spec.category);
      if (!list) continue;
      list.push({
        key: spec.key,
        label: spec.label,
        description: spec.description,
        filename: defaultAssets[spec.key] ?? "",
        fallback: BUNDLED_DEFAULT_ASSETS[spec.key],
        generateSpec: spec as unknown as RequiredGlobalAsset,
        scope: "default",
        sizeLabel: `${spec.width}×${spec.height}`,
        tileable: spec.category === "terrain",
        optional: true,
      });
    }
    return grouped;
  }, [defaultAssets]);

  const customSlots = useMemo<SharedAssetSlot[]>(
    () =>
      Object.entries(globalAssets)
        .filter(([key]) => !REQUIRED_GLOBAL_ASSET_KEYS.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, filename]) => ({
          key,
          label: key.replace(/_/g, " "),
          description: "",
          filename: filename ?? "",
          removable: true,
          scope: "global" as const,
        })),
    [globalAssets],
  );

  // ── Filtering helpers ────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const matches = useCallback(
    (slot: SharedAssetSlot) => {
      if (missingOnly && slot.filename.trim()) return false;
      if (!q) return true;
      return (
        slot.key.toLowerCase().includes(q) ||
        slot.label.toLowerCase().includes(q) ||
        slot.description.toLowerCase().includes(q)
      );
    },
    [q, missingOnly],
  );

  const filteredUi = useMemo(() => uiSlots.filter(matches), [uiSlots, matches]);
  const filteredDefaults = useMemo(() => {
    const out = new Map<string, SharedAssetSlot[]>();
    for (const [catId, slots] of defaultSlotsByCategory.entries()) {
      out.set(catId, slots.filter(matches));
    }
    return out;
  }, [defaultSlotsByCategory, matches]);
  const filteredCustom = useMemo(
    () => customSlots.filter(matches),
    [customSlots, matches],
  );

  // ── Counts ───────────────────────────────────────────────────────
  const uiBound = useMemo(
    () => uiSlots.filter((s) => s.filename.trim()).length,
    [uiSlots],
  );
  const defaultsBound = useMemo(() => {
    let n = 0;
    for (const slots of defaultSlotsByCategory.values()) {
      for (const slot of slots) if (slot.filename.trim()) n++;
    }
    return n;
  }, [defaultSlotsByCategory]);
  const defaultsTotal = REQUIRED_DEFAULT_ASSETS.length;
  const totalRequiredBound = uiBound + defaultsBound;
  const totalRequired = uiSlots.length + defaultsTotal;

  const uiMissing = uiSlots.length - uiBound;
  const defaultsUnbound = defaultsTotal - defaultsBound;

  // ── Slot action handlers ─────────────────────────────────────────
  const handleGenerateClick = (slot: SharedAssetSlot) => {
    if (!slot.generateSpec) return;
    setGeneratingFor({ spec: slot.generateSpec, scope: slot.scope });
  };

  const renderCard = (slot: SharedAssetSlot) => (
    <AssetCard
      key={`${slot.scope}:${slot.key}`}
      slot={slot}
      onPickGallery={() => setPickingFor({ key: slot.key, scope: slot.scope })}
      onPickFile={() => handlePickFile(slot.key, slot.scope)}
      onGenerate={() => handleGenerateClick(slot)}
      onClear={() => setSlot(slot.key, slot.scope, "")}
      onRemove={() => removeCustom(slot.key)}
    />
  );

  const handleAddCustom = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || key in globalAssets) return;
    onChange({ globalAssets: { ...globalAssets, [key]: "" } });
    setNewKey("");
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-5">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border-muted bg-[var(--chrome-fill-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold uppercase tracking-wide-ui text-accent">
                Asset Manifest
              </h3>
              <p className="mt-0.5 text-2xs text-text-muted">
                {totalRequiredBound} of {totalRequired} bound &middot;{" "}
                {customSlots.length} custom{" "}
                {customSlots.length === 1 ? "key" : "keys"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeploy}
                disabled={
                  deploying ||
                  Object.values(globalAssets).every((v) => !v?.trim())
                }
                className="focus-ring rounded border border-accent/40 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                title="Upload UI icons and custom keys to Cloudflare R2"
              >
                {deploying ? "Deploying…" : "Deploy UI + Custom to R2"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by key, label, or description…"
              className="ornate-input min-h-9 flex-1 px-3 py-1.5 text-xs text-text-primary"
              aria-label="Search shared assets"
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-border-default bg-bg-primary/50 px-2 py-1 text-2xs text-text-secondary transition-colors hover:border-accent/40 hover:text-accent">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => setMissingOnly(e.target.checked)}
                className="h-3 w-3 accent-accent"
              />
              Missing only
            </label>
          </div>

          {deployResult && (
            <div className="rounded border border-border-default bg-bg-elevated px-3 py-2">
              <div className="flex items-center gap-3 text-xs">
                {deployResult.uploaded > 0 && (
                  <span className="text-status-success">
                    {deployResult.uploaded} uploaded
                  </span>
                )}
                {deployResult.skipped > 0 && (
                  <span className="text-text-muted">
                    {deployResult.skipped} already synced
                  </span>
                )}
                {deployResult.failed > 0 && (
                  <span className="text-status-error">
                    {deployResult.failed} failed
                  </span>
                )}
                <button
                  onClick={() => setDeployResult(null)}
                  className="ml-auto text-text-muted hover:text-text-primary"
                  aria-label="Dismiss deploy result"
                >
                  &times;
                </button>
              </div>
              {deployResult.errors.length > 0 && (
                <div className="mt-1 max-h-20 overflow-y-auto text-2xs text-status-error">
                  {deployResult.errors.slice(0, 10).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {deployResult.errors.length > 10 && (
                    <div>…and {deployResult.errors.length - 10} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar ───────────────────────────────────────────── */}
        <div
          className="segmented-control w-fit"
          role="tablist"
          aria-label="Shared asset tabs"
        >
          {TABS.map((tab, index) => {
            const badge =
              tab.id === "ui"
                ? `${uiBound}/${uiSlots.length}`
                : tab.id === "defaults"
                  ? `${defaultsBound}/${defaultsTotal}`
                  : `${customSlots.length}`;
            const badgeTone =
              tab.id === "ui"
                ? uiMissing > 0
                  ? "text-status-warning"
                  : "text-text-muted"
                : tab.id === "defaults"
                  ? defaultsUnbound > 0
                    ? "text-text-muted"
                    : "text-text-muted"
                  : "text-text-muted";
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                aria-selected={active === tab.id}
                tabIndex={active === tab.id ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = (index + 1) % TABS.length;
                    setActive(TABS[next]!.id);
                    tabRefs.current[next]?.focus();
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next = (index - 1 + TABS.length) % TABS.length;
                    setActive(TABS[next]!.id);
                    tabRefs.current[next]?.focus();
                  }
                }}
                className="segmented-button focus-ring px-4 py-2 text-xs font-medium"
                data-active={active === tab.id}
              >
                {tab.label}
                <span className={`ml-2 font-mono text-2xs ${badgeTone}`}>
                  {badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────────────────── */}
        <div role="tabpanel">
          {active === "ui" && (
            <UiTab slots={filteredUi} total={uiSlots.length} renderCard={renderCard} />
          )}
          {active === "defaults" && (
            <DefaultsTab
              filtered={filteredDefaults}
              totalByCategory={defaultSlotsByCategory}
              renderCard={renderCard}
            />
          )}
          {active === "custom" && (
            <CustomTab
              slots={filteredCustom}
              totalCustom={customSlots.length}
              newKey={newKey}
              onNewKeyChange={setNewKey}
              onAdd={handleAddCustom}
              renderCard={renderCard}
            />
          )}
        </div>

        {/* ── Advanced drawer ─────────────────────────────────────── */}
        <Section title="Advanced" defaultExpanded={false}>
          <ImageBaseUrlField config={config} onChange={onChange} />
        </Section>
      </div>

      {pickingFor && (
        <AssetPickerModal
          onSelect={(fileName) => {
            setSlot(pickingFor.key, pickingFor.scope, fileName);
          }}
          onClose={() => setPickingFor(null)}
        />
      )}

      {generatingFor && (
        <GlobalAssetGeneratorModal
          asset={generatingFor.spec}
          onClose={() => setGeneratingFor(null)}
          onComplete={(fileName) => {
            setSlot(generatingFor.spec.key, generatingFor.scope, fileName);
          }}
        />
      )}
    </>
  );
}

// ─── Tab content components ─────────────────────────────────────────

function UiTab({
  slots,
  total,
  renderCard,
}: {
  slots: SharedAssetSlot[];
  total: number;
  renderCard: (slot: SharedAssetSlot) => React.ReactNode;
}) {
  if (slots.length === 0) {
    return (
      <EmptyState
        message={
          total === 0
            ? "No UI icons defined."
            : "No UI icons match the current filter."
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {slots.map((slot) => renderCard(slot))}
    </div>
  );
}

function DefaultsTab({
  filtered,
  totalByCategory,
  renderCard,
}: {
  filtered: Map<string, SharedAssetSlot[]>;
  totalByCategory: Map<string, SharedAssetSlot[]>;
  renderCard: (slot: SharedAssetSlot) => React.ReactNode;
}) {
  const visibleCats = DEFAULT_ASSET_CATEGORIES.filter((cat) => {
    const list = filtered.get(cat.id) ?? [];
    return list.length > 0;
  });

  if (visibleCats.length === 0) {
    return (
      <EmptyState message="No default sprites match the current filter." />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {visibleCats.map((cat) => {
        const slots = filtered.get(cat.id) ?? [];
        const total = totalByCategory.get(cat.id)?.length ?? 0;
        const bound = (totalByCategory.get(cat.id) ?? []).filter((s) =>
          s.filename.trim(),
        ).length;
        return (
          <div key={cat.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h4 className="font-display text-xs uppercase tracking-wider text-accent">
                {cat.label}
              </h4>
              <span className="font-mono text-2xs text-text-muted">
                {bound}/{total}
              </span>
            </div>
            <p className="text-2xs text-text-muted/80">{cat.description}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => renderCard(slot))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomTab({
  slots,
  totalCustom,
  newKey,
  onNewKeyChange,
  onAdd,
  renderCard,
}: {
  slots: SharedAssetSlot[];
  totalCustom: number;
  newKey: string;
  onNewKeyChange: (v: string) => void;
  onAdd: () => void;
  renderCard: (slot: SharedAssetSlot) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => onNewKeyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="new_asset_key"
          className="ornate-input min-h-9 flex-1 px-3 py-1.5 font-mono text-xs text-text-primary"
          aria-label="New custom asset key"
        />
        <button
          onClick={onAdd}
          disabled={!newKey.trim()}
          className="focus-ring rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,opacity] hover:bg-accent/90 disabled:opacity-40"
        >
          + Add key
        </button>
      </div>
      {slots.length === 0 ? (
        <EmptyState
          message={
            totalCustom === 0
              ? "No custom global assets yet. Add a key above for project-specific overlays."
              : "No custom keys match the current filter."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => renderCard(slot))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-border-muted bg-bg-primary/30 px-4 py-8 text-center text-2xs italic text-text-muted">
      {message}
    </div>
  );
}

// ─── Advanced: image base URL ───────────────────────────────────────

function ImageBaseUrlField({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const img = config.images;
  return (
    <FieldRow
      label="Image Base URL"
      hint="URL prefix for all image assets. Use '/images/' for local serving, or a full CDN URL like 'https://assets.yourgame.com/' for production."
    >
      <TextInput
        value={img.baseUrl}
        onCommit={(v) => onChange({ images: { ...img, baseUrl: v || "/images/" } })}
        placeholder="/images/"
      />
    </FieldRow>
  );
}
