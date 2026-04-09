import type { ConfigPanelProps, AppConfig } from "./types";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  ActionButton,
  IconButton,
} from "@/components/ui/FormWidgets";

export function CurrenciesPanel({ config, onChange }: ConfigPanelProps) {
  const currencies = { definitions: {}, ...config.currencies };
  const defs = currencies.definitions ?? {};

  const patchDef = (key: string, updates: Record<string, unknown>) => {
    onChange({
      currencies: {
        ...currencies,
        definitions: { ...defs, [key]: { ...defs[key], ...updates } },
      },
    } as Partial<AppConfig>);
  };

  const deleteDef = (key: string) => {
    const next = { ...defs };
    delete next[key];
    onChange({
      currencies: { ...currencies, definitions: next },
    } as Partial<AppConfig>);
  };

  const addCurrency = () => {
    const id = `currency_${Object.keys(defs).length + 1}`;
    onChange({
      currencies: {
        ...currencies,
        definitions: { ...defs, [id]: { displayName: id } },
      },
    } as Partial<AppConfig>);
  };

  const entries = Object.entries(defs);

  return (
    <Section
      title="Secondary Currencies"
      description="Non-gold currencies players can earn and spend: faction reputation, honor, arena tokens, raid marks, favor points, and so on. Define one record per currency type. These appear alongside gold in the player's pouch and can be used by shops, quests, and rewards."
    >
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 ? (
          <p className="text-2xs text-text-muted">
            No secondary currencies defined. Add one below to create reputation, tokens, or favor systems.
          </p>
        ) : (
          <div className="flex flex-col">
            {entries.map(([key, def]) => (
              <div
                key={key}
                className="flex items-start gap-2 border-b border-border-muted/30 pb-2 pt-2 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <FieldRow
                    label="ID"
                    hint="The internal key used by quests, shops, and rewards to reference this currency. Immutable once set."
                  >
                    <span className="text-xs font-mono text-accent">{key}</span>
                  </FieldRow>
                  <FieldRow
                    label="Display Name"
                    hint="What players see in their pouch and in UI. Example: 'Honor', 'Arena Tokens', 'Moonfavor'."
                  >
                    <TextInput
                      value={def.displayName}
                      onCommit={(v) => patchDef(key, { displayName: v })}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Description"
                    hint="Short flavor text shown when players inspect the currency. Explain where it comes from or what it buys."
                  >
                    <TextInput
                      value={def.description ?? ""}
                      onCommit={(v) =>
                        patchDef(key, { description: v || undefined })
                      }
                      placeholder="Optional"
                    />
                  </FieldRow>
                  <FieldRow
                    label="Max Amount"
                    hint="Hard cap on how much of this currency a player can hold. Useful for reputation or weekly tokens that shouldn't stockpile. Leave blank for no limit."
                  >
                    <NumberInput
                      value={def.maxAmount}
                      onCommit={(v) =>
                        patchDef(key, { maxAmount: v || undefined })
                      }
                      min={0}
                    />
                  </FieldRow>
                </div>
                <IconButton
                  onClick={() => deleteDef(key)}
                  title="Delete currency"
                  danger
                >
                  &times;
                </IconButton>
              </div>
            ))}
          </div>
        )}
        <div>
          <ActionButton variant="secondary" size="sm" onClick={addCurrency}>
            + Add Currency
          </ActionButton>
        </div>
      </div>
    </Section>
  );
}
