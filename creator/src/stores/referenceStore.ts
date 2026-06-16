import { create } from "zustand";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type {
  ReferenceAnnotationFile,
  ReferenceCategory,
  ReferenceFile,
  ReferenceSubject,
} from "@/types/reference";
import type { Project } from "@/types/project";
import type { WorldFile } from "@/types/world";
import {
  buildResolver,
  collectDescriptions,
  hasTokens,
  mapDescriptions,
  refKey,
  slugifyToken,
  stripSigils,
} from "@/lib/referenceTokens";

const REGISTRY_FILE = "references.json";
const ANNOTATIONS_FILE = "reference-annotations.json";

function arcanumDir(project: Project): string {
  return `${project.mudDir}/.arcanum`;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!(await exists(path))) return null;
    return JSON.parse(await readTextFile(path)) as T;
  } catch {
    return null;
  }
}

async function writeJson(dir: string, file: string, value: unknown): Promise<void> {
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  await writeTextFile(`${dir}/${file}`, JSON.stringify(value, null, 2));
}

interface ReferenceStore {
  projectDir: string | null;
  subjects: ReferenceSubject[];
  /** `<zoneId>/<kind>/<entityId>` → tokenized description. */
  annotations: Record<string, string>;
  loaded: boolean;

  loadForProject: (project: Project) => Promise<void>;
  clear: () => void;

  addSubject: (init?: Partial<ReferenceSubject>) => Promise<ReferenceSubject>;
  updateSubject: (id: string, patch: Partial<ReferenceSubject>) => Promise<void>;
  removeSubject: (id: string) => Promise<void>;

  /** Resolver indexed by token slug and display name. */
  resolver: () => Map<string, ReferenceSubject>;
  /** Set of lookup keys for every registered subject (for sigil stripping). */
  knownKeys: () => Set<string>;

  /** Re-apply stored `@token` annotations onto a freshly-loaded world. */
  applyAnnotations: (zoneId: string, world: WorldFile) => WorldFile;
  /** Strip reference sigils from a world's descriptions for the game YAML. */
  stripWorld: (world: WorldFile) => WorldFile;
  /** Record token-bearing descriptions for a zone and persist. */
  captureAnnotations: (zoneId: string, world: WorldFile) => Promise<void>;
}

export const useReferenceStore = create<ReferenceStore>((set, get) => ({
  projectDir: null,
  subjects: [],
  annotations: {},
  loaded: false,

  loadForProject: async (project) => {
    const dir = arcanumDir(project);
    const registry = await readJson<ReferenceFile>(`${dir}/${REGISTRY_FILE}`);
    const annotationFile = await readJson<ReferenceAnnotationFile>(`${dir}/${ANNOTATIONS_FILE}`);
    set({
      projectDir: project.mudDir,
      subjects: registry?.subjects ?? [],
      annotations: annotationFile?.annotations ?? {},
      loaded: true,
    });
  },

  clear: () => set({ projectDir: null, subjects: [], annotations: {}, loaded: false }),

  addSubject: async (init) => {
    const name = init?.name?.trim() || "New reference";
    const subject: ReferenceSubject = {
      id: crypto.randomUUID(),
      name,
      token: (init?.token?.trim() || slugifyToken(name)) || "reference",
      category: (init?.category as ReferenceCategory) ?? "character",
      appearance: init?.appearance ?? "",
      notes: init?.notes,
    };
    const subjects = [...get().subjects, subject];
    set({ subjects });
    await persistRegistry(get);
    return subject;
  },

  updateSubject: async (id, patch) => {
    const subjects = get().subjects.map((s) =>
      s.id === id
        ? { ...s, ...patch, token: patch.token !== undefined ? slugifyToken(patch.token) : s.token }
        : s,
    );
    set({ subjects });
    await persistRegistry(get);
  },

  removeSubject: async (id) => {
    set({ subjects: get().subjects.filter((s) => s.id !== id) });
    await persistRegistry(get);
  },

  resolver: () => buildResolver(get().subjects),

  knownKeys: () => {
    const keys = new Set<string>();
    for (const s of get().subjects) {
      if (s.token) keys.add(refKey(s.token));
      if (s.name) keys.add(refKey(s.name));
    }
    return keys;
  },

  applyAnnotations: (zoneId, world) => {
    const { annotations } = get();
    const known = get().knownKeys();
    return mapDescriptions(world, (key, text) => {
      const annotated = annotations[`${zoneId}/${key}`];
      // Only re-apply when the clean form still matches the YAML — otherwise
      // the description was edited out of band and the YAML wins.
      if (annotated && stripSigils(annotated, known) === text) return annotated;
      return text;
    });
  },

  stripWorld: (world) => {
    const known = get().knownKeys();
    return mapDescriptions(world, (_key, text) => stripSigils(text, known));
  },

  captureAnnotations: async (zoneId, world) => {
    const prefix = `${zoneId}/`;
    const next: Record<string, string> = {};
    // Drop this zone's previous entries; keep every other zone's.
    for (const [k, v] of Object.entries(get().annotations)) {
      if (!k.startsWith(prefix)) next[k] = v;
    }
    for (const slot of collectDescriptions(world)) {
      if (hasTokens(slot.text)) next[`${zoneId}/${slot.key}`] = slot.text;
    }
    set({ annotations: next });
    await persistAnnotations(get);
  },
}));

async function persistRegistry(get: () => ReferenceStore): Promise<void> {
  const { projectDir, subjects } = get();
  if (!projectDir) return;
  const file: ReferenceFile = { version: 1, subjects };
  await writeJson(`${projectDir}/.arcanum`, REGISTRY_FILE, file);
}

async function persistAnnotations(get: () => ReferenceStore): Promise<void> {
  const { projectDir, annotations } = get();
  if (!projectDir) return;
  const file: ReferenceAnnotationFile = { version: 1, annotations };
  await writeJson(`${projectDir}/.arcanum`, ANNOTATIONS_FILE, file);
}
