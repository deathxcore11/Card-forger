// Scarlet & Violet and Mega Evolution packs open at each set's measured pull rates.
import assert from 'node:assert/strict';
import {samplePack,packSize,ptcgSetRates} from './pack-preview.js';
const seeded=(a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;})(31337);
const R=s=>s.toLowerCase().replace(/[^a-z]/g,'');
const set=(counts)=>Object.entries(counts).flatMap(([rarity,n])=>[...Array(n)].map((_,i)=>({id:`${R(rarity)}-${i}`,name:`${rarity} ${i}`,rarity})));

for(const id of ['sv01','sv03.5','sv04.5','sv08','sv08.5','sv10.5b','me01','me05']){
 const rates=ptcgSetRates(id);assert.ok(rates,id);
 const reverse=['illustrationrare','specialillustrationrare','acespecrare','shinyrare','shinyultrarare','blackwhiterare'];
 const sum=keys=>Object.entries(rates).filter(([k])=>keys(k)).reduce((a,[,v])=>a+v,0);
 assert.ok(sum(k=>reverse.includes(k))<1&&sum(k=>!reverse.includes(k))<1,`${id}: each slot's odds leave room for its normal fill`);
}
assert.equal(ptcgSetRates('swsh7'),null,'sets without measured rates keep the era table');

// Surging Sparks, with every rarity it prints (TCGdex counts).
const sv08=set({'Common':88,'Uncommon':61,'Rare':16,'Double rare':18,'Ultra Rare':21,'Illustration rare':23,'Special illustration rare':11,'Hyper rare':6,'ACE SPEC Rare':8});
const N=12000,seen={};
for(let i=0;i<N;i++){
 const pack=samplePack('ptcg',sv08,undefined,seeded,{id:'sv08'});
 assert.equal(pack.length,10);assert.equal(pack.at(-1).packSlot,'hit');
 for(const r of new Set(pack.map(c=>R(c.rarity))))seen[r]=(seen[r]||0)+1;
}
const rates=ptcgSetRates('sv08');
for(const [k,p] of Object.entries(rates)){const got=(seen[k]||0)/N;assert.ok(Math.abs(got-p)<Math.max(.004,p*.15),`Surging Sparks ${k}: ${got.toFixed(4)} vs ${p.toFixed(4)}`);}
assert.equal(packSize('ptcg',{id:'sv08'}),10);

// Paldean Fates: shiny rares come about 1 pack in 4.
const sv045=set({'Common':40,'Uncommon':25,'Rare':16,'Double rare':10,'Ultra Rare':5,'Illustration rare':3,'Special illustration rare':8,'Hyper rare':6,'Shiny rare':120,'Shiny Ultra Rare':12});
let shiny=0;for(let i=0;i<3000;i++)if(samplePack('ptcg',sv045,undefined,seeded,{id:'sv04.5'}).some(c=>c.rarity==='Shiny rare'))shiny++;
assert.ok(Math.abs(shiny/3000-1/4)<.025,`shiny rate ${shiny/3000}`);
console.log('PASS: Scarlet & Violet and Mega Evolution packs open at each set’s measured pull rates (TCGplayer samples); other sets keep the era table.');
