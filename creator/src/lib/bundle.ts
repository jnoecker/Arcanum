import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import type { Project } from "@/types/project";
import type { WorldFile } from "@/types/world";

/**
 * The identity of one publish: the config and the zone files published together
 * carry the same `id`, and the server refuses a config from one publish loaded
 * with zones from another. The hashes are over the serialized in-memory world
 * and config, so the two publish actions agree whenever nothing changed between
 * them; the repository commit ties the publish to its source.
 */
export interface BundleStamp {
  id: string;
  worldRepoCommit?: string;
  worldRepoDirty?: boolean;
  worldSha256: string;
  configSha256: string;
  arcanumVersion: string;
  exportedAt: string;
}

export const BUNDLE_ID_LENGTH = 12;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** One hash over every zone's serialized YAML, in zone-id order. */
export async function worldDigest(serialized: Iterable<[string, string]>): Promise<string> {
  const parts = Array.from(serialized).sort(([a], [b]) => a.localeCompare(b));
  return sha256Hex(parts.map(([id, yaml]) => `${id}\n${yaml}\n`).join(""));
}

export async function bundleIdOf(worldSha256: string, configSha256: string): Promise<string> {
  return (await sha256Hex(`${worldSha256}:${configSha256}`)).slice(0, BUNDLE_ID_LENGTH);
}

/** The stamp's fields as the server's `ambonmud.bundle` block reads them. */
export function bundleConfigBlock(stamp: BundleStamp): Record<string, unknown> {
  return {
    id: stamp.id,
    worldRepoCommit: stamp.worldRepoCommit,
    worldRepoDirty: stamp.worldRepoDirty,
    worldSha256: stamp.worldSha256,
    configSha256: stamp.configSha256,
    arcanumVersion: stamp.arcanumVersion,
    exportedAt: stamp.exportedAt,
  };
}

/** A zone document with `bundle` placed right after `zone`, where the server's loader reads it. */
export function stampZoneDoc<T extends WorldFile>(doc: T, bundleId: string): T {
  const { zone, ...rest } = doc;
  return { zone, bundle: bundleId, ...rest } as T;
}

interface RepoIdentity {
  worldRepoCommit?: string;
  worldRepoDirty?: boolean;
}

async function repoIdentity(project: Project): Promise<RepoIdentity> {
  try {
    const status = await invoke<{ is_repo: boolean; changed_files: number }>("git_repo_status", { path: project.mudDir });
    if (!status.is_repo) return {};
    const log = await invoke<Array<{ hash: string }>>("git_log", { path: project.mudDir, count: 1 });
    return { worldRepoCommit: log[0]?.hash, worldRepoDirty: status.changed_files > 0 };
  } catch {
    return {};
  }
}

async function arcanumVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "dev";
  }
}

/**
 * Compute the stamp for the current in-memory world and config. `serializedZones`
 * and `configYaml` must be the unstamped serializations the publish will send.
 */
export async function computeBundleStamp(
  project: Project,
  serializedZones: Iterable<[string, string]>,
  configYaml: string,
): Promise<BundleStamp> {
  const [worldSha256, configSha256, repo, version] = await Promise.all([
    worldDigest(serializedZones),
    sha256Hex(configYaml),
    repoIdentity(project),
    arcanumVersion(),
  ]);
  return {
    id: await bundleIdOf(worldSha256, configSha256),
    ...repo,
    worldSha256,
    configSha256,
    arcanumVersion: version,
    exportedAt: new Date().toISOString(),
  };
}
