import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { PetDefinitionConfig } from "@/types/config";
import {
  FieldRow,
  NumberInput,
  TextInput,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getPreamble } from "@/lib/arcanumPrompts";
import type { ArtStyle } from "@/lib/arcanumPrompts";

function defaultPetDefinition(raw: string): PetDefinitionConfig {
  return {
    name: raw,
    hp: 20,
    minDamage: 1,
    maxDamage: 4,
    armor: 0,
  };
}

function summarizePet(pet: PetDefinitionConfig): string {
  const parts = [`HP ${pet.hp}`, `DMG ${pet.minDamage}-${pet.maxDamage}`];
  if (pet.armor > 0) parts.push(`ARM ${pet.armor}`);
  if (pet.image) parts.push("art");
  return parts.join(" | ");
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
  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const pets: Record<string, PetDefinitionConfig> = {};
      for (const [k, v] of Object.entries(config.pets ?? {})) {
        pets[k === oldId ? newId : k] = v;
      }
      onChange({ pets });
    },
    [config.pets, onChange],
  );

  return (
    <RegistryPanel<PetDefinitionConfig>
      title="Pet Definitions"
      items={config.pets ?? {}}
      onItemsChange={(pets) => onChange({ pets })}
      onRenameId={handleRename}
      placeholder="New pet template key"
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(p) => p.name}
      defaultItem={defaultPetDefinition}
      renderSummary={(_id, p) => summarizePet(p)}
      renderDetail={(id, pet, patch) => (
        <PetDetail id={id} pet={pet} patch={patch} />
      )}
    />
  );
}

function PetDetail({
  id,
  pet,
  patch,
}: {
  id: string;
  pet: PetDefinitionConfig;
  patch: (p: Partial<PetDefinitionConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow
          label="Name"
          hint="Display name shown in-game, including any article. Example: 'a fire familiar' or 'Sparky the wolf pup'."
        >
          <TextInput
            value={pet.name}
            onCommit={(v) => patch({ name: v })}
          />
        </FieldRow>
        <FieldRow
          label="Description"
          hint="Optional flavor text shown when players examine the pet. Keep it short — one or two evocative sentences."
        >
          <TextInput
            value={pet.description ?? ""}
            onCommit={(v) => patch({ description: v || undefined })}
            placeholder="A small flame that flickers with playful intelligence..."
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border-muted/40 pt-2">
        <div className="flex flex-col gap-0.5">
          <h5 className="font-display text-2xs uppercase tracking-widest text-text-muted">
            Combat Stats
          </h5>
          <p className="text-2xs leading-relaxed text-text-muted/70">
            Base combat values for a level-1 owner. Stats scale by +10% per owner
            level above 1, so a level 5 mage gets a pet with 140% of these values.
          </p>
        </div>
        <FieldRow
          label="HP"
          hint="Base hit points at level 1. 20 is typical for a low-tier familiar; 50+ for a tanky combat pet."
        >
          <NumberInput
            value={pet.hp}
            onCommit={(v) => patch({ hp: v ?? 20 })}
            min={1}
          />
        </FieldRow>
        <FieldRow
          label="Min Damage"
          hint="Minimum damage per attack. The floor of the pet's damage roll — set to 1+ to guarantee some hit."
        >
          <NumberInput
            value={pet.minDamage}
            onCommit={(v) => patch({ minDamage: v ?? 1 })}
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Max Damage"
          hint="Maximum damage per attack. A wider min-max gap creates more damage variance. Try 1-4 for low tier, 5-12 for mid tier."
        >
          <NumberInput
            value={pet.maxDamage}
            onCommit={(v) => patch({ maxDamage: v ?? 4 })}
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Armor"
          hint="Flat damage reduction subtracted from incoming hits. 0 for glass-cannon casters; 5-15 for frontline summons."
        >
          <NumberInput
            value={pet.armor}
            onCommit={(v) => patch({ armor: v ?? 0 })}
            min={0}
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border-muted/40 pt-2">
        <div className="flex flex-col gap-0.5">
          <h5 className="font-display text-2xs uppercase tracking-widest text-text-muted">
            Art
          </h5>
          <p className="text-2xs leading-relaxed text-text-muted/70">
            Optional portrait shown when the pet is summoned or examined. Generate
            one from the entity context or reference an existing asset filename.
          </p>
        </div>
        <FieldRow
          label="Image"
          hint="Asset filename (from the project asset manifest). Leave blank to use a default pet icon."
        >
          <TextInput
            value={pet.image ?? ""}
            onCommit={(v) => patch({ image: v || undefined })}
            placeholder="None"
          />
        </FieldRow>
        <EntityArtGenerator
          getPrompt={(style) => petPrompt(pet, style)}
          entityContext={buildPetContext(pet)}
          currentImage={pet.image}
          onAccept={(filePath) => patch({ image: filePath })}
          assetType="pet"
          context={{ zone: "", entity_type: "pet", entity_id: id }}
          surface="worldbuilding"
        />
      </div>
    </div>
  );
}
