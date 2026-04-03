import type { WizardData } from "@/lib/useProjectWizard";

interface WorldIdentityStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
}

export function WorldIdentityStep({ data, onChange }: WorldIdentityStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-text-muted">
          World Theme / Flavor
        </label>
        <textarea
          value={data.worldTheme}
          onChange={(e) => onChange({ worldTheme: e.target.value })}
          placeholder="A crumbling desert empire where magic flows from ancient crystals..."
          rows={4}
          className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <p className="mt-1 text-2xs text-text-muted">
          Describe the feel, setting, and atmosphere of your world. This guides
          AI-generated content and art.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-muted">
            Telnet Port
          </label>
          <input
            type="number"
            value={data.telnetPort}
            onChange={(e) => onChange({ telnetPort: Number(e.target.value) })}
            min={1}
            max={65535}
            className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-muted">
            Web Port
          </label>
          <input
            type="number"
            value={data.webPort}
            onChange={(e) => onChange({ webPort: Number(e.target.value) })}
            min={1}
            max={65535}
            className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>
      </div>
    </div>
  );
}
