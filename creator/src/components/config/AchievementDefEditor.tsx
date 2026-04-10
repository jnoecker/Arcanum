import { useCallback, useMemo } from "react";
import type {
  AppConfig,
  AchievementDefFile,
  AchievementCriterionFile,
  AchievementRewardsFile,
} from "@/types/config";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

// ─── Defaults ──────────────────────────────────────────────────────

const DEFAULT_CRITERION: AchievementCriterionFile = {
  type: "kill",
  targetId: "",
  count: 1,
  description: "",
};

function defaultAchievementDef(raw: string): AchievementDefFile {
  // Derive category from the id prefix if it contains a slash
  const slash = raw.indexOf("/");
  const category = slash > 0 ? raw.slice(0, slash) : "combat";
  return {
    displayName: raw
      .slice(slash + 1)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "",
    category,
    hidden: false,
    criteria: [],
  };
}

// ─── Detail component ──────────────────────────────────────────────

function AchievementDefDetail({
  def,
  patch,
  config,
}: {
  def: AchievementDefFile;
  patch: (p: Partial<AchievementDefFile>) => void;
  config: AppConfig;
}) {
  // Category dropdown from taxonomy
  const categoryOptions = useMemo(
    () =>
      Object.entries(config.achievementCategories).map(([id, cat]) => ({
        value: id,
        label: cat.displayName || id,
      })),
    [config.achievementCategories],
  );

  // Criterion type dropdown from taxonomy
  const criterionTypeOptions = useMemo(
    () =>
      Object.entries(config.achievementCriterionTypes).map(([id, ct]) => ({
        value: id,
        label: ct.displayName || id,
      })),
    [config.achievementCriterionTypes],
  );

  // ─── Criteria array helpers ──────────────────────────────────
  const {
    items: criteria,
    add: handleAddCriterion,
    update: handleUpdateCriterion,
    remove: handleDeleteCriterion,
  } = useArrayField<AchievementCriterionFile>(
    def.criteria,
    (criteria) => patch({ criteria: criteria ?? [] }),
    DEFAULT_CRITERION,
  );

  // ─── Rewards helpers ─────────────────────────────────────────
  const rewards = def.rewards ?? {};

  const handleRewardChange = useCallback(
    (field: keyof AchievementRewardsFile, value: string | number | undefined) => {
      const next: AchievementRewardsFile = { ...rewards, [field]: value };
      const hasReward =
        (next.xp ?? 0) > 0 || (next.gold ?? 0) > 0 || (next.title ?? "").length > 0;
      patch({ rewards: hasReward ? next : undefined });
    },
    [rewards, patch],
  );

  return (
    <div className="flex flex-col gap-4">
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Display name">
            <TextInput
              value={def.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={def.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="None"
            />
          </FieldRow>
          <FieldRow label="Category">
            <SelectInput
              value={def.category}
              options={categoryOptions}
              onCommit={(v) => patch({ category: v })}
              placeholder="— select category —"
            />
          </FieldRow>
          <FieldRow label="Hidden">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={def.hidden ?? false}
                onChange={(e) => patch({ hidden: e.target.checked || undefined })}
                className="accent-accent"
              />
              <span className="text-text-secondary">
                Hide until unlocked
              </span>
            </label>
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Criteria (${criteria.length})`}
        actions={
          <IconButton onClick={handleAddCriterion} title="Add criterion">
            +
          </IconButton>
        }
      >
        {criteria.length === 0 ? (
          <p className="text-xs text-text-muted">
            No criteria — add at least one to make this achievement earnable.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {criteria.map((crit, i) => (
              <div
                key={i}
                className="rounded border border-border-muted p-1.5"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-2xs font-medium text-text-muted">
                    #{i + 1}
                  </span>
                  <IconButton
                    onClick={() => handleDeleteCriterion(i)}
                    title="Remove criterion"
                    danger
                  >
                    &times;
                  </IconButton>
                </div>
                <div className="flex flex-col gap-1">
                  <FieldRow label="Type">
                    <SelectInput
                      value={crit.type}
                      options={criterionTypeOptions}
                      onCommit={(v) => handleUpdateCriterion(i, "type", v)}
                    />
                  </FieldRow>
                  <FieldRow label="Target ID">
                    <TextInput
                      value={crit.targetId ?? ""}
                      onCommit={(v) =>
                        handleUpdateCriterion(i, "targetId", v || undefined)
                      }
                      placeholder="zone:mob_id or empty"
                    />
                  </FieldRow>
                  <FieldRow label="Count">
                    <NumberInput
                      value={crit.count ?? 1}
                      onCommit={(v) =>
                        handleUpdateCriterion(i, "count", v ?? 1)
                      }
                      min={1}
                    />
                  </FieldRow>
                  <FieldRow label="Description">
                    <TextInput
                      value={crit.description ?? ""}
                      onCommit={(v) =>
                        handleUpdateCriterion(i, "description", v || undefined)
                      }
                      placeholder="Optional flavor text"
                    />
                  </FieldRow>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rewards" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="XP">
            <NumberInput
              value={rewards.xp}
              onCommit={(v) => handleRewardChange("xp", v)}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Gold">
            <NumberInput
              value={rewards.gold}
              onCommit={(v) => handleRewardChange("gold", v)}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Title">
            <TextInput
              value={rewards.title ?? ""}
              onCommit={(v) => handleRewardChange("title", v || undefined)}
              placeholder="Optional title reward"
            />
          </FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ─── Summary helpers ───────────────────────────────────────────────

function summarizeAchievementDef(def: AchievementDefFile): string {
  const parts: string[] = [];
  if (def.criteria.length > 0) {
    parts.push(`${def.criteria.length} criteria`);
  }
  if (def.rewards?.xp) parts.push(`${def.rewards.xp} XP`);
  if (def.rewards?.gold) parts.push(`${def.rewards.gold} gold`);
  if (def.rewards?.title) parts.push(`"${def.rewards.title}"`);
  return parts.join(" · ") || "No criteria or rewards";
}

function badgesForDef(def: AchievementDefFile): string[] {
  const badges: string[] = [def.category || "uncategorized"];
  if (def.hidden) badges.push("Hidden");
  return badges;
}

// ─── Main editor ───────────────────────────────────────────────────

export function AchievementDefEditor({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  return (
    <DefinitionWorkbench
      title="Achievement definition designer"
      countLabel="Achievements"
      description="Individual achievement definitions with criteria and rewards. IDs use category/name format (e.g. combat/first_blood)."
      addPlaceholder="combat/new_achievement"
      searchPlaceholder="Search achievements"
      emptyMessage="No achievements match the current search."
      items={config.achievementDefs}
      defaultItem={defaultAchievementDef}
      getDisplayName={(def) => def.displayName}
      renderSummary={summarizeAchievementDef}
      renderBadges={badgesForDef}
      renderDetail={(_id, def, patch) => (
        <AchievementDefDetail def={def} patch={patch} config={config} />
      )}
      onItemsChange={(achievementDefs) => onChange({ achievementDefs })}
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
    />
  );
}
