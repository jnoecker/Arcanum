import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { TEMPLATES, type ProjectTemplate } from "@/lib/templates";
import { useNewProject, type WizardStage } from "@/lib/useNewProject";

interface NewProjectWizardProps {
  onClose: () => void;
}

const PROJECT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const STAGE_LABELS: Record<WizardStage, string> = {
  idle: "",
  creating_structure: "Creating project...",
  setting_up: "Setting up project...",
  done: "Done!",
  error: "Error",
};

export function NewProjectWizard({ onClose }: NewProjectWizardProps) {
  // Step 1 state
  const [projectName, setProjectName] = useState("");
  const [parentDir, setParentDir] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Step 2 state
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>(
    TEMPLATES[0]!,
  );
  const [telnetPort, setTelnetPort] = useState(4000);
  const [webPort, setWebPort] = useState(8080);

  // Wizard navigation
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { stage, error, create, reset } = useNewProject();

  const fullPath =
    parentDir && projectName ? `${parentDir}/${projectName}` : "";

  const validateName = (name: string) => {
    if (!name) return "Project name is required";
    if (!PROJECT_NAME_RE.test(name))
      return "Must start with a letter, use only letters, digits, hyphens, underscores";
    return null;
  };

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setParentDir(selected as string);
  };

  const handleNext1 = () => {
    const err = validateName(projectName);
    if (err) {
      setNameError(err);
      return;
    }
    if (!parentDir) {
      setNameError("Select a parent directory");
      return;
    }
    setNameError(null);
    setStep(2);
  };

  const handleCreate = async () => {
    setStep(3);
    await create(parentDir, projectName, selectedTemplate, {
      telnet: telnetPort,
      web: webPort,
    });
  };

  const handleDone = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-accent-emphasis">
            Create New Project
          </h2>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {step === 1 && "Step 1 of 2: Location"}
            {step === 2 && "Step 2 of 2: Template & Ports"}
            {step === 3 && "Creating project..."}
          </p>
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="px-5 py-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setNameError(null);
                  }}
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
                    value={parentDir}
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
                <p className="text-[10px] text-text-muted">
                  Project will be created at:{" "}
                  <code className="font-mono text-text-secondary">
                    {fullPath}
                  </code>
                </p>
              )}
              {nameError && (
                <p className="text-[10px] text-status-error">{nameError}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Template & Ports */}
        {step === 2 && (
          <div className="px-5 py-4">
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">
                  Template
                </label>
                <div className="flex flex-col gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`rounded border px-3 py-2 text-left transition-colors ${
                        selectedTemplate.id === t.id
                          ? "border-accent bg-accent/10"
                          : "border-border-default bg-bg-primary hover:border-border-hover"
                      }`}
                    >
                      <div className="text-xs font-medium text-text-primary">
                        {t.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-text-muted">
                        {t.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-text-muted">
                    Telnet Port
                  </label>
                  <input
                    type="number"
                    value={telnetPort}
                    onChange={(e) => setTelnetPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-text-muted">
                    Web Port
                  </label>
                  <input
                    type="number"
                    value={webPort}
                    onChange={(e) => setWebPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                    className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Progress */}
        {step === 3 && (
          <div className="px-5 py-6">
            <div className="flex flex-col items-center gap-3">
              {stage !== "error" && stage !== "done" && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              )}
              {stage === "done" && (
                <div className="text-lg text-status-success">&#10003;</div>
              )}
              {stage === "error" && (
                <div className="text-lg text-status-error">&#10007;</div>
              )}
              <p className="text-sm text-text-secondary">
                {STAGE_LABELS[stage]}
              </p>
              {error && (
                <p className="max-w-sm text-center text-xs text-status-error">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleNext1}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
              >
                Next
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
              >
                Create Project
              </button>
            </>
          )}
          {step === 3 && stage === "done" && (
            <button
              onClick={handleDone}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
            >
              Close
            </button>
          )}
          {step === 3 && stage === "error" && (
            <>
              <button
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  reset();
                  setStep(1);
                }}
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
