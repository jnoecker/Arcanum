import { TEMPLATES } from "@/lib/templates";
import type { WizardData } from "@/lib/useProjectWizard";

interface TemplateStepProps {
  data: WizardData;
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateStep({ data, onSelectTemplate }: TemplateStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-text-secondary">
        Each template pre-fills stats, classes, races, equipment, and a starter
        zone. You can customize everything after creation in the config panels
        and Tuning Wizard.
      </p>
      <div className="flex flex-col gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.id)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              data.templateId === t.id
                ? "border-accent bg-accent/10"
                : "border-border-default bg-bg-primary hover:border-border-hover"
            }`}
          >
            <div className="text-sm font-medium text-text-primary">
              {t.name}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-text-secondary">
              {t.description}
            </div>
            {t.features && t.features.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-bg-elevated px-2 py-0.5 text-2xs text-text-muted"
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
  );
}
