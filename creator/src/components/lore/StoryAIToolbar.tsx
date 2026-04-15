// ─── StoryAIToolbar ─────────────────────────────────────────────────
// Three story-level AI tools:
//   - Outline:   synopsis -> 4-7 scene stubs (replaces existing scenes after confirmation)
//   - Next:      generate the next scene continuing the existing arc
//   - Synopsis:  reverse — fill story.synopsis from current scenes

import { useState, useCallback } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import { useStoryStore, generateSceneId } from "@/stores/storyStore";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { plainTextToTiptap } from "@/lib/loreRelations";
import {
  getStoryOutlineSystemPrompt,
  buildStoryOutlineUserPrompt,
  parseOutlineResponse,
  getNextSceneSystemPrompt,
  buildNextSceneUserPrompt,
  parseNextSceneResponse,
  getSynopsisSystemPrompt,
  buildSynopsisUserPrompt,
} from "@/lib/storyPrompts";
import type { Story, Scene } from "@/types/story";

interface StoryAIToolbarProps {
  story: Story;
}

type LoadingState = null | "outline" | "next" | "synopsis";

// ─── Sparkle icon ─────────────────────────────────────────────────

function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────

export function StoryAIToolbar({ story }: StoryAIToolbarProps) {
  const updateStory = useStoryStore((s) => s.updateStory);
  const addScene = useStoryStore((s) => s.addScene);
  const setActiveScene = useStoryStore((s) => s.setActiveScene);
  const removeScene = useStoryStore((s) => s.removeScene);

  const [loading, setLoading] = useState<LoadingState>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<
    null | { scenes: { title: string; narration: string }[] }
  >(null);

  const sortedScenes = [...story.scenes].sort((a, b) => a.sortOrder - b.sortOrder);

  // ─── Outline ──────────────────────────────────────────────────

  const handleOutline = useCallback(async () => {
    if (!story.synopsis?.trim()) {
      setError("Add a synopsis first — outline needs something to expand from.");
      return;
    }
    setError(null);
    setLoading("outline");
    try {
      const result = await invoke<string>("llm_complete", {
        systemPrompt: getStoryOutlineSystemPrompt(),
        userPrompt: buildStoryOutlineUserPrompt(story),
      });
      const parsed = parseOutlineResponse(result);
      if (parsed.length === 0) {
        setError("AI returned no usable scenes — try again or rewrite the synopsis.");
        return;
      }
      if (sortedScenes.length === 0) {
        // No scenes to replace — apply directly
        applyOutline(parsed);
      } else {
        setConfirmReplace({ scenes: parsed });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, sortedScenes.length]);

  const applyOutline = useCallback(
    (outline: { title: string; narration: string }[]) => {
      // Wipe existing scenes (confirmed via dialog)
      sortedScenes.forEach((s) => removeScene(story.id, s.id));
      // Add new scenes in order
      outline.forEach((s, i) => {
        const newScene: Scene = {
          id: generateSceneId(),
          title: s.title || `Scene ${i + 1}`,
          sortOrder: i,
          narration: plainTextToTiptap(s.narration),
        };
        addScene(story.id, newScene);
      });
      setConfirmReplace(null);
    },
    [story.id, sortedScenes, addScene, removeScene],
  );

  const handleConfirmReplace = useCallback(() => {
    if (confirmReplace) applyOutline(confirmReplace.scenes);
  }, [confirmReplace, applyOutline]);

  // ─── Next scene ────────────────────────────────────────────────

  const handleNextScene = useCallback(async () => {
    if (sortedScenes.length === 0) {
      setError("Need at least one existing scene to continue from.");
      return;
    }
    setError(null);
    setLoading("next");
    try {
      const result = await invoke<string>("llm_complete", {
        systemPrompt: getNextSceneSystemPrompt(),
        userPrompt: buildNextSceneUserPrompt(story, sortedScenes),
      });
      const parsed = parseNextSceneResponse(result);
      if (!parsed) {
        setError("AI returned no usable scene — try again.");
        return;
      }
      const newScene: Scene = {
        id: generateSceneId(),
        title: parsed.title || `Scene ${sortedScenes.length + 1}`,
        sortOrder: sortedScenes.length,
        narration: plainTextToTiptap(parsed.narration),
      };
      addScene(story.id, newScene);
      setActiveScene(newScene.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [story, sortedScenes, addScene, setActiveScene]);

  // ─── Synopsis from scenes ─────────────────────────────────────

  const handleSynopsis = useCallback(async () => {
    if (sortedScenes.length === 0) {
      setError("Need at least one scene to summarise.");
      return;
    }
    setError(null);
    setLoading("synopsis");
    try {
      const result = await invoke<string>("llm_complete", {
        systemPrompt: getSynopsisSystemPrompt(),
        userPrompt: buildSynopsisUserPrompt(story, sortedScenes),
      });
      const synopsis = result.trim();
      if (!synopsis) {
        setError("AI returned no synopsis — try again.");
        return;
      }
      updateStory(story.id, { synopsis });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [story, sortedScenes, updateStory]);

  if (!AI_ENABLED) return null;

  // ─── Render ────────────────────────────────────────────────────

  const btn = (active: boolean) =>
    [
      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs transition-colors",
      active
        ? "border-accent/50 bg-accent/10 text-accent"
        : "border-border-default text-text-muted hover:border-accent/40 hover:text-accent",
      "disabled:opacity-40 disabled:cursor-not-allowed",
    ].join(" ");

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleOutline}
          disabled={loading !== null}
          className={btn(loading === "outline")}
          title="Generate scene stubs from the synopsis"
        >
          <SparkleIcon />
          {loading === "outline" ? "Outlining..." : "Outline"}
        </button>
        <button
          type="button"
          onClick={handleNextScene}
          disabled={loading !== null}
          className={btn(loading === "next")}
          title="Append a new scene continuing the story"
        >
          <SparkleIcon />
          {loading === "next" ? "Writing..." : "Next scene"}
        </button>
        <button
          type="button"
          onClick={handleSynopsis}
          disabled={loading !== null}
          className={btn(loading === "synopsis")}
          title="Fill the synopsis from existing scenes"
        >
          <SparkleIcon />
          {loading === "synopsis" ? "Summarising..." : "Synopsise"}
        </button>
      </div>
      {error && (
        <span role="alert" className="max-w-xs text-right text-2xs text-status-error">
          {error}
        </span>
      )}

      {confirmReplace && (
        <ConfirmDialog
          title="Replace All Scenes?"
          message={`This will delete the ${sortedScenes.length} existing scene${sortedScenes.length === 1 ? "" : "s"} and replace them with ${confirmReplace.scenes.length} new scene${confirmReplace.scenes.length === 1 ? "" : "s"} from the AI outline. You can undo.`}
          confirmLabel="Replace"
          cancelLabel="Keep current"
          destructive
          onConfirm={handleConfirmReplace}
          onCancel={() => setConfirmReplace(null)}
        />
      )}
    </div>
  );
}
