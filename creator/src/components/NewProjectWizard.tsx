import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { TEMPLATES, type ProjectTemplate } from "@/lib/templates";
import { useNewProject, type WizardStage } from "@/lib/useNewProject";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";

interface NewProjectWizardProps {
  onClose: () => void;
}

const PROJECT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const STAGE_LABELS: Record<WizardStage, string> = {
  idle: "",
  creating_structure: "Carving the project structure...",
  setting_up: "Binding the template, ports, and starter files...",
  done: "The new world is ready.",
  error: "Project creation failed.",
};

export function NewProjectWizard({ onClose }: NewProjectWizardProps) {
  const [projectName, setProjectName] = useState("");
  const [parentDir, setParentDir] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>(TEMPLATES[0]!);
  const [telnetPort, setTelnetPort] = useState(4000);
  const [webPort, setWebPort] = useState(8080);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { stage, error, create, reset } = useNewProject();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const fullPath = parentDir && projectName ? `${parentDir}/${projectName}` : "";

  const validateName = (name: string) => {
    if (!name) return "Project name is required.";
    if (!PROJECT_NAME_RE.test(name)) {
      return "Use a leading letter, then letters, digits, hyphens, or underscores.";
    }
    return null;
  };

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setParentDir(selected as string);
  };

  const handleNext1 = () => {
    const nextError = validateName(projectName);
    if (nextError) {
      setNameError(nextError);
      return;
    }
    if (!parentDir) {
      setNameError("Choose a parent directory for the new world.");
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
    <DialogShell
      dialogRef={trapRef}
      titleId="new-project-title"
      title="Found A New World"
      subtitle="Choose where the project will live, which structure it should inherit, and which ports should answer when the world awakens."
      widthClassName="max-w-3xl"
      onClose={step === 3 && stage !== "done" ? undefined : onClose}
      status={
        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-secondary">
          {step === 1 && "Step 1 of 2"}
          {step === 2 && "Step 2 of 2"}
          {step === 3 && "World forging"}
        </span>
      }
      footer={
        <>
          {step === 1 && (
            <>
              <ActionButton onClick={onClose} variant="ghost">
                Cancel
              </ActionButton>
              <ActionButton onClick={handleNext1} variant="primary">
                Continue
              </ActionButton>
            </>
          )}
          {step === 2 && (
            <>
              <ActionButton onClick={() => setStep(1)} variant="ghost">
                Back
              </ActionButton>
              <ActionButton onClick={handleCreate} variant="primary">
                Create World
              </ActionButton>
            </>
          )}
          {step === 3 && stage === "done" && (
            <ActionButton onClick={handleDone} variant="primary">
              Enter Creator
            </ActionButton>
          )}
          {step === 3 && stage === "error" && (
            <>
              <ActionButton
                onClick={() => {
                  reset();
                  onClose();
                }}
                variant="ghost"
              >
                Close
              </ActionButton>
              <ActionButton
                onClick={() => {
                  reset();
                  setStep(1);
                }}
                variant="secondary"
              >
                Revise Setup
              </ActionButton>
            </>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="panel-surface-light rounded-[24px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">World identity</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
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
                  className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                  Parent Directory
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={parentDir}
                    readOnly
                    placeholder="Choose where the project directory should be created"
                    className="ornate-input min-h-11 min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm"
                  />
                  <ActionButton onClick={handlePickDir} variant="secondary" className="sm:self-start">
                    Choose Folder
                  </ActionButton>
                </div>
              </div>
              {nameError && (
                <div className="rounded-[18px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
                  {nameError}
                </div>
              )}
            </div>
          </section>

          <aside className="instrument-panel rounded-[28px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Projected path</p>
            <p className="mt-3 break-all font-mono text-xs leading-6 text-text-secondary">
              {fullPath || "Choose a directory and name to reveal the final path."}
            </p>
            <div className="mt-5 rounded-[20px] border border-white/8 bg-black/12 p-4">
              <p className="font-display text-sm text-text-primary">Naming guidance</p>
              <p className="mt-2 text-xs leading-6 text-text-secondary">
                World folders should begin with a letter. Use letters, digits, hyphens, and underscores so the generated project can travel cleanly between tools.
              </p>
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="panel-surface-light rounded-[24px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Foundational template</p>
            <div className="mt-4 grid gap-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`focus-ring rounded-[22px] border p-4 text-left transition ${
                    selectedTemplate.id === template.id
                      ? "border-[var(--border-glow-strong)] bg-[linear-gradient(145deg,rgba(168,151,210,0.18),rgba(42,50,71,0.9))] shadow-glow-sm"
                      : "border-white/8 bg-black/12 hover:border-white/14 hover:bg-white/6"
                  }`}
                >
                  <div className="font-display text-sm text-text-primary">{template.name}</div>
                  <div className="mt-1 text-xs leading-6 text-text-secondary">{template.description}</div>
                </button>
              ))}
            </div>
          </section>

          <aside className="instrument-panel rounded-[28px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Ports of entry</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                  Telnet Port
                </label>
                <input
                  type="number"
                  value={telnetPort}
                  onChange={(e) => setTelnetPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                  className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                  Web Port
                </label>
                <input
                  type="number"
                  value={webPort}
                  onChange={(e) => setWebPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                  className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(184,216,232,0.12),rgba(8,12,28,0.18)_40%),rgba(8,12,28,0.2)] px-6 text-center">
          {stage !== "error" && stage !== "done" && <Spinner className="h-6 w-6 border-2" />}
          {stage === "done" && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-status-success/40 bg-status-success/10 text-xl text-status-success">
              +
            </div>
          )}
          {stage === "error" && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-status-error/40 bg-status-error/10 text-xl text-status-error">
              x
            </div>
          )}
          <p className="font-display text-lg text-text-primary">{STAGE_LABELS[stage]}</p>
          {error ? (
            <p className="max-w-xl text-sm leading-6 text-status-error">{error}</p>
          ) : (
            <p className="max-w-xl text-sm leading-6 text-text-secondary">
              {stage === "done"
                ? "The project structure, template, and runtime defaults have been prepared. Open it and continue shaping the world."
                : "Creator is assembling the project skeleton, applying the template, and writing the first runtime settings."}
            </p>
          )}
        </div>
      )}
    </DialogShell>
  );
}
