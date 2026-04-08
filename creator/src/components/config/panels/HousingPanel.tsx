import type { ConfigPanelProps, AppConfig } from "./types";
import type { HousingTemplateDefinition } from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { useConfigStore } from "@/stores/configStore";

const DIRECTION_OPTIONS = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "UP", label: "Up" },
  { value: "DOWN", label: "Down" },
];

const defaultTemplate = (raw: string): HousingTemplateDefinition => ({
  title: raw,
  description: "",
  cost: 0,
});

function summarize(_id: string, t: HousingTemplateDefinition): string {
  const parts: string[] = [];
  if (t.isEntry) parts.push("entry");
  if (t.safe) parts.push("safe");
  if (t.station) parts.push(t.station);
  if (t.maxDroppedItems) parts.push(`vault(${t.maxDroppedItems})`);
  parts.push(`${t.cost}g`);
  return parts.join(" | ");
}

export function HousingPanel({ config, onChange }: ConfigPanelProps) {
  const housing = config.housing;

  const patchHousing = (p: Partial<AppConfig["housing"]>) =>
    onChange({ housing: { ...housing, ...p } });

  const stationOptions = [
    { value: "", label: "-- none --" },
    ...Object.entries(
      useConfigStore.getState().config?.craftingStationTypes ?? {},
    ).map(([id, s]) => ({ value: id, label: s.displayName || id })),
  ];

  return (
    <>
      <Section
        title="Housing System"
        description="Player housing lets each character buy a persistent home assembled from room templates. Houses are a gold sink, a social hub, and (optionally) an offline item vault. Disable this if your MUD is purely adventure-focused."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow
            label="Enabled"
            hint="Master switch for the entire housing system. When off, the housing broker NPC, house commands, and templates below are all inert."
          >
            <CheckboxInput
              checked={housing.enabled}
              onCommit={(v) => patchHousing({ enabled: v })}
              label="Housing enabled"
            />
          </FieldRow>
          <FieldRow
            label="Exit Direction"
            hint="Which cardinal direction in the house's entry room leads back out to the world. Most MUDs use 'south' so 'enter house' takes players north."
          >
            <SelectInput
              value={housing.entryExitDirection}
              options={DIRECTION_OPTIONS}
              onCommit={(v) => patchHousing({ entryExitDirection: v })}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<HousingTemplateDefinition>
        title="Room Templates"
        items={housing.templates}
        onItemsChange={(templates) => patchHousing({ templates })}
        defaultItem={defaultTemplate}
        renderSummary={summarize}
        getDisplayName={(t) => t.title}
        placeholder="template_id"
        renderDetail={(_id, t, patch) => (
          <div className="flex flex-col gap-1.5">
            <FieldRow
              label="Title"
              hint="Default room name shown to players when they enter. Owners can rename their copy after purchase."
            >
              <TextInput
                value={t.title}
                onCommit={(v) => patch({ title: v })}
              />
            </FieldRow>
            <FieldRow
              label="Description"
              hint="Default prose shown when players 'look' in the room. Owners can rewrite this to personalize their home."
            >
              <CommitTextarea
                label="Description"
                value={t.description}
                onCommit={(v) => patch({ description: v })}
                placeholder="A cozy chamber lit by hanging lanterns..."
                rows={3}
              />
            </FieldRow>
            <FieldRow
              label="Cost"
              hint="One-time gold cost to attach this room to a house. Entry rooms are usually cheap; vaults and specialty rooms (forge, alchemy) cost more."
            >
              <NumberInput
                value={t.cost}
                onCommit={(v) => patch({ cost: v ?? 0 })}
                min={0}
              />
            </FieldRow>
            <FieldRow
              label="Entry Room"
              hint="Exactly one template must be marked as the entry. It's the starting room every new house is seeded with when a player first buys property."
            >
              <CheckboxInput
                checked={t.isEntry ?? false}
                onCommit={(v) => patch({ isEntry: v || undefined })}
                label="This is the entry room"
              />
            </FieldRow>
            <FieldRow
              label="Safe"
              hint="When enabled, combat cannot start or continue in this room. Useful for bedrooms, vaults, and public gathering areas."
            >
              <CheckboxInput
                checked={t.safe ?? false}
                onCommit={(v) => patch({ safe: v || undefined })}
                label="Combat blocked"
              />
            </FieldRow>
            <FieldRow
              label="Vault Capacity"
              hint="If greater than 0, items dropped here persist across server restarts up to this count. Set to 0 for regular rooms (items vanish on reset)."
            >
              <NumberInput
                value={t.maxDroppedItems ?? 0}
                onCommit={(v) =>
                  patch({ maxDroppedItems: v && v > 0 ? v : undefined })
                }
                min={0}
                placeholder="0"
              />
            </FieldRow>
            <FieldRow
              label="Station"
              hint="Optional crafting station this room provides (e.g. forge, alchemy bench). Players can craft at home without visiting public stations."
            >
              <SelectInput
                value={t.station ?? ""}
                options={stationOptions}
                onCommit={(v) => patch({ station: v || undefined })}
              />
            </FieldRow>
            <FieldRow
              label="Image"
              hint="Optional asset filename for this room's background art. Leave blank to use the house default."
            >
              <TextInput
                value={t.image ?? ""}
                onCommit={(v) => patch({ image: v || undefined })}
                placeholder="Optional"
              />
            </FieldRow>
          </div>
        )}
      />
    </>
  );
}
