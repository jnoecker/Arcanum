import { useLoreStore } from "@/stores/loreStore";
import { getAllSceneTemplates } from "@/lib/sceneTemplates";
import type { SceneTemplateId } from "@/types/story";

interface TemplatePickerProps {
  activeTemplate?: SceneTemplateId;
  onApply: (template: SceneTemplateId) => void;
  onClear: () => void;
}

export function TemplatePicker({
  activeTemplate,
  onApply,
  onClear,
}: TemplatePickerProps) {
  const customTemplates = useLoreStore((s) => s.lore?.customSceneTemplates);
  const templates = getAllSceneTemplates(customTemplates);

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          className="segmented-button px-3 py-1.5 flex items-center gap-2"
          data-active={activeTemplate === tpl.id ? "true" : "false"}
          aria-pressed={activeTemplate === tpl.id}
          onClick={() => onApply(tpl.id)}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: tpl.badgeColor }}
          />
          <span className="text-2xs">{tpl.label}</span>
          {tpl.isCustom && (
            <span className="text-[8px] uppercase tracking-wider text-text-muted">custom</span>
          )}
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
