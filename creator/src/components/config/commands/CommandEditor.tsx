import { useState } from "react";
import type { CommandEntryConfig } from "@/types/config";
import { TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { XIcon, PlusIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface CommandEditorProps {
  id: string;
  cmd: CommandEntryConfig;
  categoryOptions: { value: string; label: string }[];
  onPatch: (p: Partial<CommandEntryConfig>) => void;
  onRename: (newId: string) => void;
}

export function CommandEditor({
  id,
  cmd,
  categoryOptions,
  onPatch,
  onRename,
}: CommandEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BasicDetailsCard
            id={id}
            cmd={cmd}
            categoryOptions={categoryOptions}
            onPatch={onPatch}
            onRename={onRename}
          />
        </div>
        <div className="lg:col-span-2">
          <AliasesCard id={id} />
        </div>
      </div>
      <HelpPreviewCard id={id} cmd={cmd} />
    </div>
  );
}

// ─── Basic Details ──────────────────────────────────────────────

function BasicDetailsCard({
  id,
  cmd,
  categoryOptions,
  onPatch,
  onRename,
}: {
  id: string;
  cmd: CommandEntryConfig;
  categoryOptions: { value: string; label: string }[];
  onPatch: (p: Partial<CommandEntryConfig>) => void;
  onRename: (newId: string) => void;
}) {
  return (
    <SectionCard title="Basic Details">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldLabel label="Usage String" required>
          <TextInput
            value={cmd.usage}
            onCommit={(v) => onPatch({ usage: v })}
            placeholder="help [topic]"
            dense
          />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Display syntax players see in <code>help</code>.
          </p>
        </FieldLabel>

        <FieldLabel label="Category" required>
          <SelectInput
            value={cmd.category}
            options={categoryOptions}
            onCommit={(v) => onPatch({ category: v })}
            placeholder="— select category —"
            dense
          />
        </FieldLabel>

        <FieldLabel label="Internal ID (slug)" required>
          <SlugRenamer id={id} onRename={onRename} />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Used for references (must be unique).
          </p>
        </FieldLabel>

        <FieldLabel label="Staff Only">
          <StaffToggle
            checked={cmd.staff}
            onChange={(v) => onPatch({ staff: v })}
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="help"
    />
  );
}

function StaffToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      aria-label="Staff only"
      className={cx(
        "focus-ring inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition",
        checked
          ? "border-accent/40 bg-accent/10"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <span
        className={cx(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-3 w-3 rounded-full bg-bg-primary shadow-md transition-transform",
            checked ? "translate-x-[0.875rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span
        className={cx(
          "font-display text-2xs font-semibold uppercase tracking-wider",
          checked ? "text-accent" : "text-text-muted",
        )}
      >
        {checked ? "Staff" : "Public"}
      </span>
    </button>
  );
}

// ─── Help Preview ───────────────────────────────────────────────

function HelpPreviewCard({ id, cmd }: { id: string; cmd: CommandEntryConfig }) {
  const name = (cmd.usage.split(/\s/)[0] || id);
  return (
    <SectionCard
      title="Help Preview"
      actions={
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.18em] text-accent">
          Preview
        </span>
      }
    >
      <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3 font-mono text-2xs leading-relaxed text-text-secondary">
        <p className="text-accent">&gt; help {name}</p>
        <p className="mt-2">
          <span className="text-text-muted">Usage:</span>{" "}
          <span className="text-text-primary">{cmd.usage || name}</span>
        </p>
        <p className="mt-1">
          <span className="text-text-muted">Category:</span>{" "}
          <span className="text-text-primary">{cmd.category || "uncategorized"}</span>
        </p>
        {cmd.staff && (
          <p className="mt-1 text-warm">[Staff only]</p>
        )}
        <p className="mt-2 text-text-muted/80">
          Displays available help topics and command information.
        </p>
      </div>
      <p className="mt-2 text-2xs text-text-muted/70">
        Live preview of how players will see this command in <code>help</code>.
      </p>
    </SectionCard>
  );
}

// ─── Aliases ────────────────────────────────────────────────────

function AliasesCard({ id }: { id: string }) {
  const [draft, setDraft] = useState("");
  // Aliases are not persisted on CommandEntryConfig today; surface the primary
  // command name as the only alias and let the user know more are coming.
  const aliases = [id];

  return (
    <SectionCard
      title="Aliases"
      description="Additional usage strings that trigger the same command."
      actions={
        <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.18em] text-text-muted">
          Coming Soon
        </span>
      }
    >
      <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-2xs text-accent"
            >
              {a}
              <span
                aria-hidden="true"
                className="-mr-0.5 rounded p-0.5 text-accent/40"
                title="Primary alias"
              >
                <XIcon className="h-3 w-3" />
              </span>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              disabled
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add alias..."
              className="ornate-input min-h-7 w-32 px-2 py-0.5 font-mono text-2xs text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              disabled
              aria-label="Add alias"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[var(--chrome-stroke-strong)] text-text-muted/60 disabled:cursor-not-allowed"
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-2xs text-text-muted/70">
        Multiple aliases per command will land in a future release.
      </p>
    </SectionCard>
  );
}

// ─── Shared primitives ─────────────────────────────────────────

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}
