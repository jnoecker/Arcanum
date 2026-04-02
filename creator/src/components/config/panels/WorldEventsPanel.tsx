import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { WorldEventDefinitionConfig } from "@/types/config";
import {
  FieldRow,
  TextInput,
} from "@/components/ui/FormWidgets";
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
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={event.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput
          value={event.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="Flavor text"
        />
      </FieldRow>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Schedule
        </h5>
        <p className="mb-2 text-2xs text-text-muted">
          ISO dates (yyyy-MM-dd). Leave both empty for a permanent event.
        </p>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Start Date">
            <TextInput
              value={event.startDate ?? ""}
              onCommit={(v) => patch({ startDate: v || undefined })}
              placeholder="2026-03-20"
            />
          </FieldRow>
          <FieldRow label="End Date">
            <TextInput
              value={event.endDate ?? ""}
              onCommit={(v) => patch({ endDate: v || undefined })}
              placeholder="2026-04-20"
            />
          </FieldRow>
        </div>
      </div>

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Flags
        </h5>
        <p className="mb-2 text-2xs text-text-muted">
          Comma-separated flags queryable by quests, mobs, and items.
        </p>
        <FieldRow label="Flags">
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

      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Broadcast Messages
        </h5>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Start Message" hint="Broadcast when the event activates.">
            <TextInput
              value={event.startMessage ?? ""}
              onCommit={(v) => patch({ startMessage: v || undefined })}
              placeholder="The festival has begun!"
            />
          </FieldRow>
          <FieldRow label="End Message" hint="Broadcast when the event deactivates.">
            <TextInput
              value={event.endMessage ?? ""}
              onCommit={(v) => patch({ endMessage: v || undefined })}
              placeholder="The festival has ended."
            />
          </FieldRow>
        </div>
      </div>
    </>
  );
}
