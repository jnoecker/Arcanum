import { useCallback, useState } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { LoreEditor } from "./LoreEditor";
import { DmNotesSection } from "./DmNotesSection";
import { TemplatePicker } from "./TemplatePicker";
import { ScenePreview } from "./ScenePreview";
import { EntityPicker } from "./EntityPicker";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditableField } from "@/components/ui/FormWidgets";
import { applyTemplate, isSceneEmpty } from "@/lib/sceneTemplates";
import type { Scene, SceneTemplate } from "@/types/story";

interface SceneDetailEditorProps {
  storyId: string;
  scene: Scene;
  zoneId: string;
}

export function SceneDetailEditor({ storyId, scene, zoneId }: SceneDetailEditorProps) {
  const updateScene = useStoryStore((s) => s.updateScene);
  const [pendingTemplate, setPendingTemplate] = useState<SceneTemplate | null>(
    null,
  );

  const handleApplyTemplate = useCallback(
    (template: SceneTemplate) => {
      if (isSceneEmpty(scene)) {
        updateScene(storyId, scene.id, applyTemplate(template));
      } else {
        setPendingTemplate(template);
      }
    },
    [scene, storyId, updateScene],
  );

  const handleConfirmTemplate = useCallback(() => {
    if (pendingTemplate) {
      updateScene(storyId, scene.id, applyTemplate(pendingTemplate));
    }
    setPendingTemplate(null);
  }, [pendingTemplate, storyId, scene.id, updateScene]);

  return (
    <div key={scene.id} className="flex gap-4 flex-1 min-h-0">
      {/* Main content area -- scrollable */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
        {/* Section 1: Scene title */}
        <EditableField
          value={scene.title}
          onCommit={(title) => updateScene(storyId, scene.id, { title })}
          placeholder="Untitled scene"
          className="font-display text-lg tracking-[0.5px] text-text-primary"
          label="Scene title"
        />

        {/* Section 2: Template picker */}
        <TemplatePicker
          activeTemplate={scene.template}
          onApply={handleApplyTemplate}
          onClear={() => updateScene(storyId, scene.id, { template: undefined })}
        />

        {/* Section 3: Scene Preview (between template and narration) */}
        <ScenePreview scene={scene} storyId={storyId} zoneId={zoneId} />

        {/* Section 4: Narration */}
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-lg tracking-[0.5px] uppercase text-text-secondary">
            Narration
          </h3>
          <LoreEditor
            value={scene.narration ?? ""}
            onCommit={(json) => updateScene(storyId, scene.id, { narration: json })}
            placeholder="Write the narration for this scene..."
            generateSystemPrompt="You are a cinematic narrator for a fantasy MUD world. Write vivid, atmospheric prose in second person."
            generateUserPrompt={`Write cinematic narration for a scene titled "${scene.title || "Untitled"}"`}
          />
        </div>

        {/* Section 5: DM Notes */}
        <DmNotesSection
          value={scene.dmNotes ?? ""}
          onChange={(dmNotes) => updateScene(storyId, scene.id, { dmNotes })}
        />

        {/* Confirm dialog for template replacement (D-13) */}
        {pendingTemplate && (
          <ConfirmDialog
            title="Replace Scene Content?"
            message="This will replace the current title and narration with template defaults. You can undo this change."
            confirmLabel="Replace Content"
            cancelLabel="Keep Current"
            onConfirm={handleConfirmTemplate}
            onCancel={() => setPendingTemplate(null)}
          />
        )}
      </div>

      {/* Entity Picker sidebar */}
      <EntityPicker zoneId={zoneId} scene={scene} storyId={storyId} />
    </div>
  );
}
