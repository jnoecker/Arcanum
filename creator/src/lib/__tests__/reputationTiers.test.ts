import { describe, it, expect } from "vitest";
import { getTiers, tierForRep, formatRep } from "../reputationTiers";
import { DEFAULT_REPUTATION_TIERS, type FactionConfig } from "@/types/config";

describe("reputation tiers", () => {
  it("falls back to defaults when no config given", () => {
    expect(getTiers()).toEqual(DEFAULT_REPUTATION_TIERS);
    expect(getTiers(null)).toEqual(DEFAULT_REPUTATION_TIERS);
  });

  it("uses config tiers when present", () => {
    const config: FactionConfig = {
      defaultReputation: 0,
      killPenalty: 5,
      killBonus: 3,
      definitions: {},
      tiers: [
        { id: "enemy", label: "Enemy", minReputation: -1000 },
        { id: "ally", label: "Ally", minReputation: 1000 },
      ],
    };
    const tiers = getTiers(config);
    expect(tiers.map((t) => t.id)).toEqual(["enemy", "ally"]);
  });

  it("sorts tiers ascending by minReputation", () => {
    const config: FactionConfig = {
      defaultReputation: 0,
      killPenalty: 5,
      killBonus: 3,
      definitions: {},
      tiers: [
        { id: "ally", label: "Ally", minReputation: 1000 },
        { id: "enemy", label: "Enemy", minReputation: -1000 },
      ],
    };
    expect(getTiers(config).map((t) => t.id)).toEqual(["enemy", "ally"]);
  });

  it("resolves tier for a given rep value", () => {
    // Defaults: hated(-20000) hostile(-1000) unfriendly(-500) neutral(0)
    //           friendly(250) honored(1000) revered(5000) exalted(20000)
    expect(tierForRep(0).id).toBe("neutral");
    expect(tierForRep(-1).id).toBe("unfriendly");
    expect(tierForRep(-500).id).toBe("unfriendly");
    expect(tierForRep(-501).id).toBe("hostile");
    expect(tierForRep(249).id).toBe("neutral");
    expect(tierForRep(250).id).toBe("friendly");
    expect(tierForRep(999_999).id).toBe("exalted");
    expect(tierForRep(-999_999).id).toBe("hated");
  });

  it("formats reputation with sign and tier label", () => {
    expect(formatRep(250)).toBe("Friendly (+250)");
    expect(formatRep(-600)).toBe("Hostile (-600)");
    expect(formatRep(0)).toBe("Neutral (+0)");
  });
});
