import {pokemonVariantChoices} from './pokemon-variant-options.js';
import {isYgoEdition} from './ygo-identity.js';
import {privateKey} from './account-scope.js';
// Captures are staged, never collection writes. Mixed-game review survives reloads.
// A failed storage write keeps the batch in memory and is surfaced by the UI.
export const BATCH_LIMIT = 48;
export const CAPTURE_BUFFER_LIMIT = 8; // Reads run in parallel while captures wait, so a fast scanner rarely fills this.
// localStorage is shared with the rest of the app. These are conservative
// application ceilings, not a promise that the browser has this much space.
// A detailed 1280px card can exceed 256KB after JPEG/base64 encoding. Keep
// its readable original; the unchanged total budget still bounds every batch.
export const CAPTURE_ORIGINAL_LIMIT = 512000;
export const CAPTURE_STORAGE_LIMIT = 3000000;
export function captureCapacity(rows, originalShot = '') {
  const chars=JSON.stringify(rows).length;
  if(originalShot.length>CAPTURE_ORIGINAL_LIMIT)return {ok:false,chars,reason:'Photo is too large to keep safely. This card is not queued. Move closer or save this batch first.'};
  if(chars>CAPTURE_STORAGE_LIMIT)return {ok:false,chars,reason:'Photo storage full. This card is not queued. Save or review this batch first.'};
  return {ok:true,chars,remaining:CAPTURE_STORAGE_LIMIT-chars};
}
const KEY = 'cardstashy-scan-batch-v1';
let fallback = null,summary=null,lastKey=null;
function currentKey(){const k=privateKey(KEY);if(k!==lastKey){fallback=null;summary=null;lastKey=k;}return k;}
globalThis.addEventListener?.('storage',event=>{if(event.key===currentKey())summary=null;});
export function loadBatch() {
  currentKey();
  if (fallback) return fallback;
  try { const value=JSON.parse(localStorage.getItem(currentKey())||'[]'); return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'):[]; } catch { return []; }
}
export function saveBatch(rows) {
  try { const raw=JSON.stringify(rows);localStorage.setItem(currentKey(),raw);fallback=null;summary={count:rows.length,chars:raw.length};return true; }
  catch { fallback=rows;summary=null;return false; }
}
// Camera ticks need only capacity, not another parse of every retained image.
export function batchStorageSummary(){currentKey();if(!summary){const rows=loadBatch();summary={count:rows.length,chars:JSON.stringify(rows).length};}return summary;}
export const batchStorageHealthy=()=>{currentKey();return fallback===null;};
export function updateBatch(id, patch) { const rows=loadBatch().map(x=>x.id===id?{...x,...patch}:x);saveBatch(rows);return rows.find(x=>x.id===id); }
export function removeBatch(id) { return saveBatch(loadBatch().filter(x=>x.id!==id)); }
export function captureEntry(game,shot,prefs={},capture={}) {
  return {id:globalThis.crypto?.randomUUID?.()||`scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,game,shot,at:Date.now(),status:'captured',cands:[],read:{},qty:Math.max(1,Number(prefs.qty)||1),condition:prefs.condition||'Near Mint',lang:prefs.lang||'en',location:prefs.location||'',finish:'',defaults:{finish:prefs.finish,finishConfirmed:prefs.finishConfirmed===true,lockSet:prefs.lockSet||'',ignorePromos:prefs.ignorePromos===true},...capture};
}
export const printingKey=c=>[c?.id||c?.card?.id,c?.print||'',c?.setReleaseId||c?.releaseName||''].join('|');
export function uniquePrintings(cands=[]) { const seen=new Set();return cands.filter(c=>{const k=printingKey(c);if(seen.has(k))return false;seen.add(k);return true;}); }
export function actualFinishes(g,c) {
  const card=c?.card||{};
  if(g==='mtg')return [...new Set((card.finishes||[]).filter(x=>['nonfoil','foil','etched'].includes(x)))];
  if(g==='ptcg')return [...new Set(pokemonVariantChoices(card).filter(v=>!/unconfirmed/i.test(v.label||'')).map(v=>v.key).filter(Boolean))];
  return []; // A set code/rarity does not establish 1st vs unlimited edition.
}
export function resolveScanFinish(g,c,prefs={},read={}) {
  const valid=actualFinishes(g,c);
  if(prefs.finishConfirmed && (valid.includes(prefs.finish)||(g==='ptcg'&&pokemonVariantChoices(c?.card,prefs.finish).some(v=>v.key===prefs.finish&&!/unconfirmed/i.test(v.label||'')))||(g==='ygo'&&isYgoEdition(prefs.finish))))return prefs.finish;
  if(g==='ygo'){
    const text=`${read.code||''}\n${read.full||''}\n${read.stats||''}`;
    const limited=/\blimited\s+edition\b/i.test(text),first=/\b1st\s+edition\b/i.test(text);
    // Independent OCR observations can disagree on the stamp. A code does not
    // resolve edition, and source order is not evidence. Explicitly confirmed
    // batch defaults above remain the user's choice; otherwise ask for review.
    if(limited&&first)return '';
    if(limited)return 'limited';
    if(first)return '1st-edition';
  }
  // A coarse 'First Edition · finish unconfirmed' bucket is not an exact finish.
  if(valid.length===1 && !/unconfirmed/i.test(c?.card?.variants?.find(v=>v.key===valid[0])?.label||''))return valid[0];
  return '';
}
export function resolvedEntry(entry,g,cands,read,verified,prefs={}) {
  const unique=uniquePrintings(cands),exact=unique.length===1&&verified(unique[0]),finish=exact?resolveScanFinish(g,unique[0],prefs,read):'';
  return {...entry,game:g,cands:unique.slice(0,3),read,finish,status:exact&&finish?'ready':unique.length?'review':'unresolved',reason:exact?(finish?'Printing matched':'Choose finish / edition'):unique.length?'Check printing':'Rescan name and bottom code',printingVerified:!!exact};
}
export const batchCounts=rows=>({ready:rows.filter(x=>x.status==='ready').length,review:rows.filter(x=>!['ready','captured','reading'].includes(x.status)).length,reading:rows.filter(x=>['captured','reading'].includes(x.status)).length});
