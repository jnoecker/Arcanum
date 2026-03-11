import { useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { CommandEntryConfig } from "@/types/config";
import { FieldRow, TextInput, SelectInput, CheckboxInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const COMMAND_CATEGORIES = [
  "navigation", "communication", "items", "combat", "progression",
  "shops", "quests", "groups", "guilds", "crafting", "world",
  "social", "utility", "admin",
];

export function defaultCommandDefinition(raw: string): CommandEntryConfig {
  return {
    usage: raw,
    category: "utility",
    staff: false,
  };
}

export function summarizeCommand(cmd: CommandEntryConfig): string {
  const parts = [cmd.category];
  if (cmd.staff) parts.push("staff");
  return parts.join(" | ");
}

export function CommandDetail({
  cmd,
  patch,
  categoryOptions,
}: {
  cmd: CommandEntryConfig;
  patch: (p: Partial<CommandEntryConfig>) => void;
  categoryOptions: { value: string; label: string }[];
}) {
  return (
    <>
      <FieldRow label="Usage">
        <TextInput
          value={cmd.usage}
          onCommit={(v) => patch({ usage: v })}
          placeholder="command [args]"
        />
      </FieldRow>
      <FieldRow label="Category">
        <SelectInput
          value={cmd.category}
          onCommit={(v) => patch({ category: v })}
          options={categoryOptions}
        />
      </FieldRow>
      <FieldRow label="Staff Only">
        <CheckboxInput
          checked={cmd.staff}
          onCommit={(v) => patch({ staff: v })}
          label="Restrict to staff"
        />
      </FieldRow>
    </>
  );
}

export function CommandsPanel({ config, onChange }: ConfigPanelProps) {
  const categoryOptions = useMemo(
    () => COMMAND_CATEGORIES.map((c) => ({ value: c, label: c })),
    [],
  );

  return (
    <RegistryPanel<CommandEntryConfig>
      title="Commands"
      items={config.commands}
      onItemsChange={(commands) => onChange({ commands })}
      placeholder="New command"
      searchThreshold={0}
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(c) => c.usage.split(/\s/)[0] ?? ""}
      defaultItem={defaultCommandDefinition}
      renderSummary={(_id, cmd) => summarizeCommand(cmd)}
      renderDetail={(_id, cmd, patch) => (
        <CommandDetail cmd={cmd} patch={patch} categoryOptions={categoryOptions} />
      )}
    />
  );
}
