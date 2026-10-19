// Public, frozen catalogue/art fixtures. No browser, server or network starts here.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import {normalizePtcg} from '../ptcg.js';

export const PROMO_IDS=['001','004','005','012','013','023','032','034','040','044','060','074','132','206','220','251'].map(n=>'swshp-SWSH'+n).concat('swsh3-161');
export const COSMOS_IDS=['012','013','032','034','040','060','220'].map(n=>'swshp-SWSH'+n);
export const STAMPED_IDS=['023','132','206'].map(n=>'swshp-SWSH'+n);
export const GM_KEY='detail:jr7oetx1mqug9';
export const CANONICAL_COUNTS=[2,1,2,2,2,2,1,1,2,1,1,1,2,2,2,1,2];
export const PROMO_EVIDENCE='Actual app with frozen public TCGdex catalogue records and exact publisher card art. Quotes are historical fixture values, not current market or paid-provider evidence. Holdings and scanner captures are synthetic; no live account, camera/OCR, payment or external write is used. Finish masks and light materials are explicitly approximate. Missing art is not substituted with another card.';
const folder=new URL('./fixtures/pokemon-promos/',import.meta.url);
export const promoFile=id=>id.startsWith('swshp-')?id.slice(6):id;
export async function loadPromoFixtures(){
 const manifest=JSON.parse(await readFile(new URL('sources.json',folder),'utf8'));
 const sourceMap=new Map(manifest.map(row=>[basename(row.file),row]));
 const raw=[],cards=[],art={};
 const checked=async file=>{const bytes=await readFile(new URL(file,folder)),source=sourceMap.get(file);assert(source?.public===true,'Public source manifest required: '+file);assert.match(source.source,/^https:\/\//);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256,'Exact captured bytes: '+file);return {bytes,source};};
 for(const id of PROMO_IDS){
  const name=promoFile(id),record=JSON.parse((await checked(name+'.json')).bytes);assert.equal(record.id,id);raw.push(record);cards.push(normalizePtcg(record));
  if(sourceMap.has(name+'.webp'))art[id]=await checked(name+'.webp');
 }
 for(const id of [...COSMOS_IDS,'swsh3-161'])assert(art[id]?.bytes.length>5000,'Reviewed exact art required: '+id);
 return {raw,cards,art,manifest};
}
export function validatePromoFixtures(data){
 assert.equal(data.cards.length,17);
 for(const [i,card]of data.cards.entries()){
  assert.equal(card.id,PROMO_IDS[i]);assert.equal(card.game,'ptcg');
  const canonical=card.variants.filter(v=>!v.aliasOf);assert.equal(canonical.length,CANONICAL_COUNTS[i],card.id+' selectable physical versions');
  assert.equal(new Set(canonical.map(v=>v.key)).size,canonical.length,'Unique keys');
 }
 const ponyta=data.cards.find(c=>c.id==='swshp-SWSH013');
 assert.equal(ponyta.variants.find(v=>v.key==='holofoil').productId,206430);
 assert.equal(ponyta.variants.find(v=>v.key===GM_KEY).productId,232767);
 assert.equal(ponyta.variants.find(v=>v.key===GM_KEY).usd,null,'General Mills does not borrow Cosmos market value');
 for(const id of STAMPED_IDS){const c=data.cards.find(c=>c.id===id),alias=c.variants.find(v=>v.key==='holofoil');assert(alias.aliasOf,'Legacy generic key remains a read-compatible alias: '+id);assert(c.variants.some(v=>v.key===alias.aliasOf));}
 return 'PASS: 17 public exact-card fixtures, verified byte hashes, seven reviewed Cosmos artworks, Trainer artwork, stable products and canonical/legacy choice contracts. No browser/server/network started.';
}
