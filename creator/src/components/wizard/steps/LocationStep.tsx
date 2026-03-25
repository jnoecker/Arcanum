import { open } from "@tauri-apps/plugin-dialog";
import type { WizardData } from "@/lib/useProjectWizard";

interface LocationStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
  nameError: string | null;
}

export function LocationStep({ data, onChange, nameError }: LocationStepProps) {
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
        <label className="mb-1 block text-xs text-text-muted">
          Project Name
        </label>
        <input
          type="text"
          value={data.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
          placeholder="my_mud_world"
          className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">
          Parent Directory
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={data.parentDir}
            readOnly
            placeholder="Select a directory..."
            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted"
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
        <p className="text-2xs text-text-muted">
          Project will be created at:{" "}
          <code className="font-mono text-text-secondary">{fullPath}</code>
        </p>
      )}
      {nameError && (
        <p className="text-2xs text-status-error">{nameError}</p>
      )}
    </div>
  );
}
