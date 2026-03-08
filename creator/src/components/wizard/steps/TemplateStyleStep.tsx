import { TEMPLATES } from "@/lib/templates";
import {
  ART_STYLE_LABELS,
  ART_STYLE_DESCRIPTIONS,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import type { WizardData } from "@/lib/useProjectWizard";

interface TemplateStyleStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateStyleStep({
  data,
  onChange,
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

      {/* Art style toggle */}
      <div>
        <label className="mb-2 block text-xs font-medium text-text-muted">
          Art Style
        </label>
        <div className="flex gap-2">
          {(Object.entries(ART_STYLE_LABELS) as [ArtStyle, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => onChange({ artStyle: key })}
                className={`flex-1 rounded border px-3 py-2 text-left transition-colors ${
                  data.artStyle === key
                    ? "border-accent bg-accent/10"
                    : "border-border-default bg-bg-primary hover:border-border-hover"
                }`}
              >
                <div className="text-xs font-medium text-text-primary">
                  {label}
                </div>
                <div className="mt-0.5 text-[10px] text-text-muted">
                  {ART_STYLE_DESCRIPTIONS[key]}
                </div>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
