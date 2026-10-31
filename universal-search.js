// One search bar for the whole app. Everything here is local and instant: the
// app's own pages, the user's decks, sets, tournament decks, wiki topics and
// news already on the device. Cards still come from the card sources, and AI is
// only the last step, offered when nothing in the app answers the query.
import {esc} from './ui.js';

const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
// Words that say what kind of thing is wanted, not what it is called.
const HINTS={set:/\b(?:sets?|expansions?|edition|release|block)\b/,deck:/\b(?:decks?|lists?|archetypes?|builds?|commanders?)\b/,wiki:/\b(?:wiki|what is|whats|meaning|keyword|mechanic|rule)\b/,news:/\b(?:news|events?|announce\w*|spoilers?|tournaments?)\b/};
const FILLER=/\b(?:show|me|open|find|go|to|the|a|an|my|in|of|for|on|magic|mtg|pokemon|ptcg|yugioh|ygo|tcg|set|sets|deck|decks|list|lists|news|wiki|what|is|whats|please)\b/g;

export function parseQuery(q){
 const n=norm(q),hint=Object.keys(HINTS).find(k=>HINTS[k].test(n))||'';
 const core=n.replace(FILLER,' ').replace(/\s+/g,' ').trim()||n;
 return {raw:String(q||'').trim(),n,core,hint,words:core.split(' ').filter(Boolean)};
}
// 0 exact · 1 starts with · 2 a word starts with · 3 contains · 4 every word appears · null no match.
export function matchScore(text,P){
 const t=norm(text);if(!t||!P.core)return null;
 if(t===P.core||t===P.n)return 0;
 if(t.startsWith(P.core))return 1;
 if((' '+t).includes(' '+P.core))return 2;
 if(P.core.length>=3&&t.includes(P.core))return 3;
 if(P.words.length>1&&P.words.every(w=>w.length>1&&(' '+t).includes(' '+w)))return 4;
 return null;
}
const best=(fields,P)=>fields.reduce((m,f)=>{const s=matchScore(f,P);return s===null?m:m===null?s:Math.min(m,s);},null);

// App destinations, by what people call them.
export const APP_PAGES=[
 ['Collection','#collection','collection binder my cards owned inventory'],
 ['Wishlist','#collection/wishlist','wishlist wanted want list'],
 ['Collection value','#collection/value','value worth prices portfolio'],
 ['Binders','#collection/binders','binders binder pages'],
 ['Scan cards','#scan','scan scanner camera photo'],
 ['My decks','#decks','decks my decks deck list'],
 ['Deck ideas','#decks/ideas','ideas build from my cards suggestions'],
 ['Meta decks','#decks/inspiration','meta tournament top decks competitive'],
 ['Play','#play','play match quick play practice cpu game'],
 ['Planeswalk','planeswalk.html','planeswalk adventure roguelike run campaign'],
 ['Sets','#sets','sets expansions releases'],
 ['Wiki','#wiki','wiki glossary keywords mechanics'],
 ['Rules','#rules','rules comprehensive rules judge'],
 ['Community','#community','community friends profile share'],
 ['Settings','#settings','settings options account theme preferences sync'],
];

/**
 * sources: { pages, decks:[{title,sub,art,route}], sets:[{title,sub,icon,route}], meta:[{title,sub,art,act,data}],
 *            wiki:[{title,sub,route}], news:[{title,sub,url}] }
 * Returns sections in the order that best answers the query, each with at most `per` items.
 */
export function searchApp(q,sources={},{per=3}={}){
 const P=parseQuery(q);if(P.core.length<2)return {P,sections:[]};
 const pick=(list,fields,limit=per)=>(list||[]).map(x=>({x,s:best(fields(x),P)})).filter(r=>r.s!==null).sort((a,b)=>a.s-b.s||String(a.x.title).length-String(b.x.title).length).slice(0,limit);
 const pages=pick((sources.pages||APP_PAGES).map(([title,route,words])=>({title,route,words,kind:'page'})),x=>[x.title,...x.words.split(' ')],2).filter(r=>r.s<=2);
 const groups=[
  {id:'deck',label:'Your decks',rows:pick(sources.decks,x=>[x.title,x.sub])},
  {id:'set',label:'Sets',rows:pick(sources.sets,x=>[x.title,x.code])},
  {id:'meta',label:'Tournament decks',rows:pick(sources.meta,x=>[x.title,x.sub])},
  {id:'wiki',label:'Wiki',rows:pick(sources.wiki,x=>[x.title],2)},
  {id:'news',label:'News',rows:pick(sources.news,x=>[x.title,x.sub],2)},
  {id:'page',label:'Go to',rows:pages},
 ].filter(g=>g.rows.length);
 // The kind the query names comes first, then whichever group matched best.
 const want={set:'set',deck:'deck',wiki:'wiki',news:'news'}[P.hint];
 const rank=g=>(g.id===want||(want==='deck'&&g.id==='meta')?-10:0)+Math.min(...g.rows.map(r=>r.s));
 groups.sort((a,b)=>rank(a)-rank(b));
 return {P,sections:groups.map(g=>({id:g.id,label:g.label,items:g.rows.map(r=>({...r.x,kind:r.x.kind||g.id,score:r.s}))}))};
}

const ICON={deck:'▤',set:'◈',meta:'♛',wiki:'✦',news:'✉',page:'→'};
export function appResultRow(item,i){
 const art=item.art?`<img src="${esc(item.art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${ICON[item.kind]||'•'}'))">`:item.icon?`<img class="is-icon" src="${esc(item.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:esc(ICON[item.kind]||'•');
 return `<button type="button" role="option" aria-selected="false" id="home-app-${i}" data-home-item="${i}" class="home-app-row is-${esc(item.kind)}"><span class="home-app-art">${art}</span><span class="home-app-text"><b>${esc(item.title)}</b>${item.sub?`<small>${esc(item.sub)}</small>`:''}</span>${item.url?'<span class="home-app-out" aria-hidden="true">↗</span>':''}</button>`;
}
export function appSectionsMarkup(sections,offset=0){
 let i=offset;
 return sections.map(s=>`<div class="home-app-group" role="group" aria-label="${esc(s.label)}"><p class="home-app-label">${esc(s.label)}</p>${s.items.map(item=>appResultRow(item,i++)).join('')}</div>`).join('');
}
