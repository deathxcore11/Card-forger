// Home "Today": the Card of the Day shown as the real card, beside the set it comes from as the Set
// of the Day (its real booster pack and your progress in it). Opening today's pack always pulls the
// Card of the Day as its hit, so the two features play together. Sources are the same public APIs
// the app already uses; results are kept for the day in memory.
import {esc,safeHref} from './ui.js';
import {packArtUrl} from './pack-preview.js';
const resolved=new Map();
const json=async url=>{const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('Daily details unavailable');return r.json();};
// The daily card's own printing and release. Nothing is guessed: a card without a release is shown alone.
export function dailyDetails(g,h,fetchJson=json){
 const key=[g,h?.date,h?.id].join('|');if(!h?.id)return Promise.resolve(null);
 if(resolved.has(key))return resolved.get(key);
 const job=(async()=>{
  if(g==='ptcg'){const c=await fetchJson('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {image:c.image?c.image+'/high.webp':'',rarity:c.rarity||'',set:c.set?.id?{id:c.set.id,name:c.set.name,count:c.set.cardCount?.official||c.set.cardCount?.total||null,logo:c.set.logo?c.set.logo+'.webp':''}:null};}
  if(g==='mtg'){const c=h.printing?.image_uris?h.printing:await fetchJson('https://api.scryfall.com/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||'',rarity:c.rarity||'',set:c.set?{code:c.set,name:c.set_name,count:null,logo:`https://svgs.scryfall.io/sets/${encodeURIComponent(c.set)}.svg`}:null};}
  if(g==='ygo'){const d=await fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(h.id)),c=d?.data?.[0];if(String(c?.id)!==String(h.id))throw Error('Different card');
   // Its first printing names the release the card debuted in.
   const s=c.card_sets?.[0];return {image:`img/ygo/${encodeURIComponent(h.id)}.jpg`,rarity:s?.set_rarity||'',set:s?{name:s.set_name,code:String(s.set_code||'').split('-')[0],count:null,logo:''}:null};}
  return null;
 })();
 job.catch(()=>resolved.delete(key));resolved.set(key,job);return job;
}
const setAction=(g,set)=>g==='mtg'?`data-act="set" data-code="${esc(set.code)}"`:g==='ygo'?`data-act="tSetByName" data-name="${esc(set.name)}"`:`data-act="tSet" data-id="${esc(set.id)}"`;
// Skeleton first (the hero already knows the card's name and art); details paint in when they arrive.
export function homeTodayMarkup(g,h){
 if(!h)return '';
 return `<section class="home-today" id="homeToday" data-game="${g}" data-daily-date="${esc(h.date)}" data-daily-id="${esc(h.id)}" aria-label="Today">
 <button class="today-card" data-act="homeDailyCard" data-game="${g}" data-id="${esc(h.id)}" data-name="${esc(h.name)}" data-date="${esc(h.date)}" aria-label="Open ${esc(h.name)}, Card of the Day"><span class="today-card-face"><img alt="" referrerpolicy="no-referrer" hidden></span><span class="today-card-glow" aria-hidden="true"></span></button>
 <div class="today-body"><p class="eyebrow">Today</p><h2>${esc(h.name)}</h2><p class="today-sub muted">Card of the Day</p><div class="today-set" aria-live="polite"><span class="today-shimmer" aria-hidden="true"></span></div></div></section>`;
}
// progress(g,set) returns setProgressMarkup-ready numbers for the release (or null).
export function todaySetMarkup(g,set,{progressHtml='',rarity=''}={}){
 if(!set)return `<p class="today-sub muted">${esc(rarity)}</p>`;
 const pack=packArtUrl(g,set);
 return `<div class="today-set-row"><button class="today-pack" data-act="homeTodayPack" data-game="${g}" aria-label="Open today’s ${esc(set.name)} pack">${pack?`<img src="${esc(safeHref(pack))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.today-pack').classList.add('no-pack');this.remove()">`:''}<span class="today-pack-label">Open today’s pack</span></button>
 <div class="today-set-info"><p class="eyebrow">Set of the Day</p><button class="today-set-name" ${setAction(g,set)}>${set.logo?`<img src="${esc(safeHref(set.logo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<b>${esc(set.name)}</b></button>${rarity?`<span class="muted small">Today’s card is ${esc(rarity)} here</span>`:''}${progressHtml}</div></div>`;
}
