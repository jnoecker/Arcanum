import { useCallback, useMemo, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { PetDefinitionConfig } from "@/types/config";
import {
  TextInput,
  NumberInput,
  CommitTextarea,
  FieldGrid,
  CompactField,
  Badge,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import { getPreamble } from "@/lib/arcanumPrompts";
import type { ArtStyle } from "@/lib/arcanumPrompts";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function defaultPetDefinition(raw: string): PetDefinitionConfig {
  return {
    name: raw || "New Pet",
    hp: 20,
    minDamage: 1,
    maxDamage: 4,
    armor: 0,
  };
}

function petPrompt(pet: PetDefinitionConfig, style: ArtStyle): string {
  const preamble = getPreamble(style, "worldbuilding");
  return `${preamble}, a summoned companion creature — "${pet.name}", ${pet.description || "a loyal magical pet"}, full body portrait, RPG companion creature, no text`;
}

function buildPetContext(pet: PetDefinitionConfig): string {
  const parts = [
    `Pet: ${pet.name}`,
    pet.description ? `Description: ${pet.description}` : null,
    `HP: ${pet.hp}`,
    `Damage: ${pet.minDamage}-${pet.maxDamage}`,
    `Armor: ${pet.armor}`,
  ];
  return parts.filter(Boolean).join("\n");
}

export function PetsPanel({ config, onChange }: ConfigPanelProps) {
  const pets = config.pets ?? {};
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const patchPets = useCallback(
    (next: Record<string, PetDefinitionConfig>) => onChange({ pets: next }),
    [onChange],
  );

  const patchPet = useCallback(
    (id: string, p: Partial<PetDefinitionConfig>) => {
      const current = pets[id];
      if (!current) return;
      patchPets({ ...pets, [id]: { ...current, ...p } });
    },
    [pets, patchPets],
  );

  const addPet = useCallback(() => {
    const id = normalizeId(newName);
    if (!id || pets[id]) return;
    patchPets({ ...pets, [id]: defaultPetDefinition(newName.trim()) });
    setNewName("");
    setSelected(id);
  }, [newName, pets, patchPets]);

  const deletePet = useCallback(
    (id: string) => {
      const next = { ...pets };
      delete next[id];
      patchPets(next);
      if (selected === id) setSelected(null);
    },
    [pets, selected, patchPets],
  );

  const renamePet = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || pets[newId]) return;
      const next: Record<string, PetDefinitionConfig> = {};
      for (const [k, v] of Object.entries(pets)) {
        next[k === oldId ? newId : k] = v;
      }
      patchPets(next);
      if (selected === oldId) setSelected(newId);
      setRenaming(null);
    },
    [pets, selected, patchPets],
  );

  const petIds = useMemo(() => Object.keys(pets), [pets]);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              Combat companions
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Pets &amp; Familiars
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Summonable creatures that fight alongside their owners — bound by
              ritual, not leash. Rangers, summoners, and mages call upon these
              templates; every player pet is an instance of one of the entries
              below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border-muted/50 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-2">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="text-accent"
                aria-hidden="true"
              >
                <path
                  d="M12 2L14.5 8.5L21 9.5L16.5 14L17.5 21L12 18L6.5 21L7.5 14L3 9.5L9.5 8.5L12 2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-accent">
                  +10% per owner level
                </p>
                <p className="text-2xs text-text-muted/80">
                  Base stats scale linearly with the summoner's level above 1.
                </p>
              </div>
            </div>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {petIds.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {petIds.length === 1 ? "pet template" : "pet templates"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-text-primary">
              Bestiary
            </h3>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted/70">
              Templates that players and summoning abilities can instantiate.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="w-40 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="new_pet_id"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPet();
              }}
            />
            <button
              type="button"
              onClick={addPet}
              disabled={!newName.trim()}
              className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </header>

        {petIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 px-6 py-12 text-center">
            <p className="font-display text-sm text-text-muted">
              The bestiary is empty.
            </p>
            <p className="mt-1 text-2xs text-text-muted/70">
              Add a familiar, a loyal beast, or an elemental servant to get
              started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {petIds.map((id) => {
              const pet = pets[id]!;
              return (
                <PetCard
                  key={id}
                  id={id}
                  pet={pet}
                  selected={selected === id}
                  onSelect={() => setSelected(selected === id ? null : id)}
                  onDelete={() => deletePet(id)}
                />
              );
            })}
          </div>
        )}

        {selected && pets[selected] && (
          <PetEditor
            id={selected}
            pet={pets[selected]!}
            renaming={renaming === selected}
            renameValue={renameValue}
            onStartRename={() => {
              setRenaming(selected);
              setRenameValue(selected);
            }}
            onRenameChange={setRenameValue}
            onCommitRename={() => renamePet(selected, renameValue)}
            onCancelRename={() => setRenaming(null)}
            onPatch={(p) => patchPet(selected, p)}
            onClose={() => setSelected(null)}
            onDelete={() => deletePet(selected)}
          />
        )}
      </section>
    </div>
  );
}

interface PetCardProps {
  id: string;
  pet: PetDefinitionConfig;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function PetCard({ id, pet, selected, onSelect, onDelete }: PetCardProps) {
  const thumb = useImageSrc(pet.image || undefined);

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
        aria-expanded={selected}
        className="focus-ring flex w-full items-stretch gap-3 p-3 text-left"
      >
        <div
          className={cx(
            "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
            selected
              ? "border-accent/40"
              : "border-border-muted/40 group-hover:border-border-muted",
          )}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={pet.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg-abyss/40">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="text-text-muted/40"
                aria-hidden="true"
              >
                <path
                  d="M8 11C9.1 11 10 10.1 10 9C10 7.9 9.1 7 8 7C6.9 7 6 7.9 6 9C6 10.1 6.9 11 8 11ZM16 11C17.1 11 18 10.1 18 9C18 7.9 17.1 7 16 7C14.9 7 14 7.9 14 9C14 10.1 14.9 11 16 11ZM12 14C10 14 8 15 7.5 17H16.5C16 15 14 14 12 14ZM5 4L3 6V9C3 11 4 13 5 14L5 18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V14C20 13 21 11 21 9V6L19 4L17 5L15 4L13 5L12 4L11 5L9 4L7 5L5 4Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-semibold text-text-primary">
              {pet.name || id}
            </h4>
            <p className="truncate text-2xs text-text-muted/70">{id}</p>
          </div>

          {pet.description && (
            <p className="mt-1 line-clamp-2 text-2xs italic leading-snug text-text-muted/70">
              {pet.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatChip label="HP" value={pet.hp} tint="rose" />
            <StatChip
              label="DMG"
              value={`${pet.minDamage}–${pet.maxDamage}`}
              tint="warm"
            />
            {pet.armor > 0 && (
              <StatChip label="ARM" value={pet.armor} tint="blue" />
            )}
            {pet.image && <Badge variant="muted">Art</Badge>}
          </div>
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

function StatChip({
  label,
  value,
  tint,
}: {
  label: string;
  value: string | number;
  tint: "rose" | "warm" | "blue";
}) {
  const tintClass =
    tint === "rose"
      ? "border-status-error/35 bg-status-error/10 text-status-error"
      : tint === "warm"
        ? "border-accent/35 bg-accent/10 text-accent"
        : "border-stellar-blue/35 bg-stellar-blue/10 text-stellar-blue";
  return (
    <span
      className={cx(
        "inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5",
        tintClass,
      )}
    >
      <span className="font-display text-[0.55rem] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="font-display text-xs font-semibold tabular-nums">
        {value}
      </span>
    </span>
  );
}

interface PetEditorProps {
  id: string;
  pet: PetDefinitionConfig;
  renaming: boolean;
  renameValue: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
  onClose: () => void;
  onDelete: () => void;
}

function PetEditor({
  id,
  pet,
  renaming,
  renameValue,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onPatch,
  onClose,
  onDelete,
}: PetEditorProps) {
  return (
    <div className="panel-surface relative overflow-hidden rounded-2xl p-5 shadow-section">
      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border-muted/50 pb-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-wider text-text-muted">
              Editing pet
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <h3 className="font-display font-semibold text-base text-text-primary">
                {pet.name || id}
              </h3>
              {renaming ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    className="w-32 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 font-sans text-xs text-text-primary outline-none focus:border-accent/50"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRename();
                      if (e.key === "Escape") onCancelRename();
                    }}
                  />
                  <button
                    type="button"
                    onClick={onCommitRename}
                    className="rounded bg-accent/20 px-1.5 py-0.5 text-2xs text-accent hover:bg-accent/30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="rounded px-1.5 py-0.5 text-2xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onStartRename}
                  title="Rename ID"
                  className="font-sans text-xs font-normal text-text-muted/70 underline-offset-2 hover:text-text-primary hover:underline"
                >
                  {id}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring shrink-0 rounded-full border border-border-muted/60 px-3 py-1 text-2xs text-text-muted transition hover:border-border-default hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,280px)_1fr]">
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 font-display text-2xs uppercase tracking-wider text-text-muted">
                Portrait
              </p>
              <EntityArtGenerator
                getPrompt={(style) => petPrompt(pet, style)}
                entityContext={buildPetContext(pet)}
                currentImage={pet.image}
                onAccept={(filePath) => onPatch({ image: filePath })}
                assetType="pet"
                context={{ zone: "", entity_type: "pet", entity_id: id }}
                surface="worldbuilding"
              />
            </div>
            <CompactField
              label="Asset filename"
              hint="Content-addressed filename from the project manifest."
            >
              <TextInput
                value={pet.image ?? ""}
                onCommit={(v) => onPatch({ image: v || undefined })}
                placeholder="None"
              />
            </CompactField>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p className="mb-2 font-display text-2xs uppercase tracking-wider text-text-muted">
                Identity
              </p>
              <FieldGrid>
                <CompactField label="Display name" span>
                  <TextInput
                    value={pet.name}
                    onCommit={(v) => onPatch({ name: v })}
                    placeholder="e.g. a fire familiar"
                  />
                </CompactField>
                <CompactField
                  label="Flavor description"
                  span
                  hint="One or two evocative sentences shown when players examine the pet."
                >
                  <CommitTextarea
                    label="Description"
                    value={pet.description ?? ""}
                    onCommit={(v) => onPatch({ description: v || undefined })}
                    placeholder="A small flame that flickers with playful intelligence..."
                    rows={2}
                  />
                </CompactField>
              </FieldGrid>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-2xs uppercase tracking-wider text-text-muted">
                  Combat stats
                </p>
                <p className="text-2xs text-text-muted/60">
                  level-1 baseline · +10% per owner level
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatInput
                  label="HP"
                  value={pet.hp}
                  onCommit={(v) => onPatch({ hp: v ?? 20 })}
                  tint="rose"
                />
                <StatInput
                  label="Min DMG"
                  value={pet.minDamage}
                  onCommit={(v) => onPatch({ minDamage: v ?? 1 })}
                  tint="warm"
                />
                <StatInput
                  label="Max DMG"
                  value={pet.maxDamage}
                  onCommit={(v) => onPatch({ maxDamage: v ?? 4 })}
                  tint="warm"
                />
                <StatInput
                  label="Armor"
                  value={pet.armor}
                  onCommit={(v) => onPatch({ armor: v ?? 0 })}
                  tint="blue"
                />
              </div>
            </div>

            <div className="mt-auto flex justify-end border-t border-border-muted/50 pt-3">
              <button
                type="button"
                onClick={onDelete}
                className="focus-ring rounded border border-status-error/30 bg-status-error/10 px-2.5 py-1 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
              >
                Delete pet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatInput({
  label,
  value,
  onCommit,
  tint,
}: {
  label: string;
  value: number;
  onCommit: (v: number | undefined) => void;
  tint: "rose" | "warm" | "blue";
}) {
  const tintClass =
    tint === "rose"
      ? "border-status-error/30 bg-status-error/[0.06]"
      : tint === "warm"
        ? "border-accent/25 bg-accent/[0.06]"
        : "border-stellar-blue/25 bg-stellar-blue/[0.06]";
  return (
    <div className={cx("rounded-xl border px-3 py-2", tintClass)}>
      <p className="font-display text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <div className="mt-1">
        <NumberInput value={value} onCommit={onCommit} min={0} />
      </div>
    </div>
  );
}
