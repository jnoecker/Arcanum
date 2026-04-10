import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  CommandDetail,
  defaultCommandDefinition,
  summarizeCommand,
} from "@/components/config/panels/CommandsPanel";

const COMMAND_CATEGORIES = [
  "navigation", "communication", "items", "combat", "progression",
  "shops", "quests", "groups", "guilds", "crafting", "world",
  "social", "utility", "admin",
];

export function CommandDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const categoryOptions = useMemo(
    () => COMMAND_CATEGORIES.map((category) => ({ value: category, label: category })),
    [],
  );

  return (
    <DefinitionWorkbench
      title="Command designer"
      countLabel="Commands"
      description="Usage strings, categories, and staff visibility."
      addPlaceholder="New command id"
      searchPlaceholder="Search commands"
      emptyMessage="No commands match the current search."
      emptyTitle="No commands defined yet"
      emptyDescription="Build the verbs and actions players will use to interact with the world."
      items={config.commands}
      defaultItem={defaultCommandDefinition}
      getDisplayName={(command) => command.usage.split(/\s/)[0] ?? ""}
      renderSummary={summarizeCommand}
      renderBadges={(command) => (command.staff ? ["Staff"] : ["Player"])}
      renderDetail={(_id, command, patch) => (
        <CommandDetail cmd={command} patch={patch} categoryOptions={categoryOptions} />
      )}
      onItemsChange={(commands) => onChange({ commands })}
    />
  );
}
