import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { zoneFilePath } from "@/lib/projectPaths";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { sketchToWorldData, mergeSketchRooms } from "@/lib/sketchToZone";
import { SketchCanvas } from "./SketchCanvas";
import type { SketchParseResult, SketchRoom } from "@/types/sketch";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

const ZONE_ID_RE = /^[a-z][a-z0-9_]*$/;

type WizardStep = "input" | "draw" | "analyzing" | "preview" | "done" | "error";

interface SketchImportWizardProps {
  onClose: () => void;
}

export function SketchImportWizard({ onClose }: SketchImportWizardProps) {
  const project = useProjectStore((s) => s.project);
  const loadZone = useZoneStore((s) => s.loadZone);
  const updateZone = useZoneStore((s) => s.updateZone);
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Image state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/png");

  // Parse result state
  const [parseResult, setParseResult] = useState<SketchParseResult | null>(null);
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});

  // Target state
  const [target, setTarget] = useState<"new" | "existing">("new");
  const [zoneId, setZoneId] = useState("");
  const [existingZoneId, setExistingZoneId] = useState("");
  const [startRoomId, setStartRoomId] = useState("");

  const trimmedZoneId = zoneId.trim().toLowerCase().replace(/\s+/g, "_");
  const zoneIdValid = ZONE_ID_RE.test(trimmedZoneId);
  const zoneIdTaken = zones.has(trimmedZoneId);

  const zoneList = useMemo(() => Array.from(zones.keys()), [zones]);

  // ─── Photo import ───────────────────────────────────────────────

  const handlePickImage = async () => {
    const selected = await open({
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] },
      ],
    });
    if (!selected) return;

    try {
      const dataUrl = await invoke<string>("read_image_data_url", {
        path: selected,
      });
      // Extract base64 and mime from data URL
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) {
        setError("Failed to read image file.");
        setStep("error");
        return;
      }
      setMediaType(match[1]!);
      setImageBase64(match[2]!);
      analyzeImage(match[2]!, match[1]!);
    } catch (err) {
      setError(String(err));
      setStep("error");
    }
  };

  // ─── Canvas export ──────────────────────────────────────────────

  const handleCanvasExport = (base64: string) => {
    setImageBase64(base64);
    setMediaType("image/png");
    analyzeImage(base64, "image/png");
  };

  // ─── Analyze via Claude Vision ──────────────────────────────────

  const analyzeImage = async (b64: string, mime: string) => {
    setStep("analyzing");
    setError(null);

    try {
      const raw = await invoke<string>("analyze_sketch", {
        imageBase64: b64,
        mediaType: mime,
      });

      // Strip markdown fences if present
      let json = raw.trim();
      if (json.startsWith("```")) {
        json = json.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      const parsed: SketchParseResult = JSON.parse(json);
      if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
        throw new Error("Invalid response: missing rooms array");
      }
      if (!parsed.connections) {
        parsed.connections = [];
      }

      setParseResult(parsed);
      // Initialize labels for editing
      const labels: Record<string, string> = {};
      for (const room of parsed.rooms) {
        labels[room.id] = room.label ?? "";
      }
      setEditedLabels(labels);
      if (parsed.rooms.length > 0) {
        setStartRoomId(parsed.rooms[0]!.id);
      }
      setStep("preview");
    } catch (err) {
      setError(String(err));
      setStep("error");
    }
  };

  // ─── Apply edited labels back to parse result ───────────────────

  const getFinalResult = (): SketchParseResult => {
    if (!parseResult) return { rooms: [], connections: [] };
    return {
      ...parseResult,
      rooms: parseResult.rooms.map((r) => ({
        ...r,
        label: editedLabels[r.id]?.trim() || null,
      })),
    };
  };

  // ─── Import ─────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!project || !parseResult) return;

    try {
      const finalResult = getFinalResult();

      if (target === "new") {
        if (!zoneIdValid || zoneIdTaken) return;

        // Reorder rooms so startRoomId is first
        const reordered = [...finalResult.rooms];
        const startIdx = reordered.findIndex((r) => r.id === startRoomId);
        if (startIdx > 0) {
          const [startRoom] = reordered.splice(startIdx, 1);
          reordered.unshift(startRoom!);
        }

        const world = sketchToWorldData(
          { rooms: reordered, connections: finalResult.connections },
          trimmedZoneId,
        );

        // Create zone directory for standalone projects
        if (project.format === "standalone") {
          await invoke("create_zone_directory", {
            projectDir: project.mudDir,
            zoneId: trimmedZoneId,
          });
        }

        const filePath = zoneFilePath(project, trimmedZoneId);
        const yaml = stringify(world, YAML_OPTS);
        await writeTextFile(filePath, yaml);

        loadZone(trimmedZoneId, filePath, world);
        openTab({
          id: `zone:${trimmedZoneId}`,
          kind: "zone",
          label: trimmedZoneId,
        });
      } else {
        // Merge into existing zone
        if (!existingZoneId || !zones.has(existingZoneId)) return;
        const zoneState = zones.get(existingZoneId)!;
        const merged = mergeSketchRooms(zoneState.data, finalResult);
        updateZone(existingZoneId, merged);
        openTab({
          id: `zone:${existingZoneId}`,
          kind: "zone",
          label: existingZoneId,
        });
      }

      setStep("done");
    } catch (err) {
      setError(String(err));
      setStep("error");
    }
  };

  // ─── Retry from error ───────────────────────────────────────────

  const handleRetry = () => {
    setError(null);
    if (imageBase64) {
      analyzeImage(imageBase64, mediaType);
    } else {
      setStep("input");
    }
  };

  // ─── Direction label helper ─────────────────────────────────────

  const dirLabel = (
    from: SketchRoom,
    to: SketchRoom,
  ): string => {
    const dx = Math.sign(to.gridX - from.gridX);
    const dy = Math.sign(to.gridY - from.gridY);
    const map: Record<string, string> = {
      "0,-1": "N",
      "0,1": "S",
      "1,0": "E",
      "-1,0": "W",
      "1,-1": "NE",
      "-1,-1": "NW",
      "1,1": "SE",
      "-1,1": "SW",
    };
    return map[`${dx},${dy}`] ?? "?";
  };

  // ─── Render ─────────────────────────────────────────────────────

  const roomLookup = useMemo(() => {
    const m = new Map<string, SketchRoom>();
    for (const r of parseResult?.rooms ?? []) m.set(r.id, r);
    return m;
  }, [parseResult]);

  // Grid bounds for the mini-map
  const gridBounds = useMemo(() => {
    const rooms = parseResult?.rooms ?? [];
    if (rooms.length === 0) return { minX: 0, minY: 0, cols: 0, rows: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of rooms) {
      if (r.gridX < minX) minX = r.gridX;
      if (r.gridX > maxX) maxX = r.gridX;
      if (r.gridY < minY) minY = r.gridY;
      if (r.gridY > maxY) maxY = r.gridY;
    }
    return { minX, minY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
  }, [parseResult]);

  // Build a grid cell lookup: "col,row" → room
  const gridCells = useMemo(() => {
    const m = new Map<string, SketchRoom>();
    for (const r of parseResult?.rooms ?? []) {
      m.set(`${r.gridX - gridBounds.minX},${r.gridY - gridBounds.minY}`, r);
    }
    return m;
  }, [parseResult, gridBounds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]0">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sketch-wizard-title"
        className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border-default px-5 py-3">
          <h2
            id="sketch-wizard-title"
            className="font-display text-sm tracking-wide text-accent-emphasis"
          >
            Sketch Import
          </h2>
          <p className="mt-0.5 text-2xs text-text-muted">
            {step === "input" && "Choose how to provide your map sketch"}
            {step === "draw" && "Draw your map layout"}
            {step === "analyzing" && "Analyzing sketch..."}
            {step === "preview" && "Review parsed rooms and configure import"}
            {step === "done" && "Import complete"}
            {step === "error" && "Something went wrong"}
          </p>
        </div>

        {/* ── Step: Input mode ── */}
        {step === "input" && (
          <div className="px-5 py-6">
            <div className="flex gap-4">
              <button
                onClick={handlePickImage}
                className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border-default bg-bg-primary p-6 transition-colors hover:border-accent/50 hover:bg-bg-elevated"
              >
                <span className="text-2xl">&#128247;</span>
                <span className="text-xs font-medium text-text-primary">
                  Import Photo
                </span>
                <span className="text-2xs text-text-muted">
                  Upload a photo or scan of a hand-drawn map
                </span>
              </button>
              <button
                onClick={() => setStep("draw")}
                className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border-default bg-bg-primary p-6 transition-colors hover:border-accent/50 hover:bg-bg-elevated"
              >
                <span className="text-2xl">&#9998;</span>
                <span className="text-xs font-medium text-text-primary">
                  Draw Sketch
                </span>
                <span className="text-2xs text-text-muted">
                  Draw a map directly in the app
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Draw canvas ── */}
        {step === "draw" && (
          <div className="px-5 py-4">
            <SketchCanvas onExport={handleCanvasExport} />
          </div>
        )}

        {/* ── Step: Analyzing ── */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-text-secondary">Analyzing sketch...</p>
            <p className="text-2xs text-text-muted">
              Sending image to Claude for room detection
            </p>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && parseResult && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className="flex gap-4 text-xs text-text-secondary">
                <span>
                  {parseResult.rooms.length} room
                  {parseResult.rooms.length !== 1 ? "s" : ""} found
                </span>
                <span>
                  {parseResult.connections.length} connection
                  {parseResult.connections.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Mini-map grid + room name list side by side */}
              <div className="flex gap-4">
                {/* Mini-map */}
                <div className="shrink-0">
                  <h3 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                    Layout
                  </h3>
                  <div
                    className="inline-grid gap-1 rounded border border-border-default bg-bg-primary p-2"
                    style={{
                      gridTemplateColumns: `repeat(${gridBounds.cols}, 28px)`,
                      gridTemplateRows: `repeat(${gridBounds.rows}, 28px)`,
                    }}
                  >
                    {Array.from({ length: gridBounds.rows }, (_, row) =>
                      Array.from({ length: gridBounds.cols }, (_, col) => {
                        const room = gridCells.get(`${col},${row}`);
                        const isHovered = room != null && hoveredRoomId === room.id;
                        const label = room ? (editedLabels[room.id]?.trim() || room.label || "") : "";
                        const initial = label ? label[0]!.toUpperCase() : "";
                        return (
                          <div
                            key={`${col},${row}`}
                            className={`flex items-center justify-center rounded text-2xs font-medium transition-colors ${
                              room
                                ? isHovered
                                  ? "border border-accent bg-accent/30 text-accent-emphasis"
                                  : "border border-border-active bg-bg-elevated text-text-primary"
                                : ""
                            }`}
                            title={room ? label || room.id : undefined}
                            onMouseEnter={() => room && setHoveredRoomId(room.id)}
                            onMouseLeave={() => room && setHoveredRoomId(null)}
                          >
                            {room ? initial || "\u00B7" : ""}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>

                {/* Room name list */}
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                    Rooms
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {parseResult.rooms.map((room, i) => {
                      const isHovered = hoveredRoomId === room.id;
                      return (
                        <div
                          key={room.id}
                          className={`flex items-center gap-2 rounded px-1.5 py-0.5 transition-colors ${
                            isHovered ? "bg-accent/10" : ""
                          }`}
                          onMouseEnter={() => setHoveredRoomId(room.id)}
                          onMouseLeave={() => setHoveredRoomId(null)}
                        >
                          <span className="w-5 shrink-0 text-center text-2xs text-text-muted">
                            {i + 1}
                          </span>
                          <input
                            type="text"
                            value={editedLabels[room.id] ?? ""}
                            onChange={(e) =>
                              setEditedLabels((prev) => ({
                                ...prev,
                                [room.id]: e.target.value,
                              }))
                            }
                            placeholder="Unnamed room"
                            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Connections */}
              {parseResult.connections.length > 0 && (
                <div>
                  <h3 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                    Connections
                  </h3>
                  <div className="flex flex-col gap-1 text-xs text-text-secondary">
                    {parseResult.connections.map((conn, i) => {
                      const from = roomLookup.get(conn.from);
                      const to = roomLookup.get(conn.to);
                      const fromName =
                        editedLabels[conn.from] ||
                        from?.label ||
                        conn.from;
                      const toName =
                        editedLabels[conn.to] || to?.label || conn.to;
                      const dir =
                        from && to ? dirLabel(from, to) : "?";
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-text-primary">{fromName}</span>
                          <span className="text-accent">{dir}</span>
                          <span className="text-text-muted">&rarr;</span>
                          <span className="text-text-primary">{toName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target selection */}
              <div className="border-t border-border-default pt-4">
                <h3 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                  Import Target
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-text-primary">
                    <input
                      type="radio"
                      name="target"
                      checked={target === "new"}
                      onChange={() => setTarget("new")}
                      className="accent-accent"
                    />
                    Create new zone
                  </label>
                  {target === "new" && (
                    <div className="ml-6">
                      <input
                        type="text"
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        placeholder="e.g. dark_forest"
                        className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                      />
                      {zoneId && !zoneIdValid && (
                        <p className="mt-1 text-2xs text-status-error">
                          Must start with a letter, only lowercase letters,
                          numbers, and underscores.
                        </p>
                      )}
                      {zoneIdTaken && (
                        <p className="mt-1 text-2xs text-status-error">
                          Zone "{trimmedZoneId}" already exists.
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-text-primary">
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
                      className="accent-accent"
                    />
                    Add to existing zone
                  </label>
                  {target === "existing" && (
                    <div className="ml-6">
                      {zoneList.length === 0 ? (
                        <p className="text-2xs text-text-muted">
                          No zones loaded.
                        </p>
                      ) : (
                        <select
                          value={existingZoneId}
                          onChange={(e) => setExistingZoneId(e.target.value)}
                          className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
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
              </div>

              {/* Start room (new zone only) */}
              {target === "new" && parseResult.rooms.length > 1 && (
                <div>
                  <h3 className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
                    Start Room
                  </h3>
                  <select
                    value={startRoomId}
                    onChange={(e) => setStartRoomId(e.target.value)}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                  >
                    {parseResult.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {editedLabels[r.id] || r.label || r.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10">
            <div className="text-lg text-status-success">&#10003;</div>
            <p className="text-sm text-text-secondary">
              {target === "new"
                ? `Zone "${trimmedZoneId}" created with ${parseResult?.rooms.length ?? 0} rooms`
                : `${parseResult?.rooms.length ?? 0} rooms added to "${existingZoneId}"`}
            </p>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10">
            <div className="text-lg text-status-error">&#10007;</div>
            <p className="max-w-sm text-center text-xs text-status-error">
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-default px-5 py-3">
          {step === "input" && (
            <button
              onClick={onClose}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
          )}

          {step === "draw" && (
            <button
              onClick={() => setStep("input")}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Back
            </button>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("input")}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={
                  (target === "new" && (!zoneIdValid || zoneIdTaken)) ||
                  (target === "existing" && !existingZoneId)
                }
                className="action-button action-button-primary action-button-md focus-ring"
              >
                Import
              </button>
            </>
          )}

          {step === "done" && (
            <button
              onClick={onClose}
              className="action-button action-button-primary action-button-md focus-ring"
            >
              Close
            </button>
          )}

          {step === "error" && (
            <>
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
