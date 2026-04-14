import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useLoreStore } from "@/stores/loreStore";
import { useStoryStore } from "@/stores/storyStore";
import { useConfigStore } from "@/stores/configStore";
import { saveEverything } from "@/lib/saveAll";
import { PANEL_MAP, panelTab } from "@/lib/panelRegistry";
import { useToastStore } from "@/stores/toastStore";

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
        saveEverything().catch((err) =>
          console.error("Save all failed:", err),
        );
        return;
      }

      // Skip remaining shortcuts when typing in inputs
      if (inInput) return;

      // ─── Ctrl+Z → undo (routed by active panel) ───────────
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (dispatchUndo()) {
          useToastStore.getState().show("Change undone");
        }
        return;
      }

      // ─── Ctrl+Shift+Z / Ctrl+Y → redo (routed by active panel) ───
      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        if (dispatchRedo()) {
          useToastStore.getState().show("Change restored");
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

      // ─── Ctrl+, → open settings ("tune the instrument") ─────
      if (e.key === ",") {
        e.preventDefault();
        useProjectStore.getState().openTab(panelTab("services"));
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

/** Active panel ID, or null if the active tab isn't a panel. */
function getActivePanelId(): string | null {
  const { activeTabId } = useProjectStore.getState();
  if (!activeTabId?.startsWith("panel:")) return null;
  return activeTabId.replace(/^panel:/, "");
}

/**
 * Route Ctrl+Z to the correct store based on the active tab.
 * Returns true if something was dispatched (so the caller can show a toast).
 *
 * Dispatch order matters: the Story Editor is a `lore` host panel, so it
 * must be checked before the generic lore branch — otherwise Ctrl+Z in the
 * story editor would wipe unrelated lore changes instead of undoing the
 * user's story edit.
 */
function dispatchUndo(): boolean {
  const activeZoneId = getActiveZoneId();
  if (activeZoneId) {
    useZoneStore.getState().undo(activeZoneId);
    return true;
  }
  const panelId = getActivePanelId();
  if (!panelId) return false;
  if (panelId === "storyEditor") {
    useStoryStore.getState().undoStory();
    return true;
  }
  const host = PANEL_MAP[panelId]?.host;
  if (host === "lore") {
    useLoreStore.getState().undoLore();
    return true;
  }
  if (host === "config") {
    useConfigStore.getState().undoConfig();
    return true;
  }
  return false;
}

function dispatchRedo(): boolean {
  const activeZoneId = getActiveZoneId();
  if (activeZoneId) {
    useZoneStore.getState().redo(activeZoneId);
    return true;
  }
  const panelId = getActivePanelId();
  if (!panelId) return false;
  if (panelId === "storyEditor") {
    useStoryStore.getState().redoStory();
    return true;
  }
  const host = PANEL_MAP[panelId]?.host;
  if (host === "lore") {
    useLoreStore.getState().redoLore();
    return true;
  }
  if (host === "config") {
    useConfigStore.getState().redoConfig();
    return true;
  }
  return false;
}
