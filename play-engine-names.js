// The one place a deck's card names become the names Forge reads, and the list of
// names the bundled Forge build accepts. Sources spell cards their own way: Magic
// Online writes split cards "Wear/Tear", older lists write "Æther", typed lists
// bring curly quotes and odd spacing. Forge only knows "Wear // Tear", and an unknown name stops the match.
import {canonicalPlayName} from './experiments/phase-engine/catalog-admission.mjs';
// Generated from Forge e5a0f815 by scripts/forge-engine-names/regenerate.sh: every name
// listed was resolved by the engine itself. Replace it whenever the engine changes.
export const ENGINE_CARD_NAMES_FILE='forge-card-names-e5a0f815.txt';
// Real card names with a slash that is not a face separator. The release check
// fails when a new one appears in the engine and is missing here.
const SLASH_NAMES=new Set(['summon: choco/mog','sp//dr, piloted by peni']);
const tidy=name=>String(name??'').normalize('NFC').replace(/[‘’ʼ]/g,"'").replace(/[“”]/g,'"').replace(/Æ/g,'Ae').replace(/æ/g,'ae').replace(/\s+/g,' ').trim();
export function engineCardName(name){
 const s=tidy(name);
 if(!s.includes('/')||SLASH_NAMES.has(s.toLowerCase()))return canonicalPlayName(s);
 const faces=s.split(/\s*\/{1,2}\s*/);
 return canonicalPlayName(faces.every(Boolean)?faces.join(' // '):s);
}
const row=r=>typeof r==='string'?engineCardName(r):r&&typeof r==='object'&&typeof r.name==='string'?{...r,name:engineCardName(r.name)}:r;
// A copy of the deck with every name in Forge's spelling; nothing else changes.
export function engineDeck(deck){
 if(!deck||typeof deck!=='object')return deck;
 const out={...deck};
 for(const k of ['cards','side','commanders'])if(Array.isArray(deck[k]))out[k]=deck[k].map(row);
 for(const k of ['commander','companion'])if(typeof deck[k]==='string'&&deck[k])out[k]=engineCardName(deck[k]);
 return out;
}
let loading=null,failedAt=-Infinity;
// The accepted names, lower-cased; null when the list could not be read (callers
// then fall back to the engine's own check when the match opens). A failed read
// is tried again after a minute, not on every call.
export function loadEngineCardNames({fetchImpl=globalThis.fetch,now=Date.now}={}){
 if(!loading&&now()-failedAt<60000)return Promise.resolve(null);
 if(!loading)loading=(async()=>{
  const r=await fetchImpl(new URL('./'+ENGINE_CARD_NAMES_FILE,import.meta.url).href,{credentials:'omit'});
  if(!r.ok)throw Error('ENGINE_NAMES_UNAVAILABLE');
  const names=new Set((await r.text()).split('\n').map(n=>n.trim().toLowerCase()).filter(Boolean));
  if(names.size<30000)throw Error('ENGINE_NAMES_INCOMPLETE');
  return names;
 })().catch(()=>{loading=null;failedAt=now();return null;});
 return loading;
}
// Names in this deck the engine would refuse, in Forge's spelling.
export function engineUnknownCards(deck,names){
 if(!names)return [];
 const d=engineDeck(deck),seen=new Set(),out=[];
 for(const n of [...[d?.commander,d?.companion].filter(Boolean),...['cards','side','commanders'].flatMap(k=>(d?.[k]||[]).map(r=>r?.name??r))]){
  if(typeof n!=='string'||seen.has(n))continue;seen.add(n);
  if(!names.has(n.toLowerCase()))out.push(n);
 }
 return out;
}
