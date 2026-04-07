import type { WizardData } from "@/lib/useProjectWizard";

interface WorldIdentityStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
}

export function WorldIdentityStep({ data, onChange }: WorldIdentityStepProps) {
  const worldThemeId = "wizard-world-theme";
  const worldThemeHintId = "wizard-world-theme-hint";
  const zoneThemeId = "wizard-zone-theme";
  const zoneThemeHintId = "wizard-zone-theme-hint";
  const telnetPortId = "wizard-telnet-port";
  const webPortId = "wizard-web-port";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={worldThemeId} className="mb-1 block text-xs text-text-muted">
          World Theme
        </label>
        <textarea
          id={worldThemeId}
          name="worldTheme"
          value={data.worldTheme}
          onChange={(e) => onChange({ worldTheme: e.target.value })}
          placeholder="A crumbling desert empire where magic flows from ancient crystals..."
          rows={3}
          aria-describedby={worldThemeHintId}
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs leading-relaxed text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <p id={worldThemeHintId} className="mt-1 text-2xs text-text-muted">
          Describes the feel and atmosphere of your world. Guides AI-generated
          content and art.
        </p>
      </div>

      <div>
        <label htmlFor={zoneThemeId} className="mb-1 block text-xs text-text-muted">
          Starter Zone Theme
        </label>
        <textarea
          id={zoneThemeId}
          name="zoneTheme"
          value={data.zoneTheme}
          onChange={(e) => onChange({ zoneTheme: e.target.value })}
          placeholder="A bustling medieval town square where adventurers gather..."
          rows={2}
          aria-describedby={zoneThemeHintId}
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs leading-relaxed text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <p id={zoneThemeHintId} className="mt-1 text-2xs text-text-muted">
          Sets the vibe for your first zone. Used by the art generator and AI
          room descriptions.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor={telnetPortId} className="mb-1 block text-xs text-text-muted">
            Telnet Port
          </label>
          <input
            id={telnetPortId}
            name="telnetPort"
            type="number"
            value={data.telnetPort}
            onChange={(e) => onChange({ telnetPort: Number(e.target.value) })}
            min={1}
            max={65535}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>
        <div className="flex-1">
          <label htmlFor={webPortId} className="mb-1 block text-xs text-text-muted">
            Web Port
          </label>
          <input
            id={webPortId}
            name="webPort"
            type="number"
            value={data.webPort}
            onChange={(e) => onChange({ webPort: Number(e.target.value) })}
            min={1}
            max={65535}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        </div>
      </div>
    </div>
  );
}
