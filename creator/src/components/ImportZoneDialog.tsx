import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument } from "yaml";
import { stringify } from "yaml";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { zoneFilePath } from "@/lib/projectPaths";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DialogShell, ActionButton, Spinner } from "./ui/FormWidgets";
import { normalizeExitDirections } from "@/lib/zoneEdits";
import type { WorldFile } from "@/types/world";
import { YAML_OPTS } from "@/lib/yamlOpts";

const ZONE_ID_RE = /^[a-z][a-z0-9_]*$/;

// ─── Types ──────────────────────────────────────────────────────────

interface ParsedZone {
  /** Original file path on disk. */
  filePath: string;
  /** File name for display. */
  fileName: string;
  /** Zone ID extracted from the YAML `zone` field. */
  zoneId: string;
  /** The parsed WorldFile data. */
  data: WorldFile;
  /** Room count for display. */
  roomCount: number;
  /** Whether a zone with this ID already exists. */
  collision: boolean;
  /** Error message if file failed to parse. */
  error?: string;
}

type ConflictStrategy = "skip" | "rename" | "overwrite";

interface ImportResult {
  zoneId: string;
  status: "imported" | "skipped" | "renamed" | "overwritten" | "error";
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function findFreeZoneId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

function sanitizeZoneId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned || !/^[a-z]/.test(cleaned)) return `zone_${cleaned || "import"}`;
  return cleaned;
}

// ─── Component ──────────────────────────────────────────────────────

export function ImportZoneDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const loadZone = useZoneStore((s) => s.loadZone);
  const zones = useZoneStore((s) => s.zones);

  const [step, setStep] = useState<"select" | "review" | "importing" | "done">("select");
  const [parsed, setParsed] = useState<ParsedZone[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("rename");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [selectError, setSelectError] = useState<string | null>(null);

  // ── Step 1: pick files ──────────────────────────────────────────

  const handlePickFiles = useCallback(async () => {
    setSelectError(null);
    const selected = await open({
      multiple: true,
      filters: [
        { name: "Zone YAML", extensions: ["yaml", "yml"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!selected) return;

    const paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;

    const existingIds = new Set(zones.keys());
    const results: ParsedZone[] = [];

    for (const filePath of paths) {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
      try {
        const content = await readTextFile(filePath);
        const doc = parseDocument(content);
        const data = doc.toJS() as WorldFile;

        if (!data.zone || !data.rooms) {
          results.push({
            filePath,
            fileName,
            zoneId: "",
            data: data as WorldFile,
            roomCount: 0,
            collision: false,
            error: "Not a valid zone file (missing 'zone' or 'rooms' field)",
          });
          continue;
        }

        const zoneId = ZONE_ID_RE.test(data.zone)
          ? data.zone
          : sanitizeZoneId(data.zone);

        results.push({
          filePath,
          fileName,
          zoneId,
          data,
          roomCount: Object.keys(data.rooms).length,
          collision: existingIds.has(zoneId),
        });
      } catch (err) {
        results.push({
          filePath,
          fileName,
          zoneId: "",
          data: {} as WorldFile,
          roomCount: 0,
          collision: false,
          error: `Parse error: ${String(err)}`,
        });
      }
    }

    if (results.length === 0) {
      setSelectError("No files selected.");
      return;
    }

    setParsed(results);
    setStep("review");
  }, [zones]);

  // ── Step 3: import ─────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!project) return;
    setStep("importing");

    const existingIds = new Set(zones.keys());
    const importResults: ImportResult[] = [];

    for (const entry of parsed) {
      if (entry.error) {
        importResults.push({
          zoneId: entry.zoneId || entry.fileName,
          status: "error",
          message: entry.error,
        });
        continue;
      }

      let finalId = entry.zoneId;

      if (entry.collision) {
        switch (conflictStrategy) {
          case "skip":
            importResults.push({
              zoneId: finalId,
              status: "skipped",
              message: "Zone already exists, skipped.",
            });
            continue;

          case "rename":
            finalId = findFreeZoneId(finalId, existingIds);
            break;

          case "overwrite":
            // Will overwrite the file on disk and reload in store
            break;
        }
      }

      try {
        // Update the zone field in the data to match the final ID
        const data: WorldFile = normalizeExitDirections({ ...entry.data, zone: finalId });

        // Create zone directory for standalone projects
        if (project.format === "standalone") {
          await invoke("create_zone_directory", {
            projectDir: project.mudDir,
            zoneId: finalId,
          });
        }

        const filePath = zoneFilePath(project, finalId);
        const yaml = stringify(data, YAML_OPTS);
        await writeTextFile(filePath, yaml);
        loadZone(finalId, filePath, data);
        existingIds.add(finalId);

        importResults.push({
          zoneId: finalId,
          status: entry.collision
            ? conflictStrategy === "rename"
              ? "renamed"
              : "overwritten"
            : "imported",
          message: entry.collision && conflictStrategy === "rename"
            ? `Imported as "${finalId}" (renamed from "${entry.zoneId}").`
            : `Imported with ${Object.keys(data.rooms).length} rooms.`,
        });
      } catch (err) {
        importResults.push({
          zoneId: finalId,
          status: "error",
          message: String(err),
        });
      }
    }

    setResults(importResults);
    setStep("done");
  }, [project, parsed, conflictStrategy, zones, loadZone]);

  // ── Open imported zones ────────────────────────────────────────

  const handleOpenAll = useCallback(() => {
    for (const r of results) {
      if (r.status === "imported" || r.status === "renamed" || r.status === "overwritten") {
        openTab({ id: `zone:${r.zoneId}`, kind: "zone", label: r.zoneId });
      }
    }
    onClose();
  }, [results, openTab, onClose]);

  // ── Counts ────────────────────────────────────────────────────

  const validCount = parsed.filter((p) => !p.error).length;
  const collisionCount = parsed.filter((p) => p.collision && !p.error).length;
  const successCount = results.filter(
    (r) => r.status === "imported" || r.status === "renamed" || r.status === "overwritten",
  ).length;

  // ── Render ────────────────────────────────────────────────────

  return (
    <DialogShell
      dialogRef={dialogRef}
      titleId="import-zone-title"
      title="Import Zones"
      subtitle="Import AmbonMUD zone YAML files into this project"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          {step === "select" && (
            <ActionButton variant="primary" onClick={handlePickFiles}>
              Choose files...
            </ActionButton>
          )}
          {step === "review" && (
            <>
              <ActionButton variant="ghost" onClick={() => { setParsed([]); setStep("select"); }}>
                Back
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={handleImport}
                disabled={validCount === 0}
              >
                Import {validCount} zone{validCount === 1 ? "" : "s"}
              </ActionButton>
            </>
          )}
          {step === "done" && (
            <>
              {successCount > 0 && (
                <ActionButton variant="secondary" onClick={handleOpenAll}>
                  Open imported zone{successCount === 1 ? "" : "s"}
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={onClose}>
                Done
              </ActionButton>
            </>
          )}
        </div>
      }
    >
      {/* ── Step: Select ──────────────────────────────────────────── */}
      {step === "select" && (
        <div className="px-1 py-4 text-center">
          <p className="text-sm text-text-secondary leading-relaxed">
            Select one or more AmbonMUD zone <code className="font-mono text-accent">.yaml</code> files to import into your project.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            Each file must contain a top-level <code className="font-mono">zone</code> and <code className="font-mono">rooms</code> field.
          </p>
          {selectError && (
            <p className="mt-3 text-sm text-status-error">{selectError}</p>
          )}
        </div>
      )}

      {/* ── Step: Review ──────────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-4">
          {/* File list */}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {parsed.map((entry, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  entry.error
                    ? "border-status-error/30 bg-status-error/5"
                    : entry.collision
                      ? "border-status-warning/30 bg-status-warning/5"
                      : "border-border-default bg-bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-text-primary">{entry.fileName}</span>
                  {entry.error ? (
                    <span className="text-2xs text-status-error">Invalid</span>
                  ) : entry.collision ? (
                    <span className="text-2xs text-status-warning">Exists</span>
                  ) : (
                    <span className="text-2xs text-status-success">Ready</span>
                  )}
                </div>
                {entry.error ? (
                  <p className="mt-1 text-xs text-status-error">{entry.error}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-text-muted">
                    Zone: <span className="text-text-secondary">{entry.zoneId}</span>
                    {" \u00b7 "}
                    {entry.roomCount} room{entry.roomCount === 1 ? "" : "s"}
                    {entry.data.mobs ? ` \u00b7 ${Object.keys(entry.data.mobs).length} mobs` : ""}
                    {entry.data.items ? ` \u00b7 ${Object.keys(entry.data.items).length} items` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {/* Conflict strategy */}
          {collisionCount > 0 && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2.5">
              <p className="mb-2 text-xs font-medium text-status-warning">
                {collisionCount} zone{collisionCount === 1 ? "" : "s"} already exist{collisionCount === 1 ? "s" : ""} in this project:
              </p>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 text-text-secondary">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictStrategy === "rename"}
                    onChange={() => setConflictStrategy("rename")}
                    className="accent-accent"
                  />
                  Rename duplicates
                </label>
                <label className="flex items-center gap-1.5 text-text-secondary">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictStrategy === "skip"}
                    onChange={() => setConflictStrategy("skip")}
                    className="accent-accent"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-1.5 text-text-secondary">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictStrategy === "overwrite"}
                    onChange={() => setConflictStrategy("overwrite")}
                    className="accent-accent"
                  />
                  Overwrite
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Importing ───────────────────────────────────────── */}
      {step === "importing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner className="h-5 w-5" />
          <p className="text-sm text-text-secondary">Importing zones...</p>
        </div>
      )}

      {/* ── Step: Done ────────────────────────────────────────────── */}
      {step === "done" && (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${
                r.status === "error"
                  ? "border-status-error/30 bg-status-error/5"
                  : r.status === "skipped"
                    ? "border-border-default bg-bg-secondary"
                    : "border-status-success/30 bg-status-success/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-text-primary">{r.zoneId}</span>
                <span
                  className={`text-2xs ${
                    r.status === "error"
                      ? "text-status-error"
                      : r.status === "skipped"
                        ? "text-text-muted"
                        : "text-status-success"
                  }`}
                >
                  {r.status === "imported" ? "Imported" :
                   r.status === "renamed" ? "Renamed" :
                   r.status === "overwritten" ? "Overwritten" :
                   r.status === "skipped" ? "Skipped" : "Error"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </DialogShell>
  );
}
