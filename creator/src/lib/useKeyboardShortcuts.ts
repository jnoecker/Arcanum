import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useLoreStore } from "@/stores/loreStore";
import { saveAllZones } from "@/lib/saveZone";
import { saveProjectConfig } from "@/lib/saveConfig";
import { useConfigStore } from "@/stores/configStore";
import { PANEL_MAP } from "@/lib/panelRegistry";

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // ─── ? → show help (only when not typing) ────────────────
      if (e.key === "?" && !mod && !inInput) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // ─── Escape → close help ─────────────────────────────────
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      if (!mod) return;

      // ─── Ctrl+S → save all ───────────────────────────────────
      if (e.key === "s") {
        e.preventDefault();
        saveAllZones().catch((err) =>
          console.error("Zone save failed:", err),
        );
        const project = useProjectStore.getState().project;
        if (project && useConfigStore.getState().dirty) {
          saveProjectConfig(project).catch((err) =>
            console.error("Config save failed:", err),
          );
        }
        return;
      }

      // Skip remaining shortcuts when typing in inputs
      if (inInput) return;

      // ─── Ctrl+Z → undo (zone or lore, depending on context) ─
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const activeZoneId = getActiveZoneId();
        if (activeZoneId) {
          useZoneStore.getState().undo(activeZoneId);
        } else if (isActiveLorePanel()) {
          useLoreStore.getState().undoLore();
        }
        return;
      }

      // ─── Ctrl+Shift+Z / Ctrl+Y → redo (zone or lore) ───────
      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        const activeZoneId = getActiveZoneId();
        if (activeZoneId) {
          useZoneStore.getState().redo(activeZoneId);
        } else if (isActiveLorePanel()) {
          useLoreStore.getState().redoLore();
        }
        return;
      }

      // ─── Ctrl+W → close active tab ──────────────────────────
      if (e.key === "w") {
        e.preventDefault();
        const { activeTabId, closeTab } = useProjectStore.getState();
        if (activeTabId) closeTab(activeTabId);
        return;
      }

      // ─── Ctrl+Tab / Ctrl+Shift+Tab → cycle tabs ─────────────
      if (e.key === "Tab") {
        e.preventDefault();
        const { tabs, activeTabId, setActiveTab } =
          useProjectStore.getState();
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length;
        setActiveTab(tabs[next]!.id);
        return;
      }

      // ─── Ctrl+1-9 → jump to tab N ───────────────────────────
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const { tabs, setActiveTab } = useProjectStore.getState();
        const tab = tabs[num - 1];
        if (tab) setActiveTab(tab.id);
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { showHelp, setShowHelp };
}

function getActiveZoneId(): string | null {
  const { activeTabId } = useProjectStore.getState();
  if (!activeTabId?.startsWith("zone:")) return null;
  return activeTabId.replace(/^zone:/, "");
}

function isActiveLorePanel(): boolean {
  const { activeTabId } = useProjectStore.getState();
  if (!activeTabId?.startsWith("panel:")) return false;
  const panelId = activeTabId.replace(/^panel:/, "");
  return PANEL_MAP[panelId]?.host === "lore";
}
