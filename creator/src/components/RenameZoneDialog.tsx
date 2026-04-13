import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { saveZone } from "@/lib/saveZone";

interface RenameZoneDialogProps {
  zoneId: string;
  onClose: () => void;
}

export function RenameZoneDialog({ zoneId, onClose }: RenameZoneDialogProps) {
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const closeTab = useProjectStore((s) => s.closeTab);
  const zones = useZoneStore((s) => s.zones);
  const renameZoneInStore = useZoneStore((s) => s.renameZone);

  const existing = zones.get(zoneId);

  const [newId, setNewId] = useState(zoneId);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const trimmedId = newId.trim().toLowerCase().replace(/\s+/g, "_");
  const idValid = /^[a-z][a-z0-9_]*$/.test(trimmedId);
  const idUnchanged = trimmedId === zoneId;
  const idTaken = !idUnchanged && zones.has(trimmedId);

  const handleRename = async () => {
    if (!project || !existing || !idValid || idTaken || idUnchanged) return;

    setRenaming(true);
    setError(null);

    try {
      // 1. Rename on disk. Backend returns the new absolute file path.
      const newFilePath = await invoke<string>("rename_zone", {
        projectDir: project.mudDir,
        projectFormat: project.format,
        oldId: zoneId,
        newId: trimmedId,
        oldFilePath: existing.filePath,
      });

      // 2. Re-key the in-memory zone. This also updates `data.zone` and marks
      // the zone dirty so the next save rewrites the file with the new id.
      renameZoneInStore(zoneId, trimmedId, newFilePath);

      // 3. Immediately persist so the file on disk matches the store and the
      // dirty flag clears. Without this, users would have to Ctrl+S to get
      // the internal `zone:` field rewritten.
      try {
        await saveZone(trimmedId);
      } catch (saveErr) {
        console.error("Failed to save renamed zone:", saveErr);
      }

      // 4. Re-point the open tab (if any) to the new id.
      closeTab(`zone:${zoneId}`);
      openTab({ id: `zone:${trimmedId}`, kind: "zone", label: trimmedId });

      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="rename-zone-dialog-title" className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="rename-zone-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            Rename Zone
          </h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Current ID
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
              aria-describedby={
                (newId && !idValid) ? "rename-zone-format-error" :
                idTaken ? "rename-zone-taken-error" :
                undefined
              }
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {newId && !idValid && (
              <span role="alert" id="rename-zone-format-error" className="mt-1 block text-2xs text-status-error">
                Must start with a letter, only lowercase letters, numbers, and underscores.
              </span>
            )}
            {idTaken && (
              <span role="alert" id="rename-zone-taken-error" className="mt-1 block text-2xs text-status-error">
                Zone "{trimmedId}" already exists.
              </span>
            )}
          </div>

          <p className="rounded border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-2xs leading-relaxed text-status-warning">
            Cross-zone references (portal exits, quest links, etc.) that point
            at <span className="font-mono">{zoneId}</span> will <strong>not</strong> be
            updated automatically. Review and fix them after renaming.
          </p>

          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={!idValid || idTaken || idUnchanged || renaming || !project || !existing}
            className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {renaming ? "Renaming..." : "Rename Zone"}
          </button>
        </div>
      </div>
    </div>
  );
}
