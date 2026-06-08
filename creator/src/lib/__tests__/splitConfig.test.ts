import { describe, expect, it } from "vitest";
import { mergeWorldPool } from "@/lib/loader";
import { WORLD_POOL_FILES, WORLD_SECTION_HOMES } from "@/lib/projectPaths";

describe("mergeWorldPool", () => {
  it("loads a legacy monolithic world.yaml with no warnings", () => {
    const { merged, warnings } = mergeWorldPool([
      {
        name: "world.yaml",
        data: {
          mode: "standard",
          commands: { look: { enabled: true } },
          lottery: { ticketCost: 10 },
          world: { name: "Ambon" },
        },
      },
    ]);

    expect(merged.mode).toBe("standard");
    expect(merged.commands).toEqual({ look: { enabled: true } });
    expect(merged.lottery).toEqual({ ticketCost: 10 });
    expect(warnings).toEqual([]);
  });

  it("merges sections from multiple files", () => {
    const { merged, warnings } = mergeWorldPool([
      { name: "commands.yaml", data: { commands: { look: {} } } },
      { name: "server.yaml", data: { mode: "standard" } },
      { name: "world.yaml", data: { world: { name: "Ambon" } } },
    ]);

    expect(merged).toEqual({
      commands: { look: {} },
      mode: "standard",
      world: { name: "Ambon" },
    });
    expect(warnings).toEqual([]);
  });

  it("prefers the canonical file when a section is duplicated, regardless of order", () => {
    // commands.yaml sorts before world.yaml (canonical seen first)
    const a = mergeWorldPool([
      { name: "world.yaml", data: { commands: { stale: true } } },
      { name: "commands.yaml", data: { commands: { fresh: true } } },
    ]);
    expect(a.merged.commands).toEqual({ fresh: true });
    expect(a.warnings).toHaveLength(1);
    expect(a.warnings[0]).toContain("commands.yaml");

    // aaa-drop.yaml sorts before economy.yaml (canonical seen second)
    const b = mergeWorldPool([
      { name: "aaa-drop.yaml", data: { lottery: { stale: true } } },
      { name: "economy.yaml", data: { lottery: { fresh: true } } },
    ]);
    expect(b.merged.lottery).toEqual({ fresh: true });
    expect(b.warnings).toHaveLength(1);
    expect(b.warnings[0]).toContain("using the copy in economy.yaml");
  });

  it("resolves duplicates between non-canonical files alphabetically with a warning", () => {
    const { merged, warnings } = mergeWorldPool([
      { name: "zz-tweaks.yaml", data: { customSection: { from: "zz" } } },
      { name: "aa-tweaks.yaml", data: { customSection: { from: "aa" } } },
    ]);

    expect(merged.customSection).toEqual({ from: "aa" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("using the copy in aa-tweaks.yaml");
  });

  it("merges unknown sections from drop-in files", () => {
    const { merged, warnings } = mergeWorldPool([
      { name: "world.yaml", data: { world: { name: "Ambon" } } },
      { name: "my-experiment.yaml", data: { skillPoints: { interval: 4 } } },
    ]);

    expect(merged.skillPoints).toEqual({ interval: 4 });
    expect(warnings).toEqual([]);
  });

  it("returns empty for no files", () => {
    const { merged, warnings } = mergeWorldPool([]);
    expect(merged).toEqual({});
    expect(warnings).toEqual([]);
  });
});

describe("WORLD_SECTION_HOMES", () => {
  it("assigns every section to a declared pool file", () => {
    const pool = new Set<string>(WORLD_POOL_FILES);
    for (const home of Object.values(WORLD_SECTION_HOMES)) {
      expect(pool.has(home)).toBe(true);
    }
  });

  it("uses every pool file at least once", () => {
    const used = new Set(Object.values(WORLD_SECTION_HOMES));
    for (const file of WORLD_POOL_FILES) {
      expect(used.has(file)).toBe(true);
    }
  });
});
