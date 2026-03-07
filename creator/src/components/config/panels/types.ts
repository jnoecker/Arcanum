import type { AppConfig } from "@/types/config";

export type { AppConfig };

export interface ConfigPanelProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}
