import { SaveIcon } from "@/components/config/icons";

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
      <button
        type="button"
        onClick={onSave}
        disabled={!hasUnsavedChanges || saving}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SaveIcon />
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </header>
  );
}
