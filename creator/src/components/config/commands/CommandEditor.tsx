import { useState } from "react";
import type { CommandEntryConfig } from "@/types/config";
import { TextInput, SelectInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { SectionCard } from "../panels/factions/SectionCard";
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
  const displayName = (cmd.usage.split(/\s/)[0] || id).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <EditorHeader id={id} displayName={displayName} cmd={cmd} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
          <HelpPreviewCard id={id} cmd={cmd} />
        </div>

        <div className="lg:col-span-3">
          <AliasesCard id={id} />
        </div>
        <div className="lg:col-span-2">
          <VisibilityCard cmd={cmd} onPatch={onPatch} />
        </div>

        <div className="lg:col-span-3">
          <CategoryMetadataCard cmd={cmd} categoryOptions={categoryOptions} />
        </div>
        <div className="lg:col-span-2">
          <NotesCard />
        </div>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────

function EditorHeader({
  id,
  displayName,
  cmd,
}: {
  id: string;
  displayName: string;
  cmd: CommandEntryConfig;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-display text-2xs uppercase tracking-[0.22em] text-text-muted">
        Commands{" "}
        <span className="mx-1 text-text-muted/50">›</span>{" "}
        <span className="text-accent">Edit</span>
      </p>
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          {displayName}
        </h2>
        <span className="font-mono text-xs text-text-muted">
          {id}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-text-muted">
        {summarizeUsage(cmd)}
      </p>
    </div>
  );
}

function summarizeUsage(cmd: CommandEntryConfig): string {
  const parts: string[] = [];
  if (cmd.usage) parts.push(`Usage “${cmd.usage}”`);
  if (cmd.category) parts.push(`category ${cmd.category}`);
  if (cmd.staff) parts.push("staff only");
  return parts.length > 0
    ? parts.join(", ") + "."
    : "Usage, category, and staff visibility.";
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
      className={cx(
        "focus-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
        checked
          ? "border-accent/40 bg-accent/10"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Staff Only
        </span>
        <span className="block text-2xs text-text-muted/80">
          Restrict to staff accounts.
        </span>
      </span>
      <span
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-4 w-4 rounded-full bg-bg-primary shadow-md transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
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

// ─── Visibility & Permissions ──────────────────────────────────

function VisibilityCard({
  cmd,
  onPatch,
}: {
  cmd: CommandEntryConfig;
  onPatch: (p: Partial<CommandEntryConfig>) => void;
}) {
  return (
    <SectionCard title="Visibility & Permissions">
      <div className="flex flex-col gap-2">
        <PermissionRow
          label="Staff Only"
          description="Only staff accounts can run this command."
          active={cmd.staff}
          onClick={() => onPatch({ staff: !cmd.staff })}
        />
        <PermissionRow
          label="Player Visible"
          description="Listed in player help indexes."
          active={!cmd.staff}
          onClick={() => onPatch({ staff: !cmd.staff })}
        />
      </div>
      <p className="mt-2 text-2xs text-text-muted/70">
        Toggle staff-only to control who can invoke or see this command.
      </p>
    </SectionCard>
  );
}

function PermissionRow({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "focus-ring flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-accent/40 bg-accent/10"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <span className="min-w-0">
        <span className="block font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </span>
        <span className="mt-0.5 block text-2xs text-text-muted/80">
          {description}
        </span>
      </span>
      <span
        className={cx(
          "rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.18em]",
          active
            ? "bg-accent/15 text-accent"
            : "bg-[var(--chrome-fill-strong)] text-text-muted",
        )}
      >
        {active ? "Enabled" : "Off"}
      </span>
    </button>
  );
}

// ─── Category Metadata ─────────────────────────────────────────

function CategoryMetadataCard({
  cmd,
  categoryOptions,
}: {
  cmd: CommandEntryConfig;
  categoryOptions: { value: string; label: string }[];
}) {
  const match = categoryOptions.find((o) => o.value === cmd.category);
  return (
    <SectionCard title="Category Metadata">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <MetaRow label="Category Slug" value={cmd.category || "—"} mono />
        <MetaRow label="Display Label" value={match?.label ?? cmd.category ?? "—"} />
        <MetaRow
          label="Help Tier"
          value={cmd.staff ? "Staff" : "Player"}
        />
        <MetaRow
          label="Usage Length"
          value={`${cmd.usage.length} chars`}
        />
      </dl>
      <p className="mt-3 text-2xs text-text-muted/70">
        Categories are defined in the broader command taxonomy.
      </p>
    </SectionCard>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
      <dt className="font-display text-[0.55rem] uppercase tracking-[0.18em] text-text-muted">
        {label}
      </dt>
      <dd
        className={cx(
          "truncate text-xs text-text-primary",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Notes ─────────────────────────────────────────────────────

function NotesCard() {
  const [draft, setDraft] = useState("");
  return (
    <SectionCard
      title="Notes"
      description="Private notes about this command. Not shown to players."
      actions={
        <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.18em] text-text-muted">
          Local
        </span>
      }
    >
      <CommitTextarea
        label=""
        value={draft}
        onCommit={(v) => setDraft(v)}
        placeholder="Design intent, edge cases, beginner-friendly..."
        rows={4}
      />
      <p className="mt-1 text-2xs text-text-muted/70">
        Notes are session-local until persisted notes are added to the schema.
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
