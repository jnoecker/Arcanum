import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { WorldEventDefinitionConfig } from "@/types/config";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

function defaultEventDefinition(raw: string): WorldEventDefinitionConfig {
  return {
    displayName: raw,
  };
}

function summarizeEvent(evt: WorldEventDefinitionConfig): string {
  const parts: string[] = [];
  if (evt.startDate && evt.endDate) {
    parts.push(`${evt.startDate} — ${evt.endDate}`);
  } else if (evt.startDate) {
    parts.push(`from ${evt.startDate}`);
  } else {
    parts.push("always active");
  }
  if (evt.flags && evt.flags.length > 0) {
    parts.push(`${evt.flags.length} flag${evt.flags.length > 1 ? "s" : ""}`);
  }
  return parts.join(" | ");
}

export function WorldEventsPanel({ config, onChange }: ConfigPanelProps) {
  const patchDefs = useCallback(
    (definitions: Record<string, WorldEventDefinitionConfig>) => {
      onChange({ worldEvents: { ...config.worldEvents, definitions } });
    },
    [config.worldEvents, onChange],
  );

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const defs: Record<string, WorldEventDefinitionConfig> = {};
      for (const [k, v] of Object.entries(config.worldEvents.definitions)) {
        defs[k === oldId ? newId : k] = v;
      }
      patchDefs(defs);
    },
    [config.worldEvents.definitions, patchDefs],
  );

  return (
    <RegistryPanel<WorldEventDefinitionConfig>
      title="Seasonal Events"
      description="Scheduled or permanent world events — festivals, invasions, blood moons, harvest seasons. Events expose flags that quests, mobs, and items can query to unlock seasonal content or alter behavior. Leave the schedule empty to create a flag that's always active."
      items={config.worldEvents.definitions}
      onItemsChange={patchDefs}
      onRenameId={handleRename}
      placeholder="New event key"
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(e) => e.displayName}
      defaultItem={defaultEventDefinition}
      renderSummary={(_id, e) => summarizeEvent(e)}
      renderDetail={(_id, evt, patch) => (
        <EventDetail event={evt} patch={patch} />
      )}
    />
  );
}

function EventDetail({
  event,
  patch,
}: {
  event: WorldEventDefinitionConfig;
  patch: (p: Partial<WorldEventDefinitionConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow
          label="Display Name"
          hint="Name shown to players in broadcast messages and event listings."
        >
          <TextInput
            value={event.displayName}
            onCommit={(v) => patch({ displayName: v })}
          />
        </FieldRow>
        <FieldRow
          label="Description"
          hint="Short flavor summary. Shown in help text and event info commands."
        >
          <TextInput
            value={event.description ?? ""}
            onCommit={(v) => patch({ description: v || undefined })}
            placeholder="A week of feasts and dancing..."
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldGroupLabel
          label="Schedule"
          hint="ISO dates (yyyy-MM-dd). Leave both empty for a permanent event that's always active."
        />
        <FieldRow
          label="Start Date"
          hint="Day the event activates. Format: 2026-03-20."
        >
          <TextInput
            value={event.startDate ?? ""}
            onCommit={(v) => patch({ startDate: v || undefined })}
            placeholder="2026-03-20"
          />
        </FieldRow>
        <FieldRow
          label="End Date"
          hint="Day the event deactivates. Format: 2026-04-20."
        >
          <TextInput
            value={event.endDate ?? ""}
            onCommit={(v) => patch({ endDate: v || undefined })}
            placeholder="2026-04-20"
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldGroupLabel
          label="Flags"
          hint="Comma-separated tags that quests, mobs, items, and drop tables can check. Flags are the main way event state influences gameplay."
        />
        <FieldRow
          label="Flags"
          hint="Example: spring_festival, bonus_herbalism, double_xp."
        >
          <TextInput
            value={(event.flags ?? []).join(", ")}
            onCommit={(v) =>
              patch({
                flags: v
                  ? v.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined,
              })
            }
            placeholder="spring_festival, bonus_herbalism"
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldGroupLabel
          label="Broadcast Messages"
          hint="Shown to every online player when the event toggles on or off."
        />
        <FieldRow
          label="Start Message"
          hint="Broadcast the moment the event activates. Keep it atmospheric."
        >
          <TextInput
            value={event.startMessage ?? ""}
            onCommit={(v) => patch({ startMessage: v || undefined })}
            placeholder="The festival has begun!"
          />
        </FieldRow>
        <FieldRow
          label="End Message"
          hint="Broadcast when the event expires."
        >
          <TextInput
            value={event.endMessage ?? ""}
            onCommit={(v) => patch({ endMessage: v || undefined })}
            placeholder="The festival has ended."
          />
        </FieldRow>
      </div>
    </div>
  );
}

function FieldGroupLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h5 className="font-display text-2xs uppercase tracking-widest text-text-muted">
        {label}
      </h5>
      <p className="text-2xs leading-relaxed text-text-muted/70">{hint}</p>
    </div>
  );
}
