import { useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { GlobalQuestsConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

const DEFAULT_GLOBAL_QUESTS: GlobalQuestsConfig = {
  enabled: false,
  intervalMs: 3_600_000,
  durationMs: 1_800_000,
  objectives: {},
  rewards: {},
};

export function GlobalQuestsPanel({ config, onChange }: ConfigPanelProps) {
  const gq = config.globalQuests ?? DEFAULT_GLOBAL_QUESTS;
  const patch = (p: Partial<GlobalQuestsConfig>) =>
    onChange({ globalQuests: { ...gq, ...p } });

  return (
    <>
      <Section
        title="Global Competitions"
        description="Server-wide timed objectives where all players contribute toward shared goals. Events run on a fixed interval and last for a set duration."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Toggle global competitions on or off.">
            <CheckboxInput
              checked={gq.enabled}
              onCommit={(v) => patch({ enabled: v })}
              label="Global events enabled"
            />
          </FieldRow>
          <FieldRow label="Interval (ms)" hint="Time between the start of each global event. 3600000 = 1 hour.">
            <NumberInput
              value={gq.intervalMs}
              onCommit={(v) => patch({ intervalMs: v ?? 3_600_000 })}
              min={60_000}
            />
          </FieldRow>
          <FieldRow label="Duration (ms)" hint="How long each global event lasts once started. 1800000 = 30 minutes.">
            <NumberInput
              value={gq.durationMs}
              onCommit={(v) => patch({ durationMs: v ?? 1_800_000 })}
              min={60_000}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Objectives"
        description="Objective definitions as JSON. These are free-form since objective structures vary by event type."
      >
        <JsonEditor
          label="Objectives"
          value={gq.objectives}
          onChange={(v) => patch({ objectives: v })}
        />
      </Section>

      <Section
        title="Rewards"
        description="Reward definitions as JSON. Distributed to all participants when the global event completes."
      >
        <JsonEditor
          label="Rewards"
          value={gq.rewards}
          onChange={(v) => patch({ rewards: v })}
        />
      </Section>
    </>
  );
}

/* ── JSON textarea editor ────────────────────────────────────────── */

function JsonEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!focused && draft !== serialized) {
    setDraft(serialized);
  }

  const commit = () => {
    try {
      const parsed = JSON.parse(draft);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError("Must be a JSON object");
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div>
      <textarea
        rows={8}
        className="ornate-input w-full resize-y rounded px-3 py-2 font-mono text-xs leading-relaxed text-text-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        aria-label={label}
      />
      {error && (
        <p className="mt-1 text-2xs text-status-error">{error}</p>
      )}
    </div>
  );
}
