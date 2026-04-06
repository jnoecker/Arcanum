import { useLoreStore } from "@/stores/loreStore";
import type { SceneTemplateId } from "@/types/story";
import { resolveSceneTemplate } from "@/lib/sceneTemplates";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TemplateBadge({ template }: { template: SceneTemplateId }) {
  const customTemplates = useLoreStore((s) => s.lore?.customSceneTemplates);
  const resolved = resolveSceneTemplate(template, customTemplates);
  if (!resolved) return null;
  return (
    <span
      className="rounded-full px-2 py-1 text-3xs uppercase tracking-[0.18em]"
      style={{
        backgroundColor: hexToRgba(resolved.badgeColor, 0.18),
        color: resolved.badgeColor,
      }}
    >
      {resolved.label}
    </span>
  );
}
