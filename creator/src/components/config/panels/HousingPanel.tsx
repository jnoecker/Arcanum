import { useMemo, useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { HousingTemplateDefinition } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
  FieldGrid,
  CompactField,
  Badge,
} from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";
import { useImageSrc } from "@/lib/useImageSrc";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const DIRECTION_OPTIONS = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "UP", label: "Up" },
  { value: "DOWN", label: "Down" },
];

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function defaultTemplate(raw: string): HousingTemplateDefinition {
  return { title: raw || "New Room", description: "", cost: 0 };
}

export function HousingPanel({ config, onChange }: ConfigPanelProps) {
  const housing = config.housing;
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const stations = useConfigStore((s) => s.config?.craftingStationTypes);
  const stationOptions = useMemo(
    () => [
      { value: "", label: "— none —" },
      ...Object.entries(stations ?? {}).map(([id, s]) => ({
        value: id,
        label: s.displayName || id,
      })),
    ],
    [stations],
  );

  const patchHousing = (p: Partial<AppConfig["housing"]>) =>
    onChange({ housing: { ...housing, ...p } });

  const patchTemplate = (
    id: string,
    p: Partial<HousingTemplateDefinition>,
  ) => {
    const t = housing.templates[id];
    if (!t) return;
    patchHousing({
      templates: { ...housing.templates, [id]: { ...t, ...p } },
    });
  };

  const addTemplate = () => {
    const id = normalizeId(newName);
    if (!id || housing.templates[id]) return;
    patchHousing({
      templates: {
        ...housing.templates,
        [id]: defaultTemplate(newName.trim()),
      },
    });
    setNewName("");
    setSelected(id);
  };

  const deleteTemplate = (id: string) => {
    const next = { ...housing.templates };
    delete next[id];
    patchHousing({ templates: next });
    if (selected === id) setSelected(null);
  };

  const templateIds = Object.keys(housing.templates);
  const entryCount = templateIds.filter(
    (id) => housing.templates[id]?.isEntry,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              Player housing
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Home is where the hearth is
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Each character can buy a persistent home assembled from room
              templates — a gold sink, a social hub, and optionally an offline
              item vault. Disable the system entirely if your world is purely
              adventure-focused.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border-muted/50 pt-4">
            <button
              type="button"
              role="switch"
              aria-checked={housing.enabled}
              onClick={() => patchHousing({ enabled: !housing.enabled })}
              className={cx(
                "focus-ring group flex items-center gap-3 rounded-full border px-4 py-2 transition",
                housing.enabled
                  ? "border-accent/40 bg-accent/15 text-accent shadow-[0_0_24px_-8px_rgb(var(--accent-rgb)/0.7)]"
                  : "border-border-muted bg-bg-primary/50 text-text-muted hover:border-border-default hover:text-text-secondary",
              )}
            >
              <span
                className={cx(
                  "relative inline-block h-5 w-9 rounded-full transition-colors",
                  housing.enabled ? "bg-accent/30" : "bg-bg-primary",
                )}
              >
                <span
                  className={cx(
                    "absolute top-0.5 h-4 w-4 rounded-full transition-all",
                    housing.enabled
                      ? "left-[calc(100%-1.125rem)] bg-accent shadow-[0_0_8px_rgb(var(--accent-rgb)/0.9)]"
                      : "left-0.5 bg-text-muted",
                  )}
                />
              </span>
              <span className="font-display text-xs font-semibold uppercase tracking-wider">
                {housing.enabled ? "System enabled" : "System disabled"}
              </span>
            </button>

            <label className="flex items-center gap-2">
              <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
                Exit direction
              </span>
              <div className="w-28">
                <SelectInput
                  value={housing.entryExitDirection}
                  options={DIRECTION_OPTIONS}
                  onCommit={(v) => patchHousing({ entryExitDirection: v })}
                />
              </div>
            </label>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {templateIds.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {templateIds.length === 1 ? "room template" : "room templates"}
              </p>
              {templateIds.length > 0 && (
                <p
                  className={cx(
                    "mt-0.5 text-2xs",
                    entryCount === 1
                      ? "text-text-muted/70"
                      : "text-status-warning/80",
                  )}
                >
                  {entryCount === 0
                    ? "no entry set"
                    : entryCount === 1
                      ? "entry configured"
                      : `${entryCount} entries — need exactly 1`}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className={cx(
          "flex flex-col gap-3 transition-opacity",
          !housing.enabled && "opacity-60",
        )}
      >
        <header className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-text-primary">
              Room Templates
            </h3>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted/70">
              Floor plans players can attach to their house. Exactly one
              template must be marked as the{" "}
              <span className="text-accent/80">entry room</span>.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="w-36 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="new_room_id"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTemplate();
              }}
              disabled={!housing.enabled}
            />
            <button
              type="button"
              onClick={addTemplate}
              disabled={!housing.enabled || !newName.trim()}
              className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </header>

        {templateIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 px-6 py-10 text-center">
            <p className="font-display text-sm text-text-muted">
              No room templates yet.
            </p>
            <p className="mt-1 text-2xs text-text-muted/70">
              Start with an entry hall, then add specialized rooms — vault,
              forge, bedroom.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {templateIds.map((id) => {
              const t = housing.templates[id]!;
              return (
                <RoomCard
                  key={id}
                  id={id}
                  t={t}
                  stationLabel={
                    t.station
                      ? stations?.[t.station]?.displayName || t.station
                      : undefined
                  }
                  selected={selected === id}
                  onSelect={() =>
                    setSelected(selected === id ? null : id)
                  }
                  onDelete={() => deleteTemplate(id)}
                />
              );
            })}
          </div>
        )}

        {selected && housing.templates[selected] && (
          <RoomEditor
            id={selected}
            t={housing.templates[selected]!}
            stationOptions={stationOptions}
            onPatch={(p) => patchTemplate(selected, p)}
            onClose={() => setSelected(null)}
            onDelete={() => deleteTemplate(selected)}
          />
        )}
      </section>
    </div>
  );
}

interface RoomCardProps {
  id: string;
  t: HousingTemplateDefinition;
  stationLabel?: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function RoomCard({
  id,
  t,
  stationLabel,
  selected,
  onSelect,
  onDelete,
}: RoomCardProps) {
  const thumb = useImageSrc(t.image || undefined);
  const vaultCap = t.maxDroppedItems ?? 0;
  const hasFeatures =
    Boolean(t.safe) || vaultCap > 0 || Boolean(stationLabel) || Boolean(t.isEntry);

  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-2xl border transition",
        selected
          ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-10px_rgb(var(--accent-rgb)/0.65)]"
          : "border-border-muted/50 bg-bg-primary/25 hover:border-border-default hover:bg-bg-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-ring flex w-full items-stretch gap-3 p-3 text-left"
        aria-expanded={selected}
      >
        <div
          className={cx(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            selected
              ? "border-accent/40"
              : "border-border-muted/40 group-hover:border-border-muted",
          )}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={t.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg-abyss/40">
              <span className="font-display text-[0.55rem] uppercase tracking-[0.2em] text-text-muted/50">
                Room
              </span>
            </div>
          )}
          {t.isEntry && (
            <span className="absolute left-1 top-1 rounded-full bg-accent/90 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-bg-abyss">
              Entry
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-display text-sm font-semibold text-text-primary">
                {t.title || id}
              </h4>
              <p className="truncate text-2xs text-text-muted/70">{id}</p>
            </div>
            <div className="flex shrink-0 items-baseline gap-1 font-display font-semibold text-warm">
              <span className="text-base leading-none">{t.cost}</span>
              <span className="text-[0.6rem] uppercase tracking-wider text-warm/70">
                gold
              </span>
            </div>
          </div>

          {t.description && (
            <p className="mt-1 line-clamp-2 text-2xs leading-snug text-text-muted/70">
              {t.description}
            </p>
          )}

          {hasFeatures && (
            <div className="mt-2 flex flex-wrap gap-1">
              {t.safe && <Badge variant="info">Safe</Badge>}
              {vaultCap > 0 && (
                <Badge variant="warning">Vault · {vaultCap}</Badge>
              )}
              {stationLabel && (
                <Badge variant="violet">{stationLabel}</Badge>
              )}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${id}`}
        className="focus-ring absolute right-2 top-2 rounded p-1 text-text-muted/40 opacity-0 transition hover:bg-status-error/15 hover:text-status-error group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

interface RoomEditorProps {
  id: string;
  t: HousingTemplateDefinition;
  stationOptions: { value: string; label: string }[];
  onPatch: (p: Partial<HousingTemplateDefinition>) => void;
  onClose: () => void;
  onDelete: () => void;
}

function RoomEditor({
  id,
  t,
  stationOptions,
  onPatch,
  onClose,
  onDelete,
}: RoomEditorProps) {
  return (
    <div className="panel-surface relative overflow-hidden rounded-2xl p-5 shadow-section">
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border-muted/50 pb-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-wider text-text-muted">
              Editing room
            </p>
            <h3 className="font-display font-semibold text-base text-text-primary">
              {t.title || id}
              <span className="ml-2 font-sans text-xs font-normal text-text-muted/70">
                {id}
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full border border-border-muted/60 px-3 py-1 text-2xs text-text-muted transition hover:border-border-default hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <FieldGrid>
          <CompactField label="Title" span>
            <TextInput value={t.title} onCommit={(v) => onPatch({ title: v })} />
          </CompactField>

          <CompactField
            label="Description"
            span
            hint="Default prose shown when players 'look' in the room. Owners can rewrite this to personalize their home."
          >
            <CommitTextarea
              label="Description"
              value={t.description}
              onCommit={(v) => onPatch({ description: v })}
              placeholder="A cozy chamber lit by hanging lanterns..."
              rows={3}
            />
          </CompactField>

          <CompactField
            label="Gold cost"
            hint="One-time cost to attach this room to a house."
          >
            <NumberInput
              value={t.cost}
              onCommit={(v) => onPatch({ cost: v ?? 0 })}
              min={0}
            />
          </CompactField>

          <CompactField
            label="Vault capacity"
            hint="If > 0, dropped items persist across resets up to this count."
          >
            <NumberInput
              value={t.maxDroppedItems ?? 0}
              onCommit={(v) =>
                onPatch({ maxDroppedItems: v && v > 0 ? v : undefined })
              }
              min={0}
              placeholder="0"
            />
          </CompactField>

          <CompactField
            label="Crafting station"
            hint="Optional station this room provides (forge, alchemy, etc.)."
          >
            <SelectInput
              value={t.station ?? ""}
              options={stationOptions}
              onCommit={(v) => onPatch({ station: v || undefined })}
            />
          </CompactField>

          <CompactField
            label="Background image"
            hint="Optional asset filename. Leave blank to use house default."
          >
            <TextInput
              value={t.image ?? ""}
              onCommit={(v) => onPatch({ image: v || undefined })}
              placeholder="Optional"
            />
          </CompactField>
        </FieldGrid>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-muted/50 pt-4">
          <FlagToggle
            label="Entry room"
            description="Exactly one template must be the entry."
            active={t.isEntry ?? false}
            onToggle={() => onPatch({ isEntry: !t.isEntry || undefined })}
          />
          <FlagToggle
            label="Safe zone"
            description="Blocks combat from starting or continuing."
            active={t.safe ?? false}
            onToggle={() => onPatch({ safe: !t.safe || undefined })}
          />
          <div className="ml-auto">
            <button
              type="button"
              onClick={onDelete}
              className="focus-ring rounded border border-status-error/30 bg-status-error/10 px-2.5 py-1 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
            >
              Delete room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FlagToggleProps {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}

function FlagToggle({ label, description, active, onToggle }: FlagToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      title={description}
      className={cx(
        "focus-ring flex items-center gap-2 rounded-full border px-3 py-1 transition",
        active
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-border-muted/60 bg-bg-primary/40 text-text-muted hover:border-border-default hover:text-text-primary",
      )}
    >
      <span
        className={cx(
          "h-2 w-2 rounded-full transition",
          active
            ? "bg-accent shadow-[0_0_6px_rgb(var(--accent-rgb)/0.9)]"
            : "bg-text-muted/40",
        )}
      />
      <span className="text-2xs font-semibold uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
