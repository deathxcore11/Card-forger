// Home "Today": the Card of the Day showcase's set line and its real booster pack. Opening today's pack
// always pulls the Card of the Day as its hit. Sources are the public APIs the app already uses; results
// are kept for the day in memory.
import {esc,safeHref} from './ui.js';
import {packArtUrl} from './pack-preview.js';
import {packEligible,setArtworkSources,setImageUrl} from './set-experience.js';
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
   const set=c.set?{code:c.set,name:c.set_name,set_type:c.set_type,digital:!!c.digital,count:null,logo:`https://svgs.scryfall.io/sets/${encodeURIComponent(c.set)}.svg`}:null;
   // Bonus sheets (Mystical Archive, Retro Artifacts…) come in their main set's boosters: today's pack is that one.
   if(set?.set_type==='masterpiece'&&!set.digital){const s=await fetchJson('https://api.scryfall.com/sets/'+encodeURIComponent(set.code)).catch(()=>null),parent=s?.parent_set_code&&await fetchJson('https://api.scryfall.com/sets/'+encodeURIComponent(s.parent_set_code)).catch(()=>null);
    if(parent?.code&&packEligible('mtg',parent))set.pack={code:parent.code,name:parent.name,set_type:parent.set_type,digital:!!parent.digital,released_at:parent.released_at||''};}
   return {image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||'',rarity:c.rarity||'',card:c,set};}
  if(g==='ygo'){const d=await fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(h.id)),c=d?.data?.[0];if(String(c?.id)!==String(h.id))throw Error('Different card');
   // Prefer a booster release it was printed in (so today's pack is real), else its first printing.
   const s=c.card_sets?.find(x=>packEligible('ygo',{name:x.set_name}))||c.card_sets?.[0];return {image:`img/ygo/${encodeURIComponent(h.id)}.jpg`,rarity:s?.set_rarity||'',printing:s?.set_code&&s?.set_rarity?`${s.set_code}::${s.set_rarity}`:'',set:s?{name:s.set_name,code:String(s.set_code||'').split('-')[0],count:null,logo:''}:null};}
  return null;
 })();
 job.catch(()=>resolved.delete(key));resolved.set(key,job);return job;
}
const setAction=(g,set)=>g==='mtg'?`data-act="set" data-code="${esc(set.code)}"`:g==='ygo'?`data-act="tSetByName" data-name="${esc(set.name)}"`:`data-act="tSet" data-id="${esc(set.id)}"`;
// One quiet line under the card's name: its set (tap for the set page) and the card's rarity there.
export function todaySetMarkup(g,set,{rarity=''}={}){
 if(!set)return '';
 return `<button class="today-set-name" ${setAction(g,set)}>${esc(set.name)}</button>${rarity?`<span class="today-rarity">${esc(rarity)}</span>`:''}`;
}
// The set's real booster pack as a tappable visual (opens today's pack); nothing when it has none.
// Sources, best first: the real pack (the worker tries TCGplayer, then the set's own product shot), then
// the set's provider art, then the Card of the Day itself wrapped as a foil pack. When even that fails the
// wrapper stays as an empty foil pack in the game's colours, never a grey box with clipped text.
export function todayPackMarkup(g,set,{cardImage=''}={}){
 const from=set?.pack||set;
 if(!from||!packEligible(g,from))return '';
 const real=packArtUrl(g,from),sources=[...new Set([real,...setArtworkSources(g,from),cardImage?setImageUrl(cardImage):''].filter(x=>x&&x!=='#').map(x=>safeHref(x)))];
 const generic=i=>i>0?' pack-generic':'';
 return `<span class="today-pack-actions"><button class="today-pack${sources.length?'':' pack-art-unavailable'}" data-act="homeTodayPack" data-game="${g}" aria-label="Open today’s ${esc(from.name)} pack"><span class="today-pack-wrap" aria-hidden="true"></span>${sources.length?`<img data-pack-art src="${esc(sources[0])}" data-sources="${esc(JSON.stringify(sources))}" data-real="${esc(sources[0]===safeHref(real)?'1':'')}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="const s=JSON.parse(this.dataset.sources),i=(+this.dataset.i||0)+1;if(s[i]){this.dataset.i=i;this.src=s[i];this.parentElement.classList.add('pack-generic')}else{this.hidden=true;this.parentElement.classList.add('pack-art-unavailable')}">`:''}<span class="pack-crimp-band top" aria-hidden="true"></span><span class="pack-crimp-band bottom" aria-hidden="true"></span></button></span>`;
}
