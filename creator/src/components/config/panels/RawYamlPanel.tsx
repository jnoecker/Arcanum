import { stringify } from "yaml";
import type { ConfigPanelProps } from "./types";
import { Section } from "@/components/ui/FormWidgets";

export function RawYamlPanel({ config }: ConfigPanelProps) {
  const entries = Object.entries(config.rawSections);

  return (
    <Section title="Unrecognized Sections">
      {entries.length === 0 ? (
        <p className="text-xs text-text-muted">
          No unrecognized config sections found. All sections in
          application.yaml are covered by the editor tabs.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-text-muted">
            These sections were found in application.yaml but are not editable
            in the UI. They are preserved when saving.
          </p>
          <div className="flex flex-col gap-2">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="rounded border border-border-muted bg-bg-primary p-2"
              >
                <h5 className="mb-1 text-xs font-semibold text-text-primary">
                  {key}
                </h5>
                <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-text-secondary">
                  {stringify(value).trimEnd()}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
