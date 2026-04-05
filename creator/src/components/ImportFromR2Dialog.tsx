import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImportFromR2, type ImportStage } from "@/lib/useImportFromR2";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";

const STAGE_LABELS: Record<ImportStage, string> = {
  idle: "",
  fetching: "Gathering the published world from R2...",
  creating_project: "Preparing the new world workspace...",
  writing_data: "Writing canon, config, and zones...",
  done: "Import complete!",
  error: "Import failed. Check your R2 credentials in API Settings.",
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
    <DialogShell
      dialogRef={trapRef}
      titleId="r2-import-title"
      title="Import A Published World"
      subtitle="Bring the deployed canon, config, and zone files back into Creator and establish a new standalone workspace."
      widthClassName="max-w-xl"
      onClose={handleClose}
      footer={
        <>
          <ActionButton onClick={handleClose} variant="ghost">
            {stage === "done" ? "Close" : "Cancel"}
          </ActionButton>
          {stage !== "done" && (
            <ActionButton
              onClick={handleImport}
              disabled={busy || !targetDir || !projectName.trim()}
              variant="primary"
            >
              {busy && <Spinner />}
              {busy ? "Importing World" : "Import World"}
            </ActionButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="panel-surface-light rounded-3xl p-4">
          <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Import destination</p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="r2-project-name" className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                Project Name
              </label>
              <input
                id="r2-project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={busy || stage === "done"}
                className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="r2-create-in" className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                Create In
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="r2-create-in"
                  type="text"
                  value={targetDir}
                  readOnly
                  placeholder="Choose the parent directory for the imported world"
                  className="ornate-input min-h-11 min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm"
                />
                <ActionButton
                  onClick={handlePickDir}
                  disabled={busy || stage === "done"}
                  variant="secondary"
                  className="sm:self-start"
                >
                  Choose Folder
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        {stage !== "idle" && (
          <div className="panel-surface-light rounded-3xl p-4">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Transit status</p>
            <p className={`mt-3 text-sm ${stage === "error" ? "text-status-error" : stage === "done" ? "text-status-success" : "text-text-secondary"}`}>
              {STAGE_LABELS[stage]}
            </p>
            {stage === "done" && (
              <p className="mt-2 text-xs text-text-muted">
                Imported {zoneCount} zone{zoneCount !== 1 ? "s" : ""} and the project config into the new workspace.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs text-status-error">{error}</p>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
