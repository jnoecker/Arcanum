import { SCENE_TEMPLATE_PRESETS } from "@/lib/sceneTemplates";
import type { SceneTemplate } from "@/types/story";

interface TemplatePickerProps {
  activeTemplate?: SceneTemplate;
  onApply: (template: SceneTemplate) => void;
  onClear: () => void;
}

export function TemplatePicker({
  activeTemplate,
  onApply,
  onClear,
}: TemplatePickerProps) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {Object.values(SCENE_TEMPLATE_PRESETS).map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="segmented-button px-3 py-1.5 flex items-center gap-2"
          data-active={activeTemplate === preset.id ? "true" : "false"}
          aria-pressed={activeTemplate === preset.id}
          onClick={() => onApply(preset.id)}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: preset.badgeColor }}
          />
          <span className="text-2xs">{preset.label}</span>
        </button>
      ))}

      {activeTemplate && (
        <button
          type="button"
          className="text-2xs text-text-muted hover:text-text-primary transition-colors"
          onClick={onClear}
        >
          Clear Template
        </button>
      )}
    </div>
  );
}
