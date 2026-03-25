import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImportFromR2, type ImportStage } from "@/lib/useImportFromR2";
import { useFocusTrap } from "@/lib/useFocusTrap";

const STAGE_LABELS: Record<ImportStage, string> = {
  idle: "",
  fetching: "Fetching data from R2...",
  creating_project: "Creating project...",
  writing_data: "Writing config & zones...",
  done: "Import complete!",
  error: "Import failed — check your R2 credentials in Settings",
};

interface ImportFromR2DialogProps {
  onClose: () => void;
}

export function ImportFromR2Dialog({ onClose }: ImportFromR2DialogProps) {
  const [projectName, setProjectName] = useState("Ambon");
  const [targetDir, setTargetDir] = useState("");
  const { stage, error, zoneCount, importFromR2, reset } = useImportFromR2();

  const busy = stage !== "idle" && stage !== "done" && stage !== "error";

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setTargetDir(selected as string);
  };

  const handleImport = async () => {
    if (!targetDir || !projectName.trim()) return;
    await importFromR2(targetDir, projectName.trim());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const trapRef = useFocusTrap<HTMLDivElement>(handleClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="r2-import-title" className="mx-4 w-full max-w-[420px] rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl">
        <h2 id="r2-import-title" className="mb-4 font-display text-lg font-semibold tracking-wide text-accent-emphasis">
          Import from R2
        </h2>
        <p className="mb-4 text-xs text-text-secondary">
          Fetch the deployed config and zone files from R2 and create a new
          standalone project.
        </p>

        {/* Project name */}
        <label className="mb-1 block text-2xs uppercase tracking-widest text-text-muted">
          Project Name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          disabled={busy || stage === "done"}
          className="mb-3 w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
        />

        {/* Target directory */}
        <label className="mb-1 block text-2xs uppercase tracking-widest text-text-muted">
          Create In
        </label>
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={targetDir}
            readOnly
            placeholder="Select a directory..."
            className="flex-1 rounded border border-border-default bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none"
          />
          <button
            onClick={handlePickDir}
            disabled={busy || stage === "done"}
            className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
          >
            Browse
          </button>
        </div>

        {/* Status */}
        {stage !== "idle" && (
          <div className="mb-4 rounded border border-border-default bg-bg-primary px-3 py-2">
            <p className={`text-xs ${stage === "error" ? "text-status-error" : stage === "done" ? "text-status-success" : "text-text-secondary"}`}>
              {STAGE_LABELS[stage]}
            </p>
            {stage === "done" && (
              <p className="mt-1 text-2xs text-text-muted">
                Imported {zoneCount} zone{zoneCount !== 1 ? "s" : ""} with config.
              </p>
            )}
            {error && (
              <p className="mt-1 text-2xs text-status-error">{error}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded px-4 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            {stage === "done" ? "Close" : "Cancel"}
          </button>
          {stage !== "done" && (
            <button
              onClick={handleImport}
              disabled={busy || !targetDir || !projectName.trim()}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 font-display text-xs font-medium tracking-wide text-accent-emphasis transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
