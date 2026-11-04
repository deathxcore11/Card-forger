// Part D step 1-2: export an act's card pool from Scryfall (every printing in the act's sets),
// then keep only cards Forge can play: in forge-card-names, not ante/dexterity, legal in Vintage
// (Story matches run on Forge's Vintage rules), and not marked AI:RemoveDeck:All for the CPU.
// Usage: node scripts/story/export-pool.mjs <act> > /tmp/story/pool-<act>.json
//        node scripts/story/export-pool.mjs --sets som,mbs,nph,m12 --land som > /tmp/story/pool-18.json   (acts not built yet)
import {readFileSync} from 'node:fs';
import {storyAct} from '../../story-acts.js';
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const act = opt('--sets') ? {act: null, sets: opt('--sets').split(','), landSet: opt('--land') || opt('--sets').split(',')[0]} : storyAct(argv[0]);
if (!act) throw Error('unknown act');
// Older cards that were legal in the era's format (scripts/story/era-sets.json, made by make-era-sets.mjs).
const eraSets = act.act ? (JSON.parse(readFileSync(new URL('./era-sets.json', import.meta.url), 'utf8'))[act.act]?.sets || []) : (opt('--era-sets') ? opt('--era-sets').split(',') : []);
const forge = new Set(readFileSync(new URL('../../forge-card-names-e5a0f815.txt', import.meta.url), 'utf8').split('\n').map(s => s.trim().toLowerCase()).filter(Boolean));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let url = 'https://api.scryfall.com/cards/search?unique=prints&order=set&q=' + encodeURIComponent(`(${[...act.sets, ...eraSets].map(s => 'e:' + s).join(' or ')}) -is:digital`);
const out = [];
while (url) {
  const body = await fetch(url, {headers: {'User-Agent': 'CardStashy/1.0 story-pool', Accept: 'application/json'}}).then(r => r.json());
  for (const c of body.data || []) {
    const name = c.name, face = c.card_faces?.[0] || c;
    out.push({set: c.set, number: c.collector_number, name, id: c.id, oracle_id: c.oracle_id, mana_cost: face.mana_cost || '', cmc: c.cmc, type: c.type_line, colors: c.colors || face.colors || [], color_identity: c.color_identity, rarity: c.rarity,
      text: c.oracle_text ?? face.oracle_text ?? '', pt: c.power != null ? c.power + '/' + c.toughness : null, vintage: c.legalities?.vintage, forge: forge.has(name.toLowerCase()), art: c.image_uris?.art_crop || face.image_uris?.art_crop || null, artist: c.artist});
  }
  url = body.has_more ? body.next_page : null; await sleep(120);
}
console.log(JSON.stringify({act: act.act, sets: act.sets, eraSets, landSet: act.landSet, cards: out}));
