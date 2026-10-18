// Rebuild the finite review data from retained provider records. No network or
// account access. These proposed materials are not enabled in the application.
import {readFile,writeFile} from 'node:fs/promises';
import {normalizePtcg} from '../ptcg.js';
import {normalizeYgo} from '../ygo.js';
import {resolveFinish} from '../finish-effects.js';
import {resolveFinish as baselineFinish} from '../review/baseline-effects.js';
const root=new URL('../',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const cases=[];
function add({key,game,card,ctx,image,printing,finish,profile,source,titleMask,foilMask,note=''}){
 const before=baselineFinish(game,card,ctx),after=resolveFinish(game,card,ctx);
 cases.push({key,game,name:card.name,printing,finish,image,profile,source,titleMask,foilMask,note,before,after,identity:{cardId:card.id,context:ctx}});
}
async function pokemon(file,image,options){
 const raw=await json(file),card=normalizePtcg(raw);
 for(const opt of options){
  const variant=card.variants.find(v=>opt.pick(v));
  if(!variant)throw Error('Missing exact variant: '+opt.key);
  add({...opt,game:'ptcg',card,ctx:{priceFinish:variant.key},image,source:raw._source||'https://api.tcgdex.net/v2/en/cards/'+card.id});
 }
}
await pokemon('test-fixtures/finish-effects/base1-4.json','assets/base1-4.png',[
 {key:'pk-charizard-base-holo',pick:v=>v.finish==='holofoil'&&/unlimited/i.test(v.label),printing:'Base Set · 4/102 · Unlimited',finish:'Holofoil',profile:'classic-holo',foilMask:'assets/base1-4-foil.svg',note:'Illustration-only simulation. The supplied catalogue scan is retained unchanged.'}]);
await pokemon('review/assets/base4-20.json','assets/base4-20.png',[
 {key:'pk-zapdos-base2-holo',pick:v=>v.finish==='holofoil',printing:'Base Set 2 · 20/130 · English',finish:'Holofoil',profile:'cosmos-holo',foilMask:'assets/base4-20-foil.svg',note:'New, exact-layout preview. Approximate light response; no edition or price inferred.'}]);
await pokemon('review/assets/mantine-swsh1.json','assets/mantine-swsh1.png',[
 {key:'pk-mantine-normal',pick:v=>v.key==='normal',printing:'Sword & Shield · 052/202 · English',finish:'Normal',profile:'plain',note:'Plain control: no foil layer.'},
 {key:'pk-mantine-reverse',pick:v=>v.key==='reverse-holofoil',printing:'Sword & Shield · 052/202 · English',finish:'Reverse Holofoil',profile:'reverse-water',note:'Mask excludes the art window and its silver caption. Pattern is a stylized material approximation.'}]);
await pokemon('test-fixtures/finish-effects/cel25-10.json','assets/zekrom.png',[
 {key:'pk-zekrom-holo',pick:v=>v.finish==='holofoil',printing:'Celebrations · 010/025 · English',finish:'Holofoil',profile:'line-holo',note:'Foil remains within this printing’s illustration.'}]);
await pokemon('test-fixtures/finish-effects/swsh4.5sv-SV107.json','assets/charizard-vmax.png',[
 {key:'pk-charizard-vmax',pick:v=>v.finish==='holofoil',printing:'Shining Fates · SV107/SV122 · English',finish:'Textured Holofoil',profile:'textured-holo',note:'Directional relief is stylized, not a recovered physical emboss map.'}]);
async function ygo(file,image,code,rarity,key,profile,titleMask){
 const card=normalizeYgo(await json('test-fixtures/finish-effects/'+file+'.json'));
 if(!card.sets.some(s=>s.code===code&&s.rarity===rarity))throw Error('Unknown YGO printing '+code+' '+rarity);
 add({key,game:'ygo',card,ctx:{priceEdition:code+'::'+rarity},image:'assets/'+image,printing:code+' · English',finish:rarity,profile,titleMask:titleMask?'assets/'+titleMask:undefined,source:'https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+card.id,note:'Set code and rarity are exact; edition is unselected. Provider master art is not an edition-specific scan.'});
}
await ygo('hot-red-dragon-abyss','hot-red-dragon-abyss.jpg','HSRD-EN041','Ultra Rare','ygo-abyss-ultra','ygo-ultra','abyss-title.svg');
await ygo('psy-framegear-gamma','psy-framegear-gamma.jpg','EXFO-ENSE3','Super Rare','ygo-gamma-super','ygo-super');
await ygo('psy-framelord-omega','psy-framelord-omega.jpg','HSRD-EN035','Secret Rare','ygo-omega-secret','ygo-secret','omega-title.svg');
await ygo('psy-framegear-gamma','psy-framegear-gamma.jpg','TOCH-EN036','Rare','ygo-gamma-rare','ygo-rare','gamma-title.svg');
await ygo('dracotail-lukias','dracotail-lukias.jpg','JUSH-EN001','Starlight Rare','ygo-lukias-starlight','starlight');
for(const [n,finish,key,profile] of [['133','nonfoil','mtg-miara-normal','plain'],['133','foil','mtg-miara-foil','traditional'],['566','etched','mtg-miara-etched','etched']]){
 const card=await json('review/assets/miara-'+n+'.json');
 if(!card.finishes.includes(finish))throw Error('Finish unavailable for exact Miara printing');
 add({key,game:'mtg',card,ctx:{priceFinish:finish},image:'assets/miara-'+n+'.jpg',printing:'Commander Legends · '+n+' · English',finish:{nonfoil:'Nonfoil',foil:'Traditional foil',etched:'Etched foil'}[finish],profile,source:'https://api.scryfall.com/cards/'+card.id,note:n==='566'?'Etched is a different printing (#566); its original artwork and identity are retained.':'Nonfoil and traditional foil are available for printing #133.'});
}
if(cases.length!==14)throw Error('Milestone must contain exactly 14 named cases');
await writeFile(new URL('review/cases.json',root),JSON.stringify({baseline:'0896479cbb5b0d103a46907e057354fe9bebf57a',scope:'approval-preview-only',cases},null,2)+'\n');
console.log('Built 14 exact review cases; application-wide rollout remains off.');
