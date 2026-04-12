import type {
  ClassDefinitionConfig,
  AbilityDefinitionConfig,
  StatusEffectDefinitionConfig,
  RaceDefinitionConfig,
  PetDefinitionConfig,
  StatDefinition,
} from "@/types/config";

// ─── Stats ─────────────────────────────────────────────────────────

export const BASE_STATS: Record<string, StatDefinition> = {
  STR: {
    id: "STR",
    displayName: "Strength",
    abbreviation: "STR",
    description: "Physical power. Governs melee damage and carrying capacity.",
    baseStat: 10,
  },
  DEX: {
    id: "DEX",
    displayName: "Dexterity",
    abbreviation: "DEX",
    description: "Agility and reflexes. Governs dodge chance and ranged precision.",
    baseStat: 10,
  },
  CON: {
    id: "CON",
    displayName: "Constitution",
    abbreviation: "CON",
    description: "Health and endurance. Governs hit points and resistance to fatigue.",
    baseStat: 10,
  },
  INT: {
    id: "INT",
    displayName: "Intelligence",
    abbreviation: "INT",
    description: "Magical aptitude. Governs spell damage and mana capacity.",
    baseStat: 10,
  },
  WIS: {
    id: "WIS",
    displayName: "Wisdom",
    abbreviation: "WIS",
    description: "Insight and willpower. Governs healing potency and mana regeneration.",
    baseStat: 10,
  },
  CHA: {
    id: "CHA",
    displayName: "Charisma",
    abbreviation: "CHA",
    description: "Force of personality. Governs merchant prices and companion loyalty.",
    baseStat: 10,
  },
};

// ─── Classes ───────────────────────────────────────────────────────

export const BASE_CLASSES: Record<string, ClassDefinitionConfig> = {
  WARRIOR: {
    displayName: "Warrior",
    description: "A battle-hardened combatant trained in heavy armor and martial weapons, equally capable of absorbing punishment and dealing devastating blows.",
    backstory:
      "Warriors are forged in the crucibles of military academies, mercenary companies, and frontier garrisons scattered across the known world. Their training begins young — often as squires hauling shields for veteran soldiers or as pit fighters scrapping for coin in underground arenas. Every warrior carries the scars of a hundred sparring matches before they ever see true battle.\n\nThe great martial traditions vary by region. In the northern holds, warriors learn to fight in tight shield walls against raiding parties. Along the coast, they train aboard warships where footing is treacherous and a single misstep means death. In the heartland cities, formal fencing academies produce duelists of extraordinary precision. What unites them all is an unflinching willingness to stand at the front and meet violence head-on.\n\nVeteran warriors often find employment as caravan guards, siege engineers, or lieutenants in the standing armies of various lords. A rare few earn enough reputation to command their own companies. Regardless of station, a warrior's worth is measured in the battles they have survived and the comrades they brought home alive.",
    hpPerLevel: 4,
    manaPerLevel: 1,
    primaryStat: "STR",
    outfitDescription: "Full plate armor with a heavy steel breastplate, layered pauldrons, gauntlets, and greaves. A longsword hangs from a leather baldric at the hip, and a kite shield bearing a battle-worn heraldic crest is strapped to one arm. A crimson half-cape drapes from the left shoulder.",
  },
  MAGE: {
    displayName: "Mage",
    description: "A scholar of the arcane arts who channels raw magical energy into destructive spells, protective wards, and debilitating hexes.",
    backstory:
      "Mages are products of the great arcane colleges — cloistered institutions built on ley-line nexuses where the veil between the material and ethereal planes runs thin. Admission requires proof of innate magical sensitivity, and the washout rate is brutal. Students who survive years of grueling study, failed incantations, and the occasional laboratory explosion emerge as some of the most dangerous individuals alive.\n\nThe curriculum covers elemental theory, planar cosmology, glyph construction, and counter-magic. Practical training takes place in warded chambers where novices learn to shape raw mana into coherent spell forms without killing themselves or their classmates. Those who show talent for destruction are shepherded toward battle-magic tracks; those with subtler gifts may specialize in enchantment, divination, or ward-crafting.\n\nGraduated mages often serve as court advisors, war-casters attached to military units, or independent researchers pursuing obscure branches of arcane knowledge. The colleges maintain strict records of all licensed practitioners, and rogue mages who practice without sanction are hunted by the order's enforcers.",
    hpPerLevel: 1,
    manaPerLevel: 5,
    primaryStat: "INT",
    outfitDescription: "Deep indigo robes with silver arcane sigils embroidered along the hems and cuffs. A tall oak staff topped with a faintly glowing crystal is held in one hand. A thick leather-bound spellbook hangs from a chain at the belt. The robe's hood is pulled back, revealing sharp, studious features.",
  },
  CLERIC: {
    displayName: "Cleric",
    description: "A devoted servant of the divine who channels sacred power to mend wounds, bolster allies, and smite the unholy.",
    backstory:
      "Clerics are ordained within the great temple hierarchies — sprawling religious institutions that maintain hospitals, libraries, and fortified sanctuaries across the realm. Aspirants are taken in as acolytes, often from orphanages or devout families, and spend years studying scripture, herbalism, and the channeling of divine energy before they are permitted to lay hands on the sick or wounded.\n\nThe path to ordination is one of discipline and sacrifice. Acolytes rise before dawn for prayer, spend their mornings tending to the injured and dying, and devote their afternoons to theological study. Combat training is mandatory — the temples learned long ago that healers who cannot defend themselves are liabilities on the battlefield. Maces and warhammers are favored because they are effective against armored foes without requiring the shedding of blood that some orders find doctrinally objectionable.\n\nFull clerics serve wherever need is greatest. Some are permanently stationed at frontier clinics. Others march with armies, keeping soldiers alive through grueling campaigns. A few are dispatched as wandering mendicants, carrying the temple's mercy to remote villages that would otherwise have no access to healing magic.",
    hpPerLevel: 2,
    manaPerLevel: 4,
    primaryStat: "WIS",
    outfitDescription: "White and gold vestments layered over a chain hauberk. A polished steel mace hangs from the belt alongside a radiant holy symbol on a heavy chain. The vestments bear the emblem of a sunburst, and a hooded mantle of deep gold cloth rests across the shoulders.",
  },
  ROGUE: {
    displayName: "Rogue",
    description: "A cunning operative who relies on stealth, precision, and dirty tricks to eliminate targets before they can retaliate.",
    backstory:
      "Rogues come from the shadow side of civilization — the thieves' guilds, spy networks, and assassin brotherhoods that thrive in every major city. Their training is informal compared to warriors or mages, but no less rigorous. Apprentices learn lockpicking, poison craft, silent movement, and blade work from experienced mentors who tolerate nothing less than perfection. A fumbled lock or a creaking floorboard during training earns a beating; in the field, it earns a grave.\n\nThe guilds operate under strict codes of conduct. Contracts are honored, territories are respected, and information is the most valuable currency. A rogue who breaks guild law faces exile or worse. In return, the guild provides fencing services for stolen goods, legal protection through bribed magistrates, and a network of safe houses spanning multiple cities.\n\nNot all rogues are criminals. Military scouts, royal intelligence agents, and freelance investigators all employ the same skill set in service of legitimate employers. The line between spy and thief is largely a matter of who signs the paycheck. Regardless of allegiance, all rogues share a preference for ending fights quickly, quietly, and on their own terms.",
    hpPerLevel: 2,
    manaPerLevel: 2,
    primaryStat: "DEX",
    outfitDescription: "Supple dark leather armor with reinforced shoulder guards and bracers studded with dull metal rivets. Twin daggers are sheathed in crossed back-scabbards. A deep hooded cloak of charcoal-grey wool obscures the face, and a bandolier of small pouches and vials crosses the chest.",
  },
  RANGER: {
    displayName: "Ranger",
    description: "A wilderness expert who fights alongside bonded animal companions, blending archery with nature magic to control the battlefield.",
    backstory:
      "Rangers are trained by the wardens — a loose confederation of frontier scouts, beast-tamers, and wilderness survivalists who patrol the untamed lands beyond the reach of civilization. There are no formal academies; instead, apprentice rangers are taken into the wild by experienced mentors and taught through years of practical experience. They learn to track prey across any terrain, read weather patterns, identify edible and poisonous plants, and forge the empathic bonds with wild animals that are the hallmark of their craft.\n\nThe bond between a ranger and their companions is not mere domestication. It is a form of primal magic — an ancient pact between humanoid and beast that predates the arcane colleges by millennia. Rangers who attune to this power can communicate wordlessly with their bonded animals, share sensory impressions across great distances, and even channel restorative natural energy through the bond. The deeper the trust between ranger and companion, the more potent these abilities become.\n\nRangers serve as border patrols, monster hunters, and guides for expeditions into uncharted territory. They are often the first line of defense when creatures from the deep wilderness encroach on settled lands. Their knowledge of the natural world makes them invaluable to military commanders planning campaigns through hostile terrain, and their animal companions provide scouting capabilities that no amount of conventional reconnaissance can match.",
    hpPerLevel: 3,
    manaPerLevel: 3,
    primaryStat: "WIS",
    outfitDescription: "Weathered green and brown leather armor with leaf-shaped scale overlays across the chest. A longbow of dark yew is slung across the back alongside a quiver of fletched arrows. A short hunting knife sits at the hip. The armor is accented with fur trim and wooden toggles, and a forest-green cloak is pinned at the shoulder with an antler brooch.",
  },
};

// ─── Status Effects ────────────────────────────────────────────────

export const BASE_STATUS_EFFECTS: Record<string, StatusEffectDefinitionConfig> = {
  // Warrior
  shield_bash_stun: {
    displayName: "Stunned",
    effectType: "stun",
    durationMs: 2000,
    stackBehavior: "none",
  },
  fortify_shield: {
    displayName: "Fortify",
    effectType: "shield",
    durationMs: 15000,
    shieldAmount: 30,
    stackBehavior: "refresh",
  },

  // Mage
  flame_brand_dot: {
    displayName: "Flame Brand",
    effectType: "dot",
    durationMs: 8000,
    tickIntervalMs: 2000,
    tickMinValue: 5,
    tickMaxValue: 8,
    stackBehavior: "refresh",
  },
  arcane_shield_effect: {
    displayName: "Arcane Shield",
    effectType: "shield",
    durationMs: 12000,
    shieldAmount: 25,
    stackBehavior: "refresh",
  },
  hex_debuff: {
    displayName: "Hex",
    effectType: "stat_debuff",
    durationMs: 10000,
    strMod: -2,
    dexMod: -2,
    conMod: -1,
    stackBehavior: "refresh",
  },

  // Cleric
  blessing_buff: {
    displayName: "Blessing",
    effectType: "stat_buff",
    durationMs: 30000,
    conMod: 3,
    wisMod: 1,
    stackBehavior: "refresh",
  },
  purge_dot: {
    displayName: "Purge",
    effectType: "dot",
    durationMs: 10000,
    tickIntervalMs: 2000,
    tickMinValue: 4,
    tickMaxValue: 7,
    stackBehavior: "refresh",
  },
  sanctuary_hot: {
    displayName: "Sanctuary",
    effectType: "hot",
    durationMs: 15000,
    tickIntervalMs: 3000,
    tickMinValue: 6,
    tickMaxValue: 10,
    stackBehavior: "refresh",
  },

  // Rogue
  blind_stun: {
    displayName: "Blinded",
    effectType: "stun",
    durationMs: 2000,
    stackBehavior: "none",
  },
  envenom_dot: {
    displayName: "Envenom",
    effectType: "dot",
    durationMs: 10000,
    tickIntervalMs: 2000,
    tickMinValue: 4,
    tickMaxValue: 6,
    stackBehavior: "stack",
    maxStacks: 3,
  },
  shadow_step_buff: {
    displayName: "Shadow Step",
    effectType: "stat_buff",
    durationMs: 20000,
    dexMod: 4,
    conMod: 1,
    stackBehavior: "refresh",
  },

  // Ranger
  natures_gift_hot: {
    displayName: "Nature's Gift",
    effectType: "hot",
    durationMs: 12000,
    tickIntervalMs: 2000,
    tickMinValue: 5,
    tickMaxValue: 8,
    stackBehavior: "refresh",
  },
};

// ─── Abilities ─────────────────────────────────────────────────────

export const BASE_ABILITIES: Record<string, AbilityDefinitionConfig> = {
  // ── Warrior ────────────────────────────────────────────────────────
  power_strike: {
    displayName: "Power Strike",
    description: "A forceful melee attack that channels raw strength into a single devastating blow.",
    manaCost: 0,
    cooldownMs: 0,
    levelRequired: 1,
    targetType: "ENEMY",
    effect: {
      type: "DIRECT_DAMAGE",
      minDamage: 8,
      maxDamage: 14,
      damagePerLevel: 0.5,
    },
    requiredClass: "WARRIOR",
  },
  shield_bash: {
    displayName: "Shield Bash",
    description: "Slams the shield into an enemy's face, leaving them dazed and unable to act.",
    manaCost: 10,
    cooldownMs: 8000,
    levelRequired: 3,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "shield_bash_stun",
    },
    requiredClass: "WARRIOR",
  },
  war_cry: {
    displayName: "War Cry",
    description: "A thunderous battle shout that forces nearby enemies to focus their aggression on the warrior.",
    manaCost: 12,
    cooldownMs: 10000,
    levelRequired: 5,
    targetType: "SELF",
    effect: {
      type: "TAUNT",
      flatThreat: 60,
      margin: 15,
    },
    requiredClass: "WARRIOR",
  },
  fortify: {
    displayName: "Fortify",
    description: "Braces behind the shield, generating a temporary barrier that absorbs incoming damage.",
    manaCost: 15,
    cooldownMs: 15000,
    levelRequired: 7,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "fortify_shield",
    },
    requiredClass: "WARRIOR",
  },
  cleave: {
    displayName: "Cleave",
    description: "A wide sweeping strike that carves through all enemies within reach.",
    manaCost: 25,
    cooldownMs: 12000,
    levelRequired: 9,
    targetType: "ENEMY",
    effect: {
      type: "AREA_DAMAGE",
      minDamage: 14,
      maxDamage: 22,
      damagePerLevel: 0.6,
    },
    requiredClass: "WARRIOR",
  },

  // ── Mage ───────────────────────────────────────────────────────────
  arcane_bolt: {
    displayName: "Arcane Bolt",
    description: "Launches a concentrated bolt of raw arcane energy at a single target.",
    manaCost: 8,
    cooldownMs: 0,
    levelRequired: 1,
    targetType: "ENEMY",
    effect: {
      type: "DIRECT_DAMAGE",
      minDamage: 10,
      maxDamage: 16,
      damagePerLevel: 0.6,
    },
    requiredClass: "MAGE",
  },
  flame_brand: {
    displayName: "Flame Brand",
    description: "Sears the target with magical fire that continues to burn over time.",
    manaCost: 15,
    cooldownMs: 6000,
    levelRequired: 3,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "flame_brand_dot",
    },
    requiredClass: "MAGE",
  },
  arcane_shield: {
    displayName: "Arcane Shield",
    description: "Conjures a shimmering barrier of magical force that absorbs incoming damage.",
    manaCost: 12,
    cooldownMs: 15000,
    levelRequired: 5,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "arcane_shield_effect",
    },
    requiredClass: "MAGE",
  },
  chain_lightning: {
    displayName: "Chain Lightning",
    description: "Unleashes a crackling arc of lightning that leaps between nearby enemies.",
    manaCost: 22,
    cooldownMs: 8000,
    levelRequired: 7,
    targetType: "ENEMY",
    effect: {
      type: "AREA_DAMAGE",
      minDamage: 12,
      maxDamage: 20,
      damagePerLevel: 0.5,
    },
    requiredClass: "MAGE",
  },
  hex: {
    displayName: "Hex",
    description: "Curses the target with dark magic, sapping their physical attributes.",
    manaCost: 14,
    cooldownMs: 10000,
    levelRequired: 9,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "hex_debuff",
    },
    requiredClass: "MAGE",
  },

  // ── Cleric ─────────────────────────────────────────────────────────
  heal: {
    displayName: "Heal",
    description: "Channels divine energy to mend the cleric's own wounds.",
    manaCost: 10,
    cooldownMs: 0,
    levelRequired: 1,
    targetType: "SELF",
    effect: {
      type: "DIRECT_HEAL",
      minHeal: 12,
      maxHeal: 20,
      healPerLevel: 0.6,
    },
    requiredClass: "CLERIC",
  },
  restore: {
    displayName: "Restore",
    description: "Extends a hand of sacred light to heal an injured ally.",
    manaCost: 12,
    cooldownMs: 3000,
    levelRequired: 3,
    targetType: "ALLY",
    effect: {
      type: "DIRECT_HEAL",
      minHeal: 15,
      maxHeal: 25,
      healPerLevel: 0.7,
    },
    requiredClass: "CLERIC",
  },
  blessing: {
    displayName: "Blessing",
    description: "Invokes a divine blessing that fortifies the body and sharpens the mind.",
    manaCost: 14,
    cooldownMs: 20000,
    levelRequired: 5,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "blessing_buff",
    },
    requiredClass: "CLERIC",
  },
  purge: {
    displayName: "Purge",
    description: "Calls down a searing radiance that burns the unholy with sustained divine fire.",
    manaCost: 12,
    cooldownMs: 8000,
    levelRequired: 7,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "purge_dot",
    },
    requiredClass: "CLERIC",
  },
  sanctuary: {
    displayName: "Sanctuary",
    description: "Wraps the cleric in a sustained aura of restorative energy that heals wounds over time.",
    manaCost: 18,
    cooldownMs: 12000,
    levelRequired: 9,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "sanctuary_hot",
    },
    requiredClass: "CLERIC",
  },

  // ── Rogue ──────────────────────────────────────────────────────────
  backstab: {
    displayName: "Backstab",
    description: "Drives a blade into a vulnerable spot, dealing heavy damage from close range.",
    manaCost: 6,
    cooldownMs: 0,
    levelRequired: 1,
    targetType: "ENEMY",
    effect: {
      type: "DIRECT_DAMAGE",
      minDamage: 9,
      maxDamage: 15,
      damagePerLevel: 0.6,
    },
    requiredClass: "ROGUE",
  },
  blind: {
    displayName: "Blind",
    description: "Throws a handful of blinding powder into an enemy's eyes, leaving them stunned.",
    manaCost: 8,
    cooldownMs: 10000,
    levelRequired: 3,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "blind_stun",
    },
    requiredClass: "ROGUE",
  },
  envenom: {
    displayName: "Envenom",
    description: "Coats a weapon in virulent poison that eats at the target's vitality over time.",
    manaCost: 12,
    cooldownMs: 8000,
    levelRequired: 5,
    targetType: "ENEMY",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "envenom_dot",
    },
    requiredClass: "ROGUE",
  },
  shadow_step: {
    displayName: "Shadow Step",
    description: "Slips into the shadows, gaining a burst of supernatural agility and resilience.",
    manaCost: 14,
    cooldownMs: 25000,
    levelRequired: 7,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "shadow_step_buff",
    },
    requiredClass: "ROGUE",
  },
  ambush: {
    displayName: "Ambush",
    description: "Strikes from concealment with lethal precision, dealing massive damage to an unsuspecting target.",
    manaCost: 22,
    cooldownMs: 8000,
    levelRequired: 9,
    targetType: "ENEMY",
    effect: {
      type: "DIRECT_DAMAGE",
      minDamage: 25,
      maxDamage: 40,
      damagePerLevel: 1.0,
    },
    requiredClass: "ROGUE",
  },

  // ── Ranger ─────────────────────────────────────────────────────────
  summon_wolf: {
    displayName: "Summon Wolf",
    description: "Calls a loyal wolf companion to fight at the ranger's side.",
    manaCost: 15,
    cooldownMs: 5000,
    levelRequired: 1,
    targetType: "SELF",
    effect: {
      type: "SUMMON_PET",
      petTemplateKey: "wolf_companion",
    },
    requiredClass: "RANGER",
  },
  aimed_shot: {
    displayName: "Aimed Shot",
    description: "Takes careful aim and releases a precise arrow that strikes a vital area.",
    manaCost: 10,
    cooldownMs: 5000,
    levelRequired: 3,
    targetType: "ENEMY",
    effect: {
      type: "DIRECT_DAMAGE",
      minDamage: 10,
      maxDamage: 18,
      damagePerLevel: 0.7,
    },
    requiredClass: "RANGER",
  },
  summon_hawk: {
    displayName: "Summon Hawk",
    description: "Calls a fierce spirit hawk to harry enemies from above.",
    manaCost: 18,
    cooldownMs: 5000,
    levelRequired: 5,
    targetType: "SELF",
    effect: {
      type: "SUMMON_PET",
      petTemplateKey: "spirit_hawk",
    },
    requiredClass: "RANGER",
  },
  natures_gift: {
    displayName: "Nature's Gift",
    description: "Draws on the vitality of the natural world to gradually restore health over time.",
    manaCost: 14,
    cooldownMs: 15000,
    levelRequired: 7,
    targetType: "SELF",
    effect: {
      type: "APPLY_STATUS",
      statusEffectId: "natures_gift_hot",
    },
    requiredClass: "RANGER",
  },
  summon_bear: {
    displayName: "Summon Bear",
    description: "Calls a massive bear guardian to absorb damage and protect the ranger.",
    manaCost: 25,
    cooldownMs: 5000,
    levelRequired: 9,
    targetType: "SELF",
    effect: {
      type: "SUMMON_PET",
      petTemplateKey: "bear_guardian",
    },
    requiredClass: "RANGER",
  },
};

// ─── Races ─────────────────────────────────────────────────────────

export const BASE_RACES: Record<string, RaceDefinitionConfig> = {
  HUMAN: {
    displayName: "Human",
    description: "Versatile and adaptable, humans excel in any role through sheer determination and ingenuity.",
    backstory:
      "Humans are the most widespread of the civilized races, having carved kingdoms, republics, and trading empires out of every habitable corner of the known world. Their relatively short lifespans drive an urgency that other races sometimes mistake for recklessness, but which humans understand as ambition. A human who lives to see sixty has likely accomplished more in raw volume than an elf who has spent three centuries perfecting a single craft.\n\nHuman societies are staggeringly diverse. The northern clans organize around warrior-kings and blood oaths. The southern city-states are governed by merchant councils and guild charters. The eastern provinces maintain rigid feudal hierarchies with landed nobility and peasant levies. What unites them is a relentless drive to build, expand, and leave a mark on the world that outlasts their mortal years.\n\nIn adventuring companies, humans serve as the glue that holds disparate races and temperaments together. They lack the innate magical affinity of the sylvan or the physical resilience of the stoneheart, but they compensate with adaptability and an unmatched talent for learning new skills quickly. A human fighter can retrain as a passable scout in weeks; a human mage can pick up the basics of herbalism between campaigns. This flexibility makes them welcome in any party composition.",
    traits: ["Adaptable", "Ambitious"],
    bodyDescription: "Medium build with a wide range of skin tones from pale to deep brown. Features are varied and unremarkable compared to the other races — no pointed ears, no stone-like skin. Hair ranges from straight to curly in shades of black, brown, red, and blonde. Eyes are brown, blue, green, or grey. Sturdy and well-proportioned, neither slight nor bulky.",
  },
  SYLVAN: {
    displayName: "Sylvan",
    description: "Graceful forest-dwellers attuned to nature and magic, with keen senses honed over centuries of life among the ancient woods.",
    backstory:
      "The sylvan emerged from the deep forests in an age before recorded history, and they have never fully left them. Their settlements are built into living trees, across suspended bridges, and within root-hollowed chambers beneath the forest floor. To outsiders, a sylvan village is nearly invisible — indistinguishable from the surrounding woodland until you are standing in the middle of it.\n\nSylvan lifespans stretch across centuries, which gives them a fundamentally different relationship with time than the shorter-lived races. A sylvan artisan may spend decades perfecting a single bow. Their historians remember events that humans consider ancient mythology. This long perspective makes them cautious and deliberate, but it also means that when a sylvan commits to a course of action, they have considered the consequences more thoroughly than most.\n\nDespite their reclusive reputation, sylvan are not isolationists. They maintain trade relationships with human border towns, exchanging rare herbs, enchanted wood, and masterwork bows for metals and manufactured goods that the forest cannot provide. Sylvan rangers patrol the borders between civilization and the wild places, serving as an early warning system against incursions from the deeper wilderness. Those who leave the forest to adventure abroad often do so out of a sense of duty — a threat has been identified that requires intervention beyond the treeline.",
    traits: ["Keen Senses", "Nature Affinity", "Graceful"],
    statMods: { DEX: 1, INT: 1, CON: -1 },
    bodyDescription: "Tall and slender with an angular, fine-boned frame. Skin has a faint warm undertone ranging from fair to olive. Ears are long and pointed, sweeping back from the head. Eyes are large and almond-shaped, often in vivid greens, golds, or pale silver. Hair is typically straight and worn long, in shades of silver-white, deep black, or autumnal auburn. Movements are fluid and precise.",
  },
  STONEHEART: {
    displayName: "Stoneheart",
    description: "Hardy mountain folk with dense bones and iron constitutions, shaped by generations of life in the deep halls beneath the peaks.",
    backstory:
      "The stoneheart were born of the mountains — or so their creation myths insist. Their earliest histories speak of a time when the first clans simply walked out of the rock itself, fully formed and already arguing about whose tunnel was deeper. Whether this is literal truth or cultural metaphor, the stoneheart have dwelt beneath the great mountain ranges for as long as any race can remember.\n\nStoneheart civilization is built around the clan-hold: a vast underground complex of mines, forges, dwelling halls, and mushroom farms carved into the living rock over generations. Each clan-hold is a self-sufficient fortress capable of withstanding siege for years. The stoneheart are master miners and smiths, producing metalwork of extraordinary quality. Their steel is sought after across the known world, and a stoneheart-forged blade can fetch ten times the price of its human-made equivalent.\n\nStoneheart who venture above ground do so for trade, diplomacy, or the pursuit of rare minerals that their home mountains lack. They find the open sky disorienting at first — too much empty space above the head — but adapt quickly enough. In battle, stoneheart are immovable anchors. Their dense bones and thick muscles make them extraordinarily difficult to knock down, and their natural resistance to poison and disease means that battlefield conditions that would incapacitate other races barely slow them down.",
    traits: ["Stone Resilience", "Mountain Born", "Enduring"],
    statMods: { CON: 2, DEX: -1 },
    bodyDescription: "Short and broad with a powerful, stocky build. Skin is thick and weathered, ranging from ruddy tan to deep granite-grey. Features are heavy and blunt — strong jaw, prominent brow ridge, wide nose. Eyes are deep-set in shades of slate, amber, or dark brown. Hair is coarse and thick, typically worn in braids, in shades of iron-grey, black, or dark copper. Hands are broad with thick, calloused fingers.",
  },
};

// ─── Pets ──────────────────────────────────────────────────────────

export const BASE_PETS: Record<string, PetDefinitionConfig> = {
  wolf_companion: {
    name: "a wolf companion",
    description: "A lean grey wolf with sharp yellow eyes, trained to fight alongside its bonded ranger.",
    hp: 25,
    minDamage: 2,
    maxDamage: 5,
    armor: 1,
  },
  spirit_hawk: {
    name: "a spirit hawk",
    description: "A large hawk wreathed in faint translucent light, striking at enemies with razor talons from above.",
    hp: 15,
    minDamage: 3,
    maxDamage: 7,
    armor: 0,
  },
  bear_guardian: {
    name: "a bear guardian",
    description: "A massive brown bear with thick scarred hide, summoned to absorb punishment and crush foes in its grip.",
    hp: 40,
    minDamage: 5,
    maxDamage: 10,
    armor: 2,
  },
};
