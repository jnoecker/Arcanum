import { useCallback, useMemo } from "react";
import type { WorldFile, TrainerFile } from "@/types/world";
import { updateTrainer, deleteTrainer } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import {
  Section,
  FieldRow,
  TextInput,
  SelectInput,
  IconButton,
  EntityHeader,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton, MediaSection } from "./EditorShared";
import { trainerPrompt } from "@/lib/entityPrompts";
import { useConfigStore } from "@/stores/configStore";
import { getTrainerClasses, setTrainerClasses } from "@/lib/trainers";

const FALLBACK_CLASSES = [
  { value: "WARRIOR", label: "Warrior" },
  { value: "MAGE", label: "Mage" },
  { value: "CLERIC", label: "Cleric" },
  { value: "ROGUE", label: "Rogue" },
];

interface TrainerEditorProps {
  trainerId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

export function TrainerEditor({
  trainerId,
  world,
  onWorldChange,
  onDelete,
  zoneId,
}: TrainerEditorProps) {
  const { entity: trainer, patch, handleDelete, rooms } = useEntityEditor<TrainerFile>(
    world,
    trainerId,
    (w) => w.trainers?.[trainerId],
    updateTrainer,
    deleteTrainer,
    onWorldChange,
    onDelete,
  );

  const config = useConfigStore((s) => s.config);

  const classOptions = useMemo(
    () =>
      config && Object.keys(config.classes).length > 0
        ? Object.entries(config.classes).map(([id, cls]) => ({
            value: id,
            label: cls.displayName || id,
          }))
        : FALLBACK_CLASSES,
    [config],
  );

  const selectedClasses = useMemo(
    () => (trainer ? getTrainerClasses(trainer) : []),
    [trainer],
  );

  const availableClasses = useMemo(
    () => classOptions.filter((opt) => !selectedClasses.includes(opt.value)),
    [classOptions, selectedClasses],
  );

  const handleAddClass = useCallback(
    (classId: string) => {
      if (!trainer || !classId) return;
      patch(setTrainerClasses([...selectedClasses, classId]));
    },
    [trainer, selectedClasses, patch],
  );

  const handleRemoveClass = useCallback(
    (classId: string) => {
      if (!trainer) return;
      patch(setTrainerClasses(selectedClasses.filter((c) => c !== classId)));
    },
    [trainer, selectedClasses, patch],
  );

  const handleReplaceClass = useCallback(
    (oldId: string, newId: string) => {
      if (!trainer) return;
      const next = selectedClasses.map((c) => (c === oldId ? newId : c));
      patch(setTrainerClasses(next));
    },
    [trainer, selectedClasses, patch],
  );

  if (!trainer) return null;

  const classLabel = (value: string): string =>
    classOptions.find((opt) => opt.value === value)?.label ?? value;

  return (
    <>
      <EntityHeader type="Trainer">
        <FieldRow label="Name">
          <TextInput value={trainer.name} onCommit={(v) => patch({ name: v })} />
        </FieldRow>
        <FieldRow label="Room">
          <SelectInput
            value={trainer.room}
            options={rooms}
            onCommit={(v) => patch({ room: v })}
          />
        </FieldRow>
      </EntityHeader>

      <Section
        title="Classes"
        description={
          selectedClasses.length > 1
            ? "Multi-class trainer — teaches all listed classes from this room."
            : "Add a second class to make this a multi-class trainer."
        }
      >
        <div className="flex flex-col gap-1.5">
          {selectedClasses.length === 0 ? (
            <div className="text-xs italic text-text-muted">No class assigned</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedClasses.map((classId) => (
                <div
                  key={classId}
                  className="flex items-center gap-1 rounded border border-border-default bg-bg-tertiary/60 px-1 py-0.5"
                >
                  <SelectInput
                    value={classId}
                    options={[
                      { value: classId, label: classLabel(classId) },
                      ...availableClasses,
                    ]}
                    onCommit={(v) => handleReplaceClass(classId, v)}
                  />
                  {selectedClasses.length > 1 && (
                    <IconButton
                      onClick={() => handleRemoveClass(classId)}
                      title={`Remove ${classLabel(classId)}`}
                      danger
                    >
                      ✕
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          )}
          {availableClasses.length > 0 && (
            <select
              className="ornate-input self-start rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) handleAddClass(v);
              }}
            >
              <option value="">
                + add {selectedClasses.length === 0 ? "class" : "another class"}
              </option>
              {availableClasses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </Section>

      <MediaSection image={trainer.image} onImageChange={(v) => patch({ image: v })} getPrompt={(style) => trainerPrompt(trainerId, trainer, style)} assetType="entity_portrait" context={zoneId ? { zone: zoneId, entity_type: "trainer", entity_id: trainerId } : undefined} />
      <DeleteEntityButton onClick={handleDelete} label="Delete Trainer" />
    </>
  );
}
