import { useMemo } from "react";
import yaml from "yaml";

interface YamlPreviewProps {
  data: unknown;
  label?: string;
}

export function YamlPreview({ data, label }: YamlPreviewProps) {
  const text = useMemo(
    () => yaml.stringify(data, { indent: 2, lineWidth: 120 }),
    [data],
  );

  return (
    <div className="flex flex-1 flex-col">
      {label && (
        <div className="border-b border-border-default px-4 py-1.5">
          <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
            {label}
          </span>
        </div>
      )}
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-text-secondary">
        {text}
      </pre>
    </div>
  );
}
