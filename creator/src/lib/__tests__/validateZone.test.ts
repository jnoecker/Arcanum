import { describe, it, expect } from "vitest";
import { validateZone, type ValidationIssue } from "../validateZone";
import type { WorldFile } from "@/types/world";

const TEST_MOB_TIERS = {
  weak: { baseHp: 8, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 3, damagePerLevel: 1, baseArmor: 0, baseXpReward: 10, xpRewardPerLevel: 3, baseGoldMin: 0, baseGoldMax: 2, goldPerLevel: 1 },
  standard: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 2, baseArmor: 2, baseXpReward: 20, xpRewardPerLevel: 7, baseGoldMin: 1, baseGoldMax: 4, goldPerLevel: 2 },
  elite: { baseHp: 50, hpPerLevel: 10, baseMinDamage: 5, baseMaxDamage: 10, damagePerLevel: 3, baseArmor: 4, baseXpReward: 50, xpRewardPerLevel: 15, baseGoldMin: 5, baseGoldMax: 15, goldPerLevel: 5 },
  boss: { baseHp: 200, hpPerLevel: 30, baseMinDamage: 10, baseMaxDamage: 20, damagePerLevel: 5, baseArmor: 8, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 50, baseGoldMax: 150, goldPerLevel: 20 },
};

function makeValidWorld(): WorldFile {
  return {
    zone: "test",
    startRoom: "room1",
    rooms: {
      room1: {
        title: "Room 1",
        description: "First room",
        exits: { n: "room2" },
      },
      room2: {
        title: "Room 2",
        description: "Second room",
        exits: { s: "room1" },
      },
    },
    mobs: {
      rat: { name: "Rat", spawns: [{ room: "room1" }] },
    },
    items: {
      sword: { displayName: "Sword", room: "room1" },
    },
  };
}

function errors(issues: ValidationIssue[]) {
  return issues.filter((i) => i.severity === "error");
}

function warnings(issues: ValidationIssue[]) {
  return issues.filter((i) => i.severity === "warning");
}

describe("validateZone", () => {
  it("returns no issues for a valid world", () => {
    const issues = validateZone(makeValidWorld());
    expect(issues).toHaveLength(0);
  });

  // ─── Zone-level ──────────────────────────────────────────────
  it("errors if startRoom does not exist", () => {
    const world = makeValidWorld();
    world.startRoom = "nonexistent";
    const issues = errors(validateZone(world));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("does not exist");
  });

  it("errors if zone has no rooms", () => {
    const world = makeValidWorld();
    world.rooms = {};
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("no rooms"))).toBe(true);
  });

  it("errors on an invalid level band", () => {
    const world = makeValidWorld();
    world.levelBand = { min: 8, max: 3 };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("levelBand.max"))).toBe(true);
  });

  // ─── Room exits ──────────────────────────────────────────────
  it("errors on exit to non-existent room", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = { n: "missing_room" };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_room"))).toBe(true);
  });

  it("does not error on cross-zone exits", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = { n: "other_zone:room1" };
    const issues = errors(validateZone(world));
    expect(issues).toHaveLength(0);
  });

  it("warns on door key that is not a known item", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = {
      n: { to: "room2", door: { locked: true, key: "missing_key" } },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_key"))).toBe(true);
  });

  // ─── Room content ────────────────────────────────────────────
  it("warns on room with no title", () => {
    const world = makeValidWorld();
    world.rooms.room1.title = "";
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("no title"))).toBe(true);
  });

  // ─── Mob checks ──────────────────────────────────────────────
  it("errors if mob spawn room does not exist", () => {
    const world = makeValidWorld();
    world.mobs!.rat.spawns = [{ room: "missing" }];
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "mob:rat")).toBe(true);
  });

  it("warns on mob drop referencing unknown item", () => {
    const world = makeValidWorld();
    world.mobs!.rat.drops = [{ itemId: "missing_item", chance: 50 }];
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  it("warns on invalid drop chance", () => {
    const world = makeValidWorld();
    world.mobs!.rat.drops = [{ itemId: "sword", chance: 1.5 }];
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("chance"))).toBe(true);
  });

  it("errors on patrol route with non-existent room", () => {
    const world = makeValidWorld();
    world.mobs!.rat.behavior = {
      template: "PATROL",
      params: { patrolRoute: ["room1", "missing"] },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing"))).toBe(true);
  });

  it("errors on mob quest reference to non-existent quest", () => {
    const world = makeValidWorld();
    world.mobs!.rat.quests = ["no_quest"];
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("no_quest"))).toBe(true);
  });

  // ─── Dialogue checks ────────────────────────────────────────
  it("errors on dialogue choice pointing to non-existent node", () => {
    const world = makeValidWorld();
    world.mobs!.rat.dialogue = {
      root: {
        text: "Hello",
        choices: [{ text: "Go", next: "missing_node" }],
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_node"))).toBe(true);
  });

  it("warns on dialogue node with empty text", () => {
    const world = makeValidWorld();
    world.mobs!.rat.dialogue = {
      root: { text: "" },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("empty text"))).toBe(true);
  });

  it("errors when dialogue is missing a root node", () => {
    const world = makeValidWorld();
    world.mobs!.rat.dialogue = {
      intro: { text: "Hello" },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("root"))).toBe(true);
  });

  it("warns when a prop mob has quests or dialogue", () => {
    const world = makeValidWorld();
    world.mobs!.rat.role = "prop";
    world.mobs!.rat.quests = ["test:someQuest"];
    world.quests = { "test:someQuest": { name: "Q", giver: "rat", objectives: [{ type: "kill", targetKey: "rat" }] } };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.entity === "mob:rat" && i.message.toLowerCase().includes("prop"))).toBe(true);
  });

  it("warns when a non-combat mob has combat-stat overrides", () => {
    const world = makeValidWorld();
    world.mobs!.rat.role = "vendor";
    world.mobs!.rat.hp = 500;
    world.mobs!.rat.xpReward = 100;
    const issues = warnings(validateZone(world));
    expect(
      issues.some(
        (i) => i.entity === "mob:rat" && i.message.toLowerCase().includes("ignore"),
      ),
    ).toBe(true);
  });

  it("does not warn when a combat mob has combat-stat overrides", () => {
    const world = makeValidWorld();
    world.mobs!.rat.hp = 500;
    world.mobs!.rat.xpReward = 100;
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.entity === "mob:rat" && i.message.toLowerCase().includes("ignore"))).toBe(false);
  });

  it("warns a combat mob's tier curve is broken by overrides when tiers are configured", () => {
    const world = makeValidWorld();
    world.mobs!.rat.tier = "standard";
    world.mobs!.rat.level = 5;
    world.mobs!.rat.hp = 999;
    const issues = warnings(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));
    const match = issues.find((i) => i.entity === "mob:rat" && i.message.includes("tier curve"));
    expect(match).toBeDefined();
    expect(match!.message).toContain("HP 999");
    expect(match!.message).toContain("tier default");
  });

  it("does not emit a tier-curve warning when no overrides are set", () => {
    const world = makeValidWorld();
    world.mobs!.rat.tier = "standard";
    world.mobs!.rat.level = 5;
    const issues = warnings(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));
    expect(issues.some((i) => i.message.includes("tier curve"))).toBe(false);
  });

  it("silently skips the tier-curve nudge when mobTiers config is absent", () => {
    const world = makeValidWorld();
    world.mobs!.rat.hp = 999;
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("tier curve"))).toBe(false);
  });

  it("warns when a quest XP override breaks its difficulty tier", () => {
    const world = makeValidWorld();
    world.mobs!.giver = { name: "Giver", spawns: [{ room: "room1" }] };
    world.quests = {
      test_quest: {
        name: "Test",
        giver: "giver",
        level: 5,
        difficulty: "standard",
        rewards: { xp: 500 },
        objectives: [{ type: "kill", targetKey: "rat" }],
      },
    };
    const questXpConfig = {
      baseline: { baseXp: 50, xpPerLevel: 20 },
      tiers: { standard: 1.0 } as const,
    };
    const issues = warnings(
      validateZone(world, undefined, undefined, undefined, undefined, undefined, questXpConfig),
    );
    const match = issues.find(
      (i) => i.entity === "quest:test_quest" && i.message.includes("override (500)"),
    );
    expect(match).toBeDefined();
    expect(match!.message).toContain("would compute 130");
  });

  it("errors when scaling.mode 'bounded' has no levelRange", () => {
    const world = makeValidWorld();
    world.scaling = { mode: "bounded" };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "zone" && i.message.includes("bounded"))).toBe(true);
  });

  it("errors on an inverted scaling levelRange", () => {
    const world = makeValidWorld();
    world.scaling = { mode: "bounded", levelRange: [10, 3] };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("max (3)"))).toBe(true);
  });

  it("accepts a valid bounded scaling config", () => {
    const world = makeValidWorld();
    world.scaling = { mode: "bounded", levelRange: [3, 8] };
    const issues = errors(validateZone(world));
    expect(issues.filter((i) => i.entity === "zone")).toHaveLength(0);
  });

  it("accepts player mode with no levelRange", () => {
    const world = makeValidWorld();
    world.scaling = { mode: "player" };
    const issues = errors(validateZone(world));
    expect(issues.filter((i) => i.entity === "zone")).toHaveLength(0);
  });

  it("warns when player mode has an unused levelRange", () => {
    const world = makeValidWorld();
    world.scaling = { mode: "player", levelRange: [3, 8] };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.entity === "zone" && i.message.includes("ignores levelRange"))).toBe(true);
  });

  it("does not warn when a quest uses the computed difficulty XP", () => {
    const world = makeValidWorld();
    world.mobs!.giver = { name: "Giver", spawns: [{ room: "room1" }] };
    world.quests = {
      test_quest: {
        name: "Test",
        giver: "giver",
        level: 5,
        difficulty: "standard",
        objectives: [{ type: "kill", targetKey: "rat" }],
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.entity === "quest:test_quest" && i.message.includes("override"))).toBe(false);
  });

  // ─── Item checks ────────────────────────────────────────────
  it("errors if item room does not exist", () => {
    const world = makeValidWorld();
    world.items!.sword.room = "missing";
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "item:sword")).toBe(true);
  });

  it("errors on deprecated mob item placement", () => {
    const world = makeValidWorld();
    world.items!.sword.mob = "rat";
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.toLowerCase().includes("deprecated"))).toBe(true);
  });

  it("errors when item onUse has no positive effect", () => {
    const world = makeValidWorld();
    world.items!.sword.onUse = { healHp: 0, grantXp: 0 };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("positive effect"))).toBe(true);
  });

  // ─── Shop checks ───────────────────────────────────────────
  it("errors if shop room does not exist", () => {
    const world = makeValidWorld();
    world.shops = { vendor: { name: "Vendor", room: "missing" } };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "shop:vendor")).toBe(true);
  });

  it("warns on shop inventory item not in zone", () => {
    const world = makeValidWorld();
    world.shops = {
      vendor: { name: "Vendor", room: "room1", items: ["missing_item"] },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  // ─── Quest checks ──────────────────────────────────────────
  it("warns if quest giver mob does not exist", () => {
    const world = makeValidWorld();
    world.quests = {
      q1: {
        name: "Quest",
        giver: "missing_mob",
        objectives: [{ type: "KILL", targetKey: "rat" }],
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_mob"))).toBe(true);
  });

  it("errors if quest has no objectives", () => {
    const world = makeValidWorld();
    world.quests = {
      q1: { name: "Quest", giver: "rat" },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("at least one objective"))).toBe(true);
  });

  // ─── Gathering node checks ────────────────────────────────
  it("errors if gathering node room does not exist", () => {
    const world = makeValidWorld();
    world.gatheringNodes = {
      ore: {
        displayName: "Ore",
        skill: "MINING",
        yields: [{ itemId: "sword" }],
        room: "missing",
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "gatheringNode:ore")).toBe(true);
  });

  it("warns on gathering yield referencing unknown item", () => {
    const world = makeValidWorld();
    world.gatheringNodes = {
      ore: {
        displayName: "Ore",
        skill: "MINING",
        yields: [{ itemId: "missing_item" }],
        room: "room1",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  it("errors on rare yield chance outside server range", () => {
    const world = makeValidWorld();
    world.gatheringNodes = {
      ore: {
        displayName: "Ore",
        skill: "MINING",
        yields: [{ itemId: "sword" }],
        rareYields: [{ itemId: "sword", dropChance: 0 }],
        room: "room1",
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("dropChance"))).toBe(true);
  });

  // ─── Recipe checks ────────────────────────────────────────
  it("warns on recipe output item not in zone", () => {
    const world = makeValidWorld();
    world.recipes = {
      r1: {
        displayName: "Recipe",
        skill: "SMITHING",
        materials: [{ itemId: "sword", quantity: 1 }],
        outputItemId: "missing_output",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_output"))).toBe(
      true,
    );
  });

  it("warns on recipe material item not in zone", () => {
    const world = makeValidWorld();
    world.recipes = {
      r1: {
        displayName: "Recipe",
        skill: "SMITHING",
        materials: [{ itemId: "missing_mat", quantity: 1 }],
        outputItemId: "sword",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_mat"))).toBe(true);
  });

  it("errors on recipe material quantity below 1", () => {
    const world = makeValidWorld();
    world.recipes = {
      r1: {
        displayName: "Recipe",
        skill: "SMITHING",
        materials: [{ itemId: "sword", quantity: 0 }],
        outputItemId: "sword",
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("quantity"))).toBe(true);
  });

  it("errors on invalid puzzle reward", () => {
    const world = makeValidWorld();
    world.puzzles = {
      gate: {
        type: "riddle",
        roomId: "room1",
        answer: "key",
        reward: { type: "give_gold", amount: 0 },
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "puzzle:gate")).toBe(true);
  });

  // ─── Sequence puzzle feature refs ───────────────────────────
  it("accepts sequence steps that reference a feature's local key", () => {
    const world = makeValidWorld();
    world.rooms.room1.features = {
      vault_lever: { type: "LEVER", displayName: "a lever", keyword: "lever", initialState: "up" },
    };
    world.puzzles = {
      open_vault: {
        type: "sequence",
        roomId: "room1",
        steps: [{ feature: "vault_lever", action: "pull" }],
        reward: { type: "give_gold", gold: 10 },
      },
    };
    const issues = validateZone(world);
    expect(issues.filter((i) => i.entity === "puzzle:open_vault")).toHaveLength(0);
  });

  it("accepts sequence steps that reference a feature's keyword (back-compat)", () => {
    const world = makeValidWorld();
    world.rooms.room1.features = {
      vault_lever: { type: "LEVER", displayName: "a lever", keyword: "lever", initialState: "up" },
    };
    world.puzzles = {
      open_vault: {
        type: "sequence",
        roomId: "room1",
        steps: [{ feature: "lever", action: "pull" }],
        reward: { type: "give_gold", gold: 10 },
      },
    };
    const issues = validateZone(world);
    expect(issues.filter((i) => i.entity === "puzzle:open_vault")).toHaveLength(0);
  });

  it("warns when a sequence step references an unknown feature", () => {
    const world = makeValidWorld();
    world.rooms.room1.features = {
      vault_lever: { type: "LEVER", displayName: "a lever", keyword: "lever", initialState: "up" },
    };
    world.puzzles = {
      open_vault: {
        type: "sequence",
        roomId: "room1",
        steps: [{ feature: "missing_lever", action: "pull" }],
        reward: { type: "give_gold", gold: 10 },
      },
    };
    const puzzleIssues = validateZone(world).filter((i) => i.entity === "puzzle:open_vault");
    expect(puzzleIssues.some((i) => i.severity === "warning" && i.message.includes("missing_lever"))).toBe(
      true,
    );
  });

  // ─── Factions & reputation ────────────────────────────────────
  describe("faction references", () => {
    const known = new Set(["royal_court", "rebel_cell"]);

    it("warns when zone-level faction is unknown", () => {
      const world = makeValidWorld();
      world.faction = "mystery_cult";
      const issues = warnings(validateZone(world, undefined, undefined, known));
      expect(issues.some((i) => i.entity === "zone" && i.message.includes("mystery_cult"))).toBe(true);
    });

    it("warns when mob faction is unknown", () => {
      const world = makeValidWorld();
      world.mobs!.rat!.faction = "mystery_cult";
      const issues = warnings(validateZone(world, undefined, undefined, known));
      expect(issues.some((i) => i.entity === "mob:rat")).toBe(true);
    });

    it("warns when shop rep gate faction is unknown", () => {
      const world = makeValidWorld();
      world.shops = {
        armorer: {
          name: "Armorer",
          room: "room1",
          requiredReputation: { faction: "mystery_cult", min: 250 },
        },
      };
      const issues = warnings(validateZone(world, undefined, undefined, known));
      expect(issues.some((i) => i.entity === "shop:armorer" && i.message.includes("mystery_cult"))).toBe(true);
    });

    it("errors when rep gate min > max", () => {
      const world = makeValidWorld();
      world.quests = {
        q1: {
          name: "Q",
          giver: "rat",
          objectives: [{ type: "KILL", targetKey: "rat", count: 1 }],
          requiredReputation: { faction: "royal_court", min: 500, max: 100 },
        },
      };
      const issues = errors(validateZone(world, undefined, undefined, known));
      expect(issues.some((i) => i.entity === "quest:q1")).toBe(true);
    });

    it("accepts known faction refs without warning", () => {
      const world = makeValidWorld();
      world.faction = "royal_court";
      world.mobs!.rat!.faction = "royal_court";
      const issues = validateZone(world, undefined, undefined, known);
      expect(issues.filter((i) => i.message.includes("royal_court"))).toHaveLength(0);
    });

    it("skips faction checks when knownFactions is not provided", () => {
      const world = makeValidWorld();
      world.faction = "anything";
      world.mobs!.rat!.faction = "anything";
      const issues = validateZone(world);
      expect(issues.filter((i) => i.message.includes("anything"))).toHaveLength(0);
    });
  });

  describe("mob damage invariant", () => {
    it("errors when maxDamage override < tier-resolved minDamage", () => {
      const world = makeValidWorld();
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 3, maxDamage: 1 };
      const issues = errors(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));
      // weak tier at level 3: minDamage = 1 + 1*(3 - 1) = 3, so maxDamage=1 < 3
      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("maxDamage") && i.message.includes("minDamage"))).toBe(true);
    });

    it("errors when both overrides set and max < min", () => {
      const world = makeValidWorld();
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], minDamage: 5, maxDamage: 3 };
      const issues = errors(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));
      expect(issues.some((i) => i.entity === "mob:rat")).toBe(true);
    });

    it("accepts matching explicit overrides", () => {
      const world = makeValidWorld();
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 3, minDamage: 1, maxDamage: 1 };
      const issues = errors(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));
      expect(issues.filter((i) => i.entity === "mob:rat")).toHaveLength(0);
    });

    it("skips the check when no tier config is provided and only one side is overridden", () => {
      const world = makeValidWorld();
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 3, maxDamage: 1 };
      const issues = errors(validateZone(world));
      expect(issues.filter((i) => i.entity === "mob:rat" && i.message.includes("maxDamage"))).toHaveLength(0);
    });
  });

  describe("zone rebalance targets", () => {
    it("warns when a mob level drifts outside the zone target band", () => {
      const world = makeValidWorld();
      world.levelBand = { min: 3, max: 7 };
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 12 };

      const issues = warnings(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));

      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("outside the zone target"))).toBe(true);
      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("Expected level 3"))).toBe(true);
    });

    it("warns when authored overrides diverge from the target tier baseline", () => {
      const world = makeValidWorld();
      world.levelBand = { min: 3, max: 3 };
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 3, hp: 200, xpReward: 9999 };

      const issues = warnings(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));

      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("Overrides diverge"))).toBe(true);
      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("hp 200"))).toBe(true);
    });

    it("warns when a zone target cannot be validated because the mob tier is unknown", () => {
      const world = makeValidWorld();
      world.levelBand = { min: 3, max: 7 };
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "phantom", level: 5 };

      const issues = warnings(validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS));

      expect(issues.some((i) => i.entity === "mob:rat" && i.message.includes("cannot be validated"))).toBe(true);
    });

    it("stays quiet when the mob already matches the zone target", () => {
      const world = makeValidWorld();
      world.levelBand = { min: 3, max: 7 };
      world.mobs!.rat = { name: "Rat", spawns: [{ room: "room1" }], tier: "weak", level: 3 };

      const issues = validateZone(world, undefined, undefined, undefined, undefined, TEST_MOB_TIERS);

      expect(issues).toHaveLength(0);
    });
  });
});
