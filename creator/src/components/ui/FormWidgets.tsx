import { useState, type ReactNode } from "react";

// ─── Shared form primitives used across all entity editors ──────────

/** Inline spinner for loading states in buttons. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent animate-spin ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

/** Click-to-edit single-line text field. */
export function EditableField({
  value,
  onCommit,
  placeholder,
  className,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div
        className={`cursor-text rounded px-1 -mx-1 hover:bg-bg-tertiary ${className ?? ""}`}
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDraft(value);
            setEditing(true);
          }
        }}
        title="Click to edit"
        aria-label={label ? `Edit ${label}` : "Click to edit"}
      >
        {value || (
          <span className="text-text-muted">{placeholder ?? "empty"}</span>
        )}
      </div>
    );
  }

  return (
    <input
      autoFocus
      className={`w-full rounded border border-accent/50 bg-bg-primary px-1 -mx-1 outline-none ${className ?? ""}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onCommit(draft);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
    />
  );
}

/** Click-to-edit multi-line textarea. */
export function EditableTextArea({
  value,
  onCommit,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div
        className="cursor-text rounded px-1 -mx-1 text-xs leading-relaxed text-text-secondary hover:bg-bg-tertiary"
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDraft(value);
            setEditing(true);
          }
        }}
        title="Click to edit"
        aria-label={label ? `Edit ${label}` : "Click to edit"}
      >
        {value || <span className="text-text-muted">empty</span>}
      </div>
    );
  }

  return (
    <textarea
      autoFocus
      rows={4}
      className="w-full resize-y rounded border border-accent/50 bg-bg-primary px-1 -mx-1 text-xs leading-relaxed text-text-secondary outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
    />
  );
}

/** Collapsible section with a header label. Click header to toggle. */
export function Section({
  title,
  description,
  children,
  actions,
  defaultExpanded = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-border-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-left"
        >
          <span
            className={`inline-block text-[9px] text-text-muted transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            &#x25B6;
          </span>
          <h4 className="font-display text-2xs uppercase tracking-widest text-text-muted">
            {title}
          </h4>
        </button>
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {expanded && (
        <>
          {description && (
            <p className="mb-2 mt-1.5 text-[11px] leading-relaxed text-text-muted/70">{description}</p>
          )}
          <div className="mt-1.5">{children}</div>
        </>
      )}
    </div>
  );
}

/** Labeled text input for forms. */
export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-0.5">
      <label className="flex items-center gap-2 text-xs">
        <span className="w-24 shrink-0 text-text-muted">{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </label>
      {hint && (
        <p className="ml-[6.5rem] mt-0.5 text-2xs leading-snug text-text-muted/60">{hint}</p>
      )}
    </div>
  );
}

/** Compact text input that commits on blur/enter. */
export function TextInput({
  value,
  onCommit,
  placeholder,
  className,
  type = "text",
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "number";
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  // Sync external value changes when not focused
  if (!focused && draft !== value) {
    setDraft(value);
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      type={type}
      className={`w-full rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 ${className ?? ""}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Compact number input that commits on blur/enter. */
export function NumberInput({
  value,
  onCommit,
  placeholder,
  min,
  max,
  step,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const strVal = value != null ? String(value) : "";
  const [draft, setDraft] = useState(strVal);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== strVal) {
    setDraft(strVal);
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value != null) onCommit(undefined);
    } else {
      const n = Number(trimmed);
      if (!isNaN(n) && n !== value) onCommit(n);
    }
  };

  return (
    <input
      type="number"
      className="w-full rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
      value={draft}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(strVal);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Dropdown select that commits on change. */
export function SelectInput({
  value,
  onCommit,
  options,
  placeholder,
  allowEmpty,
}: {
  value: string;
  onCommit: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <select
      className="w-full rounded border border-border-default bg-bg-primary px-1 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
      value={value}
      onChange={(e) => onCommit(e.target.value)}
    >
      {(allowEmpty || !value) && (
        <option value="">{placeholder ?? "— none —"}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** Checkbox with label. */
export function CheckboxInput({
  checked,
  onCommit,
  label,
}: {
  checked: boolean;
  onCommit: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
        className="accent-accent"
      />
      {label}
    </label>
  );
}

/** Commit-on-blur multi-line textarea. */
export function CommitTextarea({
  label,
  value,
  onCommit,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== value) {
    setDraft(value);
  }

  return (
    <div className="mt-1">
      <label className="text-xs text-text-muted">{label}</label>
      <textarea
        rows={rows}
        className="mt-0.5 w-full resize-y rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs leading-relaxed text-text-primary outline-none focus:border-accent/50"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft !== value) onCommit(draft);
        }}
      />
    </div>
  );
}

/** Small icon button used for add/delete actions in lists. */
export function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-6 w-6 rounded text-xs transition-colors ${
        danger
          ? "text-text-muted hover:bg-status-danger/10 hover:text-status-danger"
          : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** Inline error message with optional retry and dismiss actions. */
export function InlineError({
  error,
  onDismiss,
  onRetry,
}: {
  error: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-xs text-status-error" role="alert">
      <p>{error}</p>
      {(onRetry || onDismiss) && (
        <div className="mt-2 flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded border border-status-error/30 bg-status-error/10 px-2.5 py-1 text-2xs font-medium transition hover:bg-status-error/20"
            >
              Try again
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded px-2.5 py-1 text-2xs text-text-muted transition hover:text-text-secondary"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
