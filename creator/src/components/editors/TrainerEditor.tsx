import type { WorldFile, TrainerFile } from "@/types/world";
import { updateTrainer, deleteTrainer } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import {
  Section,
  FieldRow,
  TextInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton, MediaSection } from "./EditorShared";
import { trainerPrompt } from "@/lib/entityPrompts";
import { useConfigStore } from "@/stores/configStore";

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

  if (!trainer) return null;

  const classOptions = config && Object.keys(config.classes).length > 0
    ? Object.entries(config.classes).map(([id, cls]) => ({
        value: id,
        label: cls.displayName || id,
      }))
    : FALLBACK_CLASSES;

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Name">
            <TextInput value={trainer.name} onCommit={(v) => patch({ name: v })} />
          </FieldRow>
          <FieldRow label="Class">
            <SelectInput
              value={trainer.class}
              options={classOptions}
              onCommit={(v) => patch({ class: v })}
            />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput
              value={trainer.room}
              options={rooms}
              onCommit={(v) => patch({ room: v })}
            />
          </FieldRow>
        </div>
      </Section>

      <MediaSection image={trainer.image} onImageChange={(v) => patch({ image: v })} getPrompt={(style) => trainerPrompt(trainerId, trainer, style)} assetType="background" context={zoneId ? { zone: zoneId, entity_type: "trainer", entity_id: trainerId } : undefined} />
      <DeleteEntityButton onClick={handleDelete} label="Delete Trainer" />
    </>
  );
}
