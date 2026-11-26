// Card riding boards (plan section 7): the giant spell card you ride is a card back. Each has one stat lean (small, a matter of taste, never a must-have).
// A fresh save owns the first three; the rest are earned on the ride quests (data/quests2.js). Colours are the card's face and edge (style bible gold and cream; violet stays reserved).
export const BOARDS = {
  'plain-back':   { name: 'Plain Back',   text: 'The deck you started with. No lean.',          mods: {},                    face: 0xfff4d8, edge: 0xe0b24e, start: true },
  'sun-back':     { name: 'Sun Back',     text: 'Ollies go 5% higher.',                          mods: { ridePop: 0.05 },     face: 0xffe8a8, edge: 0xe0a030, start: true },
  'tide-back':    { name: 'Tide Back',    text: 'Grinds run 5% faster.',                         mods: { grindSpeed: 0.05 },  face: 0xe8f2f0, edge: 0xc9a24a, start: true },
  'ember-back':   { name: 'Ember Back',   text: 'Landing slams reach 6% further.',               mods: { slamSize: 0.06 },    face: 0xffd9b0, edge: 0xd07030 },
  'still-back':   { name: 'Still Back',   text: 'Balance drifts 8% slower.',                     mods: { rideBal: 0.08 },     face: 0xf0ead8, edge: 0xb89a58 },
  'whirl-back':   { name: 'Whirl Back',   text: 'Spins turn 6% faster.',                         mods: { rideSpin: 0.06 },    face: 0xfff0c8, edge: 0xe6c060 },
  'long-back':    { name: 'Long Back',    text: 'Flow holds 1 s longer before it falls.',        mods: { flowHold: 1 },       face: 0xf6eedc, edge: 0xc8a050 },
  'dune-back':    { name: 'Dune Back',    text: 'Big air over the dune sea slams again (small).', mods: { duneAir: 0.5 },      face: 0xf3d89a, edge: 0xd8a040 }
};
export const START_BOARDS = Object.keys(BOARDS).filter(k => BOARDS[k].start);
