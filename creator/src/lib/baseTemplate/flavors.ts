export interface OnboardingFlavor {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Seed prompt given to the LLM for re-skinning content */
  seedPrompt: string;
  /** Example class re-skins to show the user what this flavor produces */
  classExamples: Record<string, string>;
  /** Example race re-skins */
  raceExamples: Record<string, string>;
  /** Gradient colors for the flavor card UI [from, to] */
  gradientColors: [string, string];
  /** Icon/emoji character for the card */
  icon: string;
}

export const ONBOARDING_FLAVORS: OnboardingFlavor[] = [
  {
    id: "epic-fantasy",
    name: "Epic Fantasy",
    tagline: "Swords, sorcery, and ancient prophecies",
    description:
      "High fantasy worlds of dragons, ancient prophecies, noble bloodlines, and enchanted kingdoms. Heroes forge their legends in the fires of war and wonder.",
    seedPrompt:
      "This is a high fantasy world of towering castles, ancient dragon lairs, enchanted forests, and kingdoms built on noble bloodlines and sworn oaths. Names should feel archaic and grandiose — think Tolkien crossed with Arthurian legend. Enemies range from goblin raiding parties and undead legions to elder wyrms and corrupted archfey. The academy equivalent is a hallowed Order — a storied institution where initiates train under veteran knights, archmages, and high priests within cathedral-like halls carved with the runes of old. Magic is elemental and divine, drawn from ley lines and patron gods.",
    classExamples: {
      Warrior: "Paladin",
      Mage: "Sorcerer",
      Cleric: "Priest",
      Rogue: "Assassin",
      Ranger: "Beastmaster",
    },
    raceExamples: {
      Human: "Human",
      Sylvan: "Elf",
      Stoneheart: "Dwarf",
    },
    gradientColors: ["#4c1d95", "#d97706"],
    icon: "\u2694\uFE0F",
  },
  {
    id: "ghost-town",
    name: "Ghost Town",
    tagline: "Spectral gunslingers and cursed frontiers",
    description:
      "A spectral western frontier where undead sheriffs patrol dusty saloons, cursed mines swallow the unwary, and tumbleweed spirits drift through towns that never truly died.",
    seedPrompt:
      "This is a haunted Wild West where every frontier town sits half in the land of the living and half in the spirit world. Dust-choked main streets are lit by flickering ghost-light lanterns, and the wind carries whispers of old grudges. Names should evoke frontier grit mixed with the supernatural — weathered, rough-hewn, and eerie. Enemies include restless phantoms, bone-rattling desperados, skinwalkers stalking the mesas, and ancient curses seeping up from abandoned silver mines. The academy equivalent is the Dead Man's Lodge — a ramshackle saloon-turned-sanctuary where grizzled spirit mediums and retired gunslingers teach recruits to walk the line between worlds. Power comes from pacts with the restless dead and relics pulled from cursed earth.",
    classExamples: {
      Warrior: "Revenant",
      Mage: "Hexslinger",
      Cleric: "Spirit Mender",
      Rogue: "Shade",
      Ranger: "Haunt Caller",
    },
    raceExamples: {
      Human: "Drifter",
      Sylvan: "Specter",
      Stoneheart: "Golem",
    },
    gradientColors: ["#334155", "#2dd4bf"],
    icon: "\uD83D\uDC7B",
  },
  {
    id: "steampunk",
    name: "Steampunk",
    tagline: "Brass gears, steam engines, and mad science",
    description:
      "A Victorian-era world of clockwork contraptions, roaring steam engines, daring airship captains, and mad inventors pushing the boundaries of industrial magic.",
    seedPrompt:
      "This is a Victorian-industrial world where brass-and-iron machinery hisses alongside volatile arcane engines. Smog-wreathed cities rise in tiers of riveted iron and stained glass, connected by rail lines and airship docks. Names should sound industrial, inventive, and slightly grandiose — titles and ranks carry the weight of patent offices and guild charters. Enemies include rogue automatons, coal-dust elementals, sky pirates, and the terrible experiments of rival inventor-barons. The academy equivalent is the Grand Polytechnic — a sprawling campus of workshops, boiler rooms, and lecture halls where apprentices learn to fuse mechanical engineering with volatile aetheric science. Power is harnessed through invention, calibration, and controlled detonation.",
    classExamples: {
      Warrior: "Ironclad",
      Mage: "Artificer",
      Cleric: "Medic",
      Rogue: "Saboteur",
      Ranger: "Mechanist",
    },
    raceExamples: {
      Human: "Citizen",
      Sylvan: "Aethertouched",
      Stoneheart: "Ironborn",
    },
    gradientColors: ["#b45309", "#374151"],
    icon: "\u2699\uFE0F",
  },
  {
    id: "enchanted-forest",
    name: "Enchanted Forest",
    tagline: "Ancient groves, fey magic, and talking beasts",
    description:
      "A fey wilderness of ancient groves, mushroom circles, talking animals, and trickster spirits. Druidic magic hums through every root and branch.",
    seedPrompt:
      "This is a deep primeval forest where the trees remember the first dawn and every brook has a name whispered by the fey. Sunlight filters through cathedral canopies onto moss-covered standing stones and rings of luminous mushrooms. Names should feel organic, whimsical, and slightly wild — syllables that sound like rustling leaves or birdsong. Enemies include corrupted bramble-beasts, venomous spore-walkers, shadow foxes, mischievous boglings, and ancient treants driven mad by blight. The academy equivalent is the Heartwood Circle — a living grove where elder druids, beast-speakers, and fey emissaries teach students beneath a canopy that rearranges itself with the seasons. Power flows from the living green — sap, song, and the old pacts between mortal-kind and the wild court.",
    classExamples: {
      Warrior: "Warden",
      Mage: "Spellweaver",
      Cleric: "Druid",
      Rogue: "Trickster",
      Ranger: "Pack Leader",
    },
    raceExamples: {
      Human: "Woodland Folk",
      Sylvan: "Faeborn",
      Stoneheart: "Treant",
    },
    gradientColors: ["#065f46", "#d97706"],
    icon: "\uD83C\uDF3F",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    tagline: "Psychic powers and temples among the stars",
    description:
      "A sci-fantasy realm of space temples, psychic powers, crystalline technology, star gods, and creatures born from the void between galaxies.",
    seedPrompt:
      "This is a sci-fantasy universe where ancient civilizations built crystalline temples on moons and asteroid belts, channeling the psychic resonance of dying stars. Vast nebulae pulse with sentient light, and the void between systems teems with eldritch life. Names should feel otherworldly and luminous — blending Greek and Latin roots with invented celestial syllables. Enemies include void-spawn aberrations, rogue psionic constructs, parasitic star-leeches, and the shattered avatars of forgotten star gods. The academy equivalent is the Astral Spire — an orbital station-temple of translucent crystal and living metal where adepts train in psionic disciplines, void navigation, and communion with the stellar consciousness. Power is drawn from the psychic lattice that connects all thinking minds across the cosmos.",
    classExamples: {
      Warrior: "Vanguard",
      Mage: "Psion",
      Cleric: "Empath",
      Rogue: "Phantom",
      Ranger: "Summoner",
    },
    raceExamples: {
      Human: "Terran",
      Sylvan: "Starchild",
      Stoneheart: "Lithoid",
    },
    gradientColors: ["#312e81", "#7c3aed"],
    icon: "\u2728",
  },
  {
    id: "ninja",
    name: "Ninja / Eastern Fantasy",
    tagline: "Shinobi clans, spirit temples, and ancient honor",
    description:
      "A feudal East Asian fantasy of rival shinobi clans, wandering samurai, spirit-haunted temples, cherry blossom battlefields, and yokai lurking in the mountain mists.",
    seedPrompt:
      "This is a feudal East Asian fantasy world of misty mountains, bamboo forests, and fortified castle-towns ruled by rival clans. Cherry blossoms drift across training grounds where discipline and honor are forged in silence. Names should draw on Japanese aesthetic sensibilities — clean, sharp, and evocative, mixing martial terminology with spiritual reverence. Enemies include rogue yokai (kappa, tengu, oni), corrupted shrine guardians, rival clan assassins, and ancient demons sealed beneath forgotten temples. The academy equivalent is the Hidden Village — a secluded mountain compound of dojos, meditation gardens, and scroll libraries where masters of blade, spirit arts, and shadow techniques pass their traditions to the next generation. Power flows from ki cultivation, ancestral pacts, and the disciplined mastery of body and spirit.",
    classExamples: {
      Warrior: "Samurai",
      Mage: "Onmyoji",
      Cleric: "Shrine Keeper",
      Rogue: "Shinobi",
      Ranger: "Beast Tamer",
    },
    raceExamples: {
      Human: "Ronin",
      Sylvan: "Kitsune",
      Stoneheart: "Oni",
    },
    gradientColors: ["#991b1b", "#111827"],
    icon: "\uD83C\uDFEF",
  },
];
