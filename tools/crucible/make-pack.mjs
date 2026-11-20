// Writes the Lost Memories game pack: one plain file with the rules, the screens, every item, rival and
// number, and one spreadsheet file with every card and what it does in this game.
//   node tools/crucible/make-pack.mjs <out-dir>
// Everything listed is read from the engine and the page, so the pack cannot drift from the game.
// The prose between the tables is written here and is checked against the code by hand.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadDb, roleOf, weightOf, meldPairRaw, WHEEL } from '../../crucible/engine/cards.mjs';
import { RELICS as BASE, LAB, relicText, TUNED_TEXT } from '../../crucible/engine/relics.mjs';
import { FORGERS, FORGER_IDS } from '../../crucible/engine/forgers.mjs';
import { VAULT, FEATS, FORGER_FEATS, MAX_HEAT } from '../../crucible/engine/meta.mjs';
import { ENCHANTS, ENCHANT_TEXT, TWISTS, THEMES, STYLES, HEAT_RULES, STRONG_LAW, KIT_TUNE, KITS, BOSSES, BANDS, AI_LEVEL, BOUNTIES, styleFor } from '../../crucible/engine/run.mjs';
import { SOLO } from '../../crucible/engine/duel.mjs';
import { LAB_POOL, LAB_DEFAULTS, labConfig } from '../../crucible/web/labs.mjs';
import { SCENES } from '../../crucible/web/story.mjs';
import { rulesText, FX_TEXT, TRAP_TEXT } from '../../crucible/web/text.mjs';

const out = process.argv[2];
if (!out) { console.error('usage: make-pack.mjs <out-dir>'); process.exit(1); }
const db = loadDb(), cfg = db.config, RAW = { ...BASE, ...LAB };
const play = { ...cfg, ...labConfig(LAB_DEFAULTS) }; // the rules the playable starts with
const pdb = { config: play };
const RELICS = Object.fromEntries(Object.entries(RAW).map(([id, r]) => [id, { ...r, text: relicText(pdb, id) }])); // words as the playable starts
const card = id => db.byId.get(id);
const cards = db.pool.cards.slice().sort((a, b) => a.name < b.name ? -1 : 1);
let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { cwd: path.dirname(new URL(import.meta.url).pathname) }).toString().trim(); } catch { /* not a checkout */ }

const L = [];
const p = (...x) => L.push(...x, '');
const table = (head, rows) => { L.push('| ' + head.join(' | ') + ' |', '|' + head.map(() => ' --- ').join('|') + '|'); for (const r of rows) L.push('| ' + r.map(c => String(c).replace(/\|/g, '/')).join(' | ') + ' |'); L.push(''); };
const role = c => c.kind === 'fusion' ? 'fusion' : roleOf(db, c.id);
const by = k => cards.filter(c => role(c) === k);
const count = k => by(k).length;
const KIND = { monster: 'Monster', fusion: 'Fusion Monster', field: 'Field Spell', equip: 'Equip Spell', spell: 'Spell', trap: 'Trap', fuel: 'Fuel' };

// ---------- where each relic comes from ----------
const vault = new Map(VAULT.map(v => [v.id, v.price]));
const featOf = new Map(FEATS.map(f => [f.gift, f.name]));
const rivalOnly = new Map();
for (const [t, s] of Object.entries(STYLES)) for (const id of s.relics) rivalOnly.set(id, (rivalOnly.get(id) || []).concat(s.style));
function source(id) {
  const r = RELICS[id];
  if (r.kind === 'F') return 'Forger rule, never offered';
  if (vault.has(id)) return `Memory Vault, ${vault.get(id)} Memories`;
  if (featOf.has(id)) return `Feat: ${featOf.get(id)}`;
  if (LAB[id] && !LAB_POOL.includes(id)) return r.kind === 'M' ? 'Not obtainable yet' : rivalOnly.has(id) ? `Not offered to the player yet. Carried by the ${rivalOnly.get(id).join(' and ')} rival style` : 'Not offered yet. Test switch only';
  if (r.kind === 'M') return 'Forged from its two parts';
  return 'Offered from the first run';
}
const FAM = { furnace: 'Furnace (one melded monster that grows)', shadow: 'Ambush (veiled monsters and Traps)', lean: 'Lean Deck (bound monsters, a small deck)', storm: 'Storm (long meld chains)', tomb: 'Tomb (the graveyard as a resource)', trade: 'Trade charms (a cost for a gain)', plain: 'Plain (small steady bonuses)', core: 'Core (rule changers)' };
const KINDR = { C: 'Charm', G: 'Gift', M: 'Masterwork', F: 'Forger rule' };

// ---------- the pack ----------
p('# Lost Memories: the full game pack');
p(`Written ${new Date().toISOString().slice(0, 10)} from the game code${commit ? ' (commit ' + commit + ')' : ''}. Every list and number below is read straight from the rules engine and the playable page, so this is what the game does today, not what an older design note says.`);
p('**What this covers:** the rules of a duel, the run through the pyramid, every Forger, kit, rival, guardian, door, Charm, Gift, Masterwork, Enchant, feat, Heat level and unlock, every screen and how it is laid out, the story text as it stands, and the card pool. The companion file `lost-memories-cards.csv` lists all ' + cards.length + ' cards one per row with what each does in this game.');
p('**Status.** Lost Memories is a working test build that runs in a browser page. It has been tested by a simulator, rule tests and a click bot. The newest version has not yet been played through by a person. It is not in the app. Art is partly placeholder. Names, numbers and story are all still open to change.');
p('**What it is and is not.** It uses the Yu-Gi-Oh card data, art and foils the CardStashy app already holds, on our own rules engine. Printed monster effects are not used. The spirit is a classic console card battler with fusion by combining cards, but nothing is copied from any existing game: the rules, meld table, characters, rivals, story, screens and words are ours. The name and the use of the cards have not had an IP check, which must happen before any public release.');

p('## 1. The game in one page');
p(`You are a Forger who wakes at the top of a pyramid with no memory. You go down ${cfg.floors} floors. Each floor has ${cfg.chambers} chambers and ends at a floor guardian. In each chamber you pick one of three doors. A door says its cost and reward before you open it. Most doors are duels; others are an Anvil, a Bazaar, a Sanctum, an Omen, a Treasure or a mystery.`);
p(`You start with a 40 card starter kit of weak monsters and ${cfg.sparks} Sparks. Losing a duel costs a Spark. At no Sparks the run ends. Winning duels gives cards, Embers (the run's money), Forge Levels (each one lets you pick a Gift) and seals. A floor guardian's door opens once you hold two seals on that floor.`);
p('The heart of the game is the meld. Your monsters are weak. Two monsters melded make a stronger one by a fixed rule you can learn, and chains of three or four cards climb higher still. Charms, Gifts and Masterworks bend the rules toward a build: long meld chains, hidden defenders, the graveyard, one giant monster, or a small sharp deck.');
p('Between runs you keep Memories (a currency every run pays, win or lose), the Codex of melds you have found, feats that unlock new Gifts, new Forgers, and Heat levels that add one written rule each. Nothing kept between runs makes the start of a run stronger. It adds variety and harder rules.');

p('### Words used');
L.push('- **Meld:** combining two or more cards into one. **Fizzle:** a meld step that makes nothing. **Fuel:** a card whose only use is +' + cfg.fuelBonus + ' in a meld.', '- **Veiled:** face down in defense. **Terrain:** the Field Spell in force. **Law:** a guardian\'s rule. **Twist:** a cursed duel\'s rule.', '- **Spark:** a life for the run. **Seal:** broken by each duel won; two open the guardian\'s door. **Embers:** money inside a run. **Memories:** currency kept between runs.', '- **Forger:** your character. **Kit:** your 40 starting cards. **Trunk:** cards you own this run outside the deck. **Weight:** the deck-building limit.', '- **Relic:** any Charm, Gift or Masterwork. **Charm:** a run-long rule, up to ' + cfg.charmSlots + '. **Gift:** picked at each Forge Level. **Masterwork:** a Charm and a Gift fused.', '- **Temper, Enchant, Bind:** the three ways an Anvil improves a card. **Codex:** the book of melds you have found. **Heat:** the difficulty ladder. **Rank and bounty:** how a win is scored.', '');
p('## 2. Duel rules');
p('### 2.1 Set-up');
L.push(`- Each side starts with ${cfg.lp} Life Points and a deck of 40 cards (36 to 40 for you if you have bound melds).`, `- There are ${cfg.monsterZones} monster zones and ${cfg.trapZones} Trap zones a side. The table never changes shape.`, `- Each side draws ${cfg.hand} cards. Who goes first is random. Nobody may attack on the very first turn of the duel.`, `- A hand never holds more than ${cfg.handMax} cards.`, '- On your last Spark your opening hand is six cards.', '');
p('### 2.2 A turn');
L.push(`1. **Draw.** At the start of your turn you draw up to a hand of ${cfg.hand}, but at most ${play.drawPerTurn} cards a turn. If you must draw and your deck does not hold enough cards, you lose.`, '2. **One play.** You may make one play: one card on its own, or one meld chain, or scrap one hand card to the graveyard. A Forger power and position changes do not use the play.', '3. **Attacks.** Then each of your monsters in attack position may attack once. Once you attack you can no longer play a card that turn.', '4. **End turn.**', '');
p('A monster may change position once a turn, but not on the turn it arrived and not after it attacked. Turning a veiled monster to attack turns it face up.');
p('### 2.3 The seven kinds of card');
table(['Kind', 'How many', 'What it does'], [
  ['Monster', count('monster'), 'Fights with its printed ATK and DEF. Printed effects are not used. Played alone it may arrive in attack, in defense, or veiled (face down in defense).'],
  ['Fusion Monster', count('fusion'), 'Never in a deck at the start. Made only by melding its printed materials. A guardian\'s ace can also be won as a card.'],
  ['Field Spell', count('field'), `Sets the terrain for both sides. Monsters the terrain favours get +${cfg.terrainBonus} ATK and DEF. A new Field Spell replaces the old terrain.`],
  ['Equip Spell', count('equip'), `Played on one of your monsters, or used in a meld: +${cfg.equipBonus} ATK and DEF for the duel. Every Equip does the same thing.`],
  ['Spell', count('spell'), 'One of twelve effects of our own (see 2.9). Used once, then it goes to the graveyard.'],
  ['Trap', count('trap'), 'Set face down in a Trap zone. When the rival attacks and the Trap can do something, you are asked whether to spring it. One Trap answers one attack.'],
  ['Fuel', count('fuel'), `Every other printed Spell, Trap or Field Spell. It cannot be played alone. Melded into a monster it gives +${cfg.fuelBonus} ATK and DEF for the duel.`],
]);
p('Any Spell, Trap or Field Spell can also be spent as fuel inside a meld.');
p('### 2.4 Melding');
p('Tap two or more hand cards in order. They combine left to right into one card. To meld onto a monster already on your table, tap that monster first, then the hand cards. Each step joins the result so far (A) with the next card (B):');
L.push('1. **Printed fusion.** If A and B are the named materials of a real Fusion Monster, they make it. A fusion with three materials needs all three in a row.', '2. **Cross meld.** Otherwise two monsters make the weakest monster that has the Type of one and the Attribute of the other and more ATK than both. If both ways round give a result, the weaker of the two is made.', `3. **Equip.** A monster and an Equip Spell: the monster stays itself with +${cfg.equipBonus} ATK and DEF.`, `4. **Fuel.** A monster and any other card that is not a monster: the monster stays itself with +${cfg.fuelBonus} ATK and DEF.`, '5. **Fizzle.** If nothing fits, A is lost to the graveyard and the chain carries on from B.', '');
L.push('- The cards used go to your graveyard. The result arrives face up, in attack or defense.', '- A result keeps the fuel, Equip and relic bonuses built up earlier in the chain. It does not keep the Temper or Enchant of the monsters that went into it.', '- The meld table is fixed. The same two cards always make the same thing, so what you learn stays true.', '- The screen shows the result of a chain before you commit only if every step is a meld you have already found. Otherwise it shows "? unknown meld".', `- There are ${db.recipes.size} printed fusions and ${db.ladders.size} Type and Attribute ladders in the pool.`, '');
p('### 2.5 Battle');
L.push('- **Against a monster in attack:** the higher ATK wins. The loser is destroyed and its owner loses the difference in Life Points. On a tie both are destroyed.', '- **Against a monster in defense:** if your ATK is higher than its DEF it is destroyed and no Life Points are lost. If its DEF is higher, you lose the difference and nothing is destroyed. On a tie nothing happens.', '- **Direct attack:** if the rival has no monsters, your full ATK comes off their Life Points.', '- **Veiled monsters** are turned face up by the attack. You attack them without knowing what they are. The CPU plays by the same rule and never sees your hidden cards.', '- Before you confirm an attack on a face-up monster, the screen shows both numbers and the outcome.', '');
p('### 2.6 The Attribute wheel');
p(`${Object.entries(WHEEL).map(([a, b]) => a + ' beats ' + b).join(', ')}. LIGHT and DARK beat each other, but only for the attacker. The side with the edge gets +${cfg.wheelBonus} for that battle. A defender with the edge gets it too.`);
p('### 2.7 Terrain');
p(`One terrain is shared by both sides. Monsters it favours get +${cfg.terrainBonus} ATK and DEF while it lasts. The ${count('field')} Field Spells:`);
table(['Field Spell', 'Favours'], by('field').map(c => { const f = db.fieldOf.get(c.id); return [c.name, f.attr ? 'every ' + f.attr + ' monster' : [...f.types].join(', ')]; }));
p('### 2.8 How a duel ends');
L.push('- A side at 0 Life Points loses.', '- A side that cannot draw the cards it must draw loses.', `- At turn ${cfg.maxTurns} the side with more Life Points wins.`, '');
p('### 2.9 The twelve Spell and Trap effects');
p('Spells and Traps do not use their printed text. Each named card is mapped by a hand-kept table to one of twelve effects. A Spell aimed at a rival monster picks the strongest face-up one unless you choose.');
const fxRows = [];
for (const fx of Object.keys(FX_TEXT)) {
  const sp = by('spell').filter(c => db.tagOf.get(c.id).fx === fx), tr = by('trap').filter(c => db.tagOf.get(c.id).fx === fx);
  const ns = a => [...new Set(a.map(c => db.tagOf.get(c.id).n))].sort((x, y) => x - y);
  const eg = (list, T) => list.length ? [...new Set(ns(list).map(n => T[fx](n)))].join(' / ') : 'None';
  fxRows.push([fx, sp.length, eg(sp, FX_TEXT), tr.length, eg(tr, TRAP_TEXT)]);
}
table(['Effect', 'Spells', 'As a Spell', 'Traps', 'As a Trap (answers one attack)'], fxRows);

p('## 3. The run');
p('### 3.1 Shape of a run');
L.push('1. Pick a Forger and a Heat level.', `2. Pick one of three starter kits (you may deal the three again once). Then pick one of three Charms.`, `3. Go down ${cfg.floors} floors of ${cfg.chambers} chambers. In each chamber pick one of three doors. After a door you move to the next chamber.`, '4. Chamber six is the guardian\'s chamber. Its door needs two seals. Every duel you win on the floor that is not the guardian breaks one seal. If you reach chamber six short of seals you get three duel doors until you have both.', `5. Beat the guardian to take a Guardian Reward, raise your weight cap by ${cfg.bossCapBonus} and go down. Beat the third guardian to clear the pyramid.`, '6. Lose a duel and you lose a Spark. An ordinary door then seals and you move on with no reward. A guardian must be faced again. At no Sparks the run ends.', '');
p('### 3.2 Your deck');
L.push(`- A deck is exactly 40 cards, less one for each bound meld (so 36 to 40). At most ${cfg.maxCopies} copies of a card.`, `- Every card has a weight: a monster weighs its Level, a Field or Equip Spell ${cfg.weights.field}, a Spell or Trap with an effect ${cfg.weights.tagged}, fuel ${cfg.weights.fuel}. A bound monster weighs its own Level or the sum of its two halves, whichever is less.`, `- The deck must fit under the weight cap. The cap starts at ${cfg.weightCaps[0]}, rises by ${cfg.bossCapBonus} for each guardian beaten and by ${cfg.prices.sanctumCap} at a Sanctum.`, '- Cards you win go to your trunk. Between duels you swap trunk cards into the deck one for one.', '- Run cards never enter your real collection.', '');
p('### 3.3 Forgers');
p('A Forger is your character for the run. Each has one standing rule, one power used once a duel before the play, and three starter kits of their own.');
table(['Forger', 'Style', 'Standing rule', 'Power', 'Kits', 'How it is unlocked'], FORGER_IDS.map(id => { const f = FORGERS[id]; return [f.name, f.tag, `${RELICS[f.rule].name}: ${RELICS[f.rule].text}`, `${f.power}: ${f.powerText}`, f.kits.map(k => k.name).join('; '), FORGER_FEATS[id].text]; }));
p('A fifth slot, "The Last One", shows as hidden on the Forger screen and is not built. With no Forger (used in tests only) the three kits are ' + KITS.map(k => k.name).join(', ') + '.');
p('### 3.4 Starter kits');
p(`A kit is 40 cards dealt fresh each run inside fixed quotas: ${cfg.kit.monsters} monsters of Level ${cfg.kit.maxLevel} or lower (three in four from the kit's Types), ${cfg.kit.field} Field Spells that favour the kit, ${cfg.kit.equip} Equip Spells, ${cfg.kit.tagged} Spells or Traps with an effect (never a board wipe or a revive), and ${cfg.kit.fuel} fuel. The whole kit must weigh ${cfg.kitWeight} or less. The kit's first Field Spell is its home ground.`);
p(`Normally no starting monster has more than ${cfg.kit.maxAtk} ATK. With the "Even kits" switch on (the default) each kit has its own ceiling, set by simulation so that every kit clears about as often:`);
const allKits = FORGER_IDS.flatMap(id => FORGERS[id].kits.map(k => [FORGERS[id].name, k]));
table(['Forger', 'Kit', 'Types', 'Strongest starting monster (Even kits)'], allKits.map(([f, k]) => [f, k.name, k.types.join(', '), (KIT_TUNE[k.id] ? KIT_TUNE[k.id].maxAtk : cfg.kit.maxAtk) + ' ATK' + (KIT_TUNE[k.id] && KIT_TUNE[k.id].weight ? `, kit weight up to ${KIT_TUNE[k.id].weight}` : '')]));
p('### 3.5 Doors');
table(['Door', 'Cost', 'Reward', 'Notes'], [
  ['Duel', 'A Spark if you lose', 'Pick 1 of 3 cards, Embers, breaks a seal', 'Every chamber before the guardian has at least one duel door.'],
  ['Cursed duel', 'A Spark if you lose, and one twist', `Pick 1 of 3 cards, ${cfg.embers.cursedBonus} extra Embers, breaks a seal`, 'Twists: ' + Object.values(TWISTS).join(' ')],
  ['Champion', 'A Spark if you lose. A much harder fight', 'Cards, then a pick of 1 from 2 Charms, breaks a seal', 'The champion\'s first monster gets +200 ATK.'],
  ['Elite', 'A Spark if you lose. The hardest duel short of the guardian', 'Pick 1 of 3 from the rival\'s 4 best cards, breaks a seal', 'Only from chamber three on. The engine calls this tier "guardian"; the screen says Elite. The name is a placeholder.'],
  ['Anvil', 'Embers', 'One working: Temper, Enchant, Bind or forge a Masterwork', 'See 3.10.'],
  ['Bazaar', 'Embers', 'One of four merchants', 'Cards (four for sale), Charms (three for sale), the Scrapper (removes up to three trunk cards), or the Shadow merchant (one card shown, one sealed at half price).'],
  ['Sanctum', 'Nothing', `Take back one Spark, or raise your weight cap by ${cfg.prices.sanctumCap}`, ''],
  ['Omen', 'Your two weakest trunk cards', 'One stronger monster, unseen', 'You may pay 30 Embers to see it first, and you may always leave.'],
  ['Treasure', 'Nothing', 'A free pick from two monsters and sometimes a Charm', 'Rare.'],
  ['Mysterious door', 'May cost up to 15 Embers. No Spark can be lost', 'Half the time 25 Embers, a third of the time a fuel card, one time in six you lose up to 15 Embers', ''],
  ['Floor guardian', 'A Spark if you lose. You face it again', `Guardian Reward, +${cfg.bossCapBonus} weight cap, the way down`, 'Needs two seals. Its Law is shown from chamber three.'],
]);
p('Each door is labelled Known, Partly hidden or Mysterious. The fifth chamber offers a duel plus two of Anvil, Sanctum, Champion and Bazaar, so you can prepare for the guardian. A duel door shows a tag when the rival\'s cards fit your deck, and an Anvil door shows when a Masterwork is ready.');
p('### 3.6 Rivals');
p('Ordinary rivals come from eight families of our own. The cards in a rival\'s deck are drawn from the pool by Type and by an ATK band for the floor and tier. A rival deck is 40 cards: 29 monsters, 2 Field Spells, 3 Equip Spells and 6 Spells or Traps. Ordinary rivals on floor one carry no removal or revive cards. Board wipes appear only on floor three and in guardian decks. A guardian deck holds 30 monsters, its ace among them.');
table(['Rival', 'Types', 'Style (when rival styles are on)', 'What the style does', 'Tell shown on the door'], THEMES.map(t => { const s = styleFor(pdb, t.id); return [t.name, t.types.join(', '), s.style, s.text.replace(/^[^:]+: /, '').replace(/^./, x => x.toUpperCase()), s.tell]; }));
p('Rival styles are a switch that is off by default. They also come on at Heat 5. With styles on, a rival from floor two carries one or two of the same relics a player can earn and plays toward them.');
const band = (tier, fl) => { const b = BANDS[tier][fl].slice(); if (tier === 'boss' && play.bossBand) { const bb = play.bossBand[fl] || 0; b[0] = Math.max(300, b[0] + Math.round(bb / 2)); b[1] = Math.max(b[0] + 200, b[1] + bb); } if (play.rivalBand) { const rb = play.rivalBand[fl] || 0; b[0] = Math.max(300, b[0] + Math.round(rb / 2)); b[1] = Math.max(b[0] + 200, b[1] + rb); } return b.join(' to '); };
const CPU = ['Novice', 'Adept', 'Master'], TIER = { regular: 'Duel', cursed: 'Cursed duel', champion: 'Champion', guardian: 'Elite', boss: 'Floor guardian' };
p('ATK of the monsters in a rival deck, and the skill of the CPU that plays it, as the playable starts:');
table(['Tier', 'Floor 1', 'Floor 2', 'Floor 3'], Object.keys(BANDS).map(t => [TIER[t], ...[0, 1, 2].map(f => `${band(t, f)} ATK, ${CPU[AI_LEVEL[t][f]]}`)]));
p('The CPU has three levels. All of them see only what a player in that seat would see.');
p('### 3.7 Floor guardians and their Laws');
p('Each floor has two possible guardians and the run picks one at random. A guardian has an ace monster, a deck built round its Types, and a Law that changes the duel. The hard form of the Law applies from Heat 8.');
table(['Floor', 'Guardian', 'Ace', 'Types', 'Law', 'Hard Law (Heat 8)'], BOSSES.flatMap((pair, f) => pair.map(b => [f + 1, b.name, b.ace + ` (${card(db.byName.get(b.ace).id).atk} ATK)`, b.types.join(', '), (b.law === 'end' && play.endTurns ? b.lawText.replace('fourth turn', ({ 5: 'fifth', 6: 'sixth' }[play.endTurns] || 'fourth') + ' turn') : b.lawText), STRONG_LAW[b.law]])));
p(`As the playable starts, a guardian deck is built round ${play.bossAces || 3} cop${(play.bossAces || 3) === 1 ? 'y' : 'ies'} of its ace. Beating a guardian gives a Guardian Reward, a choice of one: the ace as a card for your deck, a Masterwork forged free if you hold both parts, or one of three Charms.`);
p('### 3.8 Rank, bounty, Embers and card drops');
p(`A win is ranked from points. You start at ${cfg.rank.start}. S needs ${cfg.rank.S}, A ${cfg.rank.A}, B ${cfg.rank.B}, C ${cfg.rank.C}, and anything lower is D.`);
table(['Line', 'Points', 'Counts as'], [
  ['Speed', 'Won in 3 of your turns +20, in 5 +10, in 8 0, slower -5', 'Fury'], ['Big hits', '+3 for each hit of 1500 or more, up to 12', 'Fury'],
  ['Melds', '+3 each, up to 12', 'Craft'], ['Spells and Traps', '+3 each, up to 12', 'Craft'], ['Defenders held', '+3 for each attacker that failed against your defender, up to 9', 'Craft'],
  ['Life Points', '7500 or more +10, under 4000 -10', 'Either'], ['Fizzles', '-3 each', 'Either'], ['Deck nearly empty', '-10 with 5 or fewer cards left', 'Either'], ['Bounty met', '+10', 'Either'],
]);
p('Your style for the duel is Craft if Craft points beat Fury points, otherwise Fury. Each duel also names one bounty: ' + BOUNTIES.map(b => b.text).join('; ') + '.');
p(`**Embers.** You start a run with ${cfg.embers.start}. A win pays ${cfg.embers.S} for S, ${cfg.embers.A} for A, ${cfg.embers.B} for B and ${cfg.embers.C} for C or D, plus ${cfg.embers.cursedBonus} for a cursed duel and ${cfg.embers.bountyBonus} for the bounty.`);
p('**Card drops.** On an S or A you pick 1 of 3 cards from the list for your style: Fury offers the rival\'s strongest monsters and its Equips, Craft offers its Spells, Traps, Field Spells and the materials of printed fusions. An S always includes the best card on the list. On a B you pick 1 of 3 of the rival\'s own monsters, on a C or D 1 of 2. You may always take nothing.');
p('### 3.9 Forge Levels and Gifts');
p(`Winning gives Forge experience: ${cfg.xp.duel} for a duel, ${cfg.xp.bounty} more for the bounty, ${cfg.xp.champion} more for a champion, ${cfg.xp.boss} more for a guardian, and ${cfg.xp.newMeld} for each meld that is new this run. Each Forge Level lets you pick 1 of 3 Gifts. A level costs ${cfg.xp.perLevel * (play.giftXpScale || 1)} experience as the playable starts, which gives about five Gifts in a full run.`);
p('With "Leaning offers" on (the default) one of the three Gifts always comes from a build you already hold a piece of, and once a run you may deal the three again. A Gift you unlocked by a feat is shown once, marked NEW, in the first Gift offer of your next run.');
p('### 3.10 The Anvil');
p('One working, then you move on.');
L.push(`- **Temper (${cfg.prices.temper} Embers).** One deck monster gets +${cfg.temperBonus} ATK and DEF for the rest of the run.`, `- **Enchant (${cfg.prices.enchant} Embers).** Put one of three offered Enchants on a deck monster that has none.`, `- **Bind (${cfg.prices.bind} Embers).** Two deck monsters whose meld you have already made this run become that result as one card in your deck. At most ${cfg.maxBinds} Binds a run.`, `- **Masterwork (${cfg.prices.masterwork} Embers).** Fuse a Charm and a Gift you hold into their Masterwork. At most ${cfg.maxMasterworks} a run.`, '');
p('The twelve Enchants:');
table(['Enchant', 'What it does'], ENCHANTS.map(e => [e[0].toUpperCase() + e.slice(1), ENCHANT_TEXT[e]]));
p(`A card's foil shows its power: a tempered card is Super, an enchanted card Ultra, and one with both is Secret. Other prices: a Bazaar card costs ${cfg.prices.card} Embers plus one for each 100 of its value, a Charm ${cfg.prices.charm}, and the Scrapper ${cfg.prices.scrap} a card.`);

p('## 4. Every item');
p(`You can hold up to ${cfg.charmSlots} Charms and any number of Gifts. A Charm is picked at the start, won from champions, guardians and treasure, or bought. A Gift is picked at each Forge Level. Every repeating effect has a fixed count. Bonuses from Charms and Gifts on one monster stop at +${cfg.relicCap} ATK and +${cfg.relicCap} DEF in a duel; Masterworks sit outside that limit. Relics resolve in a fixed order: Forger rule, Charms, Gifts, Masterworks, each in the order gained.`);
const ids = Object.keys(RELICS);
for (const fam of ['furnace', 'shadow', 'storm', 'tomb', 'lean', 'core', 'plain', 'trade']) {
  const list = ids.filter(id => RELICS[id].family === fam);
  p(`### ${FAM[fam]}`);
  table(['Name', 'Kind', 'What it does', 'Where it comes from'], list.map(id => { const r = RELICS[id]; return [r.name, KINDR[r.kind] + (r.parts ? ` (${r.parts.map(x => RELICS[x].name).join(' + ')})` : ''), r.text, source(id)]; }));
}
const nC = ids.filter(id => RELICS[id].kind === 'C').length, nG = ids.filter(id => RELICS[id].kind === 'G').length, nM = ids.filter(id => RELICS[id].kind === 'M').length;
p(`That is ${nC} Charms, ${nG} Gifts and ${nM} Masterworks, plus the four Forger rules in 3.3.`);
p('With the "Lone arrivals" switch on (off by default), a monster of four Types played alone and face up also does something on arrival: ' + Object.entries(SOLO).map(([t, x]) => `${t}: ${x}`).join(' ') + '');

p('## 5. Between runs');
p('### 5.1 Memories');
p('Every finished run pays Memories, win or lose: 1 for each duel won, 10 for each guardian beaten, 3 for each S rank, 1 for each meld new to your Codex (up to 20), 8 for each floor deeper than your best, and 30 for clearing the pyramid. Heat adds 20% of that for each Heat level.');
p('### 5.2 The Memory Vault');
p('Memories buy relics into the pool of things a run can offer. Nothing in the Vault makes a run start stronger.');
table(['Item', 'Kind', 'Price'], VAULT.map(v => [RELICS[v.id].name, KINDR[RELICS[v.id].kind], v.price + ' Memories']));
p('### 5.3 Feats');
p('A feat follows a way of playing. Progress counts across runs, win or lose. Each feat adds one Gift to what the forge can offer.');
table(['Feat', 'Build', 'Goal', 'Unlocks'], FEATS.map(f => [f.name, f.build, f.text, RELICS[f.gift].name]));
p('### 5.4 The Heat ladder');
p(`Clearing the pyramid at one Heat level opens the next, up to Heat ${MAX_HEAT}. Each level adds one rule you can read before you descend, and every lower rule stays in force. Heat adds rules, not bigger numbers.`);
table(['Heat', 'Name', 'Rule'], HEAT_RULES.map(h => [h.n, h.name, h.text]));
p('### 5.5 The Codex');
{
  const mons = db.pool.cards.filter(c => c.kind === 'monster' || c.kind === 'fusion'); const res = new Set();
  for (let i = 0; i < mons.length; i++) for (let j = i; j < mons.length; j++) { const r = meldPairRaw(db, mons[i].id, mons[j].id); if (r.id) res.add(r.id); }
  for (const id of db.recipes.values()) res.add(id);
  p(`The Codex is a book with one page for every monster a meld can make: ${res.size} pages. A page you have found shows the result, why the rule makes it, the ATK range of ingredients that makes it again, and the recipes you have used. A page you have not found shows only its Type and Attribute as a hint. The Codex is kept between runs.`);
}

p('## 6. The Lab switches on the home screen');
p('The playable has a row of rule switches so experiments can be tried by hand. A run in progress keeps the switches it started with.');
const LABTEXT = { five: 'Five Gifts a run. Gifts come half as often, the newer Storm, Tomb, Ambush and Furnace Gifts join the pool, rivals on floors two and three are eased to match, and the last guardians are eased.', lean: 'Leaning offers and one Gift re-deal a run.', heat: 'The ten-level Heat ladder.', kits: 'Even kits.', items: 'Tuned items: Storm pieces ask for a meld of four cards, Copper Loop and Patient Coil give less, Grave Ward works once a duel. Section 4 shows the tuned wording. Off, the wording is: ' + Object.keys(TUNED_TEXT).map(id => RAW[id].name + ': ' + RAW[id].text).join(' '), allHeat: 'Open every Heat level now, for testing.', veilSet: 'Veilwalker, wider rule: once a turn, while she holds no veiled monster, setting one monster veiled in defense does not use her play.', styles: 'Rivals with a style from floor two.', trap: 'Free Trap: your first Trap set each turn does not use your play. Floor guardians get it too.', free: 'Free cast: your first Spell, Field Spell or Trap played alone each turn does not use your play. Rivals get it too.', solo: 'Lone arrivals for Zombie, Fairy, Machine and Spellcaster monsters.', tombStart: 'Start with the three Tomb relics. A demonstration, not a fair run.' };
table(['Switch', 'Starts', 'What it does'], Object.keys(LABTEXT).map(k => [k, LAB_DEFAULTS[k] ? 'ON' : 'off', LABTEXT[k]]));

p('## 7. Screens and layout');
p('The page is drawn on a fixed stage 1600 wide and 900 to 1200 tall and scaled as one piece to fit any screen, so nothing moves or resizes during play. The look is dark glass panels with gold edges over painted backgrounds.');
L.push('**Home.** Title, then buttons: Continue run (if one is saved), New run, Codex, Feats, Memory Vault, How to play. Below them the Lab switches.', '', '**Choose your Forger.** Five portrait cards in a row (four Forgers and the hidden slot), each with name, style, rule and power, or how to unlock it. Under them a row of Heat buttons, a box that states the newest Heat rule, and the Descend button.', '', '**Pick a starter kit.** Three kit panels side by side. Each shows the kit name, a summary (monsters, main Types, average ATK, weight), its five best cards, and Take this kit. One Deal again button.', '', '**Pick one charm.** Three Charms with picture, name, kind, family and text.', '', '**Chamber.** A bar across the top (the run bar): floor and chamber, Sparks as diamonds, Embers, seals, deck weight against the cap, Forge Level, and buttons for Deck, Relics, Rules and Abandon. Under it one line naming the floor guardian and, from chamber three, its Law. Then three large door pictures side by side, each with a glass plate: door name, how much is known, Cost, Reward, any Law or rival tell, and tags.', '', '**Duel.** Four fixed areas.', '- Left column: the rival\'s panel at the top (Life Points, name, hand and deck counts) and your panel at the bottom (Life Points, deck count, turn number).', '- Centre: the table. From top to bottom: the rival\'s five Trap zones, the rival\'s five monster zones, a terrain line, your five monster zones, your five Trap zones. In a Narrow Pass the two outer zones are drawn sealed, not removed.', '- Right column: a "This duel" panel listing the rival\'s style, the Law, the twist, the bounty and your Forger\'s rule and power; under it a log of the last five events.', '- Bottom: your hand in six fixed slots, and an action panel. The action panel shows the meld chain you are building ("card → card = result"), what a Spell, Trap or fuel card does, and the buttons: Attack position, Defense position, Veiled defense, Undo, Scrap card, End turn, the Forger power, and a speed toggle.', '- A playable hand card has a blue ring. Tapping your monster picks it as attacker or as the base of a meld; legal targets then glow red with the forecast over them. When the rival attacks into a Trap you can spring, a prompt names the attacker, its target and each Trap.', '', '**After a duel.** A panel with Victory or Defeat, the rank letter, the points line by line, style, Embers and whether the bounty was met. Then one pick screen at a time: a card, a Charm, a Gift, or the Guardian Reward.', '', '**Anvil.** Buttons for each working with its price, the wording of the three Enchants on offer, and the whole deck as a grid to tap.', '', '**Bazaar.** Items with prices; the Scrapper shows your trunk.', '', '**Deck, Relics and Rules panels** open over any screen from the run bar. The Deck panel shows deck and trunk and swaps cards between duels. Tapping any card anywhere opens it large with its numbers and what it does in this game.', '', '**Run over.** Any unlocks first, then two boxes (this run; Memories earned line by line), then feat progress bars, then buttons for a new run, Codex, Feats and Vault.', '', '**Codex, Feats, Memory Vault** as described in section 5. Story scenes show as a portrait and a text box that advances on a tap, with a Skip button.', '');

p('## 8. Story, as it stands');
p('These are first-pass scenes, shown once each. The world is our own: an apprentice meldwright, Vessa the Ashen, the Hollow King and the lost city of Asterhold. The full story is not written.');
for (const [id, sc] of Object.entries(SCENES)) L.push(`- **${id === 'intro' ? 'Opening' : id === 'cleared' ? 'Pyramid cleared' : id === 'fell' ? 'Run lost' : sc.who}:** ${sc.lines.join(' ')}`);
L.push('');

p('## 9. The cards');
p(`The pool is every Yu-Gi-Oh card first printed on or before ${db.pool.cutoff} that the app's card source holds: ${cards.length} cards. The cut-off date is a test value and is still to be chosen. No card stat is typed by hand.`);
table(['Kind in this game', 'Cards'], ['monster', 'fusion', 'field', 'equip', 'spell', 'trap', 'fuel'].map(k => [KIND[k], count(k)]));
{
  const types = [...new Set(by('monster').map(c => c.type))].sort(), attrs = ['DARK', 'EARTH', 'FIRE', 'LIGHT', 'WATER', 'WIND'];
  p('Monsters by Type and Attribute (Fusion Monsters not counted):');
  table(['Type', ...attrs, 'All', 'ATK range'], types.map(t => { const m = by('monster').filter(c => c.type === t); return [t, ...attrs.map(a => m.filter(c => c.attr === a).length || ''), m.length, Math.min(...m.map(c => c.atk)) + ' to ' + Math.max(...m.map(c => c.atk))]; }));
}
p('### Spells with an effect');
table(['Spell', 'What it does'], by('spell').map(c => [c.name, rulesText(db, c.id).replace(/^Spell: /, '')]));
p('### Traps with an effect');
table(['Trap', 'When the rival attacks'], by('trap').map(c => [c.name, rulesText(db, c.id).replace(/^Trap, set face down\. Springs when the rival attacks: /, '')]));
p('### Equip Spells');
p(`All ${count('equip')} do the same thing (+${cfg.equipBonus} ATK and DEF): ` + by('equip').map(c => c.name).join(', ') + '.');
p('### Fusion Monsters and their recipes');
table(['Fusion Monster', 'Type', 'Attribute', 'Level', 'ATK', 'DEF', 'Made by melding'], by('fusion').sort((a, b) => a.atk - b.atk).map(c => [c.name, c.type, c.attr, c.level, c.atk, c.def, c.materials ? c.materials.map(m => card(m).name).join(' + ') : 'No recipe in the pool']));
p(`### Monsters and fuel`);
p(`The ${count('monster')} monsters and ${count('fuel')} fuel cards are listed one per row in \`lost-memories-cards.csv\`, with every other card. Its columns: name, kind in this game, Type, Attribute, Level, ATK, DEF, weight, what it does in this game, printed kind, set code, rarity, first print date, and card number.`);

p('## 10. Designed but not built');
p('For completeness, these are in the design notes and not in the game yet: the full four-act story woven through the runs, the mode\'s own Trunk and Shop, hidden Forgers, alternate stages, a rumour journal, two more build families, an endless mode, music, final art for every screen, the engine in the app\'s own language and the app screens. Known balance gaps: the Storm build clears far more often than the others in the simulator, the Veilwalker\'s rule is worth nothing, and the unlocks other than Heat run out after about nine runs.');

p('## 11. Every number');
p('The tunable values as the playable starts (base settings with the default Lab switches applied).');
const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) ? flat(v, pre + k + '.') : [[pre + k, Array.isArray(v) ? (v.length > 8 ? v.length + ' entries' : v.join(', ')) : v === null ? 'off' : String(v)]]);
table(['Setting', 'Value'], flat(play));

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'lost-memories-game-pack.md'), L.join('\n'));

// ---------- the card list ----------
const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const PRINT = { monster: 'Monster', fusion: 'Fusion Monster', field: 'Field Spell', equip: 'Equip Spell', spell: 'Spell', trap: 'Trap' };
const rows = [['name', 'kind_in_this_game', 'type', 'attribute', 'level', 'atk', 'def', 'weight', 'what_it_does_in_this_game', 'printed_kind', 'set_code', 'rarity', 'first_print_date', 'card_number']];
for (const c of cards) {
  const k = role(c), mon = k === 'monster' || k === 'fusion';
  const what = k === 'fusion' ? (c.materials ? 'Made only by melding ' + c.materials.map(m => card(m).name).join(' + ') + '. Fights with its printed ATK and DEF.' : 'No recipe in the pool. Fights with its printed ATK and DEF.') : rulesText(db, c.id);
  rows.push([c.name, KIND[k], mon ? c.type : '', mon ? c.attr : '', mon ? c.level : '', mon ? c.atk : '', mon ? c.def : '', weightOf(db, c.id), what, PRINT[c.kind], c.set, c.rarity, c.date, c.id]);
}
fs.writeFileSync(path.join(out, 'lost-memories-cards.csv'), rows.map(r => r.map(q).join(',')).join('\n') + '\n');
console.log('pack', L.join('\n').length, 'bytes;', rows.length - 1, 'cards');
