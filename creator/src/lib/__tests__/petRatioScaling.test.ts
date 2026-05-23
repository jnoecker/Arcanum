import { describe, it, expect } from "vitest";
import { parseAppConfigYaml } from "@/lib/loader";
import { petToPlain, hasPetsTopLevel } from "@/lib/exportMud";
import type { PetDefinitionConfig, PetSpellConfig } from "@/types/config";

// Wrap a pets block in just enough surrounding YAML for the engine root to parse.
function wrapPets(petsYaml: string): string {
  return `ambonmud:\n  engine:\n${petsYaml}`;
}

describe("pet template loader — legacy migration", () => {
  it("falls back to legacy hp/minDamage/maxDamage/armor when base* fields are missing", () => {
    const yaml = wrapPets(`    pets:
      definitions:
        wolf:
          name: a wolf
          hp: 25
          minDamage: 2
          maxDamage: 5
          armor: 1
`);
    const cfg = parseAppConfigYaml(yaml);
    const wolf = cfg.pets.wolf!;
    expect(wolf.baseHp).toBe(25);
    expect(wolf.baseMinDamage).toBe(2);
    expect(wolf.baseMaxDamage).toBe(5);
    expect(wolf.baseArmor).toBe(1);
    // New ratio fields default to the engine's defaults so the template still summons something sensible.
    expect(wolf.hpRatio).toBeCloseTo(0.6);
    expect(wolf.damageRatio).toBeCloseTo(0.5);
    expect(wolf.armorRatio).toBeCloseTo(0.4);
  });

  it("prefers explicit base* fields when both legacy and new keys are present", () => {
    // A user mid-migration might keep both during a transition; new keys win.
    const yaml = wrapPets(`    pets:
      definitions:
        wolf:
          name: a wolf
          hp: 25
          baseHp: 30
          minDamage: 2
          baseMinDamage: 3
          maxDamage: 5
          baseMaxDamage: 6
          armor: 1
          baseArmor: 2
`);
    const wolf = parseAppConfigYaml(yaml).pets.wolf!;
    expect(wolf.baseHp).toBe(30);
    expect(wolf.baseMinDamage).toBe(3);
    expect(wolf.baseMaxDamage).toBe(6);
    expect(wolf.baseArmor).toBe(2);
  });

  it("reads new ratio + base fields without legacy fallback", () => {
    const yaml = wrapPets(`    pets:
      definitions:
        hawk:
          name: a hawk
          hpRatio: 0.3
          damageRatio: 0.7
          armorRatio: 0.0
          baseHp: 15
          baseMinDamage: 3
          baseMaxDamage: 7
          baseArmor: 0
`);
    const hawk = parseAppConfigYaml(yaml).pets.hawk!;
    expect(hawk.hpRatio).toBe(0.3);
    expect(hawk.damageRatio).toBe(0.7);
    expect(hawk.armorRatio).toBe(0);
    expect(hawk.baseArmor).toBe(0);
  });
});

describe("pet template loader — top-level caps", () => {
  it("reads global caps when present", () => {
    const yaml = wrapPets(`    pets:
      manualSkillGraceMs: 8000
      maxHpRatio: 1.0
      maxDamageRatio: 0.8
      maxArmorRatio: 1.0
      definitions: {}
`);
    const top = parseAppConfigYaml(yaml).petsConfig;
    expect(top?.manualSkillGraceMs).toBe(8000);
    expect(top?.maxHpRatio).toBe(1.0);
    expect(top?.maxDamageRatio).toBeCloseTo(0.8);
    expect(top?.maxArmorRatio).toBe(1.0);
  });

  it("returns undefined when no top-level pet config is present", () => {
    const yaml = wrapPets(`    pets:
      definitions: {}
`);
    expect(parseAppConfigYaml(yaml).petsConfig).toBeUndefined();
  });

  it("populates only the caps that are present (others stay undefined)", () => {
    const yaml = wrapPets(`    pets:
      maxDamageRatio: 0.5
      definitions: {}
`);
    const top = parseAppConfigYaml(yaml).petsConfig;
    expect(top?.maxDamageRatio).toBe(0.5);
    expect(top?.maxHpRatio).toBeUndefined();
    expect(top?.maxArmorRatio).toBeUndefined();
    expect(top?.manualSkillGraceMs).toBeUndefined();
  });
});

describe("petToPlain — round-trip", () => {
  it("emits ratio + base fields and drops the legacy keys", () => {
    const pet: PetDefinitionConfig = {
      name: "a wolf",
      hpRatio: 0.4,
      damageRatio: 0.7,
      armorRatio: 0.3,
      baseHp: 25,
      baseMinDamage: 2,
      baseMaxDamage: 5,
      baseArmor: 1,
    };
    const out = petToPlain(pet);
    expect(out).toEqual({
      name: "a wolf",
      hpRatio: 0.4,
      damageRatio: 0.7,
      armorRatio: 0.3,
      baseHp: 25,
      baseMinDamage: 2,
      baseMaxDamage: 5,
      baseArmor: 1,
    });
    expect(out).not.toHaveProperty("hp");
    expect(out).not.toHaveProperty("minDamage");
    expect(out).not.toHaveProperty("maxDamage");
    expect(out).not.toHaveProperty("armor");
  });

  it("emits spell damageRatio / healRatio alongside flat fallbacks", () => {
    const pet: PetDefinitionConfig = {
      name: "a wolf",
      hpRatio: 0.4,
      damageRatio: 0.7,
      armorRatio: 0.3,
      baseHp: 25,
      baseMinDamage: 2,
      baseMaxDamage: 5,
      baseArmor: 1,
      spells: {
        bite: {
          displayName: "Bite",
          message: "{pet} bites {target}",
          damageRatio: 2.0,
          cooldownMs: 6000,
        },
        howl: {
          displayName: "Howl",
          message: "{pet} howls",
          healRatio: 0.05,
          cooldownMs: 15000,
        },
        flat: {
          displayName: "Flat",
          message: "flat damage",
          minDamage: 4,
          maxDamage: 8,
        } satisfies PetSpellConfig,
      },
    };
    const out = petToPlain(pet);
    const spells = out.spells as Record<string, Record<string, unknown>>;
    expect(spells.bite!.damageRatio).toBe(2.0);
    expect(spells.bite!).not.toHaveProperty("minDamage");
    expect(spells.howl!.healRatio).toBeCloseTo(0.05);
    expect(spells.flat!.minDamage).toBe(4);
    expect(spells.flat!.maxDamage).toBe(8);
    expect(spells.flat!).not.toHaveProperty("damageRatio");
  });
});

describe("hasPetsTopLevel", () => {
  it("is true when any top-level pet field is set", () => {
    expect(hasPetsTopLevel({ manualSkillGraceMs: 1000 })).toBe(true);
    expect(hasPetsTopLevel({ maxHpRatio: 1.0 })).toBe(true);
    expect(hasPetsTopLevel({ maxDamageRatio: 0.8 })).toBe(true);
    expect(hasPetsTopLevel({ maxArmorRatio: 1.0 })).toBe(true);
  });

  it("is false for undefined / empty", () => {
    expect(hasPetsTopLevel(undefined)).toBe(false);
    expect(hasPetsTopLevel({})).toBe(false);
  });
});
