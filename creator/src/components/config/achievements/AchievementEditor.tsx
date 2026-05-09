import type {
  AppConfig,
  AchievementDefFile,
  AchievementCriterionFile,
  AchievementRewardsFile,
} from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { useArrayField } from "@/lib/useArrayField";
import { SectionCard } from "../panels/factions/SectionCard";
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "./icons";
import { useCallback, useState } from "react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const DEFAULT_CRITERION: AchievementCriterionFile = {
  type: "kill",
  targetId: "",
  count: 1,
  description: "",
};

const DESCRIPTION_LIMIT = 200;
const CRITERION_DESC_LIMIT = 120;

interface AchievementEditorProps {
  id: string;
  def: AchievementDefFile;
  config: AppConfig;
  onPatch: (p: Partial<AchievementDefFile>) => void;
  onRename: (newId: string) => void;
}

export function AchievementEditor({
  id,
  def,
  config,
  onPatch,
  onRename,
}: AchievementEditorProps) {
  const categoryOptions = Object.entries(config.achievementCategories).map(
    ([cid, cat]) => ({ value: cid, label: cat.displayName || cid }),
  );

  const criterionTypeOptions = Object.entries(config.achievementCriterionTypes).map(
    ([tid, ct]) => ({ value: tid, label: ct.displayName || tid }),
  );

  const {
    items: criteria,
    add: handleAddCriterion,
    update: handleUpdateCriterion,
    remove: handleRemoveCriterion,
  } = useArrayField<AchievementCriterionFile>(
    def.criteria,
    (next) => onPatch({ criteria: next ?? [] }),
    DEFAULT_CRITERION,
  );

  const moveCriterion = (from: number, to: number) => {
    if (to < 0 || to >= criteria.length) return;
    const next = [...criteria];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onPatch({ criteria: next });
  };

  const rewards = def.rewards ?? {};
  const handleRewardChange = useCallback(
    (field: keyof AchievementRewardsFile, value: string | number | undefined) => {
      const next: AchievementRewardsFile = { ...rewards, [field]: value };
      const hasReward =
        (next.xp ?? 0) > 0 || (next.gold ?? 0) > 0 || (next.title ?? "").length > 0;
      onPatch({ rewards: hasReward ? next : undefined });
    },
    [rewards, onPatch],
  );

  return (
    <div className="flex flex-col gap-4">
      <BasicsCard
        id={id}
        def={def}
        categoryOptions={categoryOptions}
        onPatch={onPatch}
        onRename={onRename}
      />

      <CriteriaCard
        criteria={criteria}
        criterionTypeOptions={criterionTypeOptions}
        onAdd={() => handleAddCriterion()}
        onUpdate={handleUpdateCriterion}
        onRemove={handleRemoveCriterion}
        onMove={moveCriterion}
      />

      <RewardsCard rewards={rewards} onChange={handleRewardChange} />
    </div>
  );
}

// ─── Basics ────────────────────────────────────────────────────────

interface BasicsCardProps {
  id: string;
  def: AchievementDefFile;
  categoryOptions: { value: string; label: string }[];
  onPatch: (p: Partial<AchievementDefFile>) => void;
  onRename: (newId: string) => void;
}

function BasicsCard({ id, def, categoryOptions, onPatch, onRename }: BasicsCardProps) {
  const desc = def.description ?? "";
  const remaining = DESCRIPTION_LIMIT - desc.length;
  const overLimit = remaining < 0;

  return (
    <SectionCard title="Basics">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldLabel label="Display Name" required>
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="First Blood"
            dense
          />
        </FieldLabel>

        <FieldLabel label="Description">
          <CommitTextarea
            label=""
            value={desc}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="Defeat your first enemy in combat."
            rows={3}
          />
          <p
            className={cx(
              "mt-0.5 text-right font-mono text-2xs",
              overLimit ? "text-status-error" : "text-text-muted/70",
            )}
          >
            {desc.length} / {DESCRIPTION_LIMIT}
          </p>
        </FieldLabel>

        <FieldLabel label="Internal ID (slug)" required>
          <SlugRenamer id={id} onRename={onRename} />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Used for references (must be unique).
          </p>
        </FieldLabel>

        <FieldLabel label="Category" required>
          <SelectInput
            value={def.category}
            options={categoryOptions}
            onCommit={(v) => onPatch({ category: v })}
            placeholder="— select category —"
            dense
          />
        </FieldLabel>

        <div className="md:col-span-2">
          <HiddenToggle
            checked={def.hidden ?? false}
            onChange={(v) => onPatch({ hidden: v || undefined })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="first_blood"
    />
  );
}

function HiddenToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "focus-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
        checked
          ? "border-accent/40 bg-accent/10"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Hidden
        </p>
        <p className="text-2xs text-text-muted/80">
          Hide this achievement until it is unlocked.
        </p>
      </div>
      <span
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-4 w-4 rounded-full bg-bg-primary shadow-md transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

// ─── Criteria ──────────────────────────────────────────────────────

interface CriteriaCardProps {
  criteria: AchievementCriterionFile[];
  criterionTypeOptions: { value: string; label: string }[];
  onAdd: () => void;
  onUpdate: (
    index: number,
    field: keyof AchievementCriterionFile,
    value: AchievementCriterionFile[keyof AchievementCriterionFile],
  ) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

function CriteriaCard({
  criteria,
  criterionTypeOptions,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: CriteriaCardProps) {
  return (
    <SectionCard
      title="Criteria"
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add Criterion
        </button>
      }
    >
      {criteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-6 text-center">
          <p className="text-2xs italic text-text-muted/80">
            No criteria yet — add at least one to make this achievement earnable.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {criteria.map((crit, i) => (
            <CriterionRow
              key={i}
              index={i}
              criterion={crit}
              total={criteria.length}
              criterionTypeOptions={criterionTypeOptions}
              onUpdate={(field, value) => onUpdate(i, field, value)}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMove(i, i - 1)}
              onMoveDown={() => onMove(i, i + 1)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

interface CriterionRowProps {
  index: number;
  total: number;
  criterion: AchievementCriterionFile;
  criterionTypeOptions: { value: string; label: string }[];
  onUpdate: (
    field: keyof AchievementCriterionFile,
    value: AchievementCriterionFile[keyof AchievementCriterionFile],
  ) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CriterionRow({
  index,
  total,
  criterion,
  criterionTypeOptions,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: CriterionRowProps) {
  const desc = criterion.description ?? "";
  const remaining = CRITERION_DESC_LIMIT - desc.length;
  const overLimit = remaining < 0;

  return (
    <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-display text-2xs font-semibold text-accent"
        >
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text-primary">
          {criterion.description?.trim() || `Defeat a ${criterion.type}`}
        </p>
        <div className="flex items-center gap-0.5">
          <IconAction
            label="Move up"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ArrowUpIcon />
          </IconAction>
          <IconAction
            label="Move down"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDownIcon />
          </IconAction>
          <IconAction label="Remove criterion" onClick={onRemove} danger>
            <TrashIcon />
          </IconAction>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldLabel label="Type" required>
          <SelectInput
            value={criterion.type}
            options={criterionTypeOptions}
            onCommit={(v) => onUpdate("type", v)}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Target ID" required>
          <TextInput
            value={criterion.targetId ?? ""}
            onCommit={(v) => onUpdate("targetId", v || undefined)}
            placeholder="bone:mob_id or empty"
            dense
          />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Mob ID (e.g.{" "}
            <code className="text-text-muted">bone:mob_goblin_warrior</code>)
            or leave empty for any.
          </p>
        </FieldLabel>
        <FieldLabel label="Count" required>
          <NumberInput
            value={criterion.count ?? 1}
            onCommit={(v) => onUpdate("count", v ?? 1)}
            min={1}
            dense
          />
          <p className="mt-0.5 text-2xs text-text-muted/70">
            Number of times required.
          </p>
        </FieldLabel>
        <FieldLabel label="Description (optional)">
          <CommitTextarea
            label=""
            value={desc}
            onCommit={(v) => onUpdate("description", v || undefined)}
            placeholder="Optional flavor text for this criterion…"
            rows={2}
          />
          <p
            className={cx(
              "mt-0.5 text-right font-mono text-2xs",
              overLimit ? "text-status-error" : "text-text-muted/70",
            )}
          >
            {desc.length} / {CRITERION_DESC_LIMIT}
          </p>
        </FieldLabel>
      </div>
    </div>
  );
}

// ─── Rewards ───────────────────────────────────────────────────────

interface RewardsCardProps {
  rewards: AchievementRewardsFile;
  onChange: (field: keyof AchievementRewardsFile, value: string | number | undefined) => void;
}

function RewardsCard({ rewards, onChange }: RewardsCardProps) {
  const xp = rewards.xp ?? 0;
  const gold = rewards.gold ?? 0;
  const title = rewards.title ?? "";

  return (
    <SectionCard title="Rewards">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumericRewardField
          label="XP"
          value={xp}
          onChange={(v) => onChange("xp", v)}
        />
        <NumericRewardField
          label="Gold"
          value={gold}
          onChange={(v) => onChange("gold", v)}
        />
        <FieldLabel label="Title (optional)">
          <TextInput
            value={title}
            onCommit={(v) => onChange("title", v || undefined)}
            placeholder="Optional title reward"
            dense
          />
        </FieldLabel>
        <button
          type="button"
          disabled
          title="Add additional reward types — coming soon"
          className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-transparent px-3 py-2 text-2xs font-medium text-text-muted transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusIcon />
          <span className="text-left leading-tight">
            Add Reward
            <span className="block text-[0.55rem] font-normal text-text-muted/70">
              Future rewards
            </span>
          </span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--chrome-stroke)] pt-3">
        <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
          Reward Summary
        </span>
        <span className="flex items-center gap-2 font-mono text-2xs text-text-muted">
          <span className="text-accent">{xp} XP</span>
          <span className="text-text-muted/40">·</span>
          <span className="text-warm">{gold} Gold</span>
          <span className="text-text-muted/40">·</span>
          <span>{title.trim() ? `“${title}”` : "No Title"}</span>
        </span>
      </div>
    </SectionCard>
  );
}

function NumericRewardField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <FieldLabel label={label}>
      <NumberInput
        value={value}
        onCommit={(v) => onChange(v)}
        min={0}
        dense
      />
    </FieldLabel>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        "focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "text-text-muted/70 hover:bg-status-error/15 hover:text-status-error"
          : "text-text-muted/70 hover:bg-[var(--chrome-fill)] hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

