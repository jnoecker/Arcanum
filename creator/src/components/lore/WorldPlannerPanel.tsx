import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoreStore, selectMaps, selectZonePlans } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { cropImageDataUrl } from "@/lib/cropImageDataUrl";
import {
  generateZonePlans,
  suggestionsToZonePlans,
  type ZonePlanSuggestion,
} from "@/lib/loreZonePlanning";
import { createZoneFromPlan } from "@/lib/createZoneFromPlan";
import type { ZonePlan } from "@/types/lore";
import { regionToPercentRect } from "@/lib/zoneRegionGeometry";
import {
  regionContainsPoint,
  translateRegionToAbsolute,
  translateRegionToLocal,
} from "@/lib/zoneRegionGeometry";
import {
  ActionButton,
  FieldRow,
  NumberInput,
  TextInput,
  Spinner,
} from "@/components/ui/FormWidgets";
import { ZonePlanGraph } from "./ZonePlanGraph";

const MAX_TARGET_ZONE_COUNT = 70;

function ZoneRegionPreview({
  plans,
  mapWidth,
  mapHeight,
  selectedPlanId,
  hoveredPlanId,
  onSelect,
  onHover,
}: {
  plans: ZonePlan[];
  mapWidth: number;
  mapHeight: number;
  selectedPlanId: string | null;
  hoveredPlanId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const visiblePlans = plans.filter((plan) => plan.region);

  if (visiblePlans.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {visiblePlans.map((plan) => {
        const region = plan.region;
        if (!region) return null;
        const rect = regionToPercentRect(region, mapWidth, mapHeight);
        const active = plan.id === selectedPlanId || plan.id === hoveredPlanId;

        return (
          <button
            key={plan.id}
            type="button"
            className="pointer-events-auto absolute overflow-hidden rounded-md border text-left transition"
            style={{
              left: `${rect.left}%`,
              top: `${rect.top}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
              borderColor: active
                ? "rgba(242, 208, 135, 0.95)"
                : "rgba(216, 181, 106, 0.7)",
              background: active
                ? "linear-gradient(180deg, rgba(232, 189, 98, 0.22), rgba(150, 102, 35, 0.16))"
                : "linear-gradient(180deg, rgba(184, 130, 50, 0.16), rgba(84, 53, 14, 0.12))",
              boxShadow: active
                ? "0 0 0 1px rgba(242, 208, 135, 0.18), inset 0 0 0 1px rgba(255,255,255,0.08)"
                : "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
            title={plan.name}
            onClick={() => onSelect(plan.id)}
            onMouseEnter={() => onHover(plan.id)}
            onMouseLeave={() => onHover(null)}
          >
            <span
              className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/70 px-1.5 py-0.5 font-display text-[10px] tracking-[0.12em] text-warm-pale"
            >
              {plan.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Generation controls ────────────────────────────────────────────

function GenerationControls({
  targetCount,
  setTargetCount,
  toneHint,
  setToneHint,
  useLoreContext,
  setUseLoreContext,
  useGridOverlay,
  setUseGridOverlay,
  twoPass,
  setTwoPass,
  selfCheck,
  setSelfCheck,
  onGenerate,
  loading,
  disabled,
}: {
  targetCount: number;
  setTargetCount: (n: number) => void;
  toneHint: string;
  setToneHint: (s: string) => void;
  useLoreContext: boolean;
  setUseLoreContext: (b: boolean) => void;
  useGridOverlay: boolean;
  setUseGridOverlay: (b: boolean) => void;
  twoPass: boolean;
  setTwoPass: (b: boolean) => void;
  selfCheck: boolean;
  setSelfCheck: (b: boolean) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <h3 className="mb-3 font-display text-sm text-text-primary">
        Generate Zones from Map
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldRow label="Target zone count">
          <NumberInput
            value={targetCount}
            onCommit={(v) => {
              if (v == null) return;
              setTargetCount(Math.max(1, Math.min(MAX_TARGET_ZONE_COUNT, Math.round(v))));
            }}
            min={1}
            max={MAX_TARGET_ZONE_COUNT}
          />
        </FieldRow>
        <FieldRow label="Tone / scope hint (optional)">
          <TextInput
            value={toneHint}
            onCommit={setToneHint}
            placeholder="e.g. grim northern frontier, levels 10-30"
          />
        </FieldRow>
      </div>
      <p className="mt-2 text-2xs text-text-muted">
        Larger counts are meant for broad world slices. For about 30+ zones,
        think high-level regions now, then plan each region in more detail later.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={useLoreContext}
            onChange={(e) => setUseLoreContext(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Use existing world lore as context
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={useGridOverlay}
            onChange={(e) => setUseGridOverlay(e.target.checked)}
            className="h-3.5 w-3.5"
            disabled={twoPass}
          />
          Overlay reference grid on map
          <span className="text-2xs text-text-muted">
            (much more accurate placement; recommended)
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={twoPass}
            onChange={(e) => setTwoPass(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Two-pass mode
          <span className="text-2xs text-text-muted">
            (structure first, placement second; 2× cost)
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={selfCheck}
            onChange={(e) => setSelfCheck(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Self-check pass
          <span className="text-2xs text-text-muted">
            (extra LLM call to verify and correct; +1 call)
          </span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <ActionButton
          onClick={onGenerate}
          disabled={disabled || loading}
          variant="primary"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Spinner /> Planning...
            </span>
          ) : (
            "Generate Zones"
          )}
        </ActionButton>
        <span className="text-2xs text-text-muted">
          The vision model will study the map and propose a high-level breakdown.
        </span>
      </div>
    </div>
  );
}

// ─── Suggestion review list ─────────────────────────────────────────

function SuggestionReview({
  suggestions,
  dismissed,
  accepted,
  onAccept,
  onDismiss,
  onAcceptAll,
}: {
  suggestions: ZonePlanSuggestion[];
  dismissed: Set<string>;
  accepted: Set<string>;
  onAccept: (tempId: string) => void;
  onDismiss: (tempId: string) => void;
  onAcceptAll: () => void;
}) {
  const visible = suggestions.filter(
    (s) => !dismissed.has(s.tempId) && !accepted.has(s.tempId),
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm text-text-primary">
          Proposed Zones ({visible.length})
        </h3>
        {visible.length > 0 && (
          <ActionButton onClick={onAcceptAll} variant="secondary" size="sm">
            Accept All
          </ActionButton>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-2xs text-text-muted">
          All proposals processed. {accepted.size} added.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {visible.map((s) => (
            <div
              key={s.tempId}
              className="rounded-lg border border-white/8 bg-black/15 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary">
                    {s.name}
                  </div>
                  {s.blurb && (
                    <p className="mt-1 text-xs leading-snug text-text-secondary">
                      {s.blurb}
                    </p>
                  )}
                  {s.hooks.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-2xs text-text-muted">
                      {s.hooks.map((h, i) => (
                        <li key={i}>• {h}</li>
                      ))}
                    </ul>
                  )}
                  {s.borderNames.length > 0 && (
                    <div className="mt-2 text-2xs text-text-muted">
                      Borders: {s.borderNames.join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <ActionButton
                    onClick={() => onAccept(s.tempId)}
                    variant="primary"
                    size="sm"
                  >
                    Add
                  </ActionButton>
                  <ActionButton
                    onClick={() => onDismiss(s.tempId)}
                    variant="ghost"
                    size="sm"
                  >
                    Skip
                  </ActionButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single plan editor sidebar ─────────────────────────────────────

function ZonePlanEditor({
  plan,
  allPlans,
  onClose,
  onPlanSubregions,
  isScopeTarget,
}: {
  plan: ZonePlan;
  allPlans: ZonePlan[];
  onClose: () => void;
  onPlanSubregions: (id: string) => void;
  isScopeTarget: boolean;
}) {
  const updateZonePlan = useLoreStore((s) => s.updateZonePlan);
  const deleteZonePlan = useLoreStore((s) => s.deleteZonePlan);
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const zones = useZoneStore((s) => s.zones);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);

  // If the linked zoneId no longer exists in the loaded zone set, treat
  // the plan as unlinked so the user can re-scaffold.
  const linkedZoneExists = plan.zoneId ? zones.has(plan.zoneId) : false;

  const otherPlans = allPlans.filter((p) => p.id !== plan.id);
  const borders = new Set(plan.borders ?? []);
  const childCount = allPlans.filter((p) => p.parentId === plan.id).length;

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

  const handleOpenLinkedZone = () => {
    if (!plan.zoneId) return;
    openTab({ id: `zone:${plan.zoneId}`, kind: "zone", label: plan.zoneId });
  };

  const toggleBorder = (id: string) => {
    const next = new Set(borders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateZonePlan(plan.id, { borders: [...next] });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm text-text-primary">Edit Zone</h4>
        <button
          onClick={onClose}
          className="focus-ring flex h-8 items-center justify-center rounded-full px-3 text-2xs text-text-muted hover:bg-white/6 hover:text-text-primary"
        >
          Done
        </button>
      </div>

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
        <label className="text-xs text-text-muted">Hooks</label>
        <div className="mt-1 flex flex-col gap-1">
          {(plan.hooks ?? []).map((h, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <TextInput
                value={h}
                onCommit={(v) => {
                  const hooks = [...(plan.hooks ?? [])];
                  if (v.trim()) hooks[i] = v;
                  else hooks.splice(i, 1);
                  updateZonePlan(plan.id, {
                    hooks: hooks.length > 0 ? hooks : undefined,
                  });
                }}
              />
            </div>
          ))}
          <ActionButton
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              updateZonePlan(plan.id, {
                hooks: [...(plan.hooks ?? []), ""],
              })
            }
          >
            + Add hook
          </ActionButton>
        </div>
      </div>

      <div>
        <label className="text-xs text-text-muted">Borders</label>
        {otherPlans.length === 0 ? (
          <p className="mt-1 text-2xs text-text-muted">
            Add more zones to set borders.
          </p>
        ) : (
          <div className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {otherPlans.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-2xs text-text-secondary hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={borders.has(p.id)}
                  onChange={() => toggleBorder(p.id)}
                  className="h-3 w-3"
                />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {plan.region && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/6 bg-black/15 p-2 text-2xs text-text-muted">
          <div>
            Region: {Math.round(plan.region.x)},{Math.round(plan.region.y)} ·{" "}
            {Math.round(plan.region.w)}×{Math.round(plan.region.h)}px
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>
              Subregions: {childCount}
            </span>
            <ActionButton
              onClick={() => onPlanSubregions(plan.id)}
              variant={isScopeTarget ? "secondary" : "ghost"}
              size="sm"
            >
              {isScopeTarget ? "Planning Here" : "Plan Subregions"}
            </ActionButton>
          </div>
        </div>
      )}

      {/* Zone scaffold link */}
      <div className="rounded-lg border border-white/6 bg-black/15 p-2.5">
        <div className="mb-1.5 text-2xs uppercase tracking-wider text-text-muted">
          Linked Zone
        </div>
        {plan.zoneId && linkedZoneExists ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-text-secondary">{plan.zoneId}</div>
            <div className="flex gap-1.5">
              <ActionButton
                onClick={handleOpenLinkedZone}
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
            <ActionButton
              onClick={handleCreateZone}
              disabled={scaffolding || !project}
              variant="primary"
              size="sm"
              className="self-start"
            >
              {scaffolding ? (
                <span className="flex items-center gap-1.5">
                  <Spinner /> Creating...
                </span>
              ) : (
                "Create Zone from Plan"
              )}
            </ActionButton>
            {scaffoldError && (
              <p className="text-2xs text-status-danger">{scaffoldError}</p>
            )}
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-status-danger">Delete this zone?</span>
          <ActionButton
            onClick={() => {
              deleteZonePlan(plan.id);
              setConfirmDelete(false);
              onClose();
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
          Delete Zone
        </ActionButton>
      )}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export function WorldPlannerPanel() {
  const lore = useLoreStore((s) => s.lore);
  const maps = useLoreStore(selectMaps);
  const plans = useLoreStore(selectZonePlans);
  const addZonePlans = useLoreStore((s) => s.addZonePlans);

  const [sourceMapId, setSourceMapId] = useState<string>(
    () => maps[0]?.id ?? "",
  );
  const sourceMap = useMemo(
    () => maps.find((m) => m.id === sourceMapId) ?? null,
    [maps, sourceMapId],
  );
  const mapImage = useImageSrc(sourceMap?.imageAsset);

  const [targetCount, setTargetCount] = useState(8);
  const [toneHint, setToneHint] = useState("");
  const [useLoreContext, setUseLoreContext] = useState(true);
  const [useGridOverlay, setUseGridOverlay] = useState(true);
  const [twoPass, setTwoPass] = useState(false);
  const [selfCheck, setSelfCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<ZonePlanSuggestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const [planningParentId, setPlanningParentId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const scopePlan = useMemo(
    () => plans.find((p) => p.id === planningParentId) ?? null,
    [plans, planningParentId],
  );
  const scopeRegion = scopePlan?.region;

  const [showAllMaps, setShowAllMaps] = useState(false);
  const mapPlans = useMemo(
    () =>
      plans.filter((p) => !sourceMapId || !p.mapId || p.mapId === sourceMapId),
    [plans, sourceMapId],
  );
  const visiblePlans = useMemo(
    () => {
      const pool = showAllMaps ? plans : mapPlans;
      if (planningParentId) {
        return pool.filter((p) => p.parentId === planningParentId);
      }
      return pool.filter((p) => !p.parentId);
    },
    [plans, mapPlans, planningParentId, showAllMaps],
  );
  const selectedPlan = useMemo(
    () => visiblePlans.find((p) => p.id === selectedPlanId) ?? null,
    [visiblePlans, selectedPlanId],
  );
  const previewPlans = useMemo(() => {
    if (planningParentId && scopeRegion) {
      return visiblePlans
        .filter((plan) => plan.region)
        .map((plan) => ({
          ...plan,
          region: plan.region ? translateRegionToLocal(plan.region, scopeRegion) : undefined,
        }));
    }
    return plans.filter((plan) => plan.mapId === sourceMapId && !plan.parentId);
  }, [planningParentId, plans, scopeRegion, sourceMapId, visiblePlans]);

  const [planningImage, setPlanningImage] = useState<string | null>(null);
  const [planningImageLoading, setPlanningImageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function preparePlanningImage() {
      if (!mapImage) {
        setPlanningImage(null);
        setPlanningImageLoading(false);
        return;
      }

      if (!scopeRegion) {
        setPlanningImage(mapImage);
        setPlanningImageLoading(false);
        return;
      }

      setPlanningImageLoading(true);
      try {
        const cropped = await cropImageDataUrl(mapImage, scopeRegion);
        if (!cancelled) {
          setPlanningImage(cropped.dataUrl);
        }
      } catch (err) {
        console.error("Failed to crop scope image:", err);
        if (!cancelled) setPlanningImage(mapImage);
      } finally {
        if (!cancelled) setPlanningImageLoading(false);
      }
    }

    preparePlanningImage();
    return () => {
      cancelled = true;
    };
  }, [mapImage, scopeRegion]);

  const planningMap = useMemo(() => {
    if (!sourceMap) return null;
    if (!scopeRegion || !scopePlan) return sourceMap;

    const scopedPins = sourceMap.pins
      .filter((pin) => regionContainsPoint(scopeRegion, pin.position[1], pin.position[0]))
      .map((pin) => ({
        ...pin,
        position: [
          pin.position[0] - scopeRegion.y,
          pin.position[1] - scopeRegion.x,
        ] as [number, number],
      }));

    return {
      ...sourceMap,
      title: `${sourceMap.title} — ${scopePlan.name}`,
      width: Math.round(scopeRegion.w),
      height: Math.round(scopeRegion.h),
      pins: scopedPins,
    };
  }, [scopePlan, scopeRegion, sourceMap]);

  useEffect(() => {
    if (planningParentId && (!scopePlan || scopePlan.mapId !== sourceMapId)) {
      setPlanningParentId(null);
    }
  }, [planningParentId, scopePlan, sourceMapId]);

  useEffect(() => {
    if (selectedPlanId && !visiblePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [selectedPlanId, visiblePlans]);

  const resetStagedSuggestions = useCallback(() => {
    setSuggestions([]);
    setWarnings([]);
    setDismissed(new Set());
    setAccepted(new Set());
  }, []);

  const enterScope = useCallback(
    (planId: string) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan?.region) return;
      setPlanningParentId(planId);
      setSelectedPlanId(null);
      setHoveredPlanId(null);
      resetStagedSuggestions();
    },
    [plans, resetStagedSuggestions],
  );

  const exitScope = useCallback(() => {
    setPlanningParentId(null);
    setSelectedPlanId(null);
    setHoveredPlanId(null);
    resetStagedSuggestions();
  }, [resetStagedSuggestions]);

  const commitSuggestions = useCallback(
    (batch: ZonePlanSuggestion[]) => {
      if (!sourceMap) return [];
      return suggestionsToZonePlans(batch, sourceMap.id).map((plan) => ({
        ...plan,
        parentId: planningParentId ?? undefined,
        region: scopeRegion && plan.region
          ? translateRegionToAbsolute(plan.region, scopeRegion)
          : plan.region,
      }));
    },
    [planningParentId, scopeRegion, sourceMap],
  );

  const handleGenerate = useCallback(async () => {
    if (!planningMap || !planningImage || !lore) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateZonePlans(planningMap, planningImage, lore, {
        targetCount,
        toneHint,
        useLoreContext,
        useGridOverlay,
        twoPass,
        selfCheck,
        focusRegionName: scopePlan?.name,
        focusRegionBlurb: scopePlan?.blurb,
      });
      setSuggestions(result.suggestions);
      setWarnings(result.warnings);
      setDismissed(new Set());
      setAccepted(new Set());
      if (result.suggestions.length === 0) {
        setError("The model returned no zones. Try regenerating or adjusting the hint.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    planningMap,
    planningImage,
    lore,
    targetCount,
    toneHint,
    useLoreContext,
    useGridOverlay,
    twoPass,
    selfCheck,
    scopePlan,
  ]);

  const handleAccept = useCallback(
    (tempId: string) => {
      const suggestion = suggestions.find((x) => x.tempId === tempId);
      if (!suggestion) return;
      const [committed] = commitSuggestions([suggestion]);
      if (committed) {
        addZonePlans([{ ...committed, borders: undefined }]);
      }
      setAccepted((prev) => new Set(prev).add(tempId));
    },
    [suggestions, commitSuggestions, addZonePlans],
  );

  const handleDismiss = useCallback((tempId: string) => {
    setDismissed((prev) => new Set(prev).add(tempId));
  }, []);

  const handleAcceptAll = useCallback(() => {
    const remaining = suggestions.filter(
      (s) => !dismissed.has(s.tempId) && !accepted.has(s.tempId),
    );
    if (remaining.length === 0) return;
    const committed = commitSuggestions(remaining);
    addZonePlans(committed);
    setAccepted(
      new Set(
        suggestions
          .filter((s) => !dismissed.has(s.tempId))
          .map((s) => s.tempId),
      ),
    );
  }, [suggestions, dismissed, accepted, commitSuggestions, addZonePlans]);

  if (!lore) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Map selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-text-muted">Source map</label>
        <select
          className="ornate-input min-h-11 min-w-[14rem] rounded-2xl px-4 py-3 text-sm text-text-secondary"
          value={sourceMapId}
          onChange={(e) => setSourceMapId(e.target.value)}
        >
          <option value="">Choose a map...</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        {maps.length === 0 && (
          <span className="text-2xs text-text-muted">
            Upload a world map under Lore → Maps first.
          </span>
        )}
      </div>

      {sourceMap && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-black/12 px-4 py-3">
          <span className="text-2xs uppercase tracking-[0.18em] text-text-muted">
            Planning Scope
          </span>
          {scopePlan ? (
            <>
              <span className="font-display text-sm text-text-primary">
                {scopePlan.name}
              </span>
              <span className="text-2xs text-text-muted">
                Subdivide this region into smaller zones.
              </span>
              <ActionButton onClick={exitScope} variant="ghost" size="sm">
                Back to Whole Map
              </ActionButton>
            </>
          ) : (
            <>
              <span className="font-display text-sm text-text-primary">
                Whole Map
              </span>
              <span className="text-2xs text-text-muted">
                Start broad, then click a zone’s "Plan Subregions" action to break it down further.
              </span>
            </>
          )}
        </div>
      )}

      {/* Map preview */}
      {sourceMap && planningImage && (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-black/30 p-3">
          <div className="flex justify-center">
            <div className="relative">
              <img
                src={planningImage}
                alt={scopePlan ? `${sourceMap.title} — ${scopePlan.name}` : sourceMap.title}
                className="block max-h-72 max-w-full rounded-lg"
              />
              <ZoneRegionPreview
                plans={previewPlans}
                mapWidth={planningMap?.width ?? sourceMap.width}
                mapHeight={planningMap?.height ?? sourceMap.height}
                selectedPlanId={selectedPlanId}
                hoveredPlanId={hoveredPlanId}
                onSelect={setSelectedPlanId}
                onHover={setHoveredPlanId}
              />
            </div>
          </div>
          {planningImageLoading && (
            <p className="mt-2 text-center text-2xs text-text-muted">
              Preparing scoped map preview...
            </p>
          )}
        </div>
      )}

      {/* Generation controls */}
      <GenerationControls
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        toneHint={toneHint}
        setToneHint={setToneHint}
        useLoreContext={useLoreContext}
        setUseLoreContext={setUseLoreContext}
        useGridOverlay={useGridOverlay}
        setUseGridOverlay={setUseGridOverlay}
        twoPass={twoPass}
        setTwoPass={setTwoPass}
        selfCheck={selfCheck}
        setSelfCheck={setSelfCheck}
        onGenerate={handleGenerate}
        loading={loading}
        disabled={!planningMap || !planningImage || planningImageLoading}
      />

      {error && (
        <p className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
          {error}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2">
          <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-status-warning">
            Repair notes
          </div>
          <ul className="space-y-0.5 text-2xs text-text-secondary">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Staged suggestions */}
      <SuggestionReview
        suggestions={suggestions}
        dismissed={dismissed}
        accepted={accepted}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        onAcceptAll={handleAcceptAll}
      />

      {/* Committed zone plans header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-text-primary">
          Zones ({visiblePlans.length})
        </h3>
        {plans.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-2xs text-text-muted">
            <input
              type="checkbox"
              checked={showAllMaps}
              onChange={(e) => setShowAllMaps(e.target.checked)}
              className="h-3 w-3"
            />
            Show zones from all maps
          </label>
        )}
      </div>

      {/* Graph + editor */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <ZonePlanGraph
          plans={visiblePlans}
          selectedId={selectedPlanId}
          hoveredId={hoveredPlanId}
          onSelect={setSelectedPlanId}
          onHover={setHoveredPlanId}
        />
        <div className="rounded-2xl border border-white/8 bg-black/12 p-4">
          {selectedPlan ? (
            <ZonePlanEditor
              plan={selectedPlan}
              allPlans={plans}
              onClose={() => setSelectedPlanId(null)}
              onPlanSubregions={enterScope}
              isScopeTarget={planningParentId === selectedPlan.id}
            />
          ) : (
            <div className="flex flex-col gap-2 text-xs text-text-muted">
              <p>
                Click a zone in the graph to edit it.
              </p>
              <p>
                Plan the whole world first, then pick a broad zone and use
                "Plan Subregions" to break that slice down further.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
