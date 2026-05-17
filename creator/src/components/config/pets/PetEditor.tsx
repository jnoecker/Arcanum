import { useState } from "react";
import type { PetDefinitionConfig, PetSpellConfig } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
  cx,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getPreamble, type ArtStyle } from "@/lib/arcanumPrompts";
import { useImageSrc } from "@/lib/useImageSrc";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, TrashIcon } from "@/components/config/icons";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

const THREAT_ROLES: { value: string; label: string }[] = [
  { value: "tank", label: "Tank" },
  { value: "balanced", label: "Balanced" },
  { value: "dps", label: "DPS" },
];

const THREAT_VALUES: Record<string, number> = {
  tank: 3.0,
  balanced: 1.0,
  dps: 0.0,
};

function threatRole(multiplier: number | undefined): string {
  if (multiplier !== undefined && multiplier >= 2.0) return "tank";
  if (multiplier === 0 || multiplier === undefined) return "dps";
  return "balanced";
}

function petPrompt(pet: PetDefinitionConfig, style: ArtStyle): string {
  const preamble = getPreamble(style, "worldbuilding");
  return `${preamble}, a summoned companion creature — "${pet.name}", ${pet.description || "a loyal magical pet"}, full body portrait, RPG companion creature, no text`;
}

function petSpellPrompt(
  pet: PetDefinitionConfig,
  spell: PetSpellConfig,
  spellId: string,
  style: ArtStyle,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const label = spell.displayName || spellId;
  const flavor = spell.message || spell.roomMessage || "a special pet ability";
  return `${preamble}, a game ability icon for "${label}" — a skill cast by a ${pet.name || "companion"}, ${flavor}, centered square composition like an RPG ability sprite, iconic symbol rendered as flowing energy, no text, no figures`;
}

function buildPetSpellContext(
  pet: PetDefinitionConfig,
  spell: PetSpellConfig,
  spellId: string,
): string {
  const parts = [
    `Pet: ${pet.name}`,
    `Spell: ${spell.displayName || spellId}`,
    spell.message ? `Message: ${spell.message}` : null,
    spell.statusEffectId ? `Applies status: ${spell.statusEffectId}` : null,
    spell.minDamage != null && spell.maxDamage != null
      ? `Damage: ${spell.minDamage}-${spell.maxDamage}`
      : null,
    spell.healMin != null && spell.healMax != null && (spell.healMin || spell.healMax)
      ? `Heal: ${spell.healMin}-${spell.healMax}`
      : null,
  ];
  return parts.filter(Boolean).join("\n");
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

interface PetEditorProps {
  id: string;
  pet: PetDefinitionConfig;
  statusEffectIds?: string[];
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}

export function PetEditor({ id, pet, statusEffectIds, onPatch, onRename }: PetEditorProps) {
  const role = threatRole(pet.threatMultiplier);
  const isTank = (pet.threatMultiplier ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-7 flex flex-col gap-3">
        <IdentityCard id={id} pet={pet} onPatch={onPatch} onRename={onRename} />
        <CombatStatsCard pet={pet} onPatch={onPatch} role={role} />
        <SpellsCard
          petId={id}
          pet={pet}
          onPatch={onPatch}
          statusEffectIds={statusEffectIds ?? []}
          showThreatBonus={isTank}
        />
      </div>

      <div className="lg:col-span-5">
        <PortraitCard id={id} pet={pet} onPatch={onPatch} />
      </div>
    </div>
  );
}

// ─── Identity ──────────────────────────────────────────────────────

function IdentityCard({
  id,
  pet,
  onPatch,
  onRename,
}: {
  id: string;
  pet: PetDefinitionConfig;
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
  onRename: (v: string) => void;
}) {
  return (
    <SectionCard title="Identity">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Slug" required>
          <SlugRenamer id={id} onRename={onRename} />
        </FieldLabel>
        <FieldLabel label="Display Name" required>
          <TextInput
            value={pet.name}
            onCommit={(v) => onPatch({ name: v })}
            placeholder="A Wolf Companion"
            dense
          />
        </FieldLabel>
      </div>
      <div className="mt-3">
        <FieldLabel label="Flavor Description">
          <CommitTextarea
            label=""
            value={pet.description ?? ""}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="A long grey wolf with sharp yellow eyes…"
            rows={3}
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
      placeholder="wolf_companion"
    />
  );
}

// ─── Combat stats (with role + default attack) ─────────────────────

function CombatStatsCard({
  pet,
  onPatch,
  role,
}: {
  pet: PetDefinitionConfig;
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
  role: string;
}) {
  const spellIds = Object.keys(pet.spells ?? {});
  return (
    <SectionCard title="Combat Stats">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatBlock
          label="HP"
          value={pet.hp}
          onCommit={(v) => onPatch({ hp: v ?? 20 })}
          tone="rose"
        />
        <StatBlock
          label="Min DMG"
          value={pet.minDamage}
          onCommit={(v) => onPatch({ minDamage: v ?? 1 })}
          tone="warm"
        />
        <StatBlock
          label="Max DMG"
          value={pet.maxDamage}
          onCommit={(v) => onPatch({ maxDamage: v ?? 4 })}
          tone="warm"
        />
        <StatBlock
          label="Armor"
          value={pet.armor}
          onCommit={(v) => onPatch({ armor: v ?? 0 })}
          tone="blue"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Role">
          <SelectInput
            value={role}
            onCommit={(v) => onPatch({ threatMultiplier: THREAT_VALUES[v] })}
            options={THREAT_ROLES}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Default Attack">
          <SelectInput
            value={pet.defaultAttack ?? ""}
            onCommit={(v) => onPatch({ defaultAttack: v || undefined })}
            options={spellIds.map((sid) => ({
              value: sid,
              label: pet.spells?.[sid]?.displayName || sid,
            }))}
            placeholder="Standard melee"
            allowEmpty
            dense
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

function StatBlock({
  label,
  value,
  onCommit,
  tone,
}: {
  label: string;
  value: number;
  onCommit: (v: number | undefined) => void;
  tone: "rose" | "warm" | "blue";
}) {
  const toneClass =
    tone === "rose"
      ? "border-status-error/30 bg-status-error/[0.06]"
      : tone === "warm"
        ? "border-accent/30 bg-accent/[0.06]"
        : "border-stellar-blue/30 bg-stellar-blue/[0.06]";
  return (
    <div className={cx("rounded-xl border px-3 py-2.5", toneClass)}>
      <p className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <div className="mt-1.5">
        <NumberInput value={value} onCommit={onCommit} min={0} dense />
      </div>
    </div>
  );
}

// ─── Portrait ──────────────────────────────────────────────────────

function PortraitCard({
  id,
  pet,
  onPatch,
}: {
  id: string;
  pet: PetDefinitionConfig;
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Portrait">
      <EntityArtGenerator
        getPrompt={(style) => petPrompt(pet, style)}
        entityContext={buildPetContext(pet)}
        currentImage={pet.image}
        onAccept={(filePath) => onPatch({ image: filePath })}
        assetType="pet"
        context={{ zone: "", entity_type: "pet", entity_id: id }}
        surface="worldbuilding"
      />
    </SectionCard>
  );
}

// ─── Spells ────────────────────────────────────────────────────────

function SpellsCard({
  petId,
  pet,
  onPatch,
  statusEffectIds,
  showThreatBonus,
}: {
  petId: string;
  pet: PetDefinitionConfig;
  onPatch: (p: Partial<PetDefinitionConfig>) => void;
  statusEffectIds: string[];
  showThreatBonus: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const spells = pet.spells ?? {};
  const spellIds = Object.keys(spells);

  const addSpell = (sid: string) => {
    const next = { ...spells };
    next[sid] = { displayName: "", message: "", weight: 1 };
    onPatch({ spells: next });
    setAdding(false);
    setNewId("");
    setExpanded(sid);
  };

  const updateSpell = (sid: string, field: string, value: unknown) => {
    const next = { ...spells };
    next[sid] = { ...next[sid], [field]: value } as PetSpellConfig;
    onPatch({ spells: next });
  };

  const deleteSpell = (sid: string) => {
    const next = { ...spells };
    delete next[sid];
    const cleaned = Object.keys(next).length > 0 ? next : undefined;
    onPatch({
      spells: cleaned,
      defaultAttack: pet.defaultAttack === sid ? undefined : pet.defaultAttack,
    });
    if (expanded === sid) setExpanded(null);
  };

  return (
    <SectionCard
      title={`Spells (${spellIds.length})`}
      actions={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add Spell
        </button>
      }
    >
      {adding && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
          <input
            autoFocus
            className="ornate-input min-w-0 flex-1 px-2 py-1 font-mono text-xs text-text-primary"
            placeholder="spell_id"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const sid = normalizeId(newId);
                if (sid && !spells[sid]) addSpell(sid);
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewId("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const sid = normalizeId(newId);
              if (sid && !spells[sid]) addSpell(sid);
            }}
            disabled={!newId.trim() || !!spells[normalizeId(newId)]}
            className="focus-ring rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewId("");
            }}
            className="rounded-lg px-2 py-1 text-2xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      )}

      {spellIds.length === 0 ? (
        !adding && (
          <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-6 text-center">
            <p className="text-2xs italic text-text-muted/80">
              No spells defined. This pet uses standard melee attacks.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {spellIds.map((sid) => (
            <SpellRow
              key={sid}
              id={sid}
              petId={petId}
              pet={pet}
              spell={spells[sid]!}
              expanded={expanded === sid}
              statusEffectIds={statusEffectIds}
              showThreatBonus={showThreatBonus}
              onToggle={() => setExpanded(expanded === sid ? null : sid)}
              onUpdate={(field, value) => updateSpell(sid, field, value)}
              onDelete={() => deleteSpell(sid)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SpellRow({
  id,
  petId,
  pet,
  spell,
  expanded,
  statusEffectIds,
  showThreatBonus,
  onToggle,
  onUpdate,
  onDelete,
}: {
  id: string;
  petId: string;
  pet: PetDefinitionConfig;
  spell: PetSpellConfig;
  expanded: boolean;
  statusEffectIds: string[];
  showThreatBonus: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: unknown) => void;
  onDelete: () => void;
}) {
  const iconSrc = useImageSrc(spell.image || undefined);
  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl border transition",
        expanded
          ? "border-accent/40 bg-accent/[0.04]"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]",
      )}
    >
      <div className="group flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Caret expanded={expanded} />
          <div
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border",
              expanded
                ? "border-accent/40"
                : "border-[var(--chrome-stroke)] group-hover:border-[var(--chrome-stroke-strong)]",
            )}
          >
            {iconSrc ? (
              <img src={iconSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true" className="font-display text-2xs text-text-muted/40">
                ◆
              </span>
            )}
          </div>
          <span className="truncate font-display text-sm font-semibold text-text-primary">
            {spell.displayName || id}
          </span>
          <span className="font-mono text-2xs text-text-muted/60">{id}</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete spell ${id}`}
          title={`Delete spell ${id}`}
          className="focus-ring shrink-0 rounded-lg p-1.5 text-text-muted/70 transition hover:bg-status-error/15 hover:text-status-error"
        >
          <TrashIcon />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-[var(--chrome-stroke)] px-3 pb-3 pt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldLabel label="Display Name">
              <TextInput
                value={spell.displayName}
                onCommit={(v) => onUpdate("displayName", v)}
                placeholder="e.g. Fire Bolt"
                dense
              />
            </FieldLabel>
            <FieldLabel label="Weight">
              <NumberInput
                value={spell.weight ?? 1}
                onCommit={(v) => onUpdate("weight", v ?? 1)}
                min={0}
                dense
              />
            </FieldLabel>
            <FieldLabel
              label="Message"
              tooltip="Sent only to the pet's owner. Leave blank to use the default — e.g. '{pet} hits {target} with <name> for N damage.'"
            >
              <TextInput
                value={spell.message}
                onCommit={(v) => onUpdate("message", v)}
                placeholder="{pet} bites {target} for {damage} damage."
                dense
              />
            </FieldLabel>
            <FieldLabel
              label="Room Message"
              tooltip="Broadcast to other players in the room (owner is excluded). Falls back to Message when blank."
            >
              <TextInput
                value={spell.roomMessage ?? ""}
                onCommit={(v) => onUpdate("roomMessage", v || undefined)}
                placeholder="{pet} sinks its fangs into {target}."
                dense
              />
            </FieldLabel>
          </div>

          <MessageHelp hasDamage={(spell.minDamage ?? 0) > 0 || (spell.maxDamage ?? 0) > 0} />

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatBlock
              label="Min DMG"
              value={spell.minDamage ?? 0}
              onCommit={(v) => onUpdate("minDamage", v || undefined)}
              tone="warm"
            />
            <StatBlock
              label="Max DMG"
              value={spell.maxDamage ?? 0}
              onCommit={(v) => onUpdate("maxDamage", v || undefined)}
              tone="warm"
            />
            <StatBlock
              label="Heal Min"
              value={spell.healMin ?? 0}
              onCommit={(v) => onUpdate("healMin", v || undefined)}
              tone="rose"
            />
            <StatBlock
              label="Heal Max"
              value={spell.healMax ?? 0}
              onCommit={(v) => onUpdate("healMax", v || undefined)}
              tone="rose"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <StatBlock
              label="Cooldown (ms)"
              value={spell.cooldownMs ?? 0}
              onCommit={(v) => onUpdate("cooldownMs", v || undefined)}
              tone="blue"
            />
            {showThreatBonus && (
              <StatBlock
                label="Threat Bonus"
                value={spell.threatBonus ?? 0}
                onCommit={(v) => onUpdate("threatBonus", v || undefined)}
                tone="warm"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <FieldLabel label="Applies Status Effect">
              <SelectInput
                value={spell.statusEffectId ?? ""}
                onCommit={(v) => onUpdate("statusEffectId", v || undefined)}
                options={statusEffectIds.map((sid) => ({ value: sid, label: sid }))}
                placeholder="None"
                allowEmpty
                dense
              />
            </FieldLabel>
          </div>

          <FieldLabel label="Skill Icon">
            <EntityArtGenerator
              getPrompt={(style) => petSpellPrompt(pet, spell, id, style)}
              entityContext={buildPetSpellContext(pet, spell, id)}
              currentImage={spell.image}
              onAccept={(filePath) => onUpdate("image", filePath)}
              assetType="ability_icon"
              context={{ zone: "", entity_type: "pet_spell", entity_id: `${petId}__${id}` }}
              surface="worldbuilding"
            />
          </FieldLabel>
        </div>
      )}
    </div>
  );
}

function Caret({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "shrink-0 text-text-muted/70 transition-transform",
        expanded && "rotate-90",
      )}
    >
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}

// ─── Shared label primitive ────────────────────────────────────────

function FieldLabel({
  label,
  required,
  tooltip,
  children,
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cx(
          "font-display text-2xs uppercase tracking-wider text-text-muted",
          tooltip && "cursor-help decoration-text-muted/40 decoration-dotted underline-offset-2 hover:underline",
        )}
        title={tooltip}
      >
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}

function MessageHelp({ hasDamage }: { hasDamage: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-2xs text-text-muted/90">
      <p className="mb-1 font-display uppercase tracking-wider text-text-secondary">
        Placeholders
      </p>
      <ul className="space-y-0.5">
        <li>
          <code className="font-mono text-accent">{"{pet}"}</code> — the pet's
          display name (e.g. <em>a wolf companion</em>)
        </li>
        <li>
          <code className="font-mono text-accent">{"{target}"}</code> — the
          target mob's display name
        </li>
        <li>
          <code className="font-mono text-accent">{"{damage}"}</code> — final
          damage after armor.{" "}
          {hasDamage ? (
            <span className="text-text-muted/70">Substituted on this skill.</span>
          ) : (
            <span className="text-status-warning">
              This skill deals no damage — <code className="font-mono">{"{damage}"}</code> would render literally. Omit it.
            </span>
          )}
        </li>
      </ul>
      <p className="mt-1.5 text-text-muted/70">
        <strong className="font-semibold text-text-secondary">Message</strong>{" "}
        goes to the owner;{" "}
        <strong className="font-semibold text-text-secondary">Room Message</strong>{" "}
        to others in the room. Both lines appear in the main game scrollback.
      </p>
    </div>
  );
}
