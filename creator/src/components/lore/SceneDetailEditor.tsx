import { useCallback, useEffect, useState } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { LoreEditor } from "./LoreEditor";
import { DmNotesSection } from "./DmNotesSection";
import { TemplatePicker } from "./TemplatePicker";
import { ScenePreview } from "./ScenePreview";
import { EntityPicker } from "./EntityPicker";
import { TransitionDropdown } from "./TransitionDropdown";
import { PathPresetPicker } from "./PathPresetPicker";
import { NarrationSpeedSelector } from "./NarrationSpeedSelector";
import { SceneLinksSection } from "./SceneLinksSection";
import { TitleCardEditor } from "./TitleCardEditor";
import { EffectsEditor } from "./EffectsEditor";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditableField } from "@/components/ui/FormWidgets";
import { applyTemplate, isSceneEmpty } from "@/lib/sceneTemplates";
import type { Scene, SceneTemplate, TransitionType, SceneEntity } from "@/types/story";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

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
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Reset entity selection when scene changes
  useEffect(() => {
    setSelectedEntityId(null);
  }, [scene.id]);

  // ─── Transition handler ─────────────────────────────────────────
  const handleTransitionChange = useCallback(
    (type: TransitionType) => {
      updateScene(storyId, scene.id, { transition: { type } });
    },
    [storyId, scene.id, updateScene],
  );

  // ─── Entity update handler (for PathPresetPicker) ───────────────
  const handleUpdateEntity = useCallback(
    (entityId: string, patch: Partial<SceneEntity>) => {
      const entities = scene.entities ?? [];
      const updated = entities.map((ent) =>
        ent.id === entityId ? { ...ent, ...patch } : ent,
      );
      updateScene(storyId, scene.id, { entities: updated });
    },
    [scene.entities, scene.id, storyId, updateScene],
  );

  // ─── Narration speed handler ────────────────────────────────────
  const handleNarrationSpeedChange = useCallback(
    (speed: NarrationSpeed | undefined) => {
      updateScene(storyId, scene.id, { narrationSpeed: speed });
    },
    [storyId, scene.id, updateScene],
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

        {/* Section 2: Template picker + Transition dropdown */}
        <div className="flex items-center justify-between">
          <TemplatePicker
            activeTemplate={scene.template}
            onApply={handleApplyTemplate}
            onClear={() => updateScene(storyId, scene.id, { template: undefined })}
          />
          <TransitionDropdown
            value={scene.transition?.type ?? "crossfade"}
            onChange={handleTransitionChange}
          />
        </div>

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

        {/* Section 4b: Narration speed */}
        <NarrationSpeedSelector
          value={scene.narrationSpeed}
          onChange={handleNarrationSpeedChange}
        />

        {/* Section 5: DM Notes */}
        <DmNotesSection
          value={scene.dmNotes ?? ""}
          onChange={(dmNotes) => updateScene(storyId, scene.id, { dmNotes })}
        />

        {/* Section 6: Movement Paths (only when entities exist) */}
        {(scene.entities ?? []).length > 0 && (
          <PathPresetPicker
            entities={scene.entities ?? []}
            selectedEntityId={selectedEntityId}
            onUpdateEntity={handleUpdateEntity}
          />
        )}

        {/* Section 7: Linked Lore (articles, location, map, timeline) */}
        <SceneLinksSection storyId={storyId} scene={scene} />

        {/* Section 8: Title Card overlay */}
        <TitleCardEditor storyId={storyId} scene={scene} />

        {/* Section 9: Effects (particles, parallax) */}
        <EffectsEditor storyId={storyId} scene={scene} />

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
