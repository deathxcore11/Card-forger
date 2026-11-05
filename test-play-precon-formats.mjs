import assert from 'node:assert/strict';
import {constructedPrecon,constructedPreconCandidates} from './play-precon-formats.js';
import {playSourceEntries} from './play-deck-sources.js';
const legal={standard:'Legal',modern:'Legal'},modernOnly={modern:'Legal',standard:'Not Legal'};
const card=(name,count,legalities=legal,extra={})=>({name,count,legalities,...extra});
const entry={fileName:'Angels_ECL',name:'Angels',type:'Theme Deck',releaseDate:'2026-01-23'};
const deck=(main,side=[])=>({data:{name:'Angels',mainBoard:main,sideBoard:side}});
const lands=n=>card('Plains',n,legal,{supertypes:['Basic']});
{const d=constructedPrecon(deck([card('Angel A',4),card('Angel B',4),lands(52)],[card('Side',2)]),entry);assert.deepEqual(d.formats,['Standard','Modern']);assert.equal(d.format,'Standard');assert.deepEqual(d.cards,[{name:'Angel A',qty:4},{name:'Angel B',qty:4},{name:'Plains',qty:52}]);assert.deepEqual(d.side,[{name:'Side',qty:2}]);assert.equal(d.product,'Theme Deck');}
{const d=constructedPrecon(deck([card('Old card',4,modernOnly),lands(56)]),entry);assert.deepEqual(d.formats,['Modern'],'a rotated card keeps the list Modern-only');}
assert.equal(constructedPrecon(deck([card('Angel',4),lands(36)]),entry),null,'a 40-card Welcome Deck is not a constructed list');
assert.equal(constructedPrecon(deck([card('Angel',5),lands(55)]),entry),null,'more than four copies is never trimmed into legality');
assert.equal(constructedPrecon(deck([card('Banned',4,{standard:'Banned',modern:'Banned'}),lands(56)]),entry),null);
assert.equal(constructedPrecon({data:{name:'C',mainBoard:[lands(99)],commander:[card('Leader',1)]}},entry),null,'Commander products stay in the Commander tab');
assert.deepEqual(constructedPrecon(deck([card('Relentless Rats',20,legal,{text:'A deck can have any number of cards named Relentless Rats.'}),lands(40)]),entry).formats,['Standard','Modern']);
const index=[{fileName:'New_A',name:'A',type:'Theme Deck',releaseDate:'2026-04-24'},{fileName:'Old_B',name:'B',type:'Planeswalker Deck',releaseDate:'2020-07-03'},{fileName:'Wel_C',name:'C',type:'Welcome Deck',releaseDate:'2026-08-14'},{fileName:'Cmd_D',name:'D',type:'Commander Deck',releaseDate:'2026-08-14'}];
const now=Date.parse('2026-10-26T00:00:00Z');
assert.deepEqual(constructedPreconCandidates(index,'Standard',{now}).map(d=>d.fileName),['New_A'],'Standard skips rotated-era products');
assert.deepEqual(constructedPreconCandidates(index,'Modern',{now}).map(d=>d.fileName),['New_A','Old_B']);
assert.deepEqual(constructedPreconCandidates(index,'Modern',{now,checked:new Set(['New_A'])}).map(d=>d.fileName),['Old_B'],'checked products are not downloaded again');
assert.deepEqual(constructedPreconCandidates(index,'Commander',{now}),[]);
const listed=constructedPrecon(deck([card('Angel A',4),lands(56)]),entry);
assert.equal(playSourceEntries({format:'Modern',precons:[listed]}).precons.length,1,'a Standard-legal list is offered in Modern too');
assert.equal(playSourceEntries({format:'Commander',precons:[listed]}).precons.length,0);
console.log('PASS: Standard/Modern precons are published 60-card lists offered only where every card and quantity is legal, unchanged.');

import {weeklyPrecons, weeklyPreconsByFormat, STORE_FORMATS} from './play-precon-formats.js';
{
  const years = ['2026-03-01', '2018-05-01', '2008-05-01', '1999-05-01'];
  const idx = Array.from({length: 160}, (_, i) => ({type: 'Theme Deck', fileName: `D${i}_X.json`, releaseDate: years[i % 4]}));
  const now = Date.UTC(2026, 10, 5), a = weeklyPreconsByFormat(idx, '2026-W45', 4, now), b = weeklyPreconsByFormat(idx, '2026-W46', 4, now);
  for (const f of STORE_FORMATS) if (a[f].length !== 4 || new Set(a[f]).size !== 4) throw new Error('four different precons of every format: ' + f);
  if (weeklyPrecons(idx, '2026-W45', 4, now).length !== 16) throw new Error('sixteen in the store');
  if (JSON.stringify(a) !== JSON.stringify(weeklyPreconsByFormat([...idx].reverse(), '2026-W45', 4, now))) throw new Error('same week, same picks, in any list order');
  if (JSON.stringify(a) === JSON.stringify(b)) throw new Error('the store rotates weekly');
  console.log('PASS: the weekly precon store picks four of every format, stable within a week, new each week.');
}

import {commanderStorePool, commanderDeckLegal} from './play-precon-formats.js';
{
  const idx = [
    ...Array.from({length: 4}, (_, i) => ({type: 'Commander Deck', fileName: `Trek_${i}_TRC.json`, code: 'TRC', releaseDate: '2026-11-13'})),
    ...Array.from({length: 40}, (_, i) => ({type: 'Commander Deck', fileName: `Old_${i}_OLD.json`, code: 'OLD' + (i % 8), releaseDate: `20${10 + (i % 15)}-06-01`})),
    {type: 'Theme Deck', fileName: 'Theme_X.json', code: 'X', releaseDate: '2030-01-01'}];
  const a = commanderStorePool(idx, '2026-W45'), b = commanderStorePool(idx, '2026-W46');
  if (a.featured.length !== 4 || !a.featured.every(f => f.startsWith('Trek_')) || a.code !== 'TRC' || a.released !== '2026-11-13') throw new Error('the newest Commander release is featured');
  if (a.order.some(f => a.featured.includes(f)) || a.order.length < 3) throw new Error('older decks rotate behind it');
  if (JSON.stringify(a.order) === JSON.stringify(b.order)) throw new Error('the older decks rotate weekly');
  const card = {legalities: {commander: 'Legal'}}, deck = {commander: [card], mainBoard: Array.from({length: 99}, () => card)};
  if (!commanderDeckLegal(deck)) throw new Error('a legal Commander deck passes');
  if (commanderDeckLegal({...deck, mainBoard: [...deck.mainBoard.slice(1), {legalities: {commander: 'Banned'}}]})) throw new Error('a banned card fails');
  console.log('PASS: the Commander store features the newest release and rotates legal older decks.');
}

import {preconQuote, preconListPrice, preconClass} from './play-econ-rules.js';
{
  const rows = [{name: 'M', qty: 1, rarity: 'mythic'}, {name: 'R', qty: 4, rarity: 'rare'}, {name: 'U', qty: 4, rarity: 'uncommon'}, {name: 'C', qty: 4, rarity: 'common'}, {name: 'Mountain', qty: 20, rarity: 'common'}];
  const now = Date.UTC(2026, 10, 5), std = {type: 'Challenger Deck', released: '2026-03-01', now};
  // total value = 60 + 80 + 12 + 4 = 156
  const none = preconQuote(rows, new Map(), std);
  if (none.price !== 2500 || none.share !== 1 || none.cls !== 'standard') throw new Error('nothing owned pays the Standard list price: ' + none.price);
  const half = preconQuote(rows, new Map([['M', 1], ['R', 4]]), std);
  if (half.price !== Math.round(2500 * 16 / 156 / 5) * 5 || half.missing !== 8) throw new Error('owning the expensive cards drops the price: ' + half.price);
  if (preconQuote(rows, new Map([['M', 1], ['R', 4], ['U', 4], ['C', 4]]), std).price !== 0) throw new Error('owning everything is free');
  if (preconQuote(rows, new Map([['M', 1], ['R', 4], ['U', 4], ['C', 3]]), std).price !== 250) throw new Error('250 floor');
  const cls = (type, released, r = rows) => preconClass(type, {rows: r, released, now});
  if (cls('Commander Deck', '2020-01-01') !== 'commander' || cls('Brawl Deck', '2024-01-01') !== 'brawl' || cls('Starter Kit', '2005-01-01') !== 'standard') throw new Error('classes by type');
  if (cls('Theme Deck', '2015-01-01') !== 'modern' || cls('Theme Deck', '1999-01-01') !== 'legacy' || cls('Theme Deck', '2025-05-01') !== 'standard') throw new Error('classes by era');
  if (cls('Theme Deck', '2025-05-01', [{name: 'A', qty: 4, rarity: 'common'}, {name: 'B', qty: 4, rarity: 'uncommon'}]) !== 'pauper') throw new Error('no rares = Pauper');
  const lists = ['pauper', 'standard', 'brawl', 'modern', 'commander', 'legacy'].map(c => preconListPrice(c));
  if (lists.join() !== '1500,2500,3000,3500,5000,7500') throw new Error('the half-scale ladder: ' + lists);
  if (preconListPrice('commander', {precon: {list: {commander: 4000}}}) !== 4000) throw new Error('config retunes list prices');
  console.log('PASS: precon prices are the class list price times the share of deck value you do not own.');
}
