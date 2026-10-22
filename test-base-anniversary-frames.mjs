import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizePtcg} from './ptcg.js';
import {resolveFinish,finishChoices,FINISH_MASKS,pokemonFrame} from './finish-effects.js';
import {ANNIVERSARY_STAMPS,ANNIVERSARY_MAPS} from './pokemon-anniversary-masks.js';
import {finishOverlayProfile,finishImageMatches} from './finish-preview.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const base=read('tests/fixtures/base-set-frames/geometry.json');
for(const entry of base.cards){
 const raw=read(`tests/fixtures/base-set-frames/${entry.id}.json`),card=normalizePtcg(raw),before=JSON.stringify(card),choices=finishChoices('ptcg',card);
 assert.equal(choices.length,4,entry.id+' retains four catalogue editions');
 for(const v of choices){assert.equal(v.status,'approximate');assert.equal(v.layers[0].mask,`pk-${entry.id}-tcgdex-art`);}
 assert.equal(JSON.stringify(card),before);assert.equal(resolveFinish('ptcg',card).sharedFinish,true);
 const points=[...FINISH_MASKS[choices[0].layers[0].mask].matchAll(/([\d.]+)% ([\d.]+)%/g)].map(m=>[+m[1]*entry.width/100,+m[2]*entry.height/100]);
 assert.equal(points.length,entry.points.length);
 points.forEach((p,i)=>p.forEach((v,j)=>assert(Math.abs(v-entry.points[i][j])<.001)));
 assert.equal(createHash('sha256').update(fs.readFileSync(`tests/fixtures/base-set-frames/${entry.id}-high.webp`)).digest('hex'),entry.sha256);
}
const golden=read('tests/fixtures/anniversary-frames/geometry.json'),counts={};
for(const e of golden.cards){
 const raw=read(`tests/fixtures/anniversary-frames/${e.id}.json`),c=normalizePtcg(raw),before=JSON.stringify(c),original=finishChoices('ptcg',c);counts[c.set.id]=(counts[c.set.id]||0)+1;
 assert.equal(pokemonFrame(c),'','Anniversary identities cannot inherit a modern era');
 // Synthetic holo tests exercise coverage only. They never claim the source offers it.
 const fixture={...c,variants:[{key:'holofoil',finish:'holofoil',label:'Synthetic holo coverage witness'}]},model=resolveFinish('ptcg',fixture,{priceFinish:'holofoil'});
 // No measured map: never a borrowed region; a foil printing gets whole-card approximate coverage instead.
 if(e.status==='unavailable'){assert(model.status==='unknown'?model.layers.length===0:model.layers.every(l=>l.mask==='card')&&/whole-card approximate/.test(model.reason),e.id);}
 else{
  assert.equal(model.layers[0]?.mask,e.mask,e.id);assert.equal(FINISH_MASKS[e.mask],e.css);assert(!model.layers.some(l=>l.mask.startsWith('pk-swsh')));
  assert.equal(createHash('sha256').update(fs.readFileSync('tests/fixtures/anniversary-frames/'+e.file)).digest('hex'),e.sha256);
  assert(finishImageMatches(model,e.source));assert(!finishImageMatches(model,'https://example.test/different-edition.png'));
  if(e.id.startsWith('30th-c-'))assert(finishImageMatches(model,`https://cardstashy.com/img/ptcg/l/${e.id}.jpg?v=2`));
  for(const other of [resolveFinish('ptcg',{...fixture,imageLarge:'https://example.test/other.png'},{priceFinish:'holofoil'}),resolveFinish('ptcg',{...fixture,variants:[{key:'holofoil',finish:'holofoil',imageLarge:'https://example.test/edition.png'}]},{priceFinish:'holofoil'})]){assert(!other.layers.some(l=>l.mask===e.mask),e.id+' map is measured on one image only');assert.deepEqual(other.layers.map(l=>l.mask),['card'],e.id);}
 }
 assert.equal(JSON.stringify(c),before);assert.deepEqual(finishChoices('ptcg',c),original,'No availability or price mutation');
 if(e.id.startsWith('30th'))assert(original.every(p=>p.effect==='plain'),'Generated Normal availability is preserved; maps do not invent holo offers');
}
assert.deepEqual(counts,{cel25cc:25,'30th-c':30,'30th':158,cel25:1});
const regular=normalizePtcg(read('test-fixtures/finish-effects/cel25-10.json'));
assert.equal(resolveFinish('ptcg',regular,{priceFinish:regular.variants[0].key}).layers[0]?.mask,'pk-cel-art','Regular Celebrations retains its current map');
for(const set of ['cel25cc','cel25c','30th-c','30th']){
 const future={id:set+'-unknown',set:{id:set},name:'Future EX',stage:'Stage2',rarity:'Ultra Rare',variants:[{key:'holofoil',finish:'holofoil'}]};{const p=resolveFinish('ptcg',future,{priceFinish:'holofoil'});assert.deepEqual(p.layers.map(l=>l.mask),['card'],set+': an unmapped anniversary card gets whole-card coverage, never another map');assert.match(p.reason,/whole-card approximate/);}
}
console.log('PASS: 16 Base Set fronts across 64 edition choices, all 25+30 Classic and 158 main anniversary identities, source hashes, exact-image guards, unavailable special layouts and no finish/price mutations.');

const stamps=read('tests/fixtures/anniversary-frames/stamp-geometry.json');
assert.equal(new Set(stamps.profiles.filter(p=>p.id.startsWith('cel25-')).map(p=>p.id)).size,25);
for(const e of stamps.profiles){
 const profiles=ANNIVERSARY_STAMPS[e.id],model={overlayProfiles:profiles,imageSources:profiles.flatMap(p=>p.images)};
 const profile=finishOverlayProfile(model,e.source+'?cache=1');
 assert(profile,e.id+' source-specific stamp');assert.equal(FINISH_MASKS[profile.mask],e.css);
 assert.equal(createHash('sha256').update(fs.readFileSync('tests/fixtures/anniversary-frames/'+e.file)).digest('hex'),e.sha256);
 assert.equal(finishOverlayProfile(model,'https://example.test/other.png'),null);
 assert(!finishImageMatches(model,'https://example.test/other.png'));
}
const professor=normalizePtcg(read('tests/fixtures/anniversary-frames/cel25-23.json'));
for(const entry of [ANNIVERSARY_MAPS[professor.id],...ANNIVERSARY_MAPS[professor.id].alternates]){
 const c={...professor,imageLarge:entry.source},p=resolveFinish('ptcg',c,{priceFinish:c.variants[0].key});
 assert.equal(p.layers[0].mask,entry.mask);assert.equal(finishOverlayProfile(p,entry.source).artMask,entry.mask);
}
const full={id:'cel25-7',name:'Flying Pikachu VMAX',stage:'VMAX',rarity:'Full Art',set:{id:'cel25'},variants:[{key:'holofoil',finish:'holofoil'}]};
const textured=resolveFinish('ptcg',full,{priceFinish:'holofoil'});
assert.equal(textured.effect,'ptcg-full-art');assert.equal(textured.layers.length,2);assert(textured.layers.some(l=>l.material==='micro'));
assert(finishOverlayProfile(textured,'https://assets.tcgdex.net/en/swsh/cel25/7/high.webp'));
assert.equal(finishOverlayProfile({game:'ygo'},'https://example.test/card.jpg'),null);
console.log('PASS: all 25 regular Celebrations marks, 202 source-bound stamp profiles, both extended Professor contours, full-art material preservation.');
