// Captures are staged, never collection writes. Mixed-game review survives reloads.
// A failed storage write keeps the batch in memory and is surfaced by the UI.
export const BATCH_LIMIT = 48;
export const CAPTURE_BUFFER_LIMIT = 4;
const KEY = 'cardstashy-scan-batch-v1';
let fallback = null;
export function loadBatch() {
  if (fallback) return fallback;
  try { const value=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'):[]; } catch { return []; }
}
export function saveBatch(rows) {
  try { localStorage.setItem(KEY,JSON.stringify(rows));fallback=null;return true; }
  catch { fallback=rows;return false; }
}
export const batchStorageHealthy=()=>fallback===null;
export function updateBatch(id, patch) { const rows=loadBatch().map(x=>x.id===id?{...x,...patch}:x);saveBatch(rows);return rows.find(x=>x.id===id); }
export function removeBatch(id) { return saveBatch(loadBatch().filter(x=>x.id!==id)); }
export function captureEntry(game,shot,prefs={}) {
  return {id:globalThis.crypto?.randomUUID?.()||`scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,game,shot,at:Date.now(),status:'captured',cands:[],read:{},qty:Math.max(1,Number(prefs.qty)||1),condition:prefs.condition||'Near Mint',lang:prefs.lang||'en',finish:'',defaults:{finish:prefs.finish,finishConfirmed:prefs.finishConfirmed===true,lockSet:prefs.lockSet||''}};
}
export const printingKey=c=>[c?.id||c?.card?.id,c?.print||''].join('|');
export function uniquePrintings(cands=[]) { const seen=new Set();return cands.filter(c=>{const k=printingKey(c);if(seen.has(k))return false;seen.add(k);return true;}); }
export function actualFinishes(g,c) {
  const card=c?.card||{};
  if(g==='mtg')return [...new Set((card.finishes||[]).filter(x=>['nonfoil','foil','etched'].includes(x)))];
  if(g==='ptcg')return [...new Set((card.variants||[]).map(v=>v.key).filter(Boolean))];
  return []; // A set code/rarity does not establish 1st vs unlimited edition.
}
export function resolveScanFinish(g,c,prefs={},read={}) {
  const valid=actualFinishes(g,c);
  if(prefs.finishConfirmed && (valid.includes(prefs.finish)||(g==='ygo'&&['unlimited','1st-edition'].includes(prefs.finish))))return prefs.finish;
  if(g==='ygo'&&/\b1st\s+edition\b/i.test(`${read.code||''}\n${read.full||''}\n${read.stats||''}`))return '1st-edition';
  // A coarse 'First Edition · finish unconfirmed' bucket is not an exact finish.
  if(valid.length===1 && !/unconfirmed/i.test(c?.card?.variants?.find(v=>v.key===valid[0])?.label||''))return valid[0];
  return '';
}
export function resolvedEntry(entry,g,cands,read,verified,prefs={}) {
  const unique=uniquePrintings(cands),exact=unique.length===1&&verified(unique[0]),finish=exact?resolveScanFinish(g,unique[0],prefs,read):'';
  return {...entry,game:g,cands:unique.slice(0,3),read,finish,status:exact&&finish?'ready':unique.length?'review':'unresolved',reason:exact?(finish?'Printing matched':'Choose finish / edition'):unique.length?'Check printing':'Rescan name and bottom code',printingVerified:!!exact};
}
export const batchCounts=rows=>({ready:rows.filter(x=>x.status==='ready').length,review:rows.filter(x=>!['ready','captured','reading'].includes(x.status)).length,reading:rows.filter(x=>['captured','reading'].includes(x.status)).length});
