import { TEMPLATES } from "@/lib/templates";
import {
  ART_STYLE_LABELS,
  ART_STYLE_DESCRIPTIONS,
} from "@/lib/arcanumPrompts";
import type { WizardData } from "@/lib/useProjectWizard";

interface TemplateStyleStepProps {
  data: WizardData;
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateStyleStep({
  data,
  onSelectTemplate,
}: TemplateStyleStepProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Template selection */}
      <div>
        <label className="mb-2 block text-xs font-medium text-text-muted">
          Template
        </label>
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTemplate(t.id)}
              className={`rounded border px-3 py-2.5 text-left transition-colors ${
                data.templateId === t.id
                  ? "border-accent bg-accent/10"
                  : "border-border-default bg-bg-primary hover:border-border-hover"
              }`}
            >
              <div className="text-xs font-medium text-text-primary">
                {t.name}
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {t.description}
              </div>
              {t.features && t.features.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.features.map((f) => (
                    <span
                      key={f}
                      className="rounded bg-bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Art style */}
      <div>
        <label className="mb-2 block text-xs font-medium text-text-muted">
          Art Style
        </label>
        <div className="rounded border border-accent/30 bg-accent/10 px-3 py-3">
          <div className="text-xs font-medium text-text-primary">
            {ART_STYLE_LABELS.gentle_magic}
          </div>
          <div className="mt-0.5 text-[10px] text-text-muted">
            {ART_STYLE_DESCRIPTIONS.gentle_magic}
          </div>
          <div className="mt-2 text-[10px] text-text-secondary">
            This creator now uses a single visual system. Future style guides can be loaded as data,
            but Surreal Gentle Magic is the active v1 path.
          </div>
        </div>
      </div>
    </div>
  );
}
