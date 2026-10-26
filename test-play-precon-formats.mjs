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
