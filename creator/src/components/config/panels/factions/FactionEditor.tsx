import { useEffect, useRef, useState } from "react";
import type { FactionDefinition } from "@/types/config";
import { TextInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { Section } from "../../enchanting/Section";
import { CompassRoseIcon, PlusIcon, XIcon, TrashIcon, PencilIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Best-effort plain-language name for a hex color so prompts can read
 *  "deep teal" alongside "#1e6a6f" - image models pick up either, and the
 *  pair gives the LLM enhancer a fighting chance at writing it through. */
function describeColor(hex: string): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (s < 0.1) {
    if (l < 0.2) return "near-black";
    if (l < 0.4) return "dark grey";
    if (l < 0.7) return "muted grey";
    if (l < 0.9) return "light grey";
    return "near-white";
  }
  let hueName = "red";
  if (h < 15 || h >= 345) hueName = "red";
  else if (h < 45) hueName = "orange";
  else if (h < 70) hueName = "amber";
  else if (h < 90) hueName = "yellow";
  else if (h < 150) hueName = "green";
  else if (h < 195) hueName = "teal";
  else if (h < 255) hueName = "blue";
  else if (h < 295) hueName = "violet";
  else hueName = "magenta";
  let lightness = "";
  if (l < 0.25) lightness = "deep ";
  else if (l < 0.4) lightness = "dark ";
  else if (l > 0.78) lightness = "pale ";
  else if (l > 0.6) lightness = "soft ";
  const sat = s < 0.35 ? "muted " : "";
  return `${sat}${lightness}${hueName}`.trim();
}

function buildEmblemCustomization(
  name: string,
  description: string | undefined,
  color: string | undefined,
): string {
  const parts = [`Faction emblem for ${name}`];
  if (description) parts.push(description);
  if (color) {
    const named = describeColor(color);
    parts.push(
      named
        ? `heraldic color is ${named} (${color}) - render the central symbol predominantly in this hue`
        : `heraldic color ${color} - render the central symbol predominantly in this hue`,
    );
  }
  return parts.join(". ");
}

function buildEmblemContext(
  name: string,
  description: string | undefined,
  color: string | undefined,
): string {
  const lines = [`Faction: ${name}`];
  if (description) lines.push(description);
  if (color) {
    const named = describeColor(color);
    lines.push(
      named
        ? `Heraldic color: ${named} (${color}) - the emblem should be rendered predominantly in this hue.`
        : `Heraldic color: ${color} - the emblem should be rendered predominantly in this hue.`,
    );
  }
  return lines.join("\n");
}

interface FactionEditorProps {
  id: string;
  definition: FactionDefinition;
  definitions: Record<string, FactionDefinition>;
  factionIds: string[];
  factionLabelMap: Map<string, string>;
  onPatch: (p: Partial<FactionDefinition>) => void;
  /** Toggle a rivalry between this faction and `otherId` - stays
   *  symmetric so both factions agree. */
  onToggleEnemy: (otherId: string) => void;
  /** Toggle an alliance between this faction and `otherId` - stays
   *  symmetric so both factions agree. */
  onToggleAlly: (otherId: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onRename: (newId: string) => void;
}

export function FactionEditor({
  id,
  definition,
  definitions,
  factionIds,
  factionLabelMap,
  onPatch,
  onToggleEnemy,
  onToggleAlly,
  onClose,
  onDelete,
  onRename,
}: FactionEditorProps) {
  const enemies = definition.enemies ?? [];
  const allies = definition.allies ?? [];
  const others = factionIds.filter((fid) => fid !== id);
  const availableRivals = others.filter((fid) => !enemies.includes(fid));
  const availableAllies = others.filter((fid) => !allies.includes(fid));
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const emblemPath =
    definition.image && assetsDir
      ? `${assetsDir}\\images\\${definition.image}`
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-1 pr-1 lg:col-span-8">
          <Section
            title="Identity"
            actions={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/30 hover:text-text-primary"
                >
                  <XIcon className="h-3 w-3" />
                  Close
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Delete faction"
                  aria-label="Delete faction"
                  className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20"
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Display name" required>
                <TextInput
                  value={definition.name}
                  onCommit={(v) => onPatch({ name: v })}
                  placeholder="The Royal Court"
                  dense
                />
              </Field>
              <Field label="Slug" hint="Stable id used by mobs and quests.">
                <RenamableId id={id} onRename={onRename} />
              </Field>
            </div>
            <Field
              className="mt-3"
              label="Flavor description"
              hint="Short summary shown in faction info and help text."
            >
              <CommitTextarea
                label=""
                value={definition.description ?? ""}
                onCommit={(v) => onPatch({ description: v || undefined })}
                placeholder="A secretive order of spellwrights who..."
                rows={3}
              />
            </Field>
          </Section>

          <Section
            title="Rivals"
            className="popover-host !overflow-visible !p-3"
            actions={
              <RelationAddMenu
                tone="rival"
                available={availableRivals}
                factionLabelMap={factionLabelMap}
                onToggle={onToggleEnemy}
              />
            }
          >
            {others.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                Add another faction to set up rivalries.
              </p>
            ) : (
              <RelationCards
                tone="rival"
                selected={enemies}
                definitions={definitions}
                factionLabelMap={factionLabelMap}
                onRemove={onToggleEnemy}
              />
            )}
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-2">
                Allies
                <InfoTooltip text="Lore-only alliances appear on the relationship map but don't affect reputation, kill bonuses, or quest gating." />
              </span>
            }
            className="popover-host !overflow-visible !p-3 lg:flex-1"
            actions={
              <RelationAddMenu
                tone="ally"
                available={availableAllies}
                factionLabelMap={factionLabelMap}
                onToggle={onToggleAlly}
              />
            }
          >
            {others.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                Add another faction to declare alliances.
              </p>
            ) : (
              <RelationCards
                tone="ally"
                selected={allies}
                definitions={definitions}
                factionLabelMap={factionLabelMap}
                onRemove={onToggleAlly}
              />
            )}
          </Section>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-1 pr-1 lg:col-span-4">
          <Section title="Heraldry" className="!p-3 lg:min-h-full">
            <Field label="Color">
              <ColorField
                value={definition.color ?? ""}
                onChange={(hex) => onPatch({ color: hex || undefined })}
              />
            </Field>
            <div className="mt-2">
              <p className="mb-1 font-display text-2xs uppercase tracking-wider text-text-muted">
                Emblem
              </p>
              <div className="faction-emblem-generator">
                <EntityArtGenerator
                  getPrompt={(style: ArtStyle) =>
                    composePrompt(
                      "faction_emblem",
                      style,
                      buildEmblemCustomization(
                        definition.name || id,
                        definition.description,
                        definition.color,
                      ),
                    )
                  }
                  entityContext={buildEmblemContext(
                    definition.name || id,
                    definition.description,
                    definition.color,
                  )}
                  currentImage={emblemPath}
                  onAccept={(filePath) => {
                    const fileName = filePath.split(/[\\/]/).pop() ?? "";
                    onPatch({ image: fileName || undefined });
                  }}
                  assetType="faction_emblem"
                  context={{ zone: "", entity_type: "faction", entity_id: id }}
                  surface="worldbuilding"
                />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex.toLowerCase());
      setText(hex.toLowerCase());
    } else {
      setText(value);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#7a8aa6"}
        onChange={(e) => {
          onChange(e.target.value);
          setText(e.target.value);
        }}
        className="h-9 w-12 cursor-pointer rounded border border-[var(--chrome-stroke)] bg-bg-primary"
        aria-label="Faction color"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="#7a8aa6"
        spellCheck={false}
        className="ornate-input min-h-9 w-28 px-2 py-1 font-mono text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="focus-ring inline-flex items-center rounded-md border border-[var(--chrome-stroke)] px-2 py-1 text-2xs text-text-muted transition hover:border-status-error/40 hover:text-status-error"
          title="Clear color"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}

function RenamableId({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(id);
  }, [id]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(id);
          setEditing(true);
        }}
        className="group ornate-input inline-flex w-full min-h-9 items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-xs text-text-muted transition hover:text-text-primary"
        title="Rename - Esc to cancel"
      >
        <span className="truncate">{id}</span>
        <PencilIcon className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
      </button>
    );
  }

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      autoFocus
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(id);
          setEditing(false);
        }
      }}
    />
  );
}

interface RelationCardsProps {
  tone: "rival" | "ally";
  selected: string[];
  definitions: Record<string, FactionDefinition>;
  factionLabelMap: Map<string, string>;
  onRemove: (id: string) => void;
}

function RelationCards({
  tone,
  selected,
  definitions,
  factionLabelMap,
  onRemove,
}: RelationCardsProps) {
  const missingTooltip =
    tone === "rival"
      ? "Define it or remove the rivalry."
      : "Define it or remove the alliance.";
  const cardClasses =
    tone === "rival"
      ? "border-status-error/45 bg-status-error/[0.07]"
      : "border-status-success/45 bg-status-success/[0.07]";
  const labelClasses =
    tone === "rival"
      ? "text-status-error"
      : "text-status-success";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {selected.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-4 text-center text-2xs italic text-text-muted/70">
            {tone === "rival"
              ? "No rivalries marked yet."
              : "No alliances marked yet."}
          </div>
        ) : (
          selected.map((relId) => {
            const label = factionLabelMap.get(relId);
            const missing = !label;
            return (
              <RelationCard
                key={relId}
                id={relId}
                label={label ?? relId}
                definition={definitions[relId]}
                tone={tone}
                missing={missing}
                title={missing ? `Unknown faction: ${relId}. ${missingTooltip}` : undefined}
                className={missing ? "border-status-warning/45 bg-status-warning/[0.08]" : cardClasses}
                labelClassName={missing ? "text-status-warning" : labelClasses}
                onRemove={() => onRemove(relId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface RelationCardProps {
  id: string;
  label: string;
  definition: FactionDefinition | undefined;
  tone: "rival" | "ally";
  missing: boolean;
  title?: string;
  className: string;
  labelClassName: string;
  onRemove: () => void;
}

function RelationCard({
  id,
  label,
  definition,
  tone,
  missing,
  title,
  className,
  labelClassName,
  onRemove,
}: RelationCardProps) {
  const emblemSrc = useImageSrc(definition?.image);
  const factionColor = definition?.color || undefined;

  return (
    <div
      title={title}
      className={cx(
        "relative flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border px-2.5 py-3 text-center",
        "bg-gradient-to-b from-[var(--chrome-fill)] to-[var(--chrome-fill-soft)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="focus-ring absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
      >
        <XIcon className="h-3 w-3" />
      </button>

      <span
        aria-hidden="true"
        className={cx(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border",
          !factionColor &&
            "border-[var(--chrome-stroke)] bg-[var(--bg-panel)] text-text-muted",
        )}
        style={
          factionColor
            ? {
                borderColor: factionColor,
                background: `color-mix(in srgb, ${factionColor} 15%, transparent)`,
                color: factionColor,
              }
            : undefined
        }
      >
        {emblemSrc ? (
          <img
            src={emblemSrc}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <CompassRoseIcon className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0">
        <div className="line-clamp-2 font-display text-xs font-semibold leading-tight text-text-primary">
          {missing ? id : label}
        </div>
        <div className={cx("mt-2 font-display text-3xs uppercase tracking-[0.22em]", labelClassName)}>
          {missing ? "Missing" : tone === "rival" ? "Rival" : "Ally"}
        </div>
      </div>
    </div>
  );
}

interface RelationAddMenuProps {
  tone: "rival" | "ally";
  available: string[];
  factionLabelMap: Map<string, string>;
  onToggle: (id: string) => void;
}

function RelationAddMenu({
  tone,
  available,
  factionLabelMap,
  onToggle,
}: RelationAddMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (available.length === 0) {
    return (
      <button
        type="button"
        disabled
        title={tone === "rival" ? "No rivals available" : "No allies available"}
        aria-label={tone === "rival" ? "No rivals available" : "No allies available"}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted/40"
      >
        <PlusIcon className="h-3 w-3" />
      </button>
    );
  }

  const label = tone === "rival" ? "Add rival" : "Add ally";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
        className="focus-ring flex h-6 w-6 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/40 hover:text-accent"
      >
        <PlusIcon className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="menu"
          data-popover-open
          className="absolute right-0 top-8 z-30 flex min-w-56 flex-col gap-1 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--bg-panel)] p-2 shadow-panel"
        >
          {available.map((relId) => (
            <button
              key={relId}
              type="button"
              role="menuitem"
              onClick={() => {
                onToggle(relId);
                setOpen(false);
              }}
              className="focus-ring flex w-full items-center rounded-lg px-2 py-1.5 text-left font-display text-2xs text-text-secondary transition hover:bg-[var(--chrome-fill)] hover:text-accent"
            >
              {factionLabelMap.get(relId) ?? relId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] font-mono text-3xs text-text-muted transition hover:border-accent/40 hover:text-accent"
        aria-label={text}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-8 z-20 hidden w-64 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--bg-panel)] px-3 py-2 text-left text-2xs leading-snug text-text-secondary shadow-panel group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
