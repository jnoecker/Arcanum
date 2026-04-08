import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  createFallbackZone,
} from "@/lib/generateZoneContent";
import { LoreEditor } from "./lore/LoreEditor";
import type { WorldFile } from "@/types/world";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

// ─── Size presets ───────────────────────────────────────────────────

type SizePresetId = "stub" | "small" | "medium" | "large";

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
  { id: "small", label: "Small", hint: "3 rooms", rooms: 3, mobs: 2, items: 1 },
  { id: "medium", label: "Medium", hint: "5 rooms", rooms: 5, mobs: 4, items: 3 },
  { id: "large", label: "Large", hint: "8 rooms", rooms: 8, mobs: 6, items: 5 },
];

// ─── Generation prompts (used by the LoreEditor AI buttons) ─────────

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

function deriveZoneId(description: string): string {
  if (!description) return "";
  const plain = tiptapToPlainText(description).toLowerCase();
  const words = plain
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));

  // Take up to 3 meaningful words; cap total length
  const picked = words.slice(0, 3).join("_");
  if (!picked) return "";
  // Must start with a letter
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

// ─── Component ──────────────────────────────────────────────────────

interface NewZoneDialogProps {
  onClose: () => void;
}

export function NewZoneDialog({ onClose }: NewZoneDialogProps) {
  const project = useProjectStore((s) => s.project);
  const loadZone = useZoneStore((s) => s.loadZone);
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const config = useConfigStore((s) => s.config);
  const saveVibe = useVibeStore((s) => s.saveVibe);

  const [description, setDescription] = useState(""); // TipTap JSON
  const [zoneIdInput, setZoneIdInput] = useState("");
  const [size, setSize] = useState<SizePresetId>("small");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(creating ? undefined : onClose);

  const plainDescription = useMemo(
    () => tiptapToPlainText(description).trim(),
    [description],
  );
  const hasDescription = plainDescription.length > 0;
  const normalizedZoneIdInput = useMemo(
    () => normalizeZoneId(zoneIdInput),
    [zoneIdInput],
  );

  // Effective zone ID: user input overrides; otherwise derive from description.
  const effectiveZoneId = useMemo(() => {
    const fromInput = normalizedZoneIdInput;
    if (fromInput) return fromInput;
    return deriveZoneId(description);
  }, [normalizedZoneIdInput, description]);

  const idValid = /^[a-z][a-z0-9_]*$/.test(effectiveZoneId);
  const idTaken = effectiveZoneId.length > 0 && zones.has(effectiveZoneId);
  const canCreate = !!project && idValid && !idTaken && !creating;

  // ─── Build params for the LLM generator ───────────────────────────

  const buildGenParams = (zoneId: string) => {
    const preset = SIZE_PRESETS.find((p) => p.id === size) ?? SIZE_PRESETS[1]!;
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
      zoneName: zoneId,
      zoneTheme: plainDescription,
      worldTheme: buildToneDirective(),
      roomCount: preset.rooms,
      mobCount: preset.mobs,
      itemCount: preset.items,
      statNames,
      equipmentSlots,
      classNames,
    };
  };

  // ─── Create handler ───────────────────────────────────────────────

  const handleCreate = async () => {
    if (!project || !idValid || idTaken || creating) return;
    setCreating(true);
    setError(null);

    try {
      let world: WorldFile;

      if (size === "stub" || !hasDescription) {
        // Stub path — single empty room, no LLM call.
        world = createFallbackZone(effectiveZoneId, 1);
      } else {
        // AI path — let the generator create rooms/mobs/items.
        try {
          world = await generateZoneContent(buildGenParams(effectiveZoneId));
        } catch (genErr) {
          // If the LLM call fails, fall back to a stub of the requested size
          // so the user still gets a usable zone.
          const preset = SIZE_PRESETS.find((p) => p.id === size) ?? SIZE_PRESETS[1]!;
          world = createFallbackZone(effectiveZoneId, preset.rooms);
          setError(
            `AI generation failed (${String(genErr)}). Created an empty ${preset.label.toLowerCase()} zone instead.`,
          );
        }
      }

      // Standalone projects need a zone directory before the file write.
      if (project.format === "standalone") {
        await invoke("create_zone_directory", {
          projectDir: project.mudDir,
          zoneId: effectiveZoneId,
        });
      }

      const filePath = zoneFilePath(project, effectiveZoneId);
      const yaml = stringify(world, YAML_OPTS);
      await writeTextFile(filePath, yaml);

      loadZone(effectiveZoneId, filePath, world);

      // Persist the description as the zone vibe so it informs future
      // art generation and shows in the Zone Vibe panel.
      if (hasDescription) {
        try {
          await saveVibe(effectiveZoneId, plainDescription);
        } catch {
          // Non-fatal — vibe is a nice-to-have.
        }
      }

      openTab({ id: `zone:${effectiveZoneId}`, kind: "zone", label: effectiveZoneId });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]0">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-zone-dialog-title"
        aria-describedby="new-zone-dialog-description"
        className="mx-4 flex max-h-[90vh] w-full max-w-[min(40rem,calc(100vw-2rem))] flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2
            id="new-zone-dialog-title"
            className="font-display text-sm tracking-wide text-text-primary"
          >
            New Zone
          </h2>
          <p id="new-zone-dialog-description" className="mt-0.5 text-2xs text-text-muted">
            Describe a region of your world. AI will draft rooms, mobs, and items
            from your description.
          </p>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Description */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Description
            </label>
            <LoreEditor
              value={description}
              onCommit={setDescription}
              placeholder="A sunken crypt beneath an old cathedral, choked with brackish water and the echoes of forgotten hymns..."
              generateSystemPrompt={ZONE_DESC_GENERATE_SYSTEM}
              generateUserPrompt={ZONE_DESC_GENERATE_USER}
              context={buildToneDirective()}
            />
            <p className="mt-1 text-2xs text-text-muted">
              Use Generate, Expand, or Enhance to draft with AI. Leave blank for an
              empty stub zone.
            </p>
          </div>

          {/* Size preset */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Size
            </label>
            <div role="radiogroup" aria-label="Zone size" className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((preset) => {
                const active = preset.id === size;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSize(preset.id)}
                    className={`rounded-full border px-3 py-1 text-2xs font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border-default bg-bg-primary text-text-muted hover:border-border-focus hover:text-text-primary"
                    }`}
                  >
                    {preset.label}
                    <span className="ml-1.5 text-text-muted">{preset.hint}</span>
                  </button>
                );
              })}
            </div>
            {size === "stub" && (
              <p className="mt-1 text-2xs text-text-muted">
                Stub zones skip the AI generator and create a single empty room.
              </p>
            )}
          </div>

          {/* Zone ID */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Zone ID{" "}
              <span className="font-normal normal-case text-text-muted">
                (optional — auto-suggested from description)
              </span>
            </label>
            <input
              type="text"
              value={zoneIdInput}
              onChange={(e) => setZoneIdInput(e.target.value)}
              placeholder={deriveZoneId(description) || "e.g. dark_forest"}
              maxLength={80}
              aria-invalid={effectiveZoneId ? !idValid || idTaken : undefined}
              aria-describedby={
                effectiveZoneId && !idValid
                  ? "zone-id-format-error"
                  : idTaken
                    ? "zone-id-taken-error"
                    : undefined
              }
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {zoneIdInput.trim() && normalizedZoneIdInput !== zoneIdInput.trim().toLowerCase() && (
              <p className="mt-1 text-2xs text-text-muted">
                Zone IDs are normalized to lowercase letters, numbers, and underscores.
              </p>
            )}
            {effectiveZoneId && !idValid && (
              <p id="zone-id-format-error" className="mt-1 text-2xs text-status-error">
                ID must start with a letter and contain only lowercase letters,
                numbers, and underscores.
              </p>
            )}
            {idTaken && (
              <p id="zone-id-taken-error" className="mt-1 text-2xs text-status-error">
                Zone "{effectiveZoneId}" already exists.
              </p>
            )}
            {!effectiveZoneId && (
              <p className="mt-1 text-2xs text-text-muted">
                Type a description above or enter an ID manually.
              </p>
            )}
          </div>

          {error && <p role="alert" className="break-words text-xs text-status-error">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-default px-5 py-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            disabled={creating}
            className="rounded bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover sm:px-4 sm:py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="rounded bg-accent px-4 py-2 text-xs font-medium text-accent-emphasis transition-[box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5"
          >
            {creating
              ? size === "stub" || !hasDescription
                ? "Creating..."
                : "Generating zone..."
              : "Create Zone"}
          </button>
        </div>
      </div>
    </div>
  );
}
