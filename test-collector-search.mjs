import assert from 'node:assert/strict';
import {parseCollectorQuery as p,ygoCodeCandidates} from './collector-search.js';
// Magic: set code and collector number in either order, as printed.
for(const q of ['0323 trk','trk 0323','TRK 323','trk-0323','L 0323 TRK • EN','l 0323 trk en'])assert.deepEqual(p('mtg',q),{set:'trk',number:'323'},q);
assert.deepEqual(p('mtg','m21 123'),{set:'m21',number:'123'});
assert.deepEqual(p('mtg','fdn 12a'),{set:'fdn',number:'12a'});
// Ordinary names and Scryfall syntax are never read as codes.
for(const q of ['Mountain','Lightning Bolt','goblin guide','e:trk cn:323','sol ring','"0323 trk"','draw a card'])assert.equal(p('mtg',q),null,q);
// Pokémon: printed set code, TCGdex id or printed set size.
assert.deepEqual(p('ptcg','pal 45'),{set:'pal',number:'45'});
assert.deepEqual(p('ptcg','045 sv02'),{set:'sv02',number:'45'});
assert.deepEqual(p('ptcg','045/193'),{set:'',number:'45',total:193});
assert.deepEqual(p('ptcg','PAL 045/193'),{set:'pal',number:'45',total:193});
for(const q of ['Charizard','Professor\'s Research','pikachu ex'])assert.equal(p('ptcg',q),null,q);
// Yu-Gi-Oh!: printed codes with or without the region and dash.
for(const q of ['BLZD-EN010','blzd en010','en010 blzd','blzd-en010'])assert.deepEqual(p('ygo',q),{set:'BLZD',region:'EN',number:'010'},q);
assert.deepEqual(p('ygo','blzd 10'),{set:'BLZD',region:'',number:'10'});
assert.deepEqual(ygoCodeCandidates(p('ygo','blzd 10')),['BLZD-EN010','BLZD-010']);
assert.deepEqual(ygoCodeCandidates(p('ygo','LOB-001')),['LOB-001'.replace('-','-EN'),'LOB-001']);
for(const q of ['Dark Magician','Ash Blossom','blue eyes'])assert.equal(p('ygo',q),null,q);
console.log('PASS: collector numbers with set codes in either order for Magic, Pokémon and Yu-Gi-Oh!; names and syntax untouched.');
