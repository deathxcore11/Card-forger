// Session-only matchup state and escaped presentation. The app owns every action,
// network request and shared sheet. Cards are rendered by the existing deck renderer.
import {esc,safeHref,segmented,manaCost} from './ui.js';
import {aiOrb} from './ai-ui.js';
import {deckBoxMarkup} from './deck-box.js';
import {viewControl} from './workbench-ui.js';
import {detailTabs,detailPanel} from './pricing-presentation.js';
const states=new Map();
export const matchupFingerprint=deck=>JSON.stringify({id:deck?.id,format:deck?.format,cards:deck?.cards||[],side:deck?.side||[],commander:deck?.commander||'',commanders:deck?.commanders||[]});
export function matchupState(deck){
 const id=String(deck?.id||'preview'),fingerprint=matchupFingerprint(deck),old=states.get(id);
 if(old?.fingerprint===fingerprint)return old;
 if(old){old.controller?.abort();old.active=false;old.revision++;}
 const state={fingerprint,revision:0,active:true,question:'',colors:[],selectionMode:'top',mode:'bo1',opponent:null,busy:false,error:'',result:null,request:null};
 states.set(id,state);if(states.size>40){const[key,value]=states.entries().next().value;value.controller?.abort();value.active=false;states.delete(key);}return state;
}
export function resetMatchups(){for(const s of states.values()){s.controller?.abort();s.active=false;s.revision++;}states.clear();}
const colorLabels={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
const count=rows=>(rows||[]).reduce((n,r)=>n+(Number(r.qty)||0),0);
const list=xs=>`<ul>${(xs||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const outlook={favorable:'Potential edge',balanced:'Closely matched',difficult:'Challenging matchup',uncertain:'Needs more context'};
const validResult=r=>r&&Array.isArray(r.scenarios)&&r.scenarios.length===3;
const modeOf=mode=>['gallery','compact','symbols'].includes(mode)?mode:'compact';
const privacy='Analyze sends both decklists and your question to the app’s AI provider. Shared beta AI usage limits apply. Your decks and collection stay unchanged.';
const disclaimer='Three hypothetical scenarios, not games played or a win-rate prediction. AI coaching can be wrong.';
export function matchupProvenance(opponent){
 if(!opponent)return '';
 const p=opponent.provenance||{},date=p.date||p.fetchedAt||'',source=p.source||(p.kind==='example'?'Illustrative archetype example':'Pasted opponent list'),url=imageURL(p.url);
 return `<p class="am-source small muted">${p.kind==='meta'?'Tournament-source list':p.kind==='example'?'Example, not a meta result':'Imported opponent'} · ${url?`<a href="${esc(safeHref(url))}" target="_blank" rel="noopener noreferrer">${esc(source)}</a>`:esc(source)}${date?` · ${esc(date.slice(0,10))}`:''}${p.stale?' · Cached, may be out of date':''}</p>`;
}
function status(s){return `${s.error?`<p class="note warn am-error" role="alert">${esc(s.error)}</p>`:''}${s.busy?`<div class="panel am-working" role="status">${aiOrb()}<div><b>${esc(s.message||s.msg||'Preparing your matchup…')}</b><p class="small muted">Nothing is saved or changed.</p></div><button class="btn ghost small" data-act="amCancel">Cancel</button></div>`:''}`;}
function deckLink(deck,label,side,format){
 const art=imageURL(deck.art||deck.image||''),rows=deck.cards||deck.main||[];
 return `<button class="mini-row art-row am-deck-link" data-act="amOpen" data-tab="decks" data-side="${side}">${deckBoxMarkup({...deck,id:deck.id||'matchup-'+side},{images:art?[art]:[]})}<span><small class="muted">${esc(label)}</small><b>${esc(deck.name||label)}</b><small class="muted">${esc(format)} · ${count(rows)} cards${deck.side?.length?` · ${count(deck.side)} sideboard`:''}</small></span></button>`;
}
// The deck's existing art hero already surrounds this tab. This is only a compact
// invitation/status panel; setup, long decklists and analysis belong in the shared sheet.
export function renderMagicMatchups(deck){
 const s=matchupState(deck),ready=validResult(s.result);
 return `<section class="panel am-root am-main"><header class="am-header">${aiOrb()}<div><p class="eyebrow">Magic · Free beta</p><h3>AI Matchups</h3><p class="small muted">Choose an opponent, then explore a plan.</p></div></header>${status(s)}
 ${s.opponent?`<div class="am-deck-links">${deckLink(deck,'Your deck','player',deck.format)}${deckLink(s.opponent,'Opponent','opponent',deck.format)}</div>`:''}
 ${ready?`<p class="am-summary"><b>${esc(outlook[s.result.outlook]||outlook.uncertain)}</b> · ${esc(s.result.confidence||'limited')} evidence</p>`:''}
 <div class="actions wrap"><button class="btn${s.opponent?' ghost':''} small" data-act="amOpen" data-tab="setup">${s.opponent?'Change matchup':'Set up matchup'}</button>${s.opponent?`<button class="btn small" data-act="amOpen" data-tab="analysis">${ready?'Open analysis':s.busy?'View progress':'Review & analyze'}</button>`:''}</div>
 <p class="foot">${ready?disclaimer:'Preview first. Nothing is sent until you choose Analyze.'}</p></section>`;
}
function setup(deck,s){return `<fieldset class="am-controls"${s.busy?' disabled':''}><legend class="sr-only">Set up the matchup</legend>
 <label class="am-question">Ask about an opponent<input id="amQuestion" data-input="amQuestion" maxlength="500" value="${esc(s.question)}" placeholder="How would this do against red?" autocomplete="off"></label>
 <div class="am-color-choices" role="group" aria-label="Opponent colors">${Object.entries(colorLabels).map(([c,label])=>`<button class="chip pick${s.colors.includes(c)?' on':''}" data-act="amColor" data-id="${c}" aria-pressed="${s.colors.includes(c)}">${manaCost({mana_cost:'{'+c+'}'})}<span>${label}</span></button>`).join('')}</div>
 <div class="am-setting"><span class="small muted">Opponent source</span>${segmented('amSelection',s.selectionMode,[['top','Top available'],['random','Random available']])}</div>
 <div class="am-setting"><span class="small muted">Match structure</span>${segmented('amMode',s.mode,[['bo1','Best of one'],['bo3','Best of three']])}</div>
 <div class="actions wrap"><button class="btn" data-act="amSelect">Find opponent</button><button class="btn ghost" data-act="amPaste">Paste deck</button></div></fieldset>
 <details class="group am-source-help"><summary>How opponents are selected</summary><p class="small muted">Matches your ${esc(deck.format||'chosen')} format. “Top” means the highest-ranked matching list in the loaded source sample, not the best deck everywhere. You can preview both lists before analysis.</p></details>`;}
export function renderMagicMatchupDeckPreview(deck,{view='compact',renderCards}={}){
 const mode=modeOf(view);
 return `<div class="am-card-browser view-${mode}"><div class="row between"><p class="small muted">Read-only preview</p>${viewControl('mtg','matchups',{mode,action:'amView'})}</div>${typeof renderCards==='function'?renderCards(deck):'<p class="note warn">Card preview is unavailable. Reopen this matchup.</p>'}</div>`;
}
function decks(deck,s,opts){
 const side=opts.side==='opponent'?'opponent':'player',chosen=side==='opponent'?s.opponent:deck;
 return `<div class="am-decks">${segmented('amDeck',side,[['player','Your deck'],['opponent','Opponent']])}${chosen?`<h3>${esc(chosen.name||'Opponent')}</h3><p class="small muted">${esc(deck.format)} · ${count(chosen.cards||chosen.main)} main-deck cards${chosen.side?.length?` · ${count(chosen.side)} sideboard cards`:''}</p>${side==='opponent'?matchupProvenance(chosen):''}${s.sampleCount&&side==='opponent'?`<p class="small muted">Selected from ${esc(s.sampleCount)} loaded lists.</p>`:''}${renderMagicMatchupDeckPreview(chosen,opts)}`:'<p class="muted">Choose or paste an opponent in Setup first.</p>'}</div>`;
}
function referencedRows(ids,request){
 const map=new Map([...(request?.player?.cards||[]),...(request?.opponent?.cards||[]),...(request?.candidates||[])].map(c=>[c.id,c]));
 return [...new Map((ids||[]).map(id=>map.get(id)).filter(Boolean).map(c=>[c.name,{name:c.name,qty:c.qty||1}])).values()];
}
function references(ids,deck,s,opts){
 const cards=referencedRows(ids,s.request);if(!cards.length)return '';
 return `<details class="group am-references"><summary>Explore ${cards.length} referenced ${cards.length===1?'card':'cards'}</summary>${renderMagicMatchupDeckPreview({id:'matchup-references',name:'Referenced cards',format:deck.format,cards,side:[]},opts)}</details>`;
}
function analysis(deck,s,opts){
 const r=s.result,ready=validResult(r),i=Math.max(0,Math.min(2,Number(opts.scenario)||0));
 const start=s.opponent?`<div class="am-run"><p class="foot">${privacy}</p><button class="btn" data-act="amAnalyze"${s.busy?' disabled':''}>${ready?'Analyze again':'Analyze matchup'}</button></div>`:'<p class="muted">Choose and preview an opponent in Setup before analyzing.</p>';
 if(!ready)return `${s.opponent?`<h3>${esc(deck.name)} vs ${esc(s.opponent.name||'Opponent')}</h3>${matchupProvenance(s.opponent)}<button class="btn ghost small" data-act="amTab" data-tab="decks">Preview both decks</button>`:''}${s.request?.warnings?.length?`<details class="group" open><summary>Check before analyzing</summary>${list(s.request.warnings)}</details>`:''}<p class="small muted">${disclaimer}</p>${start}`;
 const scenario=r.scenarios[i],rec=r.recommendation,recNames=rec?referencedRows([rec.cutId,rec.addId],s.request):[];
 return `<div class="am-result"><header class="row between"><h3>${esc(outlook[r.outlook]||outlook.uncertain)}</h3><span class="chip">${esc(r.confidence||'limited')} evidence</span></header><p class="small muted">${disclaimer}</p>
 <details class="group am-overview"><summary>Matchup overview</summary><p>${esc(r.summary)}</p></details>
 <div class="am-scenario-choice" aria-label="Hypothetical scenarios">${segmented('amScenario',String(i),r.scenarios.map((x,n)=>[String(n),`${n+1}. ${esc(x.title)}`]))}</div>
 <section class="am-scenario" aria-label="${esc(scenario.title)}"><h3>${esc(scenario.title)}</h3>${[['Assume',scenario.setup],['Your plan',scenario.plan],['What can go wrong',scenario.risk],['Takeaway',scenario.lesson]].map(([label,text])=>`<details class="group"${label==='Your plan'?' open':''}><summary>${label}</summary><p>${esc(text)}</p></details>`).join('')}${references(scenario.cardIds,deck,s,opts)}</section>
 <details class="group am-coaching"><summary>How to pilot this matchup</summary>${(r.coaching||[]).map(c=>`<section><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p>${references(c.cardIds,deck,s,opts)}</section>`).join('')}</details>
 ${rec&&recNames.length===2?`<details class="group am-coaching"><summary>One change to consider</summary><p>${esc(rec.qty)} × ${esc(recNames[0].name)} → ${esc(recNames[1].name)}</p><p>${esc(rec.reason)}</p><p class="small muted">Tradeoff: ${esc(rec.tradeoff)}</p>${references([rec.cutId,rec.addId],deck,s,opts)}<p class="small muted">Suggestion only. Your deck and collection have not changed.</p></details>`:''}
 <details class="group am-coaching"><summary>Sources, assumptions & limitations</summary>${matchupProvenance(s.opponent)}${list(s.request?.warnings)}${list(r.assumptions)}${list(r.limitations)}<p class="small muted">${esc(r.disclaimer||disclaimer)}</p>${r.generatedAt?`<p class="small muted">Generated ${esc(r.generatedAt.slice(0,10))}</p>`:''}</details>
 <details class="group am-rerun"><summary>Analyze again</summary>${start}</details></div>`;
}
export function renderMagicMatchupSheet(deck,opts={}){
 const s=matchupState(deck),tab=['setup','decks','analysis'].includes(opts.tab)?opts.tab:'setup',tabs=[['setup','Setup'],['decks','Decks'],['analysis','Analysis']],config={prefix:'matchup',action:'amTab',label:'Matchup details'};
 return `<div class="sheet-head"><h2>AI Matchups</h2><button class="icon" data-act="closeSheet" aria-label="Close matchup">✕</button></div><div class="am-sheet"><p class="small muted">${esc(deck.name)} · ${esc(deck.format)}</p>${detailTabs(tab,tabs,config)}${status(s)}${detailPanel('setup',tab,setup(deck,s),config)}${detailPanel('decks',tab,decks(deck,s,opts),config)}${detailPanel('analysis',tab,analysis(deck,s,opts),config)}</div>`;
}
