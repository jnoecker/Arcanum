import { exists, readTextFile, writeTextFile, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import type { Project } from "@/types/project";
import type { Story } from "@/types/story";
import { useStoryStore } from "@/stores/storyStore";

/** Regex for valid story IDs -- prevents path traversal (T-07-02). */
export const STORY_ID_PATTERN = /^[a-z0-9_]+$/;

export function storiesDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/stories`
    : `${project.mudDir}/src/main/resources/stories`;
}

export function storyPath(project: Project, storyId: string): string {
  return `${storiesDir(project)}/${storyId}.json`;
}

/**
 * Load a single story from disk.
 * Returns null if the file does not exist or contains malformed JSON (T-07-01).
 */
export async function loadStory(project: Project, storyId: string): Promise<Story | null> {
  if (!STORY_ID_PATTERN.test(storyId)) return null;
  const path = storyPath(project, storyId);
  try {
    if (!(await exists(path))) return null;
    const content = await readTextFile(path);
    return JSON.parse(content) as Story;
  } catch {
    return null;
  }
}

/**
 * Save a story to disk as pretty-printed JSON.
 * Creates the stories directory if it does not exist.
 */
export async function saveStory(project: Project, story: Story): Promise<void> {
  const dir = storiesDir(project);
  await mkdir(dir, { recursive: true });
  const path = storyPath(project, story.id);
  await writeTextFile(path, JSON.stringify(story, null, 2));
}

/**
 * List all story IDs in the stories directory.
 * Returns an empty array if the directory does not exist.
 */
export async function loadAllStoryIds(project: Project): Promise<string[]> {
  const dir = storiesDir(project);
  try {
    if (!(await exists(dir))) return [];
    const entries = await readDir(dir);
    return entries
      .filter((e) => e.name?.endsWith(".json"))
      .map((e) => e.name!.replace(/\.json$/, ""))
      .filter((id) => STORY_ID_PATTERN.test(id));
  } catch {
    return [];
  }
}

/**
 * Delete a story JSON file from disk.
 */
export async function deleteStoryFile(project: Project, storyId: string): Promise<void> {
  if (!STORY_ID_PATTERN.test(storyId)) return;
  try {
    await remove(storyPath(project, storyId));
  } catch {
    // File may not exist -- silently ignore
  }
}

/**
 * Save all dirty stories to disk and mark them clean.
 */
export async function saveAllDirtyStories(project: Project): Promise<void> {
  const state = useStoryStore.getState();
  const dirtyIds = Object.entries(state.dirty)
    .filter(([, isDirty]) => isDirty)
    .map(([id]) => id);

  for (const id of dirtyIds) {
    const story = state.stories[id];
    if (story) {
      await saveStory(project, story);
      state.markClean(id);
    }
  }
}
