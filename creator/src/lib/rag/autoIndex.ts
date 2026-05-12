import { useEffect, useRef } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { getIndexStats, rebuildIndex } from ".";
import { gatherChunkerInput } from "./chunkerInput";

const REINDEX_DEBOUNCE_MS = 15_000;

/**
 * Keeps the lore RAG index in sync with edits. Only fires when an index
 * has already been built — clearing the index is a real off-switch.
 * Debounced so a burst of edits coalesces into one rebuild.
 */
export function useAutoIndexLore(): void {
  const lore = useLoreStore((s) => s.lore);
  const projectDir = useProjectStore((s) => s.project?.mudDir);
  const timerRef = useRef<number | null>(null);
  const skippedFirstRef = useRef(false);
  const hasIndexRef = useRef<boolean | null>(null);

  // On project change, reset state and probe for an existing index.
  useEffect(() => {
    skippedFirstRef.current = false;
    hasIndexRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!projectDir) return;
    let cancelled = false;
    getIndexStats()
      .then((stats) => {
        if (cancelled) return;
        hasIndexRef.current = (stats?.total_chunks ?? 0) > 0;
      })
      .catch(() => {
        if (cancelled) return;
        hasIndexRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  // On lore change, schedule a debounced rebuild.
  useEffect(() => {
    if (!projectDir || !lore) return;
    // First non-null lore for this project is the initial load, not an edit.
    if (!skippedFirstRef.current) {
      skippedFirstRef.current = true;
      return;
    }
    if (hasIndexRef.current !== true) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      try {
        await rebuildIndex(gatherChunkerInput());
      } catch (e) {
        console.warn("[rag] auto-reindex failed", e);
      }
    }, REINDEX_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [lore, projectDir]);
}
