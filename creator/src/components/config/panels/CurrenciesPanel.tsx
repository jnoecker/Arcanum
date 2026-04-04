import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput, NumberInput, IconButton } from "@/components/ui/FormWidgets";

export function CurrenciesPanel({ config, onChange }: ConfigPanelProps) {
  const currencies = { definitions: {}, ...config.currencies };
  const defs = currencies.definitions ?? {};

  const patchDef = (key: string, updates: Record<string, unknown>) => {
    onChange({ currencies: { ...currencies, definitions: { ...defs, [key]: { ...defs[key], ...updates } } } } as Partial<AppConfig>);
  };

  const deleteDef = (key: string) => {
    const next = { ...defs };
    delete next[key];
    onChange({ currencies: { ...currencies, definitions: next } } as Partial<AppConfig>);
  };

  return (
    <Section title="Secondary Currencies">
      <div className="flex flex-col gap-3">
        {Object.entries(defs).map(([key, def]) => (
          <div key={key} className="flex items-start gap-2 rounded border border-border-muted bg-bg-primary p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <FieldRow label="ID">
                <span className="text-xs font-mono text-accent">{key}</span>
              </FieldRow>
              <FieldRow label="Display Name">
                <TextInput value={def.displayName} onCommit={(v) => patchDef(key, { displayName: v })} />
              </FieldRow>
              <FieldRow label="Description">
                <TextInput value={def.description ?? ""} onCommit={(v) => patchDef(key, { description: v || undefined })} placeholder="Optional" />
              </FieldRow>
              <FieldRow label="Max Amount">
                <NumberInput value={def.maxAmount} onCommit={(v) => patchDef(key, { maxAmount: v || undefined })} />
              </FieldRow>
            </div>
            <IconButton onClick={() => deleteDef(key)} title="Delete">&times;</IconButton>
          </div>
        ))}
        <button
          onClick={() => {
            const id = `currency_${Object.keys(defs).length + 1}`;
            onChange({ currencies: { ...currencies, definitions: { ...defs, [id]: { displayName: id } } } } as Partial<AppConfig>);
          }}
          className="self-start rounded border border-border-default px-3 py-1 text-2xs text-text-secondary hover:bg-bg-tertiary"
        >
          + Add Currency
        </button>
      </div>
    </Section>
  );
}
