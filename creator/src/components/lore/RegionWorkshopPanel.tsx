import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoreStore, selectMaps, selectZonePlans, selectArticles } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import {
  buildPlanPrefill,
  createZoneFromPlan,
  type ZonePlanPrefill,
} from "@/lib/createZoneFromPlan";
import { NewZoneDialog } from "@/components/NewZoneDialog";
import { AI_ENABLED } from "@/lib/featureFlags";
import { useImageSrc } from "@/lib/useImageSrc";
import { cropImageDataUrl } from "@/lib/cropImageDataUrl";
import type { Article, LoreMap, ZonePlan, ZonePlanRegion } from "@/types/lore";
import { regionToPercentRect } from "@/lib/zoneRegionGeometry";
import {
  ActionButton,
  FieldRow,
  NumberInput,
  TextInput,
  Spinner,
} from "@/components/ui/FormWidgets";
import { LoreEditor } from "./LoreEditor";
import { ZonePlanTree } from "./ZonePlanTree";

// ─── Tag list editor (for inhabitants, landmarks) ──────────────────

function TagListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">{label}</label>
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-text-primary/10 bg-bg-abyss/20 px-2.5 py-1 text-xs text-text-secondary"
            >
              {item}
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 text-text-muted hover:text-status-danger"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          className="ornate-input min-h-9 flex-1 rounded-xl px-3 py-2 text-sm text-text-secondary"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <ActionButton onClick={add} variant="ghost" size="sm" disabled={!draft.trim()}>
          Add
        </ActionButton>
      </div>
    </div>
  );
}

// ─── Article linker ────────────────────────────────────────────────

function ArticleLinker({
  linkedIds,
  onChange,
}: {
  linkedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const allArticles = useMemo(
    () =>
      Object.values(articles)
        .filter((a): a is NonNullable<typeof a> => !!a)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [articles],
  );
  const linkedSet = new Set(linkedIds);
  const unlinked = allArticles.filter((a) => !linkedSet.has(a.id));
  const [search, setSearch] = useState("");
  const filtered = search
    ? unlinked.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : unlinked;

  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">Linked lore articles</label>
      {linkedIds.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {linkedIds.map((id) => {
            const art = articles[id];
            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-text-primary/6 bg-bg-abyss/15 px-3 py-1.5"
              >
                <span className="truncate text-xs text-text-secondary">
                  {art?.title ?? id}
                </span>
                <button
                  onClick={() => onChange(linkedIds.filter((x) => x !== id))}
                  className="ml-2 shrink-0 text-2xs text-text-muted hover:text-status-danger"
                >
                  Unlink
                </button>
              </div>
            );
          })}
        </div>
      )}
      {unlinked.length > 0 && (
        <>
          <input
            className="ornate-input mb-1 min-h-9 w-full rounded-xl px-3 py-2 text-sm text-text-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles to link..."
          />
          {search && filtered.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-text-primary/6 bg-bg-abyss/20">
              {filtered.slice(0, 10).map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    onChange([...linkedIds, a.id]);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-text-primary/5"
                >
                  <span className="truncate">{a.title}</span>
                  <span className="shrink-0 text-2xs text-text-muted">{a.template}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Region context image ──────────────────────────────────────────

function RegionContextImage({
  plan,
  parent,
  map,
}: {
  plan: ZonePlan;
  parent: ZonePlan | null;
  map: LoreMap;
}) {
  const mapImage = useImageSrc(map.imageAsset);
  const [contextImage, setContextImage] = useState<string | null>(null);
  const [contextW, setContextW] = useState(map.width);
  const [contextH, setContextH] = useState(map.height);
  const [loading, setLoading] = useState(false);

  const parentRegion = parent?.region;

  useEffect(() => {
    let cancelled = false;

    async function build() {
      if (!mapImage) {
        setContextImage(null);
        return;
      }

      if (!parentRegion) {
        setContextImage(mapImage);
        setContextW(map.width);
        setContextH(map.height);
        return;
      }

      setLoading(true);
      try {
        const cropped = await cropImageDataUrl(mapImage, parentRegion);
        if (!cancelled) {
          setContextImage(cropped.dataUrl);
          setContextW(cropped.width);
          setContextH(cropped.height);
        }
      } catch {
        if (!cancelled) setContextImage(mapImage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    build();
    return () => {
      cancelled = true;
    };
  }, [mapImage, parentRegion, map.width, map.height]);

  if (!plan.region) {
    return (
      <p className="text-2xs text-text-muted">
        This region has no bounding box, so it can't be shown on the map.
      </p>
    );
  }

  if (!contextImage) {
    return (
      <p className="text-2xs text-text-muted">
        {loading ? "Loading map context..." : "Source map image unavailable."}
      </p>
    );
  }

  // Translate the plan's absolute region into coordinates local to the
  // parent region (or keep it absolute when showing the whole map).
  const localRegion: ZonePlanRegion = parentRegion
    ? {
        x: plan.region.x - parentRegion.x,
        y: plan.region.y - parentRegion.y,
        w: plan.region.w,
        h: plan.region.h,
      }
    : plan.region;

  const rect = regionToPercentRect(localRegion, contextW, contextH);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs text-text-muted">
          Location {parent ? <>in <span className="text-text-secondary">{parent.name}</span></> : "on the whole map"}
        </label>
        <span className="text-2xs text-text-muted">
          {Math.round(plan.region.w)}×{Math.round(plan.region.h)}px
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-text-primary/10 bg-bg-abyss/20">
        <img
          src={contextImage}
          alt={parent ? `${plan.name} within ${parent.name}` : plan.name}
          className="block w-full"
        />
        <div
          className="pointer-events-none absolute rounded-sm"
          style={{
            left: `${rect.left}%`,
            top: `${rect.top}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
            border: "2px solid rgb(var(--aurum-rgb))",
            background: "rgb(var(--aurum-rgb) / 0.18)",
            boxShadow:
              "0 0 0 1px rgb(var(--bg-rgb) / 0.4), inset 0 0 0 1px rgb(var(--text-rgb) / 0.25)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Region detail editor ──────────────────────────────────────────

function RegionEditor({
  plan,
  allPlans,
  maps,
  articles,
}: {
  plan: ZonePlan;
  allPlans: ZonePlan[];
  maps: LoreMap[];
  articles: Record<string, Article>;
}) {
  const updateZonePlan = useLoreStore((s) => s.updateZonePlan);
  const deleteZonePlan = useLoreStore((s) => s.deleteZonePlan);
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const zones = useZoneStore((s) => s.zones);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);
  const [wizardPrefill, setWizardPrefill] = useState<ZonePlanPrefill | null>(
    null,
  );

  const linkedZoneExists = plan.zoneId ? zones.has(plan.zoneId) : false;
  const childCount = allPlans.filter((p) => p.parentId === plan.id).length;
  const parent = plan.parentId
    ? allPlans.find((p) => p.id === plan.parentId) ?? null
    : null;
  const parentName = parent?.name ?? null;
  const sourceMap = plan.mapId ? maps.find((m) => m.id === plan.mapId) ?? null : null;

  const handleCreateZone = async () => {
    if (!project) return;
    setScaffolding(true);
    setScaffoldError(null);
    try {
      const result = await createZoneFromPlan(plan, project);
      updateZonePlan(plan.id, { zoneId: result.zoneId });
    } catch (err) {
      setScaffoldError(err instanceof Error ? err.message : String(err));
    } finally {
      setScaffolding(false);
    }
  };

  const handleGenerateWithAI = () => {
    setScaffoldError(null);
    setWizardPrefill(buildPlanPrefill(plan, allPlans, articles));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg text-text-primary">{plan.name}</h3>
          {plan.levelRange && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-2xs tabular-nums text-accent">
              Lv {plan.levelRange.min}–{plan.levelRange.max}
            </span>
          )}
        </div>
        {parentName && (
          <div className="mt-0.5 text-2xs text-text-muted">
            in {parentName}
          </div>
        )}
        {childCount > 0 && (
          <div className="mt-0.5 text-2xs text-text-muted">
            {childCount} subregion{childCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Core fields */}
      <div className="flex flex-col gap-3">
        <FieldRow label="Name">
          <TextInput
            value={plan.name}
            onCommit={(v) => updateZonePlan(plan.id, { name: v })}
          />
        </FieldRow>

        <FieldRow label="Blurb">
          <TextInput
            value={plan.blurb}
            onCommit={(v) => updateZonePlan(plan.id, { blurb: v })}
            placeholder="1-2 sentence theme"
          />
        </FieldRow>

        <div>
          <label className="mb-1 block text-xs text-text-muted">Description</label>
          <LoreEditor
            value={plan.description ?? ""}
            onCommit={(json) =>
              updateZonePlan(plan.id, { description: json || undefined })
            }
            placeholder="Geography, atmosphere, history, culture... describe what makes this region unique. Type @ to mention a lore article."
          />
          <p className="mt-1 text-2xs text-text-muted">
            @mentioned articles are passed to the zone generator alongside linked articles.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Level min">
            <NumberInput
              value={plan.levelRange?.min ?? 1}
              onCommit={(v) =>
                updateZonePlan(plan.id, {
                  levelRange: {
                    min: v ?? 1,
                    max: plan.levelRange?.max ?? (v ?? 1),
                  },
                })
              }
              min={1}
              max={100}
            />
          </FieldRow>
          <FieldRow label="Level max">
            <NumberInput
              value={plan.levelRange?.max ?? 1}
              onCommit={(v) =>
                updateZonePlan(plan.id, {
                  levelRange: {
                    min: plan.levelRange?.min ?? 1,
                    max: v ?? 1,
                  },
                })
              }
              min={1}
              max={100}
            />
          </FieldRow>
        </div>
      </div>

      {/* Lists */}
      <TagListEditor
        label="Inhabitants"
        items={plan.inhabitants ?? []}
        onChange={(items) => updateZonePlan(plan.id, { inhabitants: items.length > 0 ? items : undefined })}
        placeholder="e.g. Thornbriar Goblins"
      />

      <TagListEditor
        label="Landmarks"
        items={plan.landmarks ?? []}
        onChange={(items) => updateZonePlan(plan.id, { landmarks: items.length > 0 ? items : undefined })}
        placeholder="e.g. The Shattered Bridge"
      />

      <div>
        <label className="mb-1 block text-xs text-text-muted">Story hooks</label>
        <div className="flex flex-col gap-1">
          {(plan.hooks ?? []).map((h, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <TextInput
                value={h}
                onCommit={(v) => {
                  const hooks = [...(plan.hooks ?? [])];
                  if (v.trim()) hooks[i] = v;
                  else hooks.splice(i, 1);
                  updateZonePlan(plan.id, { hooks: hooks.length > 0 ? hooks : undefined });
                }}
              />
            </div>
          ))}
          <ActionButton
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              updateZonePlan(plan.id, { hooks: [...(plan.hooks ?? []), ""] })
            }
          >
            + Add hook
          </ActionButton>
        </div>
      </div>

      {/* Linked articles */}
      <ArticleLinker
        linkedIds={plan.linkedArticles ?? []}
        onChange={(ids) => updateZonePlan(plan.id, { linkedArticles: ids.length > 0 ? ids : undefined })}
      />

      {/* Zone scaffold link */}
      <div className="rounded-xl border border-[var(--chrome-stroke)] bg-bg-abyss/15 p-3">
        <div className="mb-1.5 text-2xs uppercase tracking-wider text-text-muted">
          Zone scaffold
        </div>
        {plan.zoneId && linkedZoneExists ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-text-secondary">{plan.zoneId}</div>
            <div className="flex gap-1.5">
              <ActionButton
                onClick={() => openTab({ id: `zone:${plan.zoneId}`, kind: "zone", label: plan.zoneId! })}
                variant="secondary"
                size="sm"
              >
                Open Zone
              </ActionButton>
              <ActionButton
                onClick={() => updateZonePlan(plan.id, { zoneId: undefined })}
                variant="ghost"
                size="sm"
                title="Remove the link without deleting the zone"
              >
                Unlink
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {plan.zoneId && !linkedZoneExists && (
              <div className="text-2xs text-text-muted">
                Linked zone "{plan.zoneId}" not loaded.
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {AI_ENABLED && (
                <ActionButton
                  onClick={handleGenerateWithAI}
                  disabled={scaffolding || !project}
                  variant="primary"
                  size="sm"
                >
                  Generate with AI…
                </ActionButton>
              )}
              <ActionButton
                onClick={handleCreateZone}
                disabled={scaffolding || !project}
                variant={AI_ENABLED ? "ghost" : "primary"}
                size="sm"
              >
                {scaffolding ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner /> Creating...
                  </span>
                ) : (
                  "Create Stub"
                )}
              </ActionButton>
            </div>
            <p className="text-2xs text-text-muted">
              {AI_ENABLED
                ? "Generate fills in rooms, mobs, and items from the plan. Stub creates a single empty room."
                : "Creates a single empty room seeded with the plan's notes."}
            </p>
            {scaffoldError && (
              <p className="text-2xs text-status-danger">{scaffoldError}</p>
            )}
          </div>
        )}
      </div>

      {wizardPrefill && (
        <NewZoneDialog
          prefill={wizardPrefill}
          onCreated={(zoneId) => updateZonePlan(plan.id, { zoneId })}
          onClose={() => setWizardPrefill(null)}
        />
      )}

      {/* Region coordinates */}
      {plan.region && (
        <div className="text-2xs text-text-muted">
          Region: {Math.round(plan.region.x)},{Math.round(plan.region.y)} ·{" "}
          {Math.round(plan.region.w)}×{Math.round(plan.region.h)}px
        </div>
      )}

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-status-danger">Delete this region and all subregions?</span>
          <ActionButton
            onClick={() => {
              deleteZonePlan(plan.id);
              setConfirmDelete(false);
            }}
            variant="danger"
            size="sm"
          >
            Yes
          </ActionButton>
          <ActionButton
            onClick={() => setConfirmDelete(false)}
            variant="ghost"
            size="sm"
          >
            No
          </ActionButton>
        </div>
      ) : (
        <ActionButton
          onClick={() => setConfirmDelete(true)}
          variant="danger"
          size="sm"
          className="self-start"
        >
          Delete Region
        </ActionButton>
      )}

      {/* Map context preview */}
      {sourceMap && plan.region && (
        <RegionContextImage plan={plan} parent={parent} map={sourceMap} />
      )}
    </div>
  );
}

// ─── Workshop panel ────────────────────────────────────────────────

export function RegionWorkshopPanel() {
  const lore = useLoreStore((s) => s.lore);
  const maps = useLoreStore(selectMaps);
  const plans = useLoreStore(selectZonePlans);
  const articles = useLoreStore(selectArticles);
  const [sourceMapId, setSourceMapId] = useState<string>(() => maps[0]?.id ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const mapPlans = useMemo(
    () => plans.filter((p) => !sourceMapId || !p.mapId || p.mapId === sourceMapId),
    [plans, sourceMapId],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const handleTreeNavigateScope = useCallback((id: string) => {
    setSelectedPlanId(id);
  }, []);

  if (!lore) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Map filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-text-muted">Map</label>
        <select
          className="ornate-input min-h-11 min-w-[14rem] rounded-2xl px-4 py-3 text-sm text-text-secondary"
          value={sourceMapId}
          onChange={(e) => {
            setSourceMapId(e.target.value);
            setSelectedPlanId(null);
          }}
        >
          <option value="">All maps</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <span className="text-2xs text-text-muted">
          {mapPlans.length} region{mapPlans.length !== 1 ? "s" : ""} total
        </span>
      </div>

      {/* Tree + editor */}
      <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Tree sidebar */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-text-primary/8 bg-bg-abyss/15">
          {mapPlans.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ZonePlanTree
                plans={mapPlans}
                selectedId={selectedPlanId}
                onSelect={setSelectedPlanId}
                onNavigateScope={handleTreeNavigateScope}
                bare
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-text-muted">
              No regions yet. Use the World Planner tab to break your map into regions first.
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="overflow-y-auto rounded-2xl border border-text-primary/8 bg-bg-abyss/15 p-5">
          {selectedPlan ? (
            <RegionEditor
              plan={selectedPlan}
              allPlans={plans}
              maps={maps}
              articles={articles}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-muted">
              <div className="font-display text-base text-text-secondary">
                Select a region to start detailing
              </div>
              <p className="max-w-md text-xs leading-relaxed">
                Pick a region from the tree to describe its geography, inhabitants,
                landmarks, and story hooks. When you're ready, scaffold it into
                a real zone file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
