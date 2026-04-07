import { open } from "@tauri-apps/plugin-dialog";
import type { WizardData } from "@/lib/useProjectWizard";

interface LocationStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
  nameError: string | null;
}

export function LocationStep({ data, onChange, nameError }: LocationStepProps) {
  const projectNameId = "wizard-project-name";
  const projectNameErrorId = "wizard-project-name-error";
  const parentDirId = "wizard-parent-dir";
  const pathPreviewId = "wizard-project-path";
  const fullPath =
    data.parentDir && data.projectName
      ? `${data.parentDir}/${data.projectName}`
      : "";

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) onChange({ parentDir: selected as string });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={projectNameId} className="mb-1 block text-xs text-text-muted">
          Project Name
        </label>
        <input
          id={projectNameId}
          name="projectName"
          type="text"
          value={data.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
          placeholder="my_mud_world"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? projectNameErrorId : undefined}
          className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
      </div>
      <div>
        <label htmlFor={parentDirId} className="mb-1 block text-xs text-text-muted">
          Parent Directory
        </label>
        <div className="flex gap-2">
          <input
            id={parentDirId}
            name="parentDir"
            type="text"
            value={data.parentDir}
            readOnly
            placeholder="Select a directory..."
            aria-describedby={fullPath ? pathPreviewId : undefined}
            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <button
            onClick={handlePickDir}
            className="shrink-0 rounded border border-border-default bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            Browse...
          </button>
        </div>
      </div>
      {fullPath && (
        <p id={pathPreviewId} className="text-2xs text-text-muted">
          Project will be created at:{" "}
          <code className="font-mono text-text-secondary">{fullPath}</code>
        </p>
      )}
      {nameError && (
        <p id={projectNameErrorId} className="text-2xs text-status-error">{nameError}</p>
      )}
    </div>
  );
}
