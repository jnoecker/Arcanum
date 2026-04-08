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
  type FixedLayout,
  type FixedLayoutRoom,
} from "@/lib/generateZoneContent";
import { sanitizeLabel, inferDirection } from "@/lib/sketchToZone";
import { LoreEditor } from "./lore/LoreEditor";
import { SketchCanvas } from "./SketchCanvas";
import type { WorldFile } from "@/types/world";
import type { SketchParseResult, SketchRoom } from "@/types/sketch";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

// ─── Size presets ───────────────────────────────────────────────────

type SizePresetId = "stub" | "small" | "medium" | "large" | "huge";

interface SizePreset {
  id: SizePresetId;
  label: string;
  hint: string;
  rooms: number;
  mobs: number;
  items: number;
}

const SIZE_PRESETS: SizePreset[] = [
  { id: "stub", label: "Stub", hint: "1 empty room", rooms: 1, mobs: 0, items: 0 },
  { id: "small", label: "Small", hint: "~10 rooms", rooms: 10, mobs: 5, items: 4 },
  { id: "medium", label: "Medium", hint: "~30 rooms", rooms: 30, mobs: 12, items: 10 },
  { id: "large", label: "Large", hint: "~60 rooms", rooms: 60, mobs: 20, items: 16 },
  { id: "huge", label: "Huge", hint: "~100 rooms", rooms: 100, mobs: 30, items: 24 },
];

// ─── Description generation prompts (for the LoreEditor AI buttons) ─

const ZONE_DESC_GENERATE_SYSTEM =
  "You are a creative game designer for a text-based MUD. Write a single evocative paragraph describing a new zone (a region of the game world). Focus on atmosphere, setting, and what players will encounter. Output ONLY the paragraph — no headings, no quotes, no preamble.";

const ZONE_DESC_GENERATE_USER =
  "Invent a fresh zone for this world. Pick something the player has not seen before. Keep it to one paragraph.";

// ─── ID derivation ──────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "with",
  "for", "from", "by", "is", "as", "this", "that", "these", "those",
]);
const MAX_ZONE_ID_LENGTH = 40;
const ZONE_ID_RE = /^[a-z][a-z0-9_]*$/;

function deriveZoneId(description: string): string {
  if (!description) return "";
  const plain = tiptapToPlainText(description).toLowerCase();
  const words = plain
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const picked = words.slice(0, 3).join("_");
  if (!picked) return "";
  return picked.replace(/^[^a-z]+/, "").slice(0, MAX_ZONE_ID_LENGTH);
}

function normalizeZoneId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .slice(0, MAX_ZONE_ID_LENGTH);
}

// ─── Sketch parse → FixedLayout conversion ──────────────────────────

function sketchParseToFixedLayout(
  result: SketchParseResult,
  zoneId: string,
  existingIds: Set<string>,
): FixedLayout {
  // Assign final room IDs (same logic as sketchToZone.buildRoomIdMap)
  const idMap = new Map<string, string>();
  const used = new Set<string>(existingIds);
  let unlabeledCount = 0;
  for (const room of result.rooms) {
    let id: string;
    if (room.label) {
      id = sanitizeLabel(room.label);
    } else {
      unlabeledCount++;
      id = `${zoneId}_room${unlabeledCount}`;
    }
    // Dedupe
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
    }
    used.add(id);
    idMap.set(room.id, id);
  }

  // Build exits per room based on sketch connections
  const rooms: FixedLayoutRoom[] = [];
  const byId = new Map<string, SketchRoom>();
  for (const r of result.rooms) byId.set(r.id, r);

  for (const sketchRoom of result.rooms) {
    const finalId = idMap.get(sketchRoom.id)!;
    const exits: Record<string, string> = {};

    for (const conn of result.connections) {
      let otherId: string | null = null;
      let isFrom = false;
      if (conn.from === sketchRoom.id) {
        otherId = conn.to;
        isFrom = true;
      } else if (conn.to === sketchRoom.id) {
        otherId = conn.from;
        isFrom = false;
      }
      if (!otherId) continue;

      const other = byId.get(otherId);
      if (!other) continue;
      const otherFinalId = idMap.get(otherId);
      if (!otherFinalId) continue;

      const dir = isFrom
        ? inferDirection(sketchRoom.gridX, sketchRoom.gridY, other.gridX, other.gridY)
        : inferDirection(sketchRoom.gridX, sketchRoom.gridY, other.gridX, other.gridY);
      if (!dir) continue;
      if (!exits[dir]) exits[dir] = otherFinalId;
    }

    rooms.push({
      id: finalId,
      hint: sketchRoom.label ?? null,
      exits,
    });
  }

  return { rooms };
}

// ─── Wizard component ──────────────────────────────────────────────

type WizardStep =
  | "target"
  | "content"
  | "layout"
  | "review"
  | "done"
  | "error";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]0">
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
          <button
            onClick={onClose}
            disabled={creating}
            className="rounded bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover sm:px-4 sm:py-1.5"
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>

          <div className="flex gap-2 sm:justify-end">
            {step !== "target" && step !== "done" && step !== "error" && (
              <button
                onClick={() => {
                  setError(null);
                  if (step === "review") setStep("layout");
                  else if (step === "layout") setStep("content");
                  else if (step === "content") setStep("target");
                }}
                disabled={creating}
                className="rounded bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover sm:px-4 sm:py-1.5"
              >
                Back
              </button>
            )}

            {step === "target" && (
              <button
                onClick={() => setStep("content")}
                disabled={!canAdvanceTarget}
                className="rounded bg-accent px-4 py-2 text-xs font-medium text-accent-emphasis transition-[box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5"
              >
                Next
              </button>
            )}

            {step === "content" && (
              <button
                onClick={() => setStep("layout")}
                className="rounded bg-accent px-4 py-2 text-xs font-medium text-accent-emphasis transition-[box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 sm:px-4 sm:py-1.5"
              >
                Next
              </button>
            )}

            {step === "layout" && (
              <button
                onClick={() => setStep("review")}
                disabled={analyzingSketch}
                className="rounded bg-accent px-4 py-2 text-xs font-medium text-accent-emphasis transition-[box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5"
              >
                Next
              </button>
            )}

            {step === "review" && (
              <button
                onClick={handleGenerate}
                disabled={creating}
                className="rounded bg-accent px-4 py-2 text-xs font-medium text-accent-emphasis transition-[box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-1.5"
              >
                {creating
                  ? target === "new"
                    ? "Generating zone..."
                    : "Generating rooms..."
                  : target === "new"
                    ? "Create Zone"
                    : "Add Rooms"}
              </button>
            )}

            {step === "error" && (
              <button
                onClick={() => {
                  setError(null);
                  setStep("review");
                }}
                className="rounded bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover sm:px-4 sm:py-1.5"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step sub-components ───────────────────────────────────────────

const STEP_LABELS: Array<[WizardStep, string]> = [
  ["target", "Target"],
  ["content", "Content"],
  ["layout", "Layout"],
  ["review", "Review"],
];

function StepBreadcrumb({ step }: { step: WizardStep }) {
  if (step === "done" || step === "error") return null;
  const idx = STEP_LABELS.findIndex(([s]) => s === step);
  return (
    <div className="mt-1 flex items-center gap-1.5 text-2xs text-text-muted">
      {STEP_LABELS.map(([s, label], i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span
            className={
              i < idx
                ? "text-text-secondary"
                : i === idx
                  ? "font-medium text-accent"
                  : "text-text-muted"
            }
          >
            {i + 1}. {label}
          </span>
          {i < STEP_LABELS.length - 1 && <span className="text-border-default">/</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Target step ──────────────────────────────────────────────────

interface TargetStepProps {
  target: "new" | "existing";
  setTarget: (t: "new" | "existing") => void;
  zoneIdInput: string;
  setZoneIdInput: (s: string) => void;
  effectiveZoneId: string;
  zoneIdValid: boolean;
  zoneIdTaken: boolean;
  zoneList: string[];
  existingZoneId: string;
  setExistingZoneId: (s: string) => void;
}

function TargetStep({
  target,
  setTarget,
  zoneIdInput,
  setZoneIdInput,
  effectiveZoneId,
  zoneIdValid,
  zoneIdTaken,
  zoneList,
  existingZoneId,
  setExistingZoneId,
}: TargetStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        Create a brand-new zone, or add rooms to an existing one.
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default bg-bg-primary p-3 transition-colors hover:border-accent/40">
        <input
          type="radio"
          name="target"
          checked={target === "new"}
          onChange={() => setTarget("new")}
          className="mt-0.5 accent-accent"
        />
        <div className="flex-1">
          <div className="text-xs font-medium text-text-primary">Create new zone</div>
          <div className="mt-0.5 text-2xs text-text-muted">
            Start with a blank zone and let AI shape its rooms, mobs, and items.
          </div>
          {target === "new" && (
            <div className="mt-3">
              <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
                Zone ID{" "}
                <span className="font-normal normal-case text-text-muted">
                  (optional — will be derived from your description if blank)
                </span>
              </label>
              <input
                type="text"
                value={zoneIdInput}
                onChange={(e) => setZoneIdInput(e.target.value)}
                placeholder="e.g. dark_forest"
                maxLength={80}
                aria-invalid={effectiveZoneId ? !zoneIdValid || zoneIdTaken : undefined}
                className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
              />
              {effectiveZoneId && !zoneIdValid && (
                <p className="mt-1 text-2xs text-status-error">
                  ID must start with a letter and contain only lowercase letters,
                  numbers, and underscores.
                </p>
              )}
              {zoneIdTaken && (
                <p className="mt-1 text-2xs text-status-error">
                  Zone "{effectiveZoneId}" already exists. Pick a different ID
                  or use "Add to existing zone" instead.
                </p>
              )}
            </div>
          )}
        </div>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default bg-bg-primary p-3 transition-colors hover:border-accent/40">
        <input
          type="radio"
          name="target"
          checked={target === "existing"}
          onChange={() => {
            setTarget("existing");
            if (!existingZoneId && zoneList.length > 0) {
              setExistingZoneId(zoneList[0]!);
            }
          }}
          className="mt-0.5 accent-accent"
          disabled={zoneList.length === 0}
        />
        <div className="flex-1">
          <div className="text-xs font-medium text-text-primary">
            Add to existing zone
          </div>
          <div className="mt-0.5 text-2xs text-text-muted">
            Extend a zone with new rooms, matched to its existing voice and vibe.
          </div>
          {target === "existing" && (
            <div className="mt-3">
              {zoneList.length === 0 ? (
                <p className="text-2xs text-text-muted">
                  No zones loaded yet. Create your first zone instead.
                </p>
              ) : (
                <select
                  value={existingZoneId}
                  onChange={(e) => setExistingZoneId(e.target.value)}
                  className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                >
                  {zoneList.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </label>
    </div>
  );
}

// ─── Content step ─────────────────────────────────────────────────

interface ContentStepProps {
  target: "new" | "existing";
  description: string;
  setDescription: (s: string) => void;
  backgroundNotes: string;
  setBackgroundNotes: (s: string) => void;
}

function ContentStep({
  target,
  description,
  setDescription,
  backgroundNotes,
  setBackgroundNotes,
}: ContentStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
          {target === "new" ? "Zone description" : "What should the new rooms feel like?"}
        </label>
        <LoreEditor
          value={description}
          onCommit={setDescription}
          placeholder={
            target === "new"
              ? "A sunken crypt beneath an old cathedral, choked with brackish water and the echoes of forgotten hymns..."
              : "A lower level carved out beneath the existing chambers, colder and quieter, with the sound of distant water..."
          }
          generateSystemPrompt={ZONE_DESC_GENERATE_SYSTEM}
          generateUserPrompt={ZONE_DESC_GENERATE_USER}
          context={buildToneDirective()}
        />
        <p className="mt-1 text-2xs text-text-muted">
          Use Generate, Expand, or Enhance to draft with AI.{" "}
          {target === "new" && "Leave blank for an empty stub zone."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
          Background notes
          <span className="ml-2 font-normal normal-case text-text-muted">
            (optional)
          </span>
        </label>
        <textarea
          value={backgroundNotes}
          onChange={(e) => setBackgroundNotes(e.target.value)}
          placeholder="Anything the AI should keep in mind: key NPCs, the zone's place in the story, tone guardrails, connections to other zones..."
          rows={4}
          className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <p className="mt-1 text-2xs text-text-muted">
          Plain-text context passed to the AI alongside the description.
        </p>
      </div>
    </div>
  );
}

// ─── Layout step ──────────────────────────────────────────────────

interface LayoutStepProps {
  target: "new" | "existing";
  size: SizePresetId;
  setSize: (s: SizePresetId) => void;
  sketchMode: "none" | "photo" | "draw";
  setSketchMode: (m: "none" | "photo" | "draw") => void;
  sketchParse: SketchParseResult | null;
  sketchBase64: string | null;
  analyzingSketch: boolean;
  onPickPhoto: () => Promise<void>;
  onCanvasExport: (base64: string) => Promise<void>;
  clearSketch: () => void;
}

function LayoutStep({
  target,
  size,
  setSize,
  sketchMode,
  setSketchMode,
  sketchParse,
  analyzingSketch,
  onPickPhoto,
  onCanvasExport,
  clearSketch,
}: LayoutStepProps) {
  const hasSketch = !!sketchParse;
  return (
    <div className="flex flex-col gap-5">
      {/* Size preset */}
      <div>
        <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
          {target === "new" ? "Size" : "How many rooms to add"}
        </label>
        <div role="radiogroup" aria-label="Zone size" className="flex flex-wrap gap-2">
          {SIZE_PRESETS.filter((p) => !(target === "existing" && p.id === "stub")).map(
            (preset) => {
              const active = preset.id === size;
              const disabled = hasSketch;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => setSize(preset.id)}
                  className={`rounded-full border px-3 py-1 text-2xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border-default bg-bg-primary text-text-muted hover:border-border-focus hover:text-text-primary"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {preset.label}
                  <span className="ml-1.5 text-text-muted">{preset.hint}</span>
                </button>
              );
            },
          )}
        </div>
        {size === "stub" && target === "new" && !hasSketch && (
          <p className="mt-1 text-2xs text-text-muted">
            Stub zones skip the AI generator and create a single empty room.
          </p>
        )}
        {hasSketch && (
          <p className="mt-1 text-2xs text-text-muted">
            Size is overridden — the sketch defines the layout.
          </p>
        )}
      </div>

      {/* Sketch */}
      <div>
        <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
          Sketch
          <span className="ml-2 font-normal normal-case text-text-muted">
            (optional — defines the room layout)
          </span>
        </label>

        {/* Summary when we have a parsed sketch */}
        {hasSketch && sketchParse && (
          <div className="rounded border border-border-default bg-bg-primary p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-secondary">
                <span className="text-text-primary">
                  {sketchParse.rooms.length}
                </span>{" "}
                rooms parsed,{" "}
                <span className="text-text-primary">
                  {sketchParse.connections.length}
                </span>{" "}
                connections
              </div>
              <button
                onClick={clearSketch}
                className="rounded bg-bg-elevated px-2 py-1 text-2xs font-medium text-text-primary hover:bg-bg-hover"
              >
                Clear
              </button>
            </div>
            {sketchParse.rooms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 text-2xs text-text-muted">
                {sketchParse.rooms.slice(0, 12).map((r) => (
                  <span
                    key={r.id}
                    className="rounded bg-bg-elevated px-1.5 py-0.5"
                  >
                    {r.label || r.id}
                  </span>
                ))}
                {sketchParse.rooms.length > 12 && (
                  <span className="text-text-muted">
                    +{sketchParse.rooms.length - 12} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Picker when no sketch yet */}
        {!hasSketch && sketchMode === "none" && !analyzingSketch && (
          <div className="flex gap-2">
            <button
              onClick={onPickPhoto}
              className="flex flex-1 flex-col items-center gap-1 rounded border border-border-default bg-bg-primary p-4 text-xs font-medium text-text-primary transition-colors hover:border-accent/50 hover:bg-bg-elevated"
            >
              <span className="text-lg">&#128247;</span>
              Import photo
              <span className="text-2xs font-normal text-text-muted">
                Hand-drawn on paper
              </span>
            </button>
            <button
              onClick={() => setSketchMode("draw")}
              className="flex flex-1 flex-col items-center gap-1 rounded border border-border-default bg-bg-primary p-4 text-xs font-medium text-text-primary transition-colors hover:border-accent/50 hover:bg-bg-elevated"
            >
              <span className="text-lg">&#9998;</span>
              Draw here
              <span className="text-2xs font-normal text-text-muted">
                In-app canvas
              </span>
            </button>
          </div>
        )}

        {/* Canvas */}
        {sketchMode === "draw" && !hasSketch && !analyzingSketch && (
          <div>
            <SketchCanvas onExport={onCanvasExport} />
            <button
              onClick={() => setSketchMode("none")}
              className="mt-2 rounded bg-bg-elevated px-3 py-1 text-2xs text-text-primary hover:bg-bg-hover"
            >
              Back
            </button>
          </div>
        )}

        {/* Analyzing */}
        {analyzingSketch && (
          <div className="flex flex-col items-center gap-2 rounded border border-border-default bg-bg-primary py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-2xs text-text-muted">Analyzing sketch...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Review step ──────────────────────────────────────────────────

interface ReviewStepProps {
  target: "new" | "existing";
  targetZoneId: string;
  description: string;
  backgroundNotes: string;
  sizeLabel: string;
  roomCount: number;
  mobCount: number;
  itemCount: number;
  hasSketch: boolean;
  sketchRoomCount: number;
  creating: boolean;
}

function ReviewStep({
  target,
  targetZoneId,
  description,
  backgroundNotes,
  sizeLabel,
  roomCount,
  mobCount,
  itemCount,
  hasSketch,
  sketchRoomCount,
  creating,
}: ReviewStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        {creating
          ? "Working on it..."
          : "Review the plan below, then generate when you're ready."}
      </p>

      <dl className="flex flex-col gap-2 rounded border border-border-default bg-bg-primary p-3 text-xs">
        <Row label="Target">
          {target === "new" ? (
            <>
              New zone <span className="font-mono text-accent">{targetZoneId}</span>
            </>
          ) : (
            <>
              Extend <span className="font-mono text-accent">{targetZoneId}</span>
            </>
          )}
        </Row>
        <Row label="Rooms">
          {hasSketch ? (
            <>
              <span className="text-text-primary">{sketchRoomCount}</span> from sketch
            </>
          ) : (
            <>
              <span className="text-text-primary">{roomCount}</span> ({sizeLabel})
            </>
          )}
        </Row>
        <Row label="Mobs">{mobCount}</Row>
        <Row label="Items">{itemCount}</Row>
        <Row label="Description">
          {description ? (
            <span className="text-text-secondary">
              {description.length > 140
                ? `${description.slice(0, 140)}\u2026`
                : description}
            </span>
          ) : (
            <span className="italic text-text-muted">(none)</span>
          )}
        </Row>
        {backgroundNotes && (
          <Row label="Notes">
            <span className="text-text-secondary">
              {backgroundNotes.length > 140
                ? `${backgroundNotes.slice(0, 140)}\u2026`
                : backgroundNotes}
            </span>
          </Row>
        )}
      </dl>

      {creating && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>
            AI is {target === "new" ? "shaping the zone" : "writing new rooms"}...
          </span>
        </div>
      )}

      {target === "existing" && !creating && (
        <p className="text-2xs text-text-muted">
          New rooms are added to the zone but not auto-wired. After generation,
          drag an exit from an existing room to connect them.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-20 shrink-0 text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

// ─── Stub-from-sketch helper ──────────────────────────────────────
// Produces a WorldFile (new zone) or rooms map (extending) from a sketch
// without calling the LLM. Used when the user provides a sketch but no
// description.

function buildStubFromSketch(zoneName: string, layout: FixedLayout): WorldFile {
  const rooms: WorldFile["rooms"] = {};
  for (const r of layout.rooms) {
    const exits: Record<string, string> = {};
    for (const [dir, target] of Object.entries(r.exits)) {
      exits[dir] = target;
      // Ensure bidirectional — the layout already has both sides populated via
      // sketchParseToFixedLayout walking every room/connection pair.
    }
    rooms[r.id] = {
      title: r.hint ?? r.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "A new room.",
      exits,
    };
  }
  const startRoom = layout.rooms[0]?.id ?? "start";
  return {
    zone: zoneName,
    lifespan: 30,
    startRoom,
    rooms,
    mobs: {},
    items: {},
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

