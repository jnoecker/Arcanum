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
        description="Enable player housing and configure how houses connect to the world. Each player can own one house with expandable rooms purchased from a housing broker NPC."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Toggle the entire housing system on or off.">
            <CheckboxInput
              checked={housing.enabled}
              onCommit={(v) => patchHousing({ enabled: v })}
              label="Housing enabled"
            />
          </FieldRow>
          <FieldRow label="Exit Direction" hint="The direction that leads out of the house entry room back to the world. Players use this exit to leave.">
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
          <>
            <FieldRow label="Title" hint="Default room title shown to players. They can override this.">
              <TextInput
                value={t.title}
                onCommit={(v) => patch({ title: v })}
              />
            </FieldRow>
            <FieldRow label="Description">
              <CommitTextarea
                label="Description"
                value={t.description}
                onCommit={(v) => patch({ description: v })}
                placeholder="Default room description..."
                rows={3}
              />
            </FieldRow>
            <FieldRow label="Cost" hint="Gold cost to purchase this room.">
              <NumberInput
                value={t.cost}
                onCommit={(v) => patch({ cost: v ?? 0 })}
                min={0}
              />
            </FieldRow>
            <FieldRow label="Entry Room" hint="Exactly one template must be the entry. This is the first room when a player buys a house.">
              <CheckboxInput
                checked={t.isEntry ?? false}
                onCommit={(v) => patch({ isEntry: v || undefined })}
                label="This is the entry room"
              />
            </FieldRow>
            <FieldRow label="Safe" hint="When enabled, combat is blocked in this room.">
              <CheckboxInput
                checked={t.safe ?? false}
                onCommit={(v) => patch({ safe: v || undefined })}
                label="Combat blocked"
              />
            </FieldRow>
            <FieldRow label="Vault Capacity" hint="When > 0, items dropped here persist across sessions. 0 means items are transient.">
              <NumberInput
                value={t.maxDroppedItems ?? 0}
                onCommit={(v) =>
                  patch({ maxDroppedItems: v && v > 0 ? v : undefined })
                }
                min={0}
                placeholder="0"
              />
            </FieldRow>
            <FieldRow label="Station" hint="Optional crafting station type (e.g. forge, alchemy_bench).">
              <SelectInput
                value={t.station ?? ""}
                options={stationOptions}
                onCommit={(v) => patch({ station: v || undefined })}
              />
            </FieldRow>
            <FieldRow label="Image" hint="Optional room image path.">
              <TextInput
                value={t.image ?? ""}
                onCommit={(v) => patch({ image: v || undefined })}
                placeholder="Optional"
              />
            </FieldRow>
          </>
        )}
      />
    </>
  );
}
