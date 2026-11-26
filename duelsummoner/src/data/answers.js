// Trick answers (card riding plan section 11): every card you hold answers ONE trick (a Fusion answers two). When you land that trick the card acts, on a short cooldown so spam does not multiply.
// on: grind (every 0.4 s on a rail), flip (each flip), grab (each grab let go), spin (a landed 360 or more), land (a clean banked landing), air (landing after 1.1 s or more of air),
//     manual (each second of a manual), seal (each seal stone lit). Monsters grow their answer at level 5 (x1.5) and level 10 (x2). Spells and traps scale with their level.
export const ANSWERS = {
  'ember-wyvern':      [{ on: 'grind', cd: 0.4, text: 'Grinding: fire runs along the rail you ride.' }],
  'cinder-hatchling':  [{ on: 'land', cd: 1.2, text: 'A clean landing: a fireball bursts where you land.' }],
  'rune-apprentice':   [{ on: 'flip', cd: 0.8, text: 'Each flip marks the 3 nearest enemies.' }],
  'sigil-familiar':    [{ on: 'spin', cd: 1.2, text: 'A landed spin of 360 or more: a 5 m lightning ring.' }],
  'twinflare-tyrant':  [{ on: 'grind', cd: 0.4, text: 'Grinding: a wide fire wake.' }, { on: 'air', cd: 2, text: 'Big air: a firestorm where you land.' }],
  'astral-magus':      [{ on: 'flip', cd: 0.8, text: 'Each flip marks the 5 nearest.' }, { on: 'seal', cd: 0.6, text: 'Each seal stone lit: a star burst there.' }],
  'toll-of-ash':       [{ on: 'spin', cd: 1.5, text: 'A landed spin: an ash burst around you.' }],
  'kindling-rite':     [{ on: 'grind', cd: 0.5, text: 'Grinding: the sparks set enemies alight.' }],
  'deep-marks':        [{ on: 'seal', cd: 0.6, text: 'Each seal stone lit marks every enemy within 10 m.' }],
  'pack-drill':        [{ on: 'manual', cd: 0.9, text: 'Each second of a manual: your monsters strike again sooner.' }],
  'elemental-litany':  [{ on: 'air', cd: 1.5, text: 'Big air: an elemental burst where you land.' }],
  'widening-rite':     [{ on: 'land', cd: 1.5, text: 'A clean landing: a wider second ring.' }],
  'swift-draw':        [{ on: 'flip', cd: 0.6, text: 'Each flip throws a card at once.' }],
  'runners-sash':      [{ on: 'manual', cd: 0.9, text: 'Each second of a manual: the card gathers speed.' }],
  'heart-of-the-cards':[{ on: 'land', cd: 2, text: 'A clean landing heals a little.' }],
  'collectors-eye':    [{ on: 'grab', cd: 1, text: 'Each grab pulls in pickups nearby.' }],
  'gust-ward':         [{ on: 'grab', cd: 2, text: 'Each grab: a gust knocks back everything within 5 m.' }],
  'pit-of-seals':      [{ on: 'seal', cd: 1.5, text: 'Each seal stone lit opens a seal pit there.' }],
  'second-wind':       [], 'storm-of-cards': []       // one-shots act once when picked: no answer
};
