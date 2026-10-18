// Session-only matchup state and escaped presentation. Controllers own all network/actions.
import { esc, safeHref } from './ui.js';
import { aiOrb } from './ai-ui.js';
const states = new Map();
export const matchupFingerprint = deck => JSON.stringify({id:deck?.id,format:deck?.format,cards:deck?.cards || [],side:deck?.side || [],commander:deck?.commander || '',commanders:deck?.commanders || []});
export function matchupState(deck) {
  const id=String(deck?.id || 'preview'),fingerprint=matchupFingerprint(deck),old=states.get(id);
  if(old?.fingerprint===fingerprint)return old;
  if(old){old.controller?.abort();old.active=false;old.revision++;}
  const state={fingerprint,revision:0,active:true,question:'',colors:[],selectionMode:'top',mode:'bo1',opponent:null,busy:false,error:'',result:null,request:null};
  states.set(id,state);
  if(states.size>40){const [key,value]=states.entries().next().value;value.controller?.abort();value.active=false;states.delete(key);}
  return state;
}
export function resetMatchups(){for(const s of states.values()){s.controller?.abort();s.active=false;s.revision++;}states.clear();}
const colorLabels={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
const colorSymbols={W:'☀',U:'◉',B:'☽',R:'◆',G:'♣'};
const count=rows=>(rows || []).reduce((n,r)=>n+(Number(r.qty)||0),0);
const list=xs=>`<ul>${(xs || []).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function deckPreview(deck,label,format){
  const rows=[...(deck.cards || deck.main || [])],side=deck.side || [],art=imageURL(deck.art || deck.image || '');
  for(const leader of [...(deck.commanders || []).map(r=>typeof r==='string'?{name:r,qty:1}:r),...(deck.commander?[{name:deck.commander,qty:1}]:[])]) if(!rows.some(r=>r.name===leader.name))rows.push(leader);
  return `<section class="am-deck">${art?`<img class="am-deck-art" src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="am-deck-mark" aria-hidden="true">▱</span>'}<div class="am-deck-heading"><span class="eyebrow">${esc(label)}</span><h3>${esc(deck.name || label)}</h3><p class="small muted">${esc(format)} · ${count(rows)} cards${side.length?` · ${count(side)} sideboard`:''}</p></div><details class="am-deck-list"><summary>Preview decklist</summary>${deck.commander?`<p class="small">Commander: ${esc(deck.commander)}</p>`:''}${list(rows.map(r=>`${r.qty} × ${r.name}`))}${side.length?`<h4>Sideboard</h4>${list(side.map(r=>`${r.qty} × ${r.name}`))}`:''}</details></section>`;
}
function provenanceHTML(opponent){
  const p=opponent.provenance || {},date=p.date || p.fetchedAt || '',source=p.source || (p.kind==='example'?'Illustrative archetype example':'Pasted opponent list'),url=imageURL(p.url);
  return `<p class="am-source small muted">${p.kind==='meta'?'Tournament-source list':p.kind==='example'?'Example, not a meta result':'Imported opponent'} · ${url?`<a href="${esc(safeHref(url))}" target="_blank" rel="noopener noreferrer">${esc(source)}</a>`:esc(source)}${date?` · ${esc(date.slice(0,10))}`:''}${p.stale?' · Cached, may be out of date':''}</p>`;
}
function cardsFor(ids,request){
  const map=new Map([...(request?.player?.cards || []),...(request?.opponent?.cards || []),...(request?.candidates || [])].map(c=>[c.id,c]));
  return (ids || []).map(id=>map.get(id)?.name).filter(Boolean);
}
function resultHTML(result,request){
  if(!result || !Array.isArray(result.scenarios) || result.scenarios.length!==3)return '';
  const labels={favorable:'Potential edge',balanced:'Closely matched',difficult:'Challenging matchup',uncertain:'Needs more context'};
  const refs=ids=>{const names=cardsFor(ids,request);return names.length?`<p class="am-card-refs small">${names.map(n=>`<span>${esc(n)}</span>`).join('')}</p>`:'';};
  const r=result.recommendation,names=r?cardsFor([r.cutId,r.addId],request):[];
  return `<section class="panel am-result" aria-live="polite"><div class="am-result-top"><p class="eyebrow">Matchup outlook</p><span class="am-confidence">${esc(result.confidence || 'limited')} evidence</span></div><h3>${esc(labels[result.outlook] || labels.uncertain)}</h3><p class="am-summary">${esc(result.summary)}</p><p class="small muted">Three illustrative scenarios. Not games played, a win-rate prediction, or a guaranteed outcome.</p></section>
  <div class="am-scenarios">${result.scenarios.map((s,i)=>`<details class="panel am-scenario"><summary><span class="am-scenario-number">${i+1}</span><span><b>${esc(s.title)}</b><small>Hypothetical scenario</small></span><span class="am-chevron" aria-hidden="true">⌄</span></summary><div class="am-detail"><p><b>Assume:</b> ${esc(s.setup)}</p><p><b>Your plan:</b> ${esc(s.plan)}</p><p><b>What can go wrong:</b> ${esc(s.risk)}</p><p><b>Takeaway:</b> ${esc(s.lesson)}</p>${refs(s.cardIds)}</div></details>`).join('')}</div>
  <details class="panel am-coaching" open><summary>How to pilot this matchup</summary>${(result.coaching || []).map(c=>`<section class="am-coach-item"><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p>${refs(c.cardIds)}</section>`).join('')}</details>
  ${r&&names.length===2?`<details class="panel am-coaching"><summary>One change to consider</summary><p>${esc(r.qty)} × ${esc(names[0])} → ${esc(names[1])}</p><p>${esc(r.reason)}</p><p class="small muted">Tradeoff: ${esc(r.tradeoff)}</p><p class="small muted">Suggestion only. Your deck and collection have not changed.</p></details>`:''}
  <details class="panel am-coaching"><summary>Assumptions & limitations</summary>${list(result.assumptions)}${list(result.limitations)}<p class="small muted">${esc(result.disclaimer || 'AI coaching can be wrong. Check precise interactions against the rules.')}</p>${result.generatedAt?`<p class="small muted">Generated ${esc(result.generatedAt.slice(0,10))}</p>`:''}</details>`;
}
export function renderMagicMatchups(deck){
  const s=matchupState(deck),disabled=s.busy?' disabled':'',format=deck.format || 'Choose a format';
  return `<div class="am-root"><section class="panel am-picker"><header class="am-header">${aiOrb()}<div><p class="eyebrow">Magic · Free beta</p><h2>AI Matchups</h2><p class="muted small">Choose an opponent. Preview both lists. Get a plan for three possible situations.</p></div></header>
  <label class="am-question">Ask about an opponent<input id="amQuestion" data-input="amQuestion" maxlength="500" value="${esc(s.question)}" placeholder="How would this do against red?" autocomplete="off"${disabled}></label>
  <div class="am-pill-row" role="group" aria-label="Opponent colors">${Object.entries(colorLabels).map(([c,label])=>`<button type="button" class="am-pill am-color am-${c}${s.colors.includes(c)?' on':''}" data-act="amColor" data-id="${c}" aria-pressed="${s.colors.includes(c)}"${disabled}><span class="am-color-icon" aria-hidden="true">${colorSymbols[c]}</span>${label}</button>`).join('')}</div>
  <div class="am-pill-row" role="group" aria-label="Choose opponent"><button type="button" class="am-pill${s.selectionMode==='top'?' on':''}" data-act="amSelection" data-id="top" aria-pressed="${s.selectionMode==='top'}"${disabled}>✦ Top available</button><button type="button" class="am-pill${s.selectionMode==='random'?' on':''}" data-act="amSelection" data-id="random" aria-pressed="${s.selectionMode==='random'}"${disabled}>⤨ Random available</button><button type="button" class="am-pill" data-act="amPaste"${disabled}>▱ Paste deck</button></div>
  <div class="am-picker-footer"><div class="am-pill-row" role="group" aria-label="Match structure"><button type="button" class="am-pill small${s.mode==='bo1'?' on':''}" data-act="amMode" data-id="bo1" aria-pressed="${s.mode==='bo1'}"${disabled}>Best of one</button><button type="button" class="am-pill small${s.mode==='bo3'?' on':''}" data-act="amMode" data-id="bo3" aria-pressed="${s.mode==='bo3'}"${disabled}>Best of three</button></div><button type="button" class="btn" data-act="amSelect"${disabled}>Find opponent →</button></div><p class="am-help small muted">Matches your ${esc(format)} format. “Top” means the highest-ranked matching list in the loaded source sample, not the best deck everywhere.</p></section>
  ${s.error?`<p class="note warn am-error" role="alert">${esc(s.error)}</p>`:''}
  ${s.busy?`<section class="panel am-working" role="status">${aiOrb()}<div><b>${esc(s.message || s.msg || 'Preparing your matchup…')}</b><p class="small muted">No deck or collection changes are made.</p></div><button type="button" class="btn ghost small" data-act="amCancel">Cancel</button></section>`:''}
  ${s.opponent?`<section class="am-preview" aria-label="Preview matchup"><div class="am-versus">${deckPreview(deck,'Your deck',format)}<span class="am-vs" aria-hidden="true">VS</span>${deckPreview(s.opponent,'Opponent',format)}</div>${provenanceHTML(s.opponent)}${s.sampleCount?`<p class="small muted">Selected from ${esc(s.sampleCount)} loaded lists.</p>`:''}${s.request?.warnings?.length?`<details class="panel am-coaching" open><summary>Check before analyzing</summary>${list(s.request.warnings)}</details>`:''}<div class="am-run"><p class="small muted">Starting sends both decklists and your question to the app’s AI provider. Three hypothetical scenarios, not simulated games. Shared beta AI usage limits apply.</p><button type="button" class="btn" data-act="amAnalyze"${disabled}>Analyze matchup ✦</button></div></section>`:''}
  ${resultHTML(s.result,s.request)}</div>`;
}
