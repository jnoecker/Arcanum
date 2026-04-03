import { useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

export function ActionButton({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      type={type}
      className={cx(
        "focus-ring action-button",
        variant === "primary" && "action-button-primary",
        variant === "secondary" && "action-button-secondary",
        variant === "ghost" && "action-button-ghost",
        variant === "danger" && "action-button-danger",
        size === "sm" && "action-button-sm",
        size === "md" && "action-button-md",
        size === "icon" && "action-button-icon",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DialogShell({
  dialogRef,
  titleId,
  title,
  subtitle,
  status,
  role = "dialog",
  widthClassName = "max-w-2xl",
  className,
  bodyClassName,
  footer,
  onClose,
  children,
}: {
  dialogRef?: Ref<HTMLDivElement>;
  titleId: string;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  role?: "dialog" | "alertdialog";
  widthClassName?: string;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dialog-overlay">
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("dialog-shell flex max-h-[88vh] w-full flex-col", widthClassName, className)}
      >
        <div className="dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {subtitle && <p className="dialog-subtitle">{subtitle}</p>}
          </div>
          {(status || onClose) && (
            <div className="ml-4 flex shrink-0 items-start gap-2">
              {status}
              {onClose && (
                <ActionButton
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="text-base"
                >
                  ✕
                </ActionButton>
              )}
            </div>
          )}
        </div>
        <div className={cx("dialog-body", bodyClassName)}>{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
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
        className={`focus-ring cursor-text rounded border-b border-dashed border-white/10 px-1 -mx-1 hover:border-white/20 hover:bg-bg-tertiary ${className ?? ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={editing}
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
      className={`ornate-input w-full rounded px-1 -mx-1 ${className ?? ""}`}
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
        className="focus-ring cursor-text rounded border-b border-dashed border-white/10 px-1 -mx-1 text-xs leading-relaxed text-text-secondary hover:border-white/20 hover:bg-bg-tertiary"
        role="button"
        tabIndex={0}
        aria-expanded={editing}
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
      className="ornate-input w-full resize-y rounded px-1 -mx-1 text-xs leading-relaxed text-text-secondary"
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

  const contentId = "section-content-" + title.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="border-b border-border-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="focus-ring flex items-center gap-1.5 rounded text-left"
        >
          <span
            className={`inline-block text-[9px] text-text-muted transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            &#x25B6;
          </span>
          <h4 className="font-display font-semibold text-2xs uppercase tracking-widest text-text-muted">
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
          <div id={contentId} className="mt-1.5">{children}</div>
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
  dense = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "number";
  dense?: boolean;
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
      className={cx(
        "ornate-input w-full rounded text-xs text-text-primary",
        dense ? "min-h-9 px-2 py-1" : "min-h-11 px-3 py-2",
        className,
      )}
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
  dense = false,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  dense?: boolean;
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
      className={cx(
        "ornate-input w-full rounded text-xs text-text-primary",
        dense ? "min-h-9 px-2 py-1" : "min-h-11 px-3 py-2",
      )}
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
  dense = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allowEmpty?: boolean;
  dense?: boolean;
}) {
  return (
    <select
      className={cx(
        "ornate-input w-full rounded text-xs text-text-primary",
        dense ? "min-h-9 px-2 py-1" : "min-h-11 px-3 py-2",
      )}
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
        className="ornate-input mt-0.5 w-full resize-y rounded px-1.5 py-1 text-xs leading-relaxed text-text-primary"
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
  size = "md",
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: ReactNode;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      className={cx(
        "focus-ring rounded text-xs transition-colors",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        danger
          ? "text-text-muted hover:bg-status-danger/10 hover:text-status-danger"
          : "text-text-muted hover:bg-bg-elevated hover:text-text-primary",
      )}
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
