import { useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import { ErrorDialog } from "./ErrorDialog";

export function WelcomeScreen() {
  const openProject = useOpenProject();
  const [errors, setErrors] = useState<string[] | null>(null);

  const handleOpen = async () => {
    const result = await openProject();
    if (result && !result.success && result.errors) {
      setErrors(result.errors);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-text-primary">
            AmbonMUD Creator
          </h1>
          <p className="text-text-secondary">
            World building and server management tool
          </p>
        </div>
        <button
          onClick={handleOpen}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-emphasis"
        >
          Open AmbonMUD Project
        </button>
      </div>

      {errors && (
        <ErrorDialog
          title="Invalid AmbonMUD Directory"
          messages={errors}
          onClose={() => setErrors(null)}
        />
      )}
    </div>
  );
}
