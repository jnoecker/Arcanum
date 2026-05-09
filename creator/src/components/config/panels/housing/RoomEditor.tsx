import { useState } from "react";
import type { HousingTemplateDefinition } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import { housingRoomPrompt, housingRoomContext } from "@/lib/entityPrompts";
import { CopyIcon, TrashIcon } from "./icons";

// TODO: lift into @/lib/cx once the shared utility lands.
function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface RoomEditorProps {
  id: string;
  t: HousingTemplateDefinition;
  stationOptions: { value: string; label: string }[];
  onPatch: (p: Partial<HousingTemplateDefinition>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (newId: string) => void;
}

export function RoomEditor({
  id,
  t,
  stationOptions,
  onPatch,
  onDelete,
  onDuplicate,
  onRename,
}: RoomEditorProps) {
  return (
    <div className="panel-surface bg-gradient-glow-top relative flex flex-col overflow-hidden rounded-2xl shadow-section">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px flourish-top-thread" />

      <HeroArtBand
        id={id}
        t={t}
        onPatch={onPatch}
        onDuplicate={onDuplicate}
        onRename={onRename}
      />

      <div className="bg-gradient-panel-light flex flex-col gap-4 p-5">
        <DetailsSection t={t} onPatch={onPatch} />
        <div className="ornate-divider" aria-hidden />
        <MechanicsSection t={t} stationOptions={stationOptions} onPatch={onPatch} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--chrome-stroke)] px-5 py-3">
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Raze this room
        </button>
      </div>
    </div>
  );
}

function HeroArtBand({
  id,
  t,
  onPatch,
  onDuplicate,
  onRename,
}: {
  id: string;
  t: HousingTemplateDefinition;
  onPatch: (p: Partial<HousingTemplateDefinition>) => void;
  onDuplicate: () => void;
  onRename: (v: string) => void;
}) {
  const heroSrc = useImageSrc(t.image || undefined);
  const [editingId, setEditingId] = useState(false);
  const [draft, setDraft] = useState(id);

  const commitRename = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    setEditingId(false);
  };

  return (
    <div className="relative h-60 w-full shrink-0 overflow-hidden border-b border-[var(--chrome-stroke)]">
      {heroSrc ? (
        <img
          src={heroSrc}
          alt={t.title || id}
          className="h-full w-full object-cover"
        />
      ) : (
        <HeroPlaceholder />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-primary/95 via-bg-primary/30 to-transparent" />

      <div className="absolute right-3 top-3 z-10">
        <div className="rounded-xl border border-[var(--chrome-stroke)] bg-bg-primary/70 p-1 backdrop-blur-md shadow-glow-warm">
          <EntityArtGenerator
            getPrompt={(style) => housingRoomPrompt(id, t, style)}
            entityContext={housingRoomContext(id, t)}
            currentImage={t.image}
            onAccept={(filePath) => onPatch({ image: filePath })}
            assetType="background"
            context={{ zone: "config", entity_type: "housing_room", entity_id: id }}
            surface="worldbuilding"
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-10">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-2xl font-semibold leading-tight text-text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {t.title || id}
          </h3>
          <div className="mt-1 flex items-center gap-2">
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
                className="font-mono text-xs text-text-secondary/90 underline-offset-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] hover:text-accent hover:underline"
              >
                {id}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate this room template"
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary/70 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-md transition hover:border-accent/40 hover:text-text-primary"
        >
          <CopyIcon />
          Duplicate
        </button>
      </div>
    </div>
  );
}

function HeroPlaceholder() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-abyss/60">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_60%,rgb(var(--accent-rgb)/0.18),transparent_60%)]" />
      <svg
        viewBox="0 0 64 64"
        className="h-20 w-20 text-text-muted/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 30L32 12l24 18" />
        <path d="M14 28v22h36V28" />
        <path d="M26 50V36h12v14" />
        <path d="M20 36h2M42 36h2" />
      </svg>
      <span className="absolute bottom-3 font-display text-2xs uppercase tracking-[0.22em] text-text-muted/60">
        No room art yet
      </span>
    </div>
  );
}

function DetailsSection({
  t,
  onPatch,
}: {
  t: HousingTemplateDefinition;
  onPatch: (p: Partial<HousingTemplateDefinition>) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>Particulars</SectionHeading>
      <Field label="Title">
        <TextInput
          value={t.title}
          onCommit={(v) => onPatch({ title: v })}
          placeholder="Basic Room"
          dense
        />
      </Field>
      <Field label="Description">
        <CommitTextarea
          label=""
          value={t.description}
          onCommit={(v) => onPatch({ description: v })}
          placeholder="A cozy chamber lit by hanging lanterns..."
          rows={3}
        />
      </Field>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FlagToggle
          label="Entry Room"
          active={t.isEntry ?? false}
          onToggle={() => onPatch({ isEntry: !t.isEntry || undefined })}
        />
        <FlagToggle
          label="Safe Zone"
          active={t.safe ?? false}
          onToggle={() => onPatch({ safe: !t.safe || undefined })}
        />
      </div>
    </section>
  );
}

function MechanicsSection({
  t,
  stationOptions,
  onPatch,
}: {
  t: HousingTemplateDefinition;
  stationOptions: { value: string; label: string }[];
  onPatch: (p: Partial<HousingTemplateDefinition>) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>Workings</SectionHeading>
      <InlineNumericField
        label="Gold cost"
        value={t.cost}
        onCommit={(v) => onPatch({ cost: v ?? 0 })}
      />
      <InlineNumericField
        label="Vault capacity"
        value={t.maxDroppedItems ?? 0}
        onCommit={(v) =>
          onPatch({ maxDroppedItems: v && v > 0 ? v : undefined })
        }
        hint="Dropped items persist across resets, up to this count. Leave at 0 for an ordinary room."
      />
      <Field
        label="Crafting station"
        hint="Optional. The station this dwelling houses — forge, alchemy bench, loom."
      >
        <SelectInput
          value={t.station ?? ""}
          options={stationOptions}
          onCommit={(v) => onPatch({ station: v || undefined })}
          dense
        />
      </Field>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-secondary">
      {children}
    </h4>
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
  hint,
}: {
  label: string;
  value: number;
  onCommit: (v: number | undefined) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="flex-1 font-display text-2xs uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <div className="w-24 shrink-0">
          <NumberInput value={value} onCommit={onCommit} min={0} dense />
        </div>
      </div>
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
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
