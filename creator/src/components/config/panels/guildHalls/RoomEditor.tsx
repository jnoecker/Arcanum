import { useState } from "react";
import type { GuildHallRoomTemplate } from "@/types/config";
import {
  TextInput,
  NumberInput,
  CommitTextarea,
  cx,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import {
  guildHallRoomPrompt,
  guildHallRoomContext,
} from "@/lib/entityPrompts";
import { SectionCard } from "@/components/ui/SectionCard";
import { CopyIcon, TrashIcon } from "@/components/config/icons";

interface RoomEditorProps {
  id: string;
  t: GuildHallRoomTemplate;
  onPatch: (p: Partial<GuildHallRoomTemplate>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (newId: string) => void;
}

export function RoomEditor({
  id,
  t,
  onPatch,
  onDelete,
  onDuplicate,
  onRename,
}: RoomEditorProps) {
  const title = t.title || t.displayName || id;

  return (
    <div className="panel-surface flex flex-col gap-4 rounded-2xl p-4 shadow-section">
      <EditorHeader
        id={id}
        title={title}
        onDuplicate={onDuplicate}
        onRename={onRename}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <DetailsCard t={t} onPatch={onPatch} />
          <MechanicsCard t={t} onPatch={onPatch} />
        </div>
        <div className="xl:col-span-3">
          <BackgroundArtCard id={id} t={t} onPatch={onPatch} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--chrome-stroke)] pt-3">
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Delete Room
        </button>
      </div>
    </div>
  );
}

function EditorHeader({
  id,
  title,
  onDuplicate,
  onRename,
}: {
  id: string;
  title: string;
  onDuplicate: () => void;
  onRename: (v: string) => void;
}) {
  const [editingId, setEditingId] = useState(false);
  const [draft, setDraft] = useState(id);

  const commitRename = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    setEditingId(false);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate font-display text-xl font-semibold text-text-primary">
            {title}
          </h3>
          {editingId ? (
            <input
              autoFocus
              className="ornate-input min-h-7 px-2 py-0.5 font-mono text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraft(id);
                  setEditingId(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(id);
                setEditingId(true);
              }}
              title="Rename ID"
              className="font-mono text-xs text-text-muted/80 underline-offset-2 hover:text-text-primary hover:underline"
            >
              {id}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate this room template"
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent/30 hover:text-text-primary"
        >
          <CopyIcon />
          Duplicate
        </button>
      </div>
    </header>
  );
}

function DetailsCard({
  t,
  onPatch,
}: {
  t: GuildHallRoomTemplate;
  onPatch: (p: Partial<GuildHallRoomTemplate>) => void;
}) {
  return (
    <SectionCard title="Details">
      <div className="flex flex-col gap-3">
        <Field label="Title">
          <TextInput
            value={t.title ?? t.displayName ?? ""}
            onCommit={(v) => onPatch({ title: v, displayName: v })}
            placeholder="Vault Chamber"
            dense
          />
        </Field>
        <Field label="Description">
          <CommitTextarea
            label=""
            value={t.description}
            onCommit={(v) => onPatch({ description: v })}
            placeholder="A fortified vault lined with enchanted stone…"
            rows={3}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function MechanicsCard({
  t,
  onPatch,
}: {
  t: GuildHallRoomTemplate;
  onPatch: (p: Partial<GuildHallRoomTemplate>) => void;
}) {
  return (
    <SectionCard title="Mechanics">
      <div className="flex flex-col gap-3">
        <InlineNumericField
          label="Gold cost"
          value={t.cost ?? 0}
          onCommit={(v) => onPatch({ cost: v ?? 0 })}
        />
        <FlagToggle
          label="Has Storage"
          active={t.hasStorage ?? false}
          onToggle={() => onPatch({ hasStorage: !t.hasStorage || undefined })}
        />
      </div>
    </SectionCard>
  );
}

function BackgroundArtCard({
  id,
  t,
  onPatch,
}: {
  id: string;
  t: GuildHallRoomTemplate;
  onPatch: (p: Partial<GuildHallRoomTemplate>) => void;
}) {
  return (
    <SectionCard title="Background Art">
      <EntityArtGenerator
        getPrompt={(style) => guildHallRoomPrompt(id, t, style)}
        entityContext={guildHallRoomContext(id, t)}
        currentImage={t.image}
        onAccept={(filePath) => onPatch({ image: filePath })}
        assetType="background"
        context={{ zone: "config", entity_type: "guild_hall_room", entity_id: id }}
        surface="worldbuilding"
      />
    </SectionCard>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}

function InlineNumericField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="w-24 shrink-0">
        <NumberInput value={value} onCommit={onCommit} min={0} dense />
      </div>
    </div>
  );
}

interface FlagToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

function FlagToggle({ label, active, onToggle }: FlagToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={cx(
        "focus-ring flex items-center gap-2.5 rounded-lg border px-3 py-2 transition",
        active
          ? "border-accent/40 bg-accent/10 shadow-[0_0_18px_-10px_rgb(var(--accent-rgb)/0.7)]"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <span
        className={cx(
          "flex-1 text-left font-display text-2xs font-semibold uppercase tracking-[0.18em]",
          active ? "text-accent" : "text-text-muted",
        )}
      >
        {label}
      </span>
      <span
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          active ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-4 w-4 rounded-full bg-bg-primary shadow-md transition-transform",
            active ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
