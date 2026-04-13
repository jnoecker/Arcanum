import type { ReactNode } from "react";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { buildToneDirective } from "@/lib/loreGeneration";
import { sanitizeLabel, inferDirection } from "@/lib/sketchToZone";
import { LoreEditor } from "./lore/LoreEditor";
import { SketchCanvas } from "./SketchCanvas";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { WorldFile } from "@/types/world";
import type { SketchParseResult } from "@/types/sketch";
import type { FixedLayout, FixedLayoutRoom } from "@/lib/generateZoneContent";

// ─── Constants ──────────────────────────────────────────────────────

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "with",
  "for", "from", "by", "is", "as", "this", "that", "these", "those",
]);
export const MAX_ZONE_ID_LENGTH = 40;
export const ZONE_ID_RE = /^[a-z][a-z0-9_]*$/;

// ─── Size presets ───────────────────────────────────────────────────

export type SizePresetId = "stub" | "small" | "medium" | "large" | "huge";

export interface SizePreset {
  id: SizePresetId;
  label: string;
  hint: string;
  rooms: number;
  mobs: number;
  items: number;
}

export const SIZE_PRESETS: SizePreset[] = [
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

// ─── Wizard step type ───────────────────────────────────────────────

export type WizardStep =
  | "target"
  | "content"
  | "layout"
  | "review"
  | "done"
  | "error";

// ─── ID derivation ──────────────────────────────────────────────────

export function deriveZoneId(description: string): string {
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

export function normalizeZoneId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .slice(0, MAX_ZONE_ID_LENGTH);
}

// ─── Sketch parse → FixedLayout conversion ──────────────────────────

export function sketchParseToFixedLayout(
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
  const byId = new Map<string, (typeof result.rooms)[number]>();
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

// ─── Stub-from-sketch helper ──────────────────────────────────────
// Produces a WorldFile (new zone) or rooms map (extending) from a sketch
// without calling the LLM. Used when the user provides a sketch but no
// description.

export function buildStubFromSketch(zoneName: string, layout: FixedLayout): WorldFile {
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

// ─── Step sub-components ───────────────────────────────────────────

const STEP_LABELS: Array<[WizardStep, string]> = [
  ["target", "Target"],
  ["content", "Content"],
  ["layout", "Layout"],
  ["review", "Review"],
];

interface StepBreadcrumbProps {
  step: WizardStep;
}

export function StepBreadcrumb({ step }: StepBreadcrumbProps) {
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

export interface TargetStepProps {
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

export function TargetStep({
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

export interface ContentStepProps {
  target: "new" | "existing";
  description: string;
  setDescription: (s: string) => void;
  backgroundNotes: string;
  setBackgroundNotes: (s: string) => void;
}

export function ContentStep({
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

export interface LayoutStepProps {
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

export function LayoutStep({
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

      {/* Sketch (requires AI vision) */}
      {AI_ENABLED && (
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
      )}
    </div>
  );
}

// ─── Review step ──────────────────────────────────────────────────

export interface ReviewStepProps {
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

export function ReviewStep({
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

// ─── Row helper ──────────────────────────────────────────────────

interface RowProps {
  label: string;
  children: ReactNode;
}

export function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-20 shrink-0 text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
