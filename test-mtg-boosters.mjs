// Magic packs drawn from the set's real booster sheets (MTGJSON, baked into data/mtg-boosters).
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {drawMtgBooster,mtgBoosterCards,loadMtgBooster} from './mtg-boosters.js';
import {packFinishes} from './pack-preview.js';
const seeded=(a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;})(2024);
const kld=JSON.parse(readFileSync('data/mtg-boosters/kld.json','utf8'));

// Every baked set is well formed: layouts name existing sheets and every sheet has weighted cards.
const index=JSON.parse(readFileSync('data/mtg-boosters/index.json','utf8'));
assert.ok(Object.keys(index.sets).length>=150,'the bake covers the boosterable sets');
for(const file of readdirSync('data/mtg-boosters').filter(f=>f!=='index.json')){
 const d=JSON.parse(readFileSync(`data/mtg-boosters/${file}`,'utf8'));assert.equal(`${d.set}.json`,file);assert.ok(index.sets[d.set]);
 for(const b of d.boosters){assert.ok(b.w>0);for(const [name,n] of Object.entries(b.c)){assert.ok(d.sheets[name],`${file}: ${name}`);assert.ok(n>0);}}
 for(const [name,s] of Object.entries(d.sheets)){assert.ok(s.cards.length,`${file}: ${name} is empty`);for(const [id,w] of s.cards){assert.match(id,/^[0-9a-f-]{36}$/);assert.ok(w>0);}}
}

// A stand-in card for every Kaladesh sheet entry; the rarity comes from the sheet it is on.
const cards=new Map(),colors=['W','U','B','R','G'];let n=0;
for(const [name,s] of Object.entries(kld.sheets))for(const [id] of s.cards)if(!cards.has(id))cards.set(id,{id,name:`${name} ${n}`,colors:name==='common'?[colors[n++%5]]:[],finishes:['nonfoil','foil'],rarity:name==='basic'?'common':name==='common'?'common':name==='uncommon'?'uncommon':'rare'});
const mythics=new Set(kld.sheets.rareMythic.cards.filter(([,w])=>w===1).map(([id])=>id));
const N=4000;let foils=0,mythic=0;
for(let i=0;i<N;i++){
 const pack=drawMtgBooster(kld,cards,seeded);
 assert.equal(pack.length,15,'Kaladesh boosters hold 15 cards (with the basic land)');
 const sheets=pack.map(c=>c.packSheet);
 assert.equal(sheets.filter(s=>s==='basic').length,1);assert.equal(sheets.filter(s=>s==='uncommon').length,3);
 assert.equal(pack.at(-1).packSheet,'rareMythic','the rare or mythic is the last card');assert.equal(pack.at(-1).packSlot,'hit');
 const commons=pack.filter(c=>c.packSheet==='common');
 assert.equal(new Set(commons.map(c=>c.id)).size,commons.length,'no common twice in one pack');
 for(const color of colors)assert.ok(commons.some(c=>c.colors[0]===color),'commons are colour balanced');
 const foil=pack.filter(c=>c.packFoil);foils+=foil.length;
 if(foil.length){assert.equal(commons.length,9,'the foil replaces a common');assert.deepEqual(packFinishes('mtg',foil),[{finish:'foil'}]);}
 if(mythics.has(pack.at(-1).id))mythic++;
}
// MTGJSON: 9 in 40 packs have a foil; mythics are 15 of 121 rare-sheet weight.
assert.ok(Math.abs(foils/N-9/40)<.02,`foil rate ${foils/N}`);
assert.ok(Math.abs(mythic/N-15/121)<.02,`mythic rate ${mythic/N}`);

// Cards the set page has not loaded are fetched from Scryfall in batches of 75, once per session.
const known=[...cards.values()].slice(0,100),calls=[];
const fetcher=async(url,init)=>{calls.push(JSON.parse(init.body).identifiers.length);return {ok:true,json:async()=>({data:JSON.parse(init.body).identifiers.map(({id})=>cards.get(id))})};};
const map=await mtgBoosterCards(kld,known,fetcher);
assert.equal(map.size,cards.size);assert.ok(calls.every(x=>x<=75));assert.equal(calls.reduce((a,b)=>a+b,0),cards.size-100);
calls.length=0;await mtgBoosterCards(kld,known,fetcher);assert.equal(calls.length,0,'fetched cards are kept for the session');
// A card Scryfall cannot return is left out of its sheet instead of breaking the pack.
const partial=new Map([...cards].filter(([id])=>id!==kld.sheets.basic.cards[0][0]));
for(let i=0;i<50;i++)assert.equal(drawMtgBooster(kld,partial,seeded).length,15);

// Only plain set codes are requested; a missing file falls back to the era table.
const asked=[];const stub=async url=>{asked.push(url);return {ok:url.endsWith('/kld.json'),json:async()=>kld};};
assert.equal(await loadMtgBooster('../x',stub),null);assert.equal(asked.length,0);
assert.equal((await loadMtgBooster('KLD',stub)).set,'kld');assert.deepEqual(asked,['/data/mtg-boosters/kld.json']);
assert.equal(await loadMtgBooster('zzz',stub),null);

// The pack opener uses the real sheets for Magic, and the shell keeps the module offline.
const app=readFileSync('app.js','utf8'),sw=readFileSync('sw.js','utf8'),preview=readFileSync('pack-preview.js','utf8');
assert.match(app,/const data=await loadMtgBooster\(screen\.code\)/);assert.match(app,/openPackPreview\(\{game,set,cards,featured,booster,/);
assert.match(preview,/if\(action==='again'\)\{picks=draw\(\);/);assert.match(sw,/"\.\/mtg-boosters\.js"/);
console.log('PASS: Magic packs follow each set’s real booster sheets: layouts by weight, colour-balanced commons, a foil in 9 of 40 packs, mythic odds, bonus cards fetched once, era table when no data.');
