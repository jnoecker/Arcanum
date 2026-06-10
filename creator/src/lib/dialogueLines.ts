import type { WorldFile } from "@/types/world";
import type { DialogueLine } from "@/types/voiceover";

/** Flatten every voiceable NPC dialogue line across the given zones, sorted by
 *  zone, then mob, then node (root first). Shared by the Voice-Over panel and
 *  the world publish flow so both enumerate the same lines. */
export function collectDialogueLines(
  zones: Map<string, { data: WorldFile }>,
): DialogueLine[] {
  const lines: DialogueLine[] = [];
  for (const { data } of zones.values()) {
    const zone = data.zone;
    const mobs = data.mobs ?? {};
    for (const [templateKey, mob] of Object.entries(mobs)) {
      const dialogue = mob.dialogue;
      if (!dialogue) continue;
      for (const [nodeId, node] of Object.entries(dialogue)) {
        if (!node.text || !node.text.trim()) continue;
        lines.push({ zone, templateKey, mobName: mob.name ?? templateKey, nodeId, text: node.text });
      }
    }
  }
  lines.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
    if (a.templateKey !== b.templateKey) return a.templateKey.localeCompare(b.templateKey);
    if (a.nodeId === "root") return -1;
    if (b.nodeId === "root") return 1;
    return a.nodeId.localeCompare(b.nodeId);
  });
  return lines;
}
