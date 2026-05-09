import { useEffect, useRef, useState } from "react";
import { SaveIcon, MoreVerticalIcon } from "./icons";

interface CraftingHeaderProps {
  hasUnsavedChanges: boolean;
  saving: boolean;
  onSave: () => void;
}

export function CraftingHeader({
  hasUnsavedChanges,
  saving,
  onSave,
}: CraftingHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--chrome-stroke)] pb-4">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          Crafting Systems
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">
          Configure progression, harvesting pace, skills, and station types.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!hasUnsavedChanges || saving}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SaveIcon />
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <OverflowMenu />
      </div>
    </header>
  );
}

function OverflowMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More crafting actions"
        aria-expanded={open}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-accent"
      >
        <MoreVerticalIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated text-xs shadow-lg">
          <DisabledMenuItem
            label="Reset to defaults"
            hint="Coming soon"
          />
          <DisabledMenuItem
            label="Export as YAML"
            hint="Use the global Save button"
          />
        </div>
      )}
    </div>
  );
}

function DisabledMenuItem({ label, hint }: { label: string; hint: string }) {
  return (
    <button
      type="button"
      disabled
      title={hint}
      className="flex w-full cursor-not-allowed items-center justify-between gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-text-muted/70 last:border-b-0"
    >
      <span>{label}</span>
      <span className="text-[0.55rem] uppercase tracking-wider text-text-muted/50">
        Soon
      </span>
    </button>
  );
}
