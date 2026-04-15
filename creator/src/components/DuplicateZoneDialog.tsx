import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { duplicateZone } from "@/lib/duplicateZone";
import { zoneFilePath } from "@/lib/projectPaths";
import { YAML_OPTS } from "@/lib/yamlOpts";

interface DuplicateZoneDialogProps {
  zoneId: string;
  onClose: () => void;
  /** Optional: override the initial new-id value (e.g. after a retheme flow). */
  initialNewId?: string;
}

export function DuplicateZoneDialog({ zoneId, onClose, initialNewId }: DuplicateZoneDialogProps) {
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const zones = useZoneStore((s) => s.zones);
  const loadZone = useZoneStore((s) => s.loadZone);

  const existing = zones.get(zoneId);
  const defaultNewId = initialNewId ?? `${zoneId}_copy`;

  const [newId, setNewId] = useState(defaultNewId);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const trimmedId = newId.trim().toLowerCase().replace(/\s+/g, "_");
  const idValid = /^[a-z][a-z0-9_]*$/.test(trimmedId);
  const idUnchanged = trimmedId === zoneId;
  const idTaken = !idUnchanged && zones.has(trimmedId);

  const handleDuplicate = async () => {
    if (!project || !existing || !idValid || idTaken || idUnchanged) return;

    setDuplicating(true);
    setError(null);

    try {
      const cloned = duplicateZone(existing.data, trimmedId);

      if (project.format === "standalone") {
        await invoke("create_zone_directory", {
          projectDir: project.mudDir,
          zoneId: trimmedId,
        });
      }

      const filePath = zoneFilePath(project, trimmedId);
      const yaml = stringify(cloned, YAML_OPTS);
      await writeTextFile(filePath, yaml);

      loadZone(trimmedId, filePath, cloned);
      openTab({ id: `zone:${trimmedId}`, kind: "zone", label: trimmedId });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-zone-dialog-title"
        className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="duplicate-zone-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            Duplicate Zone
          </h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Source
            </label>
            <div className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs leading-8 text-text-muted">
              {zoneId}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              New ID
            </label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. dark_forest"
              autoFocus
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {newId && !idValid && (
              <span role="alert" className="mt-1 block text-2xs text-status-error">
                Must start with a letter, only lowercase letters, numbers, and underscores.
              </span>
            )}
            {idTaken && (
              <span role="alert" className="mt-1 block text-2xs text-status-error">
                Zone "{trimmedId}" already exists.
              </span>
            )}
          </div>

          <p className="rounded border border-border-default bg-bg-primary px-3 py-2 text-2xs leading-relaxed text-text-secondary">
            Creates a full copy including rooms, mobs, items, quests, and art references.
            Cross-zone exit targets are not updated — review them after duplication.
          </p>

          {error && <p className="text-xs text-status-error">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={!idValid || idTaken || idUnchanged || duplicating || !project || !existing}
            className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {duplicating ? "Duplicating..." : "Duplicate Zone"}
          </button>
        </div>
      </div>
    </div>
  );
}
