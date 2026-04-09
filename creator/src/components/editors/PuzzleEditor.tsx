import { useCallback, useMemo } from "react";
import type {
  WorldFile,
  PuzzleFile,
  PuzzleReward,
  PuzzleStep,
} from "@/types/world";
import { updatePuzzle, deletePuzzle, OPPOSITE } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import { useArrayField } from "@/lib/useArrayField";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
  CommitTextarea,
  IconButton,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton } from "./EditorShared";

interface PuzzleEditorProps {
  puzzleId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const PUZZLE_TYPE_OPTIONS = [
  { value: "riddle", label: "Riddle" },
  { value: "sequence", label: "Sequence" },
];

const REWARD_TYPE_OPTIONS = [
  { value: "unlock_exit", label: "Unlock exit" },
  { value: "give_item", label: "Give item" },
  { value: "give_gold", label: "Give gold" },
  { value: "give_xp", label: "Give XP" },
];

const STEP_ACTION_OPTIONS = [
  { value: "pull", label: "Pull" },
  { value: "push", label: "Push" },
  { value: "open", label: "Open" },
  { value: "close", label: "Close" },
  { value: "flip", label: "Flip" },
  { value: "touch", label: "Touch" },
  { value: "read", label: "Read" },
];

/**
 * Editor for zone-level `PuzzleFile` entries. Handles both riddle and
 * sequence puzzles with conditional UI per type. Sequence puzzle steps
 * reference room features by their local key, so the step "feature"
 * dropdown is populated from the puzzle room's features map.
 */
export function PuzzleEditor({
  puzzleId,
  world,
  onWorldChange,
  onDelete,
}: PuzzleEditorProps) {
  const { entity: puzzle, patch, handleDelete, rooms } = useEntityEditor<PuzzleFile>(
    world,
    puzzleId,
    (w) => w.puzzles?.[puzzleId],
    updatePuzzle,
    deletePuzzle,
    onWorldChange,
    onDelete,
  );

  const zoneMobOptions = useMemo(
    () =>
      Object.entries(world.mobs ?? {}).map(([id, m]) => ({
        value: id,
        label: `${m.name} (${id})`,
      })),
    [world.mobs],
  );

  const zoneItemOptions = useMemo(
    () =>
      Object.entries(world.items ?? {}).map(([id, item]) => ({
        value: id,
        label: `${item.displayName} (${id})`,
      })),
    [world.items],
  );

  const directionOptions = useMemo(
    () => Object.keys(OPPOSITE).map((d) => ({ value: d, label: d.toUpperCase() })),
    [],
  );

  const roomFeatureOptions = useMemo(() => {
    if (!puzzle) return [];
    const room = !puzzle.roomId.includes(":") ? world.rooms[puzzle.roomId] : undefined;
    if (!room?.features) return [];
    return Object.entries(room.features).map(([id, f]) => ({
      value: id,
      label: `${id} — ${f.displayName || f.keyword || f.type}`,
    }));
  }, [world.rooms, puzzle]);

  const acceptableAnswers = puzzle?.acceptableAnswers ?? [];

  const addAnswer = useCallback(() => {
    patch({ acceptableAnswers: [...acceptableAnswers, ""] });
  }, [acceptableAnswers, patch]);

  const updateAnswer = useCallback(
    (index: number, value: string) => {
      const next = [...acceptableAnswers];
      next[index] = value;
      patch({ acceptableAnswers: next });
    },
    [acceptableAnswers, patch],
  );

  const removeAnswer = useCallback(
    (index: number) => {
      const next = acceptableAnswers.filter((_, i) => i !== index);
      patch({ acceptableAnswers: next.length > 0 ? next : undefined });
    },
    [acceptableAnswers, patch],
  );

  const {
    items: steps,
    add: addStep,
    update: updateStep,
    remove: removeStep,
  } = useArrayField<PuzzleStep>(
    puzzle?.steps,
    (next) => patch({ steps: next }),
    { feature: "", action: "pull" },
    true,
  );

  const handleRewardPatch = useCallback(
    (rewardPatch: Partial<PuzzleReward>) => {
      if (!puzzle) return;
      patch({ reward: { ...puzzle.reward, ...rewardPatch } });
    },
    [puzzle, patch],
  );

  if (!puzzle) return null;

  const puzzleType = (puzzle.type ?? "riddle").toLowerCase();
  const rewardType = (puzzle.reward?.type ?? "give_gold").toLowerCase();

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Type">
            <SelectInput
              value={puzzleType}
              options={PUZZLE_TYPE_OPTIONS}
              onCommit={(v) => patch({ type: v })}
            />
          </FieldRow>
          <FieldRow label="Room" hint="Room where the puzzle lives.">
            <SelectInput
              value={puzzle.roomId}
              options={rooms}
              onCommit={(v) => patch({ roomId: v })}
            />
          </FieldRow>
          <FieldRow label="Mob (optional)" hint="NPC that voices the puzzle (riddle only).">
            <SelectInput
              value={puzzle.mobId ?? ""}
              options={zoneMobOptions}
              onCommit={(v) => patch({ mobId: v || undefined })}
              placeholder="— none —"
              allowEmpty
            />
          </FieldRow>
        </div>
      </Section>

      {puzzleType === "riddle" && (
        <Section title="Riddle">
          <div className="flex flex-col gap-1.5">
            <CommitTextarea
              label="Question"
              value={puzzle.question ?? ""}
              onCommit={(v) => patch({ question: v || undefined })}
              placeholder="What walks on four legs in the morning..."
              rows={3}
            />
            <FieldRow label="Answer" hint="The canonical answer (required).">
              <TextInput
                value={puzzle.answer ?? ""}
                onCommit={(v) => patch({ answer: v || undefined })}
                placeholder="man"
              />
            </FieldRow>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
                Acceptable alternates ({acceptableAnswers.length})
              </span>
              <IconButton onClick={addAnswer} title="Add alternate answer">
                +
              </IconButton>
            </div>
            {acceptableAnswers.length === 0 ? (
              <p className="text-2xs italic text-text-muted">None — only the canonical answer accepted.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {acceptableAnswers.map((answer, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <TextInput
                        value={answer}
                        onCommit={(v) => updateAnswer(index, v)}
                        placeholder="alternate spelling"
                      />
                    </div>
                    <IconButton onClick={() => removeAnswer(index)} title="Remove" danger>
                      &times;
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      {puzzleType === "sequence" && (
        <Section
          title={`Sequence steps (${steps.length})`}
          description="Ordered interactions players must perform in the puzzle room."
          actions={
            <IconButton onClick={addStep} title="Add step">
              +
            </IconButton>
          }
        >
          {roomFeatureOptions.length === 0 && (
            <p className="mb-2 rounded border border-status-warning/40 bg-status-warning/5 px-2 py-1 text-2xs text-status-warning">
              Puzzle room has no features. Add a container, lever, or sign to the room first — sequence steps reference
              features by their local key.
            </p>
          )}
          {steps.length === 0 ? (
            <p className="text-xs italic text-text-muted">No steps — sequence puzzles need at least one.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {steps.map((step, index) => (
                <div key={index} className="rounded border border-border-muted p-1.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-2xs font-medium text-text-muted">#{index + 1}</span>
                    <IconButton onClick={() => removeStep(index)} title="Remove step" danger>
                      &times;
                    </IconButton>
                  </div>
                  <div className="flex flex-col gap-1">
                    <FieldRow label="Feature">
                      {roomFeatureOptions.length > 0 ? (
                        <SelectInput
                          value={step.feature}
                          options={roomFeatureOptions}
                          onCommit={(v) => updateStep(index, "feature", v)}
                          placeholder="— select feature —"
                          allowEmpty
                        />
                      ) : (
                        <TextInput
                          value={step.feature}
                          onCommit={(v) => updateStep(index, "feature", v)}
                          placeholder="feature local key"
                        />
                      )}
                    </FieldRow>
                    <FieldRow label="Action">
                      <SelectInput
                        value={step.action.toLowerCase()}
                        options={STEP_ACTION_OPTIONS}
                        onCommit={(v) => updateStep(index, "action", v)}
                      />
                    </FieldRow>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Reward">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Type">
            <SelectInput
              value={rewardType}
              options={REWARD_TYPE_OPTIONS}
              onCommit={(v) => patch({ reward: { ...puzzle.reward, type: v } })}
            />
          </FieldRow>
          {rewardType === "unlock_exit" && (
            <>
              <FieldRow label="Direction">
                <SelectInput
                  value={puzzle.reward?.exitDirection ?? ""}
                  options={directionOptions}
                  onCommit={(v) => handleRewardPatch({ exitDirection: v || undefined })}
                  placeholder="— select —"
                  allowEmpty
                />
              </FieldRow>
              <FieldRow label="Target room">
                <SelectInput
                  value={puzzle.reward?.targetRoom ?? ""}
                  options={rooms}
                  onCommit={(v) => handleRewardPatch({ targetRoom: v || undefined })}
                  placeholder="— select —"
                  allowEmpty
                />
              </FieldRow>
            </>
          )}
          {rewardType === "give_item" && (
            <FieldRow label="Item">
              <SelectInput
                value={puzzle.reward?.itemId ?? ""}
                options={zoneItemOptions}
                onCommit={(v) => handleRewardPatch({ itemId: v || undefined })}
                placeholder="— select —"
                allowEmpty
              />
            </FieldRow>
          )}
          {rewardType === "give_gold" && (
            <FieldRow label="Gold">
              <NumberInput
                value={puzzle.reward?.gold ?? puzzle.reward?.amount}
                onCommit={(v) => handleRewardPatch({ gold: v, amount: undefined })}
                min={1}
                placeholder="10"
              />
            </FieldRow>
          )}
          {rewardType === "give_xp" && (
            <FieldRow label="XP">
              <NumberInput
                value={puzzle.reward?.xp ?? puzzle.reward?.amount}
                onCommit={(v) => handleRewardPatch({ xp: v, amount: undefined })}
                min={1}
                placeholder="50"
              />
            </FieldRow>
          )}
        </div>
      </Section>

      <Section title="Messages" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="On success">
            <TextInput
              value={puzzle.successMessage ?? ""}
              onCommit={(v) => patch({ successMessage: v || undefined })}
              placeholder="A hidden door grinds open..."
            />
          </FieldRow>
          <FieldRow label="On fail">
            <TextInput
              value={puzzle.failMessage ?? ""}
              onCommit={(v) => patch({ failMessage: v || undefined })}
              placeholder="Nothing happens."
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Behavior" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)" hint="Delay before players can retry after failing.">
            <NumberInput
              value={puzzle.cooldownMs}
              onCommit={(v) => patch({ cooldownMs: v })}
              min={0}
              placeholder="0"
            />
          </FieldRow>
          <CheckboxInput
            checked={!!puzzle.resetOnFail}
            onCommit={(v) => patch({ resetOnFail: v || undefined })}
            label="Reset progress on fail"
          />
        </div>
      </Section>

      <DeleteEntityButton onClick={handleDelete} label="Delete Puzzle" />
    </>
  );
}
