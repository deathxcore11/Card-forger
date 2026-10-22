// Pokémon holo/reverse windows must match the independently measured frame
// geometry (mean edge maps of real fronts), and each layout must pick its own.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FINISH_MASKS,resolveFinish,finishChoices,pokemonFrame} from './finish-effects.js';
const golden=JSON.parse(readFileSync(new URL('./tests/fixtures/pokemon-frame-geometry.json',import.meta.url),'utf8')).frames;
const points=s=>[...s.matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)].map(m=>[+m[1],+m[2]]);
const stems={wotc:'pk-wotc',gym:'pk-gym',neo:'pk-neo',lc:'pk-lc',ecard:'pk-ecard',exa:'pk-exa',exb:'pk-exb',dppt:'pk-dppt',hgss:'pk-hgss',bwxy:'pk-bwxy',sm:'pk-sm',swsh:'pk-swsh',svme:'pk-sv'};
for(const [era,frames] of Object.entries(golden)){
 // Reverse foil reaches the inner edge of the measured outer border on every surround.
 for(const kind of ['basic','evolved','trainer'])assert.deepEqual(points(FINISH_MASKS[stems[era]+(kind==='basic'?'':'-'+kind)+'-surround']).slice(0,4),frames.outer,`${era} ${kind} reverse reaches the border`);
}
for(const [era,frames] of Object.entries(golden))for(const [kind,poly] of Object.entries(frames)){
 if(kind==='outer')continue;
 const stem=stems[era]+(kind==='basic'?'':'-'+kind),art=FINISH_MASKS[stem+'-art'];
 assert(art,`${stem}-art exists`);assert.deepEqual(points(art),poly,`${stem}-art matches measured window`);
 if(era==='sm'&&kind!=='trainer')continue; // Sun & Moon Pokémon reverse keeps its sm11-checked surrounds.
 const ring=points(FINISH_MASKS[stem+'-surround']);
 assert.deepEqual(ring.slice(5,-1),poly,`${stem}-surround hole is exactly the measured window`);
 assert.deepEqual(ring.at(-1),poly[0],`${stem}-surround hole is closed`);
}
// The reported Diamond & Pearl/Platinum defect: the old box spilled onto the
// Pokédex strip (to 52.5%) and missed the art beside the stage banner.
for(const kind of ['basic','evolved']){const ys=golden.dppt[kind].map(p=>p[1]);assert(Math.max(...ys)<=49.8,'DP/Pl window stops at the Pokédex strip');assert(Math.min(...ys)<=9.5,'DP/Pl window reaches the art beside the stage banner');}
const card=(id,set,stage,category='Pokemon',rarity='Common')=>({id,set:{id:set},stage,category,rarity,name:'Fixture',variants:[{key:'normal',label:'Normal',finish:'normal'},{key:'holofoil',label:'Holofoil',finish:'holofoil'},{key:'reverse-holofoil',label:'Reverse Holo',finish:'reverse-holofoil'}]});
const mask=(c,finish)=>resolveFinish('ptcg',c,{priceFinish:finish}).layers.map(l=>l.mask);
const cases=[['dp5-33','dp5','Basic','pk-dppt'],['dp1-31','dp1','Stage2','pk-dppt-evolved'],['pl3-1','pl3','Basic','pk-dppt'],['hgss3-15','hgss3','Stage1','pk-hgss-evolved'],['col1-1','col1','Basic','pk-hgss'],['bw7-121','bw7','Stage1','pk-bwxy-evolved'],['xy8-105','xy8','Basic','pk-bwxy'],['g1-1','g1','Basic','pk-bwxy'],['sm8-115','sm8','Basic','pk-sm'],['swsh9-061','swsh9','Stage1','pk-swsh-evolved'],['sv06-037','sv06','Stage1','pk-sv-evolved'],['me02-031','me02','Stage1','pk-sv-evolved'],['me01-001','me01','Basic','pk-sv']];
for(const [id,set,stage,frame] of cases){
 const c=card(id,set,stage);assert.equal(pokemonFrame(c),frame,id);
 assert.deepEqual(mask(c,'holofoil'),[frame+'-art'],id+' holo');
 assert.deepEqual(mask(c,'reverse-holofoil'),[frame+'-surround'],id+' reverse');
 assert.equal(resolveFinish('ptcg',c,{priceFinish:'normal'}).layers.length,0,id+' normal stays plain');
}
// The user-reported newer-set failure: Mega Evolution reverse produced no effect.
assert.equal(resolveFinish('ptcg',card('me01-016','me01','Basic'),{priceFinish:'reverse-holofoil'}).effect,'ptcg-reverse','Mega Evolution reverse is visible');
// Basic never receives an invented evolution cut-out; a missing stage stays Basic.
for(const set of ['dp1','hgss1','bw1','xy1','sm1','swsh1','sv01','me01'])for(const stage of ['Basic',undefined])assert(!pokemonFrame(card('x',set,stage)).includes('evolved'),set+' Basic window');
// Trainers use their own measured frame; promo Trainers and unmeasured layouts get whole-card approximate
// coverage (never a borrowed window); WotC promos use the WotC window.
assert.deepEqual(mask(card('pl1-111','pl1',undefined,'Trainer'),'reverse-holofoil'),['pk-dppt-trainer-surround']);
assert.deepEqual(mask(card('sv01-169','sv01',undefined,'Trainer'),'holofoil'),['pk-sv-trainer-art']);
for(const c of [card('swshp-SWSH251','swshp',undefined,'Trainer'),card('xy1-133','xy1',undefined,'Energy'),card('xy3-55','xy3','BREAK'),{...card('ex14-100','ex14','Basic'),name:'Blaziken ex'}])
 for(const finish of ['holofoil','reverse-holofoil']){const p=resolveFinish('ptcg',c,{priceFinish:finish});assert.deepEqual(p.layers.map(l=>l.mask),['card'],c.id+' '+finish);assert.match(p.reason,/whole-card approximate/,c.id+' '+finish);}
assert.deepEqual(mask(card('basep-1','basep','Basic'),'holofoil'),['pk-wotc-art']);
// LV.X carries foil across the whole frame; it has no reverse window.
const lvx=card('pl1-122','pl1','LEVEL-UP','Pokemon','Rare Holo LV.X');
assert.deepEqual(mask(lvx,'holofoil'),['card']);assert.equal(resolveFinish('ptcg',lvx,{priceFinish:'holofoil'}).coverage,'full');
{const r=resolveFinish('ptcg',lvx,{priceFinish:'reverse-holofoil'});assert.deepEqual(r.layers.map(l=>l.mask),['card']);assert.match(r.reason,/whole-card approximate/);}
// Pre-Diamond & Pearl eras: WotC, e-Card and EX frames, Basic/evolved/Trainer.
for(const [id,set,stage,frame,cat] of [['base2-46','base2','Stage1','pk-wotc-evolved'],['base5-10','base5','Basic','pk-gym'],['gym1-38','gym1','Basic','pk-gym'],['neo4-37','neo4','Stage1','pk-neo-evolved'],['lc-97','lc','Basic','pk-lc'],['ecard1-120','ecard1','Basic','pk-ecard'],['ecard3-1','ecard3','Stage1','pk-ecard-evolved'],['ex2-69','ex2','Basic','pk-exa'],['ex14-10','ex14','Stage1','pk-exb-evolved'],['ex1-90','ex1',undefined,'pk-exa-trainer','Trainer']]){
 const c=card(id,set,stage,cat);assert.equal(pokemonFrame(c),frame,id);assert.deepEqual(mask(c,'holofoil'),[frame+'-art'],id);assert.deepEqual(mask(c,'reverse-holofoil'),[frame+'-surround'],id);
}
// Exact older evidence keeps precedence over the era frames.
assert.deepEqual(mask(card('base1-4','base1','Stage2'),'holofoil'),['pk-base1-4-art']);
assert.deepEqual(mask(card('base1-2','base1','Stage2'),'holofoil'),['pk-base-art']);
assert.deepEqual(mask(card('ecard1-1','ecard1','Stage2'),'reverse-holofoil'),['pk-expedition-field']);
// Exact Celebi evidence and full-art treatment keep precedence.
assert.deepEqual(mask(card('sm11-4','sm11','Basic'),'holofoil'),['pk-sm11-4-art']);
assert.equal(resolveFinish('ptcg',card('sv01-199','sv01','Basic','Pokemon','Illustration Rare'),{priceFinish:'holofoil'}).effect,'ptcg-full-art');
// Cosmos uses the measured window of its own layout, never adds a finish.
const cosmos={...card('pl1-28','pl1','Basic','Pokemon','Rare'),variants:[{key:'detail:c',label:'Holofoil · Cosmos',finish:'holofoil',foil:'cosmos',size:'standard',stamps:[]}]};
const choice=finishChoices('ptcg',cosmos)[0];assert.equal(choice.materialProfile,'cosmos-holo');assert.deepEqual(choice.layers.map(l=>l.mask),['pk-dppt-art']);
assert.equal(finishChoices('ptcg',{...cosmos,variants:[]}).length,0);
console.log('PASS: measured Pokémon frame windows for WotC, Gym, Neo, Legendary Collection, e-Card, EX, DP/Pt, HGSS, BW/XY, SM, SWSH and SV/ME; Basic, evolved, Trainer, LV.X, Cosmos and unmeasured layouts.');
