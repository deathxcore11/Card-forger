// Forgers: the playable characters of Lost Memories. Each has one standing rule (a relic of
// kind F that only its Forger carries), one power used once a duel before the play, and
// its own three starter kits. Names and rules are ours.
export const FORGERS = {
  tarn: {
    name: 'Tarn Emberhand', tag: 'Big melds', rule: 'f_tarn', power: 'Stoke',
    powerText: 'Once a duel, before you play: your next meld gets +200 ATK this duel.',
    kits: [
      { id: 'dragons_warriors', name: 'Dragons and Warriors', types: ['Dragon', 'Warrior'] },
      { id: 'fire_scale', name: 'Fire and Scale', types: ['Pyro', 'Dinosaur', 'Reptile'] },
      { id: 'blades_claws', name: 'Blades and Claws', types: ['Warrior', 'Beast-Warrior'] },
    ],
  },
  scrapper: {
    name: 'The Scrapper', tag: 'Fizzles and Embers', rule: 'f_scrapper', power: 'Salvage', needs: 'hand',
    powerText: 'Once a duel, before you play: put one hand card on the bottom of your deck and draw two.',
    kits: [
      { id: 'machines_thunder', name: 'Machines and Thunder', types: ['Machine', 'Thunder'] },
      { id: 'stone_gears', name: 'Stone and Gears', types: ['Rock', 'Machine'] },
      { id: 'swarm', name: 'The Swarm', types: ['Insect', 'Plant'] },
    ],
  },
  veil: {
    name: 'The Veilwalker', tag: 'Veiled monsters and Traps', rule: 'f_veil', power: 'Shroud', needs: 'zone', build: 'shadow',
    powerText: 'Once a duel, before you play: turn one of your face-up monsters veiled, in defense.',
    kits: [
      { id: 'spellcasters_fiends', name: 'Spellcasters and Fiends', types: ['Spellcaster', 'Fiend'] },
      { id: 'grave_court', name: 'The Grave Court', types: ['Zombie', 'Fiend'] },
      { id: 'lantern_choir', name: 'The Lantern Choir', types: ['Fairy', 'Spellcaster'] },
    ],
  },
  storm: {
    name: 'The Stormcaller', tag: 'Terrain', rule: 'f_storm', power: 'Landfall',
    powerText: 'Once a duel, before you play: the terrain becomes your home ground again.',
    kits: [
      { id: 'tide', name: 'The Tide', types: ['Aqua', 'Fish', 'Sea Serpent'] },
      { id: 'high_wind', name: 'High Wind', types: ['Winged Beast', 'Dragon'] },
      { id: 'beasts_plants', name: 'Beasts and Plants', types: ['Beast', 'Plant', 'Beast-Warrior', 'Insect'] },
    ],
  },
  // Hidden: the prize of the first secret (lever secretLast, run.mjs). Not on the Forger screen until earned, and no
  // list of Forgers names it. Name, rule and power names are from the Story thread (21 November 2026).
  last: {
    name: 'The Last One', tag: 'One monster and what it carries', rule: 'f_last', power: 'The Quiet Door', needs: 'lone', hidden: true,
    powerText: 'Once a duel, before you play, with exactly one monster on your side: it gets +400 ATK and +400 DEF this duel.',
    kits: [
      { id: 'lone_blade', name: 'The Lone Blade', types: ['Warrior'], q: { monsters: 28, field: 2, equip: 5, tagged: 5, traps: 3, carriers: 1 } },
      { id: 'last_candle', name: 'The Last Candle', types: ['Spellcaster', 'Fairy'], q: { monsters: 28, field: 2, equip: 5, tagged: 5, traps: 3, carriers: 1 } },
      { id: 'iron_vigil', name: 'The Iron Vigil', types: ['Machine', 'Rock'], q: { monsters: 28, field: 2, equip: 5, tagged: 5, traps: 3, carriers: 1 } },
    ],
  },
};
export const FORGER_IDS = Object.keys(FORGERS).filter(id => !FORGERS[id].hidden); // the four a player sees from the start
export const HIDDEN_FORGERS = Object.keys(FORGERS).filter(id => FORGERS[id].hidden);
