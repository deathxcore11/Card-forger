import {aiOrb} from './ai-ui.js';
import {esc,usd,cardImage} from './ui.js';
import {presentationQuote} from './pricing-presentation.js';
import {nameDistance} from './scan-signals.js';

export const homeQueries={};
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function homeIntent(q){
 if(/^(?:how|why|when|can|could|should|which|what|where|does|do|is|are)\b/i.test(q)||/\b(?:build|explain|compare|recommend|help|finish my|my collection|my deck|ruling)\b/i.test(q))return 'ask';
 return 'cards';
}
export function rankHomeCards(cards,q,limit=7){
 const query=key(q),seen=new Set();
 return cards.filter(c=>c?.id&&c.name&&!c.pocket&&!seen.has(String(c.id))&&seen.add(String(c.id))).map(c=>{
  const n=key(c.name),distance=n===query?0:n.startsWith(query)?1:n.includes(query)?2:query.length>=5?3+nameDistance(n,query,3):99;
  return {c,distance};
 }).filter(x=>x.distance<=6).sort((a,b)=>a.distance-b.distance||a.c.name.localeCompare(b.c.name)).slice(0,limit).map(x=>x.c);
}
// Reuse the collection's middle-view lot layout and classes. These are read-only
// previews: a reference quote never becomes a saved-condition value.
export function homeResultRow(game,c,i){
 const quote=presentationQuote(game,c,game==='mtg'?'nonfoil':'reference'),value=quote.value;
 const set=game==='mtg'?[c.set_name||c.set,c.collector_number&&'#'+c.collector_number,c.rarity]:[c.set?.name||c.set?.id,c.set?.number&&'#'+c.set.number,c.rarity];
 const image=game==='mtg'?cardImage(c):c.image||c.imageLarge||'';
 return `<button type="button" role="option" aria-selected="false" id="home-result-${i}" data-home-pick="${i}" class="lot home-result"><span class="lot-art">${image?`<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'◇'}</span><span class="lot-info"><b class="lot-name">${esc(c.name)}</b><span class="lot-sub">${esc(set.filter(Boolean).join(' · ')||'Open for printing details')}</span></span><span class="lot-side"><b class="price">${value==null?'Price unavailable':usd(value)}</b><small>${value==null?'':esc(quote.label||'Reference quote')+' · USD'}</small></span></button>`;
}
export function homeSearchMarkup(game){return `<div class="home-search-wrap"><div class="home-search-pill"><span class="home-ai-label" id="home-search-label">Cards & answers</span><input id="homeQ" type="search" data-home-search="${game}" value="${esc(homeQueries[game]||'')}" placeholder="Find a card or ask a question…" maxlength="300" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="homeSearchResults" aria-label="Find cards or ask CardStashy" aria-describedby="home-search-label" autocomplete="off"><button class="home-search-submit" data-act="homeSearch" aria-label="Search cards">${searchEmblem()}</button><button class="home-ai-submit" data-act="homeAsk" aria-label="Ask CardStashy">${aiOrb()}</button></div></div>`;}

export function attachHomeSearch({game,lookup,open,submit}){
 let field=null,box=null,rows=[],active=-1,ticket=0,timer;
 const close=()=>{clearTimeout(timer);ticket++;box?.remove();box=null;active=-1;field?.setAttribute('aria-expanded','false');field?.removeAttribute('aria-activedescendant');};
 function position(){
  if(!box)return;if(!field?.isConnected||!field.getClientRects().length||game()!==field.dataset.homeSearch)return close();
  const r=field.closest('.home-search-pill').getBoundingClientRect(),v=window.visualViewport;
  const left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||innerWidth,h=v?.height||innerHeight,width=Math.min(r.width,w-20);
  const below=top+h-r.bottom-12,above=r.top-top-12,up=below<160&&above>below;
  Object.assign(box.style,{position:'fixed',left:Math.max(left+10,Math.min(r.left,left+w-width-10))+'px',width:width+'px',maxHeight:Math.max(90,Math.min(450,up?above:below))+'px',top:up?'auto':r.bottom+6+'px',bottom:up?innerHeight-r.top+6+'px':'auto'});
 }
 function show(cards,status){
  if(!field?.isConnected||document.activeElement!==field||game()!==field.dataset.homeSearch)return;
  rows=cards;active=-1;
  if(!box){box=document.createElement('div');box.id='homeSearchPopup';box.className='home-suggestions view-compact';box.setAttribute('role','region');box.setAttribute('aria-label','Matching cards');document.body.append(box);
   box.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
   box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-home-pick'))pick(Number(b.dataset.homePick));else{const q=field.value;close();submit(q,b.dataset.homeAction);}});
  }
  box.innerHTML=`<p class="home-result-status" role="status">${esc(status)}</p><div class="display-list" id="homeSearchResults" role="listbox" aria-label="Matching cards">${cards.map((c,i)=>homeResultRow(game(),c,i)).join('')}</div><div class="home-result-actions"><button type="button" class="home-catalogue-action" data-home-action="cards">${searchEmblem()}<span>View all matches</span></button><button type="button" class="home-assistant-action" data-home-action="ask">${aiOrb()}<span>Ask about this<small>CardStashy AI</small></span></button></div>`;
  field.setAttribute('aria-expanded','true');position();
 }
 function pick(i){const c=rows[i],g=field?.dataset.homeSearch;if(!c||game()!==g)return;close();open(g,c);}
 async function update(){
  const f=field,g=f?.dataset.homeSearch,q=f?.value.trim(),id=++ticket;
  if(!q||q.length<2)return close();
  show([],'Looking for matching cards…');
  try{const result=await lookup(g,q);if(id!==ticket||field!==f||f.value.trim()!==q||game()!==g)return;
   show(result.cards,result.corrected?'Similar names · choose the card you meant':result.cards.length?`${result.cards.length} matching cards`:result.error?'Card source unavailable. Try again or ask about this.':'No matching cards yet. Try a shorter name or ask about this.');
  }catch{if(id===ticket)show([],'Card source unavailable. Try again.');}
 }
 document.addEventListener('focusin',e=>{const f=e.target.closest?.('[data-home-search]');if(!f)return;close();field=f;update();});
 document.addEventListener('input',e=>{if(!e.target.matches?.('[data-home-search]'))return;field=e.target;homeQueries[field.dataset.homeSearch]=field.value;close();timer=setTimeout(update,220);});
 document.addEventListener('keydown',e=>{if(e.target!==field)return;if(e.key==='Escape'){e.preventDefault();close();}else if(['ArrowDown','ArrowUp'].includes(e.key)&&rows.length&&box){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;box.querySelectorAll('[data-home-pick]').forEach((n,i)=>{n.setAttribute('aria-selected',String(i===active));if(i===active)n.scrollIntoView({block:'nearest'});});field.setAttribute('aria-activedescendant','home-result-'+active);}else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();if(box&&active>=0)pick(active);else{const q=field.value;close();submit(q,'cards');}}},true);
 document.addEventListener('pointerdown',e=>{if(box&&!box.contains(e.target)&&!e.target.closest('[data-home-search]'))close();},{passive:true});
 document.addEventListener('focusout',()=>setTimeout(()=>{if(box&&!box.contains(document.activeElement)&&document.activeElement!==field)close();},150));
 if(typeof MutationObserver!=='undefined')new MutationObserver(()=>{if(box&&(!field?.isConnected||game()!==field.dataset.homeSearch))close();}).observe(document.querySelector('#content'),{childList:true});
 window.addEventListener('resize',position,{passive:true});window.addEventListener('scroll',position,{passive:true});window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
 return {close};
}

export const searchEmblem=()=>'<svg class="search-emblem" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 8H8a3 3 0 0 0-3 3v20a3 3 0 0 0 3 3h14" stroke-width="1.7" opacity=".55"/><rect x="11" y="4" width="20" height="28" rx="4" stroke-width="1.8"/><path d="M16 10h9M16 14h5" stroke-width="1.6" opacity=".65"/><circle cx="25" cy="24" r="7" fill="var(--surface,#191d26)" stroke-width="2.2"/><path d="m30.2 29.2 5.8 5.8" stroke-width="2.8"/></svg>';
// Keep one real input while moving between the immersive Home and desktop bar.
// Moving the existing node preserves typing, selection and pending suggestions.
export function placeGlobalSearch(game,view,desktop=globalThis.matchMedia?.('(min-width:1200px)').matches){
 const header=document.querySelector('#desktopSearch'),dock=document.querySelector('#homeSearchDock');if(!header?.append)return;
 let wrap=header.querySelector('.home-search-wrap')||dock?.querySelector('.home-search-wrap');
 if(wrap?.querySelector('input')?.dataset.homeSearch!==game){wrap?.remove();wrap=null;}
 if(!wrap){const holder=document.createElement('div');holder.innerHTML=homeSearchMarkup(game);wrap=holder.firstElementChild;}
 const target=desktop?header:view==='home'&&dock?dock:header;
 const field=wrap.querySelector('input'),focused=document.activeElement===field,start=field.selectionStart,end=field.selectionEnd;
 if(dock)for(const duplicate of [...dock.children])if(duplicate!==wrap)duplicate.remove();
 if(wrap.parentElement!==target){target.append(wrap);if(focused){field.focus({preventScroll:true});try{field.setSelectionRange(start,end);}catch{}}}
 header.hidden=!desktop;
}
