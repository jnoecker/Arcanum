import { useEffect, useRef, useState } from "react";
import type { FactionDefinition } from "@/types/config";
import { TextInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useAssetStore } from "@/stores/assetStore";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { Section } from "../../enchanting/Section";
import { XIcon, TrashIcon, PencilIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Best-effort plain-language name for a hex color so prompts can read
 *  "deep teal" alongside "#1e6a6f" — image models pick up either, and the
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
        ? `heraldic color is ${named} (${color}) — render the central symbol predominantly in this hue`
        : `heraldic color ${color} — render the central symbol predominantly in this hue`,
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
        ? `Heraldic color: ${named} (${color}) — the emblem should be rendered predominantly in this hue.`
        : `Heraldic color: ${color} — the emblem should be rendered predominantly in this hue.`,
    );
  }
  return lines.join("\n");
}

interface FactionEditorProps {
  id: string;
  definition: FactionDefinition;
  factionIds: string[];
  factionLabelMap: Map<string, string>;
  onPatch: (p: Partial<FactionDefinition>) => void;
  /** Toggle a rivalry between this faction and `otherId` — stays
   *  symmetric so both factions agree. */
  onToggleEnemy: (otherId: string) => void;
  /** Toggle an alliance between this faction and `otherId` — stays
   *  symmetric so both factions agree. */
  onToggleAlly: (otherId: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onRename: (newId: string) => void;
}

export function FactionEditor({
  id,
  definition,
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
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const emblemPath =
    definition.image && assetsDir
      ? `${assetsDir}\\images\\${definition.image}`
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-8">
          <Section
            title="Identity"
            actions={
              <button
                type="button"
                onClick={onClose}
                className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/30 hover:text-text-primary"
              >
                <XIcon className="h-3 w-3" />
                Close
              </button>
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
                placeholder="A secretive order of spellwrights who…"
                rows={3}
              />
            </Field>
          </Section>

          <Section title="Rivals">
            {others.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                Add another faction to set up rivalries.
              </p>
            ) : (
              <RelationChips
                tone="rival"
                all={others}
                selected={enemies}
                factionLabelMap={factionLabelMap}
                onToggle={onToggleEnemy}
              />
            )}
            <p className="mt-2 text-2xs leading-snug text-text-muted/70">
              Killing a member of this faction grants reputation with the
              selected rivals, and vice versa.
            </p>
          </Section>

          <Section title="Allies">
            {others.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                Add another faction to declare alliances.
              </p>
            ) : (
              <RelationChips
                tone="ally"
                all={others}
                selected={allies}
                factionLabelMap={factionLabelMap}
                onToggle={onToggleAlly}
              />
            )}
            <p className="mt-2 text-2xs leading-snug text-text-muted/70">
              Lore-only — alliances appear on the relationship map but
              don't affect reputation, kill bonuses, or quest gating.
            </p>
          </Section>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-4">
          <Section title="Heraldry">
            <Field
              label="Color"
              hint="Used on the rivalry map and the badge ring in the list."
            >
              <ColorField
                value={definition.color ?? ""}
                onChange={(hex) => onPatch({ color: hex || undefined })}
              />
            </Field>
            <div className="mt-3">
              <p className="mb-1 font-display text-2xs uppercase tracking-wider text-text-muted">
                Emblem
              </p>
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
          </Section>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Delete faction
        </button>
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
        title="Rename — Esc to cancel"
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

interface RelationChipsProps {
  tone: "rival" | "ally";
  all: string[];
  selected: string[];
  factionLabelMap: Map<string, string>;
  onToggle: (id: string) => void;
}

function RelationChips({ tone, all, selected, factionLabelMap, onToggle }: RelationChipsProps) {
  const chipClasses =
    tone === "rival"
      ? "border-status-error/40 bg-status-error/10 text-status-error"
      : "border-status-success/40 bg-status-success/10 text-status-success";
  const removeClasses =
    tone === "rival"
      ? "text-status-error/70 hover:bg-status-error/20 hover:text-status-error"
      : "text-status-success/70 hover:bg-status-success/20 hover:text-status-success";
  const missingTooltip =
    tone === "rival"
      ? "Define it or remove the rivalry."
      : "Define it or remove the alliance.";

  return (
    <div className="rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((eid) => {
          const label = factionLabelMap.get(eid);
          const missing = !label;
          return (
            <span
              key={eid}
              title={missing ? `Unknown faction: ${eid}. ${missingTooltip}` : undefined}
              className={cx(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-display text-2xs",
                missing
                  ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                  : chipClasses,
              )}
            >
              {missing && <span aria-hidden="true">{"⚠ "}</span>}
              {label ?? eid}
              <button
                type="button"
                onClick={() => onToggle(eid)}
                aria-label={`Remove ${label ?? eid}`}
                className={cx(
                  "focus-ring -mr-0.5 rounded p-0.5 transition",
                  missing
                    ? "text-status-warning/70 hover:bg-status-warning/20 hover:text-status-warning"
                    : removeClasses,
                )}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      {all.filter((id) => !selected.includes(id)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--chrome-stroke)] pt-2">
          {all
            .filter((id) => !selected.includes(id))
            .map((eid) => (
              <button
                key={eid}
                type="button"
                onClick={() => onToggle(eid)}
                className={cx(
                  "focus-ring inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--chrome-stroke-strong)] bg-transparent px-2 py-1 font-display text-2xs text-text-muted transition",
                  tone === "rival"
                    ? "hover:border-status-error/40 hover:text-status-error"
                    : "hover:border-status-success/40 hover:text-status-success",
                )}
              >
                + {factionLabelMap.get(eid) ?? eid}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
