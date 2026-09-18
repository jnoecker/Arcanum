import { describe, it, expect } from "vitest";
import { stringify } from "yaml";
import { bundleConfigBlock, bundleIdOf, sha256Hex, stampZoneDoc, worldDigest, BUNDLE_ID_LENGTH, type BundleStamp } from "@/lib/bundle";
import { YAML_OPTS } from "@/lib/yamlOpts";
import type { WorldFile } from "@/types/world";

describe("bundle stamp", () => {
  it("hashes deterministically and independently of zone order", async () => {
    const a = await worldDigest([["caldera", "zone: caldera\n"], ["aetherion", "zone: aetherion\n"]]);
    const b = await worldDigest([["aetherion", "zone: aetherion\n"], ["caldera", "zone: caldera\n"]]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const c = await worldDigest([["caldera", "zone: caldera\nlifespan: 5\n"], ["aetherion", "zone: aetherion\n"]]);
    expect(c).not.toBe(a);
  });

  it("derives one short id from the world and config digests", async () => {
    const id = await bundleIdOf(await sha256Hex("world"), await sha256Hex("config"));
    expect(id).toHaveLength(BUNDLE_ID_LENGTH);
    expect(id).toMatch(/^[0-9a-f]+$/);
    expect(await bundleIdOf(await sha256Hex("world"), await sha256Hex("config"))).toBe(id);
    expect(await bundleIdOf(await sha256Hex("world"), await sha256Hex("other config"))).not.toBe(id);
  });

  it("places the stamp right after the zone key in the serialized document", () => {
    const doc: WorldFile = { zone: "caldera", startRoom: "gate", rooms: { gate: { title: "Gate", description: "A gate." } } };
    const stamped = stampZoneDoc(doc, "rc-1");
    expect(Object.keys(stamped).slice(0, 3)).toEqual(["zone", "bundle", "startRoom"]);
    expect(stringify(stamped, YAML_OPTS).split("\n").slice(0, 2)).toEqual(["zone: caldera", "bundle: rc-1"]);
    expect(doc).not.toHaveProperty("bundle");
  });

  it("writes the block the server's BundleConfig reads", () => {
    const stamp: BundleStamp = {
      id: "abc123def456",
      worldRepoCommit: "0123456789abcdef",
      worldRepoDirty: false,
      worldSha256: "w".repeat(64),
      configSha256: "c".repeat(64),
      arcanumVersion: "3.17.0",
      exportedAt: "2026-09-17T00:00:00.000Z",
    };
    expect(bundleConfigBlock(stamp)).toEqual({
      id: "abc123def456",
      worldRepoCommit: "0123456789abcdef",
      worldRepoDirty: false,
      worldSha256: "w".repeat(64),
      configSha256: "c".repeat(64),
      arcanumVersion: "3.17.0",
      exportedAt: "2026-09-17T00:00:00.000Z",
    });
  });
});
