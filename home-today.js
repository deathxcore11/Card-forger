// Home "Today": beside the header's Card of the Day, the set it comes from with its real booster
// pack. Opening today's pack always pulls the Card of the Day as its hit, so the two play together. Sources are the same public APIs
// the app already uses; results are kept for the day in memory.
import {esc,safeHref} from './ui.js';
import {packArtUrl} from './pack-preview.js';
import {packEligible} from './set-experience.js';
const resolved=new Map();
// TCGdex gives an image base without an extension; a stored copy may already carry one.
const json=async url=>{const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('Daily details unavailable');return r.json();};
// The daily card's own printing and release. Nothing is guessed: a card without a release is shown alone.
export function dailyDetails(g,h,fetchJson=json){
 const key=[g,h?.date,h?.id].join('|');if(!h?.id)return Promise.resolve(null);
 if(resolved.has(key))return resolved.get(key);
 const job=(async()=>{
  if(g==='ptcg'){const c=await fetchJson('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {image:c.image?(/\.(?:webp|png|jpe?g)$/i.test(c.image)?c.image:c.image+'/high.webp'):'',rarity:c.rarity||'',set:c.set?.id?{id:c.set.id,name:c.set.name,count:c.set.cardCount?.official||c.set.cardCount?.total||null,logo:c.set.logo?c.set.logo+'.webp':''}:null};}
  if(g==='mtg'){const c=h.printing?.image_uris?h.printing:await fetchJson('https://api.scryfall.com/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||'',rarity:c.rarity||'',set:c.set?{code:c.set,name:c.set_name,set_type:c.set_type,digital:!!c.digital,count:null,logo:`https://svgs.scryfall.io/sets/${encodeURIComponent(c.set)}.svg`}:null};}
  if(g==='ygo'){const d=await fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(h.id)),c=d?.data?.[0];if(String(c?.id)!==String(h.id))throw Error('Different card');
   // Prefer a booster release it was printed in (so today's pack is real), else its first printing.
   const s=c.card_sets?.find(x=>packEligible('ygo',{name:x.set_name}))||c.card_sets?.[0];return {image:`img/ygo/${encodeURIComponent(h.id)}.jpg`,rarity:s?.set_rarity||'',set:s?{name:s.set_name,code:String(s.set_code||'').split('-')[0],count:null,logo:''}:null};}
  return null;
 })();
 job.catch(()=>resolved.delete(key));resolved.set(key,job);return job;
}
const setAction=(g,set)=>g==='mtg'?`data-act="set" data-code="${esc(set.code)}"`:g==='ygo'?`data-act="tSetByName" data-name="${esc(set.name)}"`:`data-act="tSet" data-id="${esc(set.id)}"`;
// Today's pack, beside the header's Card of the Day pill: the set's real booster pack (tap to open
// today's pack, which always pulls the Card of the Day) and one quiet line naming the set and the
// card's rarity there. The header's art already is the card, so nothing is shown twice.
export function todayPillMarkup(g,set,{rarity=''}={}){
 if(!set)return '';
 const pack=packEligible(g,set)?packArtUrl(g,set):'';
 return `<div class="hh-today${pack?'':' no-pack'}" id="homeToday" data-game="${g}">${pack?`<button class="hh-today-pack" data-act="homeTodayPack" data-game="${g}" aria-label="Open today’s ${esc(set.name)} pack"><img src="${esc(safeHref(pack))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.hh-today').classList.add('no-pack');this.closest('.hh-today-pack').remove()"></button>`:''}<button class="hh-today-set" ${setAction(g,set)}><span>${pack?'Today’s pack':'Today’s set'}</span><b>${esc(set.name)}</b>${rarity?`<small>${esc(rarity)}</small>`:''}</button></div>`;
}
