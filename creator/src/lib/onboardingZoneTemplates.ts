export interface OnboardingZoneTemplate {
  id: string;
  name: string;
  blurb: string;
  seedPrompt: string;
  backgroundContext: string;
  vibeText: string;
  roomCount: number;
  mobCount: number;
  itemCount: number;
}

export const ONBOARDING_ZONE_TEMPLATES: OnboardingZoneTemplate[] = [
  {
    id: "western_town",
    name: "Western Town",
    blurb: "Dusty frontier streets, a saloon, a sheriff's office, wooden boardwalks.",
    seedPrompt:
      "A dusty frontier town on the edge of civilization — wooden storefronts, swinging saloon doors, a weathered sheriff's office, hitching posts and water troughs. The town sits at the meeting of several trails and sees travelers of every stripe.",
    backgroundContext:
      "Sunbaked, arid, and lightly lawless. The kind of place where a stranger walking in draws every eye.",
    vibeText:
      "A sleepy frontier town baking in slow gold sunlight. Boardwalks creak under boot heels; tumbleweeds drift past shuttered windows. There is quiet tension here — somebody always seems to be watching from a porch, and the air carries the distant toll of a wind-worn bell.",
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  },
  {
    id: "cartoon_village",
    name: "Cartoon Village",
    blurb: "A whimsical hillside village with round doors, flower boxes, and a friendly mill.",
    seedPrompt:
      "A whimsical cartoon village nestled in rolling green hills — round wooden doors set into curved cottages, window boxes overflowing with flowers, a working watermill turning beside a bright stream. Everything feels drawn with a warm hand.",
    backgroundContext:
      "A cozy, peaceful village full of gentle life. The kind of place with soft edges where nothing too terrible ever happens — but secrets still linger in the mill cellar and the old orchard.",
    vibeText:
      "A warmly lit village of curved rooftops and overgrown gardens, where every cottage seems to breathe a little. Bees drone over the apple orchard, a waterwheel turns at its own patient pace, and the low hum of village life feels like a half-remembered lullaby.",
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  },
  {
    id: "dark_forest",
    name: "Dark Forest",
    blurb: "Twisting old-growth trees, crooked paths, and things that watch from between trunks.",
    seedPrompt:
      "A dense, ancient forest of twisting old-growth trees and narrow mossy paths. Shafts of pale green light fall between the trunks. The deeper you go, the quieter — and the more the forest seems to notice you.",
    backgroundContext:
      "An untamed woodland that has seen empires come and go. Ruins of older civilizations are slowly being reclaimed by roots and lichen.",
    vibeText:
      "An old forest where the canopy sews the sky shut and sound carries strangely. Ferns coil around fallen stonework; a distant branch cracks when no wind is blowing. The forest is not hostile, exactly — it is simply older and patient, and it is paying attention.",
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  },
  {
    id: "crystal_caves",
    name: "Crystal Caves",
    blurb: "Glowing crystalline caverns, underground streams, and echoes from far below.",
    seedPrompt:
      "A network of vast crystalline caverns lit by the soft glow of embedded gemstones. Stalactites and stalagmites of clear crystal refract distant light into slow-moving rainbows. Cold underground streams wind through narrow passages.",
    backgroundContext:
      "A place of natural wonder that miners once tried to exploit and then abandoned. Rusted rails and broken carts still sit where they were dropped.",
    vibeText:
      "A hushed cathedral of living crystal, where every footstep rings faintly against unseen facets. Veins of pale light pulse in slow patterns through the walls, as if the mountain itself is breathing. The air tastes of cold mineral water and very old silence.",
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  },
  {
    id: "ancient_ruins",
    name: "Ancient Ruins",
    blurb: "Crumbling temples, toppled columns, and inscriptions nobody alive can read.",
    seedPrompt:
      "The crumbling ruins of a once-great temple complex — toppled columns draped in vines, a central plaza sunken into the earth, inscriptions in a forgotten language worn almost smooth by centuries of rain.",
    backgroundContext:
      "Whoever built this place worshipped something the modern world has forgotten. A few glyphs still catch firelight in an unsettling way.",
    vibeText:
      "Shattered stonework under a sky bruised with incoming weather. The ruins wear their centuries like a tired cloak — patient, proud, and still holding on to something they will not explain. Every carved face seems to be mid-sentence.",
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  },
];

export function findOnboardingTemplate(id: string): OnboardingZoneTemplate | undefined {
  return ONBOARDING_ZONE_TEMPLATES.find((t) => t.id === id);
}

export function buildCustomOnboardingTemplate(description: string): OnboardingZoneTemplate {
  const trimmed = description.trim();
  return {
    id: "custom",
    name: "Your World",
    blurb: "A world of your own design.",
    seedPrompt: trimmed,
    backgroundContext: "",
    vibeText: trimmed,
    roomCount: 5,
    mobCount: 3,
    itemCount: 3,
  };
}
