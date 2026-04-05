import { useState, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { stringify } from "yaml";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { zoneFilePath } from "@/lib/projectPaths";
import {
  detectMudFiles,
  chunkMudFile,
  convertChunk,
  parseZoneResets,
  parseZoneHeader,
  applyZoneResets,
  assembleWorldFile,
  estimateChunks,
  type MudFileInfo,
  type MudFileType,
  type ConversionChunk,
  type ChunkResult,
} from "@/lib/mudImport";

// ─── Types ────────────────────���────────────────────────────────────

type WizardStep = "select" | "configure" | "converting" | "review";

const FILE_TYPE_LABELS: Record<MudFileType, string> = {
  wld: "Rooms (.wld)",
  mob: "Mobiles (.mob)",
  obj: "Objects (.obj)",
  zon: "Zone Resets (.zon)",
  shp: "Shops (.shp)",
};

const YAML_OPTS = { lineWidth: 120, defaultStringType: "PLAIN" as const };

// ─── Component ─────────────────────────────────────────────────────

export function MudImportWizard({ onClose }: { onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);
  const project = useProjectStore((s) => s.project);
  const loadZone = useZoneStore((s) => s.loadZone);

  // Step state
  const [step, setStep] = useState<WizardStep>("select");

  // Step 1: file selection
  const [files, setFiles] = useState<(MudFileInfo & { checked: boolean })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  // Step 2: configuration
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");

  // Step 3: conversion progress
  const [chunkResults, setChunkResults] = useState<ChunkResult[]>([]);
  const [converting, setConverting] = useState(false);
  const [conversionLog, setConversionLog] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Step 4: review
  const [importResult, setImportResult] = useState<{
    yaml: string;
    warnings: string[];
    stats: { rooms: number; mobs: number; items: number; shops: number };
  } | null>(null);
  const [imported, setImported] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // ─── Step 1: Scan ─────────────���─────────────────────────────────

  const handleSelectFolder = useCallback(async () => {
    const dir = await open({ directory: true, title: "Select MUD zone folder" });
    if (!dir) return;

    setScanning(true);
    setScanError(null);
    setFiles([]);
    setSelectedDir(dir);

    try {
      const detected = await detectMudFiles(dir);
      if (detected.length === 0) {
        setScanError("No MUD zone files (.are, .wld, .mob, .obj, .zon, .shp) found in this folder.");
      } else {
        setFiles(detected.map((f) => ({ ...f, checked: true })));

        // Auto-derive zone ID/name from .zon file if present
        const zonFile = detected.find((f) => f.type === "zon");
        if (zonFile) {
          const header = parseZoneHeader(zonFile.content);
          setZoneId(sanitizeZoneId(header.zoneName || header.zoneId));
          setZoneName(header.zoneName || `Zone ${header.zoneId}`);
        } else {
          // Derive from folder name
          const folderName = dir.split(/[/\\]/).pop() ?? "imported_zone";
          setZoneId(sanitizeZoneId(folderName));
          setZoneName(folderName);
        }
      }
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleFile = useCallback((index: number) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f)));
  }, []);

  // ─── Step 3: Convert ─────────────────���──────────────────────────

  const handleConvert = useCallback(async () => {
    const checkedFiles = files.filter((f) => f.checked);
    if (checkedFiles.length === 0) return;

    setStep("converting");
    setConverting(true);
    setConversionLog([]);
    abortRef.current = false;

    // Build all chunks (except .zon which is parsed deterministically)
    const allChunks: ConversionChunk[] = [];
    for (const file of checkedFiles) {
      if (file.type === "zon") continue; // handled separately
      const chunks = chunkMudFile(file.content, file.type);
      allChunks.push(...chunks);
    }

    const results: ChunkResult[] = allChunks.map((chunk) => ({
      chunk,
      status: "pending" as const,
    }));
    setChunkResults(results);

    // Process chunks sequentially
    const rooms: unknown[] = [];
    const mobs: unknown[] = [];
    const items: unknown[] = [];
    const shops: unknown[] = [];
    const allWarnings: string[] = [];

    for (let i = 0; i < allChunks.length; i++) {
      if (abortRef.current) break;

      const chunk = allChunks[i]!;

      // Mark as converting
      setChunkResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "converting" } : r)),
      );
      addLog(`Converting ${FILE_TYPE_LABELS[chunk.fileType]} chunk ${chunk.index + 1} (${chunk.recordCount} records)...`);

      try {
        const { data, warnings } = await convertChunk(chunk);
        allWarnings.push(...warnings);

        // Route data by type
        switch (chunk.fileType) {
          case "wld": rooms.push(...data); break;
          case "mob": mobs.push(...data); break;
          case "obj": items.push(...data); break;
          case "shp": shops.push(...data); break;
        }

        setChunkResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", data: data as ChunkResult["data"], warnings } : r)),
        );
        addLog(`  Done — ${data.length} entities converted${warnings.length ? `, ${warnings.length} warnings` : ""}`);
      } catch (err) {
        const errorMsg = String(err);
        setChunkResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", error: errorMsg } : r)),
        );
        addLog(`  Error: ${errorMsg}`);
        allWarnings.push(`Chunk ${chunk.fileType}[${chunk.index}] failed: ${errorMsg}`);
      }
    }

    // Apply zone resets (deterministic)
    const zonFile = checkedFiles.find((f) => f.type === "zon");
    const zonHeader = zonFile ? parseZoneHeader(zonFile.content) : null;
    const lifespan = zonHeader?.lifespan ?? 0;

    const worldFile = assembleWorldFile(
      zoneId,
      zoneName,
      lifespan,
      rooms as Parameters<typeof assembleWorldFile>[3],
      mobs as Parameters<typeof assembleWorldFile>[4],
      items as Parameters<typeof assembleWorldFile>[5],
      shops as Parameters<typeof assembleWorldFile>[6],
    );

    if (zonFile) {
      addLog("Applying zone resets...");
      const resets = parseZoneResets(zonFile.content);
      const resetWarnings = applyZoneResets(worldFile, resets);
      allWarnings.push(...resetWarnings);
      if (resets.length > 0) {
        addLog(`  Applied ${resets.length} zone resets`);
      }
    }

    // Set startRoom to first room if not already set
    if (!worldFile.startRoom && Object.keys(worldFile.rooms).length > 0) {
      worldFile.startRoom = Object.keys(worldFile.rooms)[0] ?? "";
    }

    const yaml = stringify(worldFile, YAML_OPTS);
    const stats = {
      rooms: Object.keys(worldFile.rooms).length,
      mobs: Object.keys(worldFile.mobs ?? {}).length,
      items: Object.keys(worldFile.items ?? {}).length,
      shops: Object.keys(worldFile.shops ?? {}).length,
    };

    setImportResult({ yaml, warnings: allWarnings, stats });
    setConverting(false);
    addLog(`\nConversion complete: ${stats.rooms} rooms, ${stats.mobs} mobs, ${stats.items} items, ${stats.shops} shops`);

    // Auto-advance to review
    setStep("review");
  }, [files, zoneId, zoneName]);

  function addLog(msg: string) {
    setConversionLog((prev) => [...prev, msg]);
  }

  // ─── Step 4: Import ─────────────────────��───────────────────────

  const handleImport = useCallback(async () => {
    if (!project || !importResult) return;

    try {
      // Create zone directory (standalone format)
      if (project.format === "standalone") {
        await invoke("create_zone_directory", {
          projectDir: project.mudDir,
          zoneId,
        });
      }

      // Write YAML
      const filePath = zoneFilePath(project, zoneId);
      await writeTextFile(filePath, importResult.yaml);

      // Register in zone store
      const worldFile = JSON.parse(JSON.stringify(
        // Re-parse from YAML to get clean data
        (await import("yaml")).parse(importResult.yaml),
      ));
      loadZone(zoneId, filePath, worldFile);

      setImported(true);
    } catch (err) {
      setImportError(String(err));
    }
  }, [project, importResult, zoneId, loadZone]);

  // ─── Retry Failed Chunk ──────────────────────���──────────────────

  const retryChunk = useCallback(async (idx: number) => {
    const result = chunkResults[idx];
    if (!result || result.status !== "error") return;

    setChunkResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "converting", error: undefined } : r)),
    );

    try {
      const { data, warnings } = await convertChunk(result.chunk);
      setChunkResults((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "done", data: data as ChunkResult["data"], warnings } : r)),
      );
    } catch (err) {
      setChunkResults((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "error", error: String(err) } : r)),
      );
    }
  }, [chunkResults]);

  // ─── Computed state ──────────────────────────────────────────────

  const checkedFiles = files.filter((f) => f.checked);
  const hasWld = checkedFiles.some((f) => f.type === "wld");
  const chunkEstimate = checkedFiles.length > 0 ? estimateChunks(checkedFiles) : null;

  const doneChunks = chunkResults.filter((r) => r.status === "done").length;
  const errorChunks = chunkResults.filter((r) => r.status === "error").length;
  const totalChunks = chunkResults.length;

  // ─── Render ──────────────────────────��──────────────────────────

  const stepLabel =
    step === "select" ? "1 / 4" :
    step === "configure" ? "2 / 4" :
    step === "converting" ? "3 / 4" :
    "4 / 4";

  return (
    <DialogShell
      dialogRef={dialogRef}
      titleId="mud-import-title"
      title="Import MUD Zone"
      subtitle="Convert DikuMUD / CircleMUD / ROM / SMAUG area files to Ambon format using AI"
      status={<span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-2xs text-text-secondary">Step {stepLabel}</span>}
      widthClassName="max-w-3xl"
      onClose={converting ? undefined : onClose}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {step === "configure" && chunkEstimate && (
              <span>{chunkEstimate.total} chunks to process ({checkedFiles.length} files)</span>
            )}
            {step === "converting" && (
              <span>{doneChunks + errorChunks} / {totalChunks} chunks{errorChunks > 0 ? ` (${errorChunks} errors)` : ""}</span>
            )}
          </div>
          <div className="flex gap-2">
            {step === "select" && (
              <>
                <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
                <ActionButton
                  variant="primary"
                  onClick={() => setStep("configure")}
                  disabled={!hasWld}
                >
                  Next
                </ActionButton>
              </>
            )}
            {step === "configure" && (
              <>
                <ActionButton variant="ghost" onClick={() => setStep("select")}>Back</ActionButton>
                <ActionButton
                  variant="primary"
                  onClick={handleConvert}
                  disabled={!zoneId.trim() || !hasWld}
                >
                  Start Conversion
                </ActionButton>
              </>
            )}
            {step === "converting" && (
              <ActionButton
                variant="ghost"
                onClick={() => {
                  abortRef.current = true;
                  if (!converting) setStep("review");
                }}
              >
                {converting ? "Abort" : "Continue to Review"}
              </ActionButton>
            )}
            {step === "review" && (
              <>
                <ActionButton variant="ghost" onClick={onClose}>
                  {imported ? "Close" : "Cancel"}
                </ActionButton>
                {!imported && (
                  <ActionButton
                    variant="primary"
                    onClick={handleImport}
                    disabled={!importResult || importResult.stats.rooms === 0}
                  >
                    Import Zone
                  </ActionButton>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Step 1: Select Files */}
      {step === "select" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActionButton variant="secondary" onClick={handleSelectFolder} disabled={scanning}>
              {scanning ? <><Spinner /> Scanning...</> : "Select Folder"}
            </ActionButton>
            {selectedDir && (
              <span className="truncate text-xs text-text-muted">{selectedDir}</span>
            )}
          </div>

          {scanError && (
            <p className="rounded-lg border border-status-error/20 bg-status-error/5 p-3 text-sm text-status-error">{scanError}</p>
          )}

          {files.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-secondary">Detected Files</p>
              {files.map((file, idx) => (
                <label
                  key={file.path}
                  className="flex items-center gap-3 rounded-lg border border-white/6 px-3 py-2 transition hover:border-white/12 hover:bg-white/3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={file.checked}
                    onChange={() => toggleFile(idx)}
                    className="accent-accent"
                  />
                  <span className="flex-1 text-sm text-text-primary">{file.filename}</span>
                  <span className="text-2xs text-text-muted">{FILE_TYPE_LABELS[file.type]}</span>
                  <span className="text-2xs text-text-muted">{formatSize(file.size)}</span>
                </label>
              ))}
            </div>
          )}

          {files.length > 0 && !hasWld && (
            <p className="text-xs text-status-warning">A rooms file (.wld or .are with #ROOMS section) is required for import.</p>
          )}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Zone ID</label>
            <input
              type="text"
              value={zoneId}
              onChange={(e) => setZoneId(sanitizeZoneId(e.target.value))}
              placeholder="e.g. midgaard"
              className="field-input w-full"
            />
            <p className="mt-1 text-2xs text-text-muted">Lowercase, no spaces. Used as the zone identifier in Ambon.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Zone Name</label>
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. The City of Midgaard"
              className="field-input w-full"
            />
          </div>

          {chunkEstimate && (
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="text-xs font-medium text-text-secondary">Conversion Plan</p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-text-muted">
                {(Object.entries(chunkEstimate.byType) as [MudFileType, number][])
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span>{FILE_TYPE_LABELS[type]}</span>
                      <span className="text-text-secondary">{count} chunk{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
              </div>
              <p className="mt-2 text-2xs text-text-muted">
                Total: {chunkEstimate.total} LLM calls. Each call processes a small batch of records.
              </p>
            </div>
          )}

          <p className="text-2xs text-text-muted">
            Conversion uses your configured LLM provider. Ensure an API key is set in Settings.
          </p>
        </div>
      )}

      {/* Step 3: Converting */}
      {step === "converting" && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-text-muted">
              <span>Progress</span>
              <span>{doneChunks + errorChunks} / {totalChunks}</span>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${totalChunks > 0 ? ((doneChunks + errorChunks) / totalChunks) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Chunk status grid */}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {chunkResults.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  r.status === "done" ? "bg-status-success" :
                  r.status === "error" ? "bg-status-error" :
                  r.status === "converting" ? "bg-status-warning animate-pulse" :
                  "bg-white/20"
                }`} />
                <span className="text-text-muted">
                  {FILE_TYPE_LABELS[r.chunk.fileType]} #{r.chunk.index + 1}
                </span>
                {r.status === "error" && (
                  <button
                    onClick={() => retryChunk(idx)}
                    className="ml-auto text-2xs text-accent hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Log */}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/6 bg-black/20 p-3 font-mono text-2xs text-text-muted">
            {conversionLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {converting && (
              <div className="flex items-center gap-1.5 text-accent">
                <Spinner /> Processing...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === "review" && importResult && (
        <div className="space-y-4">
          {imported ? (
            <div className="flex items-center gap-2 rounded-lg border border-status-success/20 bg-status-success/5 p-3 text-sm text-status-success">
              <span>✓</span>
              <span>Zone "{zoneId}" imported successfully. You can now edit it in the Zone Builder.</span>
            </div>
          ) : importError ? (
            <div className="rounded-lg border border-status-error/20 bg-status-error/5 p-3 text-sm text-status-error">
              Import failed: {importError}
            </div>
          ) : null}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {([["Rooms", importResult.stats.rooms], ["Mobs", importResult.stats.mobs], ["Items", importResult.stats.items], ["Shops", importResult.stats.shops]] as const).map(([label, count]) => (
              <div key={label} className="rounded-lg border border-white/8 bg-white/3 p-3 text-center">
                <div className="text-lg font-display text-text-primary">{count}</div>
                <div className="text-2xs text-text-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {importResult.warnings.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-status-warning hover:text-status-warning">
                {importResult.warnings.length} warning{importResult.warnings.length !== 1 ? "s" : ""} — click to expand
              </summary>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-white/6 bg-black/20 p-3 text-2xs text-text-muted space-y-0.5">
                {importResult.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </details>
          )}

          {/* YAML Preview */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-text-secondary hover:text-text-primary">
              Preview generated YAML
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/6 bg-black/20 p-3 font-mono text-2xs text-text-muted whitespace-pre-wrap">
              {importResult.yaml}
            </pre>
          </details>
        </div>
      )}
    </DialogShell>
  );
}

// ─── Helpers ──────────────────���───────────────────────────────────

function sanitizeZoneId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
