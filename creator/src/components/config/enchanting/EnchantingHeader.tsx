import { XIcon, CopyIcon, TrashIcon, SaveIcon } from "./icons";
import { NumberInput } from "@/components/ui/FormWidgets";

interface EnchantingHeaderProps {
  selectedId: string | null;
  hasUnsavedChanges: boolean;
  saving: boolean;
  maxPerItem: number;
  onMaxPerItemChange: (v: number) => void;
  onDeselect: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function EnchantingHeader({
  selectedId,
  hasUnsavedChanges,
  saving,
  maxPerItem,
  onMaxPerItemChange,
  onDeselect,
  onSave,
  onDuplicate,
  onDelete,
}: EnchantingHeaderProps) {
  const hasSelection = selectedId !== null;

  return (
    <header className="panel-surface relative overflow-hidden rounded-3xl px-5 py-4 shadow-section">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top right, rgb(var(--accent-rgb)/0.18), transparent 55%), radial-gradient(circle at 25% 80%, rgb(var(--stellar-blue-rgb)/0.10), transparent 55%)",
        }}
      />
      <div className="relative z-10 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
            The Enchanter's Ledger
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
            Inscriptions &amp; Wards
          </h2>
          <p className="mt-1.5 max-w-2xl text-2xs leading-relaxed text-text-secondary">
            Enchantments are permanent augments inscribed onto equipment —
            runes, wards, etchings. Each one trains a crafting skill, burns
            materials, and stacks onto an item up to the per-item cap.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2.5 py-1">
            <span className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Max per Item
            </span>
            <div className="w-12">
              <NumberInput
                value={maxPerItem}
                onCommit={(v) => onMaxPerItemChange(Math.max(1, v ?? 1))}
                min={1}
                dense
              />
            </div>
            <span className="text-2xs italic text-text-muted/70">
              {maxPerItem === 1 ? "single inscription" : `up to ${maxPerItem} stacked`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderButton
            icon={<XIcon className="h-3.5 w-3.5" />}
            label="Deselect"
            onClick={onDeselect}
            disabled={!hasSelection}
          />
          <HeaderButton
            icon={<SaveIcon />}
            label={saving ? "Saving…" : "Save Changes"}
            onClick={onSave}
            tone="accent"
            disabled={!hasUnsavedChanges || saving}
          />
          <HeaderButton
            icon={<CopyIcon />}
            label="Duplicate"
            onClick={onDuplicate}
            disabled={!hasSelection}
          />
          <HeaderButton
            icon={<TrashIcon />}
            label="Delete"
            onClick={onDelete}
            tone="danger"
            disabled={!hasSelection}
          />
        </div>
      </div>
    </header>
  );
}

function HeaderButton({
  icon,
  label,
  onClick,
  tone = "muted",
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "muted" | "accent" | "danger";
  disabled?: boolean;
}) {
  const cls =
    tone === "accent"
      ? "border-accent/45 bg-accent/10 text-accent hover:bg-accent/20 focus-visible:border-accent"
      : tone === "danger"
        ? "border-status-error/40 bg-status-error/10 text-status-error hover:bg-status-error/20"
        : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-secondary hover:border-accent/30 hover:text-text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}
