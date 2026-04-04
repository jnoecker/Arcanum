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
  const preamble = getPreamble(style);
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
    <>
      <FieldRow label="Name" hint="Display name shown in-game (e.g. 'a fire familiar')">
        <TextInput
          value={pet.name}
          onCommit={(v) => patch({ name: v })}
        />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput
          value={pet.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="Flavor text"
        />
      </FieldRow>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Combat Stats
        </h5>
        <p className="mb-2 text-2xs text-text-muted">
          Base values scaled by owner level (+10% per level above 1).
        </p>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="HP" hint="Base hit points">
            <NumberInput
              value={pet.hp}
              onCommit={(v) => patch({ hp: v ?? 20 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Min Damage" hint="Minimum damage roll">
            <NumberInput
              value={pet.minDamage}
              onCommit={(v) => patch({ minDamage: v ?? 1 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Max Damage" hint="Maximum damage roll">
            <NumberInput
              value={pet.maxDamage}
              onCommit={(v) => patch({ maxDamage: v ?? 4 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Armor" hint="Damage reduction">
            <NumberInput
              value={pet.armor}
              onCommit={(v) => patch({ armor: v ?? 0 })}
              min={0}
            />
          </FieldRow>
        </div>
      </div>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Art
        </h5>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Image">
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
          />
        </div>
      </div>
    </>
  );
}
