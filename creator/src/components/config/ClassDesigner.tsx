import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import {
  ClassDetail,
  defaultClassDefinition,
  renameClassDefinition,
  summarizeClass,
} from "@/components/config/panels/ClassesPanel";
import { DefinitionWorkbench } from "./DefinitionWorkbench";

export function ClassDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const statOptions = useMemo(
    () =>
      Object.entries(config.stats.definitions).map(([id, def]) => ({
        value: id,
        label: def.displayName,
      })),
    [config.stats.definitions],
  );
  const raceOptions = useMemo(
    () => Object.keys(config.races).map((id) => ({ value: id, label: config.races[id]!.displayName || id })),
    [config.races],
  );

  return (
    <DefinitionWorkbench
      title="Class designer"
      countLabel="Class roster"
      description="Tune progression, identity, and presentation for this class."
      addPlaceholder="New class id"
      searchPlaceholder="Search classes"
      emptyMessage="No classes match the current search."
      emptyTitle="Create a class to start designing it."
      items={config.classes}
      defaultItem={defaultClassDefinition}
      getDisplayName={(cls) => cls.displayName}
      renderSummary={summarizeClass}
      idTransform={(raw) => raw.trim().toUpperCase().replace(/\s+/g, "_")}
      renderListCard={(id, cls) => (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-lg text-text-primary">{cls.displayName}</div>
              <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
            </div>
            {cls.image && (
              <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                Art
              </span>
            )}
          </div>
          <div className="mt-3 text-xs text-text-secondary">{summarizeClass(cls)}</div>
        </>
      )}
      renderDetailHeader={(_, cls) => (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">HP +{cls.hpPerLevel}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">Mana +{cls.manaPerLevel}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{cls.primaryStat ?? "No primary stat"}</span>
        </div>
      )}
      onRename={(oldId, newId) => {
        const updated = renameClassDefinition(config, oldId, newId);
        onChange({ classes: updated.classes, abilities: updated.abilities });
      }}
      renderDetail={(id, cls, patch) => (
        <ClassDetail
          id={id}
          cls={cls}
          patch={patch}
          statOptions={statOptions}
          raceOptions={raceOptions}
          maxLevel={config.progression.maxLevel}
          baseHp={config.progression.rewards.baseHp}
          baseMana={config.progression.rewards.baseMana}
        />
      )}
      onItemsChange={(classes) => onChange({ classes })}
    />
  );
}
