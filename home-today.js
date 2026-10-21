// Home "Today": the Card of the Day shown as the real card, beside the set it comes from as the Set
// of the Day (its real booster pack and your progress in it). Opening today's pack always pulls the
// Card of the Day as its hit, so the two features play together. Sources are the same public APIs
// the app already uses; results are kept for the day in memory.
import {esc,safeHref} from './ui.js';
import {packArtUrl} from './pack-preview.js';
import {packEligible} from './set-experience.js';
import {normalizePtcg} from './ptcg.js';
const resolved=new Map();
// TCGdex gives an image base without an extension; a stored copy may already carry one.
const json=async url=>{const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('Daily details unavailable');return r.json();};
// The daily card's own printing and release. Nothing is guessed: a card without a release is shown alone.
export function dailyDetails(g,h,fetchJson=json){
 const key=[g,h?.date,h?.id].join('|');if(!h?.id)return Promise.resolve(null);
 if(resolved.has(key))return resolved.get(key);
 const job=(async()=>{
  if(g==='ptcg'){const c=await fetchJson('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {card:normalizePtcg(c),image:c.image?(/\.(?:webp|png|jpe?g)$/i.test(c.image)?c.image:c.image+'/high.webp'):'',rarity:c.rarity||'',set:c.set?.id?{id:c.set.id,name:c.set.name,count:c.set.cardCount?.official||c.set.cardCount?.total||null,logo:c.set.logo?c.set.logo+'.webp':''}:null};}
  if(g==='mtg'){const c=h.printing?.image_uris?h.printing:await fetchJson('https://api.scryfall.com/cards/'+encodeURIComponent(h.id));if(c?.id!==h.id)throw Error('Different card');
   return {card:c,image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||'',rarity:c.rarity||'',set:c.set?{code:c.set,name:c.set_name,set_type:c.set_type,digital:!!c.digital,count:null,logo:`https://svgs.scryfall.io/sets/${encodeURIComponent(c.set)}.svg`}:null};}
  if(g==='ygo'){const d=await fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(h.id)),c=d?.data?.[0];if(String(c?.id)!==String(h.id))throw Error('Different card');
   // Prefer a booster release it was printed in (so today's pack is real), else its first printing.
   const s=c.card_sets?.find(x=>packEligible('ygo',{name:x.set_name}))||c.card_sets?.[0];return {image:`img/ygo/${encodeURIComponent(h.id)}.jpg`,rarity:s?.set_rarity||'',set:s?{name:s.set_name,code:String(s.set_code||'').split('-')[0],count:null,logo:''}:null};}
  return null;
 })();
 job.catch(()=>resolved.delete(key));resolved.set(key,job);return job;
}
const setAction=(g,set)=>g==='mtg'?`data-act="set" data-code="${esc(set.code)}"`:g==='ygo'?`data-act="tSetByName" data-name="${esc(set.name)}"`:`data-act="tSet" data-id="${esc(set.id)}"`;
// The card art is a large tap target for the header's Card of the Day action, not a second button,
// so keyboard and screen-reader users meet one control for it.
// Skeleton first (the hero already knows the card's name and art); details paint in when they arrive.
export function homeTodayMarkup(g,h){
 if(!h)return '';
 return `<section class="home-today" id="homeToday" data-game="${g}" data-daily-date="${esc(h.date)}" data-daily-id="${esc(h.id)}" aria-label="Today">
 <span class="today-card" data-act="homeTodayCard" aria-hidden="true"><span class="today-card-face"><img alt="" referrerpolicy="no-referrer" hidden></span><span class="today-card-glow"></span></span>
 <div class="today-body"><div class="today-head"><p class="eyebrow">Today</p><h2>${esc(h.name)}</h2><p class="today-sub muted">Card of the Day</p></div><div class="today-set" aria-live="polite"><span class="today-shimmer" aria-hidden="true"></span></div></div></section>`;
}
export function todaySetMarkup(g,set,{rarity=''}={}){
 if(!set)return `<p class="today-sub muted">${esc(rarity)}</p>`;
 const pack=packEligible(g,set)?packArtUrl(g,set):'';
 return `<div class="today-set-row${pack?'':' no-pack'}">${pack?`<button class="today-pack" data-act="homeTodayPack" data-game="${g}" aria-label="Open today’s ${esc(set.name)} pack"><img src="${esc(safeHref(pack))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.today-set-row').classList.add('no-pack');this.closest('.today-pack').remove()"><span class="today-pack-label">Open today’s pack</span></button>`:''}
 <div class="today-set-info"><p class="eyebrow">Set of the Day</p><button class="today-set-name" ${setAction(g,set)}>${set.logo?`<img src="${esc(safeHref(set.logo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<b>${esc(set.name)}</b></button>${rarity?`<span class="today-rarity">${esc(rarity)}</span>`:''}</div></div>`;
}
