import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useVibeStore } from "@/stores/vibeStore";
import { zoneFilePath } from "@/lib/projectPaths";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { buildToneDirective } from "@/lib/loreGeneration";
import {
  generateZoneContent,
  generateZoneFromSketch,
  extendZoneContent,
  createFallbackZone,
  type ZoneGenerationParams,
} from "@/lib/generateZoneContent";
import type { WorldFile } from "@/types/world";
import type { SketchParseResult } from "@/types/sketch";
import { ActionButton } from "@/components/ui/FormWidgets";
import {
  ZONE_ID_RE,
  SIZE_PRESETS,
  deriveZoneId,
  normalizeZoneId,
  sketchParseToFixedLayout,
  buildStubFromSketch,
  StepBreadcrumb,
  TargetStep,
  ContentStep,
  LayoutStep,
  ReviewStep,
  type WizardStep,
  type SizePresetId,
} from "./NewZoneDialogSteps";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

// ─── Wizard component ──────────────────────────────────────────────

interface NewZoneDialogProps {
  onClose: () => void;
}

export function NewZoneDialog({ onClose }: NewZoneDialogProps) {
  const project = useProjectStore((s) => s.project);
  const loadZone = useZoneStore((s) => s.loadZone);
  const updateZone = useZoneStore((s) => s.updateZone);
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const config = useConfigStore((s) => s.config);
  const saveVibe = useVibeStore((s) => s.saveVibe);
  const vibes = useVibeStore((s) => s.vibes);

  // ─── Wizard state ─────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("target");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(creating ? undefined : onClose);

  // Target
  const [target, setTarget] = useState<"new" | "existing">("new");
  const [zoneIdInput, setZoneIdInput] = useState("");
  const [existingZoneId, setExistingZoneId] = useState("");

  // Content
  const [description, setDescription] = useState(""); // TipTap JSON
  const [backgroundNotes, setBackgroundNotes] = useState("");

  // Layout
  const [size, setSize] = useState<SizePresetId>("small");
  const [sketchMode, setSketchMode] = useState<"none" | "photo" | "draw">("none");
  const [sketchBase64, setSketchBase64] = useState<string | null>(null);
  const [sketchParse, setSketchParse] = useState<SketchParseResult | null>(null);
  const [analyzingSketch, setAnalyzingSketch] = useState(false);

  // Done
  const [successSummary, setSuccessSummary] = useState<string>("");

  // ─── Derived state ────────────────────────────────────────────
  const plainDescription = useMemo(
    () => tiptapToPlainText(description).trim(),
    [description],
  );
  const hasDescription = plainDescription.length > 0;

  const normalizedZoneIdInput = useMemo(
    () => normalizeZoneId(zoneIdInput),
    [zoneIdInput],
  );

  const effectiveNewZoneId = useMemo(() => {
    const fromInput = normalizedZoneIdInput;
    if (fromInput) return fromInput;
    return deriveZoneId(description);
  }, [normalizedZoneIdInput, description]);

  const newZoneIdValid = ZONE_ID_RE.test(effectiveNewZoneId);
  const newZoneIdTaken =
    effectiveNewZoneId.length > 0 && zones.has(effectiveNewZoneId);

  const zoneList = useMemo(() => Array.from(zones.keys()).sort(), [zones]);

  const preset =
    SIZE_PRESETS.find((p) => p.id === size) ?? SIZE_PRESETS[1]!;

  const effectiveRoomCount = sketchParse
    ? sketchParse.rooms.length
    : preset.rooms;

  // ─── Step transitions ─────────────────────────────────────────
  const canAdvanceTarget = useMemo(() => {
    if (target === "new") {
      return newZoneIdValid && !newZoneIdTaken;
    }
    return !!existingZoneId && zones.has(existingZoneId);
  }, [target, newZoneIdValid, newZoneIdTaken, existingZoneId, zones]);

  // ─── Sketch handling ──────────────────────────────────────────
  const handlePickSketchPhoto = async () => {
    try {
      const selected = await open({
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] },
        ],
      });
      if (!selected) return;
      const dataUrl = await invoke<string>("read_image_data_url", {
        path: selected,
      });
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) {
        setError("Failed to read image file.");
        return;
      }
      setSketchBase64(match[2]!);
      await analyzeSketch(match[2]!, match[1]!);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCanvasExport = async (base64: string) => {
    setSketchBase64(base64);
    await analyzeSketch(base64, "image/png");
  };

  const analyzeSketch = async (b64: string, mime: string) => {
    setAnalyzingSketch(true);
    setError(null);
    try {
      const raw = await invoke<string>("analyze_sketch", {
        imageBase64: b64,
        mediaType: mime,
      });
      let json = raw.trim();
      if (json.startsWith("```")) {
        json = json.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed: SketchParseResult = JSON.parse(json);
      if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
        throw new Error("Invalid sketch response: missing rooms array");
      }
      if (!parsed.connections) parsed.connections = [];
      setSketchParse(parsed);
      setSketchMode("none"); // hide the picker, show summary
    } catch (err) {
      setError(`Could not parse sketch: ${String(err)}`);
      setSketchBase64(null);
    } finally {
      setAnalyzingSketch(false);
    }
  };

  const clearSketch = () => {
    setSketchBase64(null);
    setSketchParse(null);
    setSketchMode("none");
    setError(null);
  };

  // ─── Build LLM params ─────────────────────────────────────────
  const buildGenParams = (zoneName: string): ZoneGenerationParams => {
    const statNames = config?.stats?.definitions
      ? Object.values(config.stats.definitions).map((s) => s.id)
      : [];
    const equipmentSlots = config?.equipmentSlots
      ? Object.keys(config.equipmentSlots)
      : [];
    const classNames = config?.classes
      ? Object.values(config.classes).map((c) => c.displayName).filter(Boolean)
      : [];

    return {
      zoneName,
      zoneTheme: plainDescription,
      backgroundContext: backgroundNotes.trim() || undefined,
      worldTheme: buildToneDirective(),
      roomCount: effectiveRoomCount,
      mobCount: preset.mobs,
      itemCount: preset.items,
      statNames,
      equipmentSlots,
      classNames,
    };
  };

  // ─── Generate + commit ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!project || creating) return;
    setCreating(true);
    setError(null);

    try {
      if (target === "new") {
        await handleCreateNew();
      } else {
        await handleExtendExisting();
      }
    } catch (err) {
      setError(String(err));
      setStep("error");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNew = async () => {
    if (!project) return;
    const zoneId = effectiveNewZoneId;
    if (!ZONE_ID_RE.test(zoneId) || zones.has(zoneId)) {
      throw new Error(`Zone ID "${zoneId}" is invalid or taken`);
    }

    let world: WorldFile;

    if (size === "stub" && !sketchParse) {
      // Empty stub, no LLM call
      world = createFallbackZone(zoneId, 1);
    } else if (sketchParse) {
      // Sketch drives layout; LLM writes flavor
      const layout = sketchParseToFixedLayout(
        sketchParse,
        zoneId,
        new Set(),
      );
      if (!hasDescription) {
        // No description → stub sketch rooms without LLM
        world = buildStubFromSketch(zoneId, layout);
      } else {
        world = await generateZoneFromSketch(buildGenParams(zoneId), layout);
      }
    } else {
      // Pure AI generation
      if (!hasDescription) {
        // No description → fall back to an empty stub of the requested size
        world = createFallbackZone(zoneId, preset.rooms);
      } else {
        world = await generateZoneContent(buildGenParams(zoneId));
      }
    }

    // Standalone projects need a zone directory before the file write
    if (project.format === "standalone") {
      await invoke("create_zone_directory", {
        projectDir: project.mudDir,
        zoneId,
      });
    }

    const filePath = zoneFilePath(project, zoneId);
    const yaml = stringify(world, YAML_OPTS);
    await writeTextFile(filePath, yaml);
    loadZone(zoneId, filePath, world);

    // Persist description as vibe so it informs future art generation
    if (hasDescription) {
      try {
        await saveVibe(zoneId, plainDescription);
      } catch {
        /* non-fatal */
      }
    }

    openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });
    setSuccessSummary(
      `Created zone "${zoneId}" with ${Object.keys(world.rooms).length} rooms.`,
    );
    setStep("done");
  };

  const handleExtendExisting = async () => {
    if (!project) return;
    if (!existingZoneId || !zones.has(existingZoneId)) {
      throw new Error(`Zone "${existingZoneId}" not loaded`);
    }
    const zoneState = zones.get(existingZoneId)!;
    const currentWorld = zoneState.data;
    const existingIds = new Set(Object.keys(currentWorld.rooms));
    const existingVibe = vibes.get(existingZoneId);

    // Sample a few existing rooms for style matching
    const samples = Object.entries(currentWorld.rooms)
      .slice(0, 5)
      .map(([id, room]) => ({
        id,
        title: room.title,
        description: room.description,
      }));

    let newRooms: Record<string, WorldFile["rooms"][string]>;
    let newMobs: NonNullable<WorldFile["mobs"]>;
    let newItems: NonNullable<WorldFile["items"]>;

    if (sketchParse) {
      // Sketch defines layout; AI flavors rooms in existing style
      const layout = sketchParseToFixedLayout(
        sketchParse,
        existingZoneId,
        existingIds,
      );
      if (hasDescription) {
        const partial = await generateZoneFromSketch(
          {
            ...buildGenParams(existingZoneId),
            backgroundContext: [
              backgroundNotes.trim(),
              existingVibe ? `Existing zone vibe: ${existingVibe}` : "",
              samples.length > 0
                ? `Match the voice of these existing rooms: ${samples
                    .map((s) => `"${s.title}" — ${s.description}`)
                    .join(" | ")}`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          },
          layout,
        );
        newRooms = partial.rooms;
        newMobs = partial.mobs ?? {};
        newItems = partial.items ?? {};
      } else {
        // Stub the sketch rooms in existing style
        const stub = buildStubFromSketch(existingZoneId, layout);
        newRooms = stub.rooms;
        newMobs = {};
        newItems = {};
      }
    } else {
      // AI extends zone with new rooms matching style
      if (!hasDescription) {
        throw new Error(
          "A description is required when extending a zone without a sketch",
        );
      }
      const result = await extendZoneContent({
        ...buildGenParams(existingZoneId),
        existingRoomSamples: samples,
        existingVibe: existingVibe || undefined,
      });
      newRooms = result.newRooms;
      newMobs = result.newMobs;
      newItems = result.newItems;
    }

    // Merge into the existing world. New rooms are added but NOT auto-wired to
    // existing rooms — the user decides where to connect them in the graph view.
    const merged: WorldFile = {
      ...currentWorld,
      rooms: { ...currentWorld.rooms, ...newRooms },
      mobs: { ...(currentWorld.mobs ?? {}), ...newMobs },
      items: { ...(currentWorld.items ?? {}), ...newItems },
    };
    updateZone(existingZoneId, merged);
    openTab({
      id: `zone:${existingZoneId}`,
      kind: "zone",
      label: existingZoneId,
    });
    const newCount = Object.keys(newRooms).length;
    setSuccessSummary(
      `Added ${newCount} new room${newCount === 1 ? "" : "s"} to "${existingZoneId}". Drag an exit from an existing room to connect them.`,
    );
    setStep("done");
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-zone-dialog-title"
        className="mx-4 flex max-h-[90vh] w-full max-w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border-default px-5 py-3">
          <h2
            id="new-zone-dialog-title"
            className="font-display text-sm tracking-wide text-accent-emphasis"
          >
            {target === "new" ? "New Zone" : "Extend Zone"}
          </h2>
          <StepBreadcrumb step={step} />
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "target" && (
            <TargetStep
              target={target}
              setTarget={setTarget}
              zoneIdInput={zoneIdInput}
              setZoneIdInput={setZoneIdInput}
              effectiveZoneId={effectiveNewZoneId}
              zoneIdValid={newZoneIdValid}
              zoneIdTaken={newZoneIdTaken}
              zoneList={zoneList}
              existingZoneId={existingZoneId}
              setExistingZoneId={setExistingZoneId}
            />
          )}

          {step === "content" && (
            <ContentStep
              target={target}
              description={description}
              setDescription={setDescription}
              backgroundNotes={backgroundNotes}
              setBackgroundNotes={setBackgroundNotes}
            />
          )}

          {step === "layout" && (
            <LayoutStep
              target={target}
              size={size}
              setSize={setSize}
              sketchMode={sketchMode}
              setSketchMode={setSketchMode}
              sketchParse={sketchParse}
              sketchBase64={sketchBase64}
              analyzingSketch={analyzingSketch}
              onPickPhoto={handlePickSketchPhoto}
              onCanvasExport={handleCanvasExport}
              clearSketch={clearSketch}
            />
          )}

          {step === "review" && (
            <ReviewStep
              target={target}
              targetZoneId={target === "new" ? effectiveNewZoneId : existingZoneId}
              description={plainDescription}
              backgroundNotes={backgroundNotes.trim()}
              sizeLabel={preset.label}
              roomCount={effectiveRoomCount}
              mobCount={preset.mobs}
              itemCount={preset.items}
              hasSketch={!!sketchParse}
              sketchRoomCount={sketchParse?.rooms.length ?? 0}
              creating={creating}
            />
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="text-lg text-status-success">&#10003;</div>
              <p className="max-w-md text-sm text-text-secondary">
                {successSummary}
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="text-lg text-status-error">&#10007;</div>
              <p className="max-w-md break-words text-xs text-status-error">
                {error ?? "Something went wrong"}
              </p>
            </div>
          )}

          {error && step !== "error" && step !== "done" && (
            <p role="alert" className="mt-3 break-words text-xs text-status-error">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-default px-5 py-3 sm:flex-row sm:justify-between">
          <ActionButton variant="ghost" size="sm" onClick={onClose} disabled={creating}>
            {step === "done" ? "Close" : "Cancel"}
          </ActionButton>

          <div className="flex gap-2 sm:justify-end">
            {step !== "target" && step !== "done" && step !== "error" && (
              <ActionButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  if (step === "review") setStep("layout");
                  else if (step === "layout") setStep("content");
                  else if (step === "content") setStep("target");
                }}
                disabled={creating}
              >
                Back
              </ActionButton>
            )}

            {step === "target" && (
              <ActionButton variant="primary" size="sm" onClick={() => setStep("content")} disabled={!canAdvanceTarget}>
                Next
              </ActionButton>
            )}

            {step === "content" && (
              <ActionButton variant="primary" size="sm" onClick={() => setStep("layout")}>
                Next
              </ActionButton>
            )}

            {step === "layout" && (
              <ActionButton variant="primary" size="sm" onClick={() => setStep("review")} disabled={analyzingSketch}>
                Next
              </ActionButton>
            )}

            {step === "review" && (
              <ActionButton variant="primary" size="sm" onClick={handleGenerate} disabled={creating}>
                {creating
                  ? target === "new"
                    ? "Generating zone..."
                    : "Generating rooms..."
                  : target === "new"
                    ? "Create Zone"
                    : "Add Rooms"}
              </ActionButton>
            )}

            {step === "error" && (
              <ActionButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setStep("review");
                }}
              >
                Try again
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


