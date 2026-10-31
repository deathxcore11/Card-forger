import {esc} from './ui.js';
import {RULE_DEX,ruleTerms,ruleText,ruleDexPanel,ruleCardContext} from './rule-dex.js';
import {LESSONS,TURN_STEPS,RULE_CHECKS,CORE_RULES,BEGINNER_START} from './rule-lessons.js';
import {RULE_SOURCES,normalizeRuleId,lessonReference,entryReference,resolveRuleReference,sourceDestination,searchRulebook,visibleRulePassage} from './rule-reference.js';
import {loadRulePack} from './rule-corpus.js';
import {rulesAskPanel} from './ai-rules-panel.js';
import {mechanicCardMatches} from './deck-mechanic-plan.js';
export {lessonMatches,searchRulebook} from './rule-reference.js';
const names={mtg:'Magic',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'};
const sourceLink=(source,page)=>{const d=sourceDestination(source,page);return `<a class="link small" data-source-kind="${d.kind}" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.label)}</a>`;};
function sourceLinks(g){return RULE_SOURCES[g].map(s=>`<div class="rule-document"><div><b>${esc(s.title)}</b><small>${esc(s.organization)} · ${esc(s.date)}${s.legacy?' · older reference':''}</small></div>${sourceLink(s)}${s.kind==='pdf'?`<a class="link small" href="${esc(s.fallbackUrl)}" target="_blank" rel="noopener noreferrer">Official page if the PDF is unavailable</a>`:''}</div>`).join('');}
export function ruleReferenceButton(reference,label){return reference?`<button type="button" class="link small rule-source-action" data-rule-reference="${esc(JSON.stringify(reference))}" data-rule-find="${esc(reference.label||reference.entryId||reference.key)}">${esc(label||'Read the source · '+(reference.label||reference.entryId))} →</button>`:'';}
const refButton=(g,ref)=>ruleReferenceButton(lessonReference(g,ref));
function turnBody(g,index){const step=TURN_STEPS[g][index];return `<p class="eyebrow">Step ${index+1} of ${TURN_STEPS[g].length}</p><h3 tabindex="-1" data-turn-heading>${esc(step[0])}</h3><p>${esc(step[1])}</p><details class="learn-turn-tip"><summary>What to watch for</summary><p>${esc(step[2])}</p></details>${refButton(g,step[3])}`;}
function legacyNotice(g){return g==='ygo'?`<p class="note small">The bundled books are older references: version 10 and the 2017 guide. Later official updates take precedence. ${refButton(g,'2021 Rules Update')}</p>`:'';}
export function interactiveRules(g,context={}){
 if(!LESSONS[g])return '';
 const intro=BEGINNER_START[g],format=typeof context.format==='string'?context.format:'';
 return `<section class="rule-learning" data-learning-root data-game="${g}" data-rule-format="${esc(format)}">
 <div data-learning-home>
  <section class="panel learn-welcome"><p class="eyebrow">Learn ${esc(names[g])} · one step at a time</p><h3>${esc(intro.title)}</h3><p class="learn-overview">${esc(intro.overview)}</p><ol class="learn-story" aria-label="The basic rhythm">${intro.path.map((p,i)=>`<li><span aria-hidden="true">${i+1}</span>${esc(p)}</li>`).join('')}</ol><div class="learn-example"><span class="eyebrow">Picture your first turn</span><p>${esc(intro.example)}</p></div><button type="button" class="btn" data-learn-start>Try a turn →</button><p class="foot">${esc(intro.goal)}</p></section>
  ${rulesAskPanel({game:g,format})}
  <nav class="learn-nav" aria-label="Learning shortcuts"><button type="button" class="btn ghost small" data-rule-load>Open searchable rulebook</button></nav>
  <details class="panel learn-turn learn-disclosure" data-learn-turn><summary><b>Try a turn</b><small>Six steps, with the details when you need them</small></summary><div class="learn-step-rail" aria-label="Turn steps">${TURN_STEPS[g].map((s,i)=>`<button type="button" class="chip pick ${i===0?'on':''}" aria-pressed="${i===0}" data-learn-step="${i}">${i+1}. ${esc(s[0])}</button>`).join('')}</div><div class="learn-turn-body" aria-live="polite">${turnBody(g,0)}</div><div class="row between"><button type="button" class="btn ghost small" data-learn-move="-1" disabled>Previous step</button><button type="button" class="btn ghost small" data-learn-move="1">Next step</button></div></details>
  <details class="panel learn-disclosure" data-learn-basics><summary><b>The essentials</b><small>Setup, winning and the rules you use most</small></summary><div class="learn-topics">${CORE_RULES[g].map(([title,text])=>`<details><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join('')}</div></details>
  <details class="panel learn-disclosure" data-learn-section="topics"><summary><b>Explore a situation</b><small>${LESSONS[g].length} topics, each with a concrete example</small></summary><label class="learn-search">Find a topic or keyword<input type="search" data-learn-search placeholder="Try timing, Energy, targets…" autocomplete="off"></label><p class="small muted" data-learn-count aria-live="polite">${LESSONS[g].length} topics</p><div class="learn-topic-grid">${LESSONS[g].map((t,i)=>`<details class="learn-topic" data-learn-topic="${i}" data-search="${esc(Object.values(t).join(' ').toLowerCase())}"><summary><b>${esc(t.title)}</b><small>${esc(t.summary)}</small></summary><div class="learn-example"><p>${esc(t.example)}</p></div><p>${ruleText(g,t.detail)}</p>${refButton(g,t.ref)}</details>`).join('')}</div><p class="muted small" data-learn-empty hidden>No matching topics. Try a shorter term or the full rulebook.</p><div class="learn-keywords">${Object.entries(ruleTerms(g)).map(([key,r])=>`<button type="button" class="chip" data-act="ruleHint" data-game="${g}" data-rule="${esc(key)}" data-learn-keyword data-search="${esc((key+' '+r.definition).toLowerCase())}">${esc(r.label)}</button>`).join('')}</div></details>
  <details class="panel learn-disclosure" data-learn-practice><summary><b>Try a decision</b><small>Four quick situations. Learn from either answer.</small></summary><div class="rule-check-grid">${RULE_CHECKS[g].map((q,i)=>`<section class="rule-check" data-rule-check="${i}"><h4>${esc(q.q)}</h4><div class="row wrap"><button type="button" class="btn ghost small" data-rule-answer="yes" aria-pressed="false">Yes</button><button type="button" class="btn ghost small" data-rule-answer="no" aria-pressed="false">No</button></div><div class="rule-check-answer" role="status" hidden></div></section>`).join('')}</div></details>
  <details class="panel learn-disclosure" data-learn-glossary><summary><b>Keywords & deck concepts</b><small>Mechanics, community terminology and their exact sources</small></summary>${ruleDexPanel(g)}</details>
  <p class="foot learn-context">${format?'Deck format: '+esc(format):'Format not selected'} · Plain-language teaching, not an official tournament ruling.</p>
 </div>
 <section class="panel rule-library" data-learning-library hidden><button type="button" class="btn ghost small" data-rule-home>← Back to learning</button><p class="eyebrow">Reference</p><h3 tabindex="-1" data-library-heading>Search the official books</h3><p class="small muted">Complete dated text from the supplied books. The PDFs preserve diagrams and can be saved from your browser. Later rules and errata take precedence; a bundled edition is not a live update service.</p>${legacyNotice(g)}<p class="small muted" data-rule-notice role="status"></p><button type="button" class="btn ghost small" data-rule-book-retry hidden>Retry download</button><div data-rule-browser hidden><div class="row between"><p class="small muted">Search only when you want to type.</p><button type="button" class="btn ghost small" data-rule-type>Type a search</button></div><label class="learn-search">Search text or rule number<input type="search" data-rule-search placeholder="${g==='mtg'?'Try 903.8, ward, combat damage':g==='ptcg'?'Try evolution, Energy, Checkup…':'Try Special Summon, Spell Speed…'}" autocomplete="off"></label><div class="learn-book-filters" data-rule-docs aria-label="Rulebooks"></div>${g==='mtg'?`<details class="learn-chapters"><summary>Browse a chapter</summary><div class="learn-book-filters" data-rule-chapters aria-label="Rules chapters">${[['','All chapters'],['1','Game concepts'],['2','Parts of a card'],['3','Card types'],['4','Zones'],['5','Turn structure'],['6','Spells & abilities'],['7','Additional rules'],['8','Multiplayer'],['9','Casual & Commander'],['Glossary','Glossary']].map(([id,label])=>`<button type="button" class="chip pick ${!id?'on':''}" data-rule-chapter="${id}" aria-pressed="${!id}">${label}</button>`).join('')}</div></details>`:''}<p class="foot" data-rule-result-count aria-live="polite"></p><div class="rules-list" data-rule-results></div><button type="button" class="btn ghost small" data-rule-more hidden>Show more rules</button></div><details class="rule-documents" open><summary>Official documents & downloads</summary><div data-rule-sources>${sourceLinks(g)}</div></details></section>
 <section class="panel rule-destination" data-rule-destination aria-label="Selected rule source" hidden></section>
 </section>`;
}
export function cardRuleHelp(g,card){
 const context=ruleCardContext(g,card),text=context.text.toLowerCase();
 const terms=Object.entries(ruleTerms(g)).filter(([key])=>text.includes(key.toLowerCase())).slice(0,12);
 if(g==='mtg')for(const id of ['bloodlust','bloodthirst'])if(!terms.some(([key])=>key.toLowerCase()===id)&&mechanicCardMatches(card,[id]))terms.push([id,ruleTerms(g)[id]]);
 return `<section class="guide-sec card-rule-help" data-rule-card-context="${esc(JSON.stringify(context))}"><h3>Explore the rules</h3><div class="row wrap">${terms.map(([key,r])=>`<button type="button" class="chip" data-act="ruleHint" data-game="${g}" data-rule="${esc(key)}">${esc(r.label)}</button>`).join('')}<button type="button" class="btn ghost small" data-act="learnGame" data-game="${g}">Rules & how to play →</button></div></section>`;
}
const states=new WeakMap(),attached=new WeakSet(),handledEvents=new WeakSet();
function stateFor(root){if(!states.has(root))states.set(root,{game:root.dataset.game,view:'home',seq:0,history:[],pack:null,query:'',doc:'',chapter:'',limit:25});return states.get(root);}
function showView(root,state,view){state.view=view;root.querySelector('[data-learning-home]').hidden=view!=='home';root.querySelector('[data-learning-library]').hidden=view!=='library';root.querySelector('[data-rule-destination]').hidden=view!=='source';}
function reveal(node){node?.focus?.({preventScroll:true});node?.scrollIntoView?.({block:'start',behavior:'auto'});}
function scrollSnapshot(root){const rows=[];for(let n=root;n;n=n.parentElement)rows.push([n,n.scrollTop,n.scrollLeft]);const page=root.ownerDocument?.scrollingElement;if(page&&!rows.some(([n])=>n===page))rows.push([page,page.scrollTop,page.scrollLeft]);return rows;}
function rememberView(root,state,trigger){return {view:state.view,trigger,scroll:scrollSnapshot(root),html:state.view==='source'?root.querySelector('[data-rule-destination]').innerHTML:null,reference:state.reference,status:state.referenceStatus};}
function sourceFrame(title,body){return `<button type="button" class="btn ghost small" data-rule-back>← Back to explanation</button><p class="eyebrow">Rule source</p><h3 tabindex="-1" data-rule-heading>${esc(title)}</h3>${body}`;}
function ruleEntryText(text,g){
 if(g!=='mtg')return esc(text);
 return String(text).split(/(\b\d{3}\.\d+[a-z]?\b)/g).map((part,i)=>i%2?ruleReferenceButton(entryReference(g,part),part):esc(part)).join('');
}
function referenceBody(result){
 if(result.reference.kind==='official-page'){
  const r=result.reference;return `<p class="small muted">${esc(r.organization)} · ${esc(r.date)} · official web page</p><p>${esc(r.summary)}</p><a class="btn ghost" data-source-kind="official-page" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Read the official explanation</a><p class="foot">${esc(r.verified)} This opens the original page, not an indexed PDF section.</p>`;
 }
 const {source,entry,entries}=result;
 return `<p class="small muted">${esc(source.organization)} · ${esc(source.date)}${entry.title === source.title + " · PDF page " + entry.page ? "" : " · " + esc(source.title) + " · PDF page " + entry.page}</p>${source.legacy?'<p class="note small">Legacy edition. Later official updates and current card rulings take precedence.</p>':''}<div class="rule-passages">${entries.map(e=>{const passage=visibleRulePassage(result.reference.game,e);return `<section data-rule-entry="${esc(e.id)}"><p class="rule-source-text">${ruleEntryText(passage.text,result.reference.game)}</p>${passage.fullText?`<details><summary>Full extracted page, including diagram labels</summary><p class="rule-source-text">${esc(passage.fullText)}</p></details>`:''}</section>`;}).join('')}</div><div class="rule-source-footer">${sourceLink(source,entry.page)}${source.kind==='pdf'?`<a class="link small" href="${esc(source.fallbackUrl)}" target="_blank" rel="noopener noreferrer">Official source page</a>`:'<p class="foot">This source link opens the official rules page, not a direct PDF page.</p>'}<p class="foot">${esc(source.verification)} Text extraction can omit symbols and diagrams; consult the original document when those matter.</p>${result.reference.game==='ygo'?refButton('ygo','2021 Rules Update'):''}</div>`;
}
// Shared entry point for exact citations, including future grounded Judge citations.
// It never writes a query or focuses an editable element.
export async function openRuleReference(root,reference,{trigger=null,retry=false,load=loadRulePack}={}){
 const state=stateFor(root),g=root.dataset.game;if(!reference||reference.game!==g)return false;
 if(!retry&&(state.view!=='source'||state.referenceStatus==='ready'))state.history.push(rememberView(root,state,trigger));
 state.reference=reference;state.referenceStatus='loading';const seq=++state.seq;
 showView(root,state,'source');const panel=root.querySelector('[data-rule-destination]');
 panel.innerHTML=sourceFrame(reference.label||reference.entryId||'Selected rule','<p class="small muted" role="status">Opening the exact source…</p>');panel.setAttribute('aria-busy','true');reveal(panel.querySelector('[data-rule-heading]'));
 const current=()=>root.isConnected!==false&&root.dataset.game===g&&state.seq===seq&&state.view==='source';
 try{
  const pack=reference.kind==='bundled-entry'?await load(g):null;if(!current())return false;
  const result=resolveRuleReference(pack,reference);if(!result)throw Error('This exact reference is not available in the selected edition. Use the official documents below, or retry.');
  if(pack)state.pack=pack;state.referenceStatus='ready';panel.innerHTML=sourceFrame(result.reference.kind==='official-page'?result.reference.title:result.entry.title,referenceBody(result));panel.setAttribute('aria-busy','false');reveal(panel.querySelector('[data-rule-heading]'));return true;
 }catch(error){
  if(!current())return false;state.referenceStatus='error';panel.setAttribute('aria-busy','false');panel.innerHTML=sourceFrame(reference.label||'Source unavailable',`<p class="note small" role="status">${esc(error?.message||'The source could not be opened.')}</p><button type="button" class="btn ghost" data-rule-retry>Retry exact source</button><details class="rule-documents" open><summary>Official documents & downloads</summary>${sourceLinks(g)}</details>`);reveal(panel.querySelector('[data-rule-heading]'));return false;
 }
}
export function closeRuleReference(root){
 const state=stateFor(root),previous=state.history.pop();++state.seq;
 if(!previous){showView(root,state,'home');return;}
 showView(root,state,previous.view);state.reference=previous.reference;state.referenceStatus=previous.status;
 if(previous.html!==null)root.querySelector('[data-rule-destination]').innerHTML=previous.html;
 const target=previous.trigger?.isConnected!==false?previous.trigger:null;
 const fallback=previous.view==='source'?root.querySelector('[data-rule-destination]').querySelector('[data-rule-heading]'):root.querySelector(previous.view==='library'?'[data-library-heading]':'[data-learn-start]');
 (target||fallback)?.focus?.({preventScroll:true});
 for(const [node,top,left] of previous.scroll){node.scrollTop=top;node.scrollLeft=left;}
}
function renderBook(root){
 const state=stateFor(root);if(!state.pack)return;
 const hits=searchRulebook(state.pack,state.query,state.doc,state.chapter),box=root.querySelector('[data-rule-results]');
 box.innerHTML=hits.slice(0,state.limit).map(e=>`<details ${state.query&&normalizeRuleId(e.id)===normalizeRuleId(state.query)?'open':''}><summary><b>${esc(e.title)}</b><small>${esc(state.pack.sources[e.doc].title)} · ${esc(state.pack.sources[e.doc].date)} · PDF page ${e.page}</small></summary><p class="rule-source-text">${ruleEntryText(e.text,state.pack.game)}</p>${ruleReferenceButton(entryReference(state.game,e.id,e.title),'Open this exact rule')}${sourceLink(state.pack.sources[e.doc],e.page)}</details>`).join('')||'<p class="muted">No matching rules. Try a shorter term or another book.</p>';
 root.querySelector('[data-rule-result-count]').textContent=`${hits.length} results · showing ${Math.min(state.limit,hits.length)}`;root.querySelector('[data-rule-more]').hidden=hits.length<=state.limit;
}
async function openBook(root,trigger){
 const state=stateFor(root),g=root.dataset.game,seq=++state.seq,notice=root.querySelector('[data-rule-notice]');state.libraryTrigger=trigger||state.libraryTrigger;showView(root,state,'library');notice.textContent='Opening the reference…';root.querySelector('[data-rule-book-retry]').hidden=true;reveal(root.querySelector('[data-library-heading]'));
 const current=()=>root.isConnected!==false&&root.dataset.game===g&&state.seq===seq&&state.view==='library';
 try{
  const pack=await loadRulePack(g);if(!current())return;state.pack=pack;root.querySelector('[data-rule-browser]').hidden=false;
  root.querySelector('[data-rule-docs]').innerHTML=[['','All books'],...pack.sources.map((s,i)=>[String(i),s.title])].map(([id,label])=>`<button type="button" class="chip pick ${id===state.doc?'on':''}" data-rule-doc="${id}" aria-pressed="${id===state.doc}">${esc(label)}</button>`).join('');
  root.querySelector('[data-rule-search]').value=state.query;notice.textContent='Reference ready. Offline availability depends on this device’s storage.';renderBook(root);
 }catch(e){if(!current())return;notice.textContent=e.message;root.querySelector('[data-rule-book-retry]').hidden=false;}
}
export function attachRuleLearning(root=document){
 if(attached.has(root))return;attached.add(root);
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('button'),scope=button?.closest?.('[data-learning-root]');if(!scope||handledEvents.has(event))return;handledEvents.add(event);
  const g=scope.dataset.game,state=stateFor(scope);
  if(button.matches('[data-learn-start],[data-learn-jump]')){
   const section=scope.querySelector(button.matches('[data-learn-start]')?'[data-learn-turn]':'[data-learn-section="topics"]');section.open=true;reveal(section.querySelector('summary'));
  }else if(button.matches('[data-learn-step],[data-learn-move]')){
   const buttons=[...scope.querySelectorAll('[data-learn-step]')],old=buttons.findIndex(b=>b.getAttribute('aria-pressed')==='true'),index=button.dataset.learnStep!==undefined?Number(button.dataset.learnStep):Math.max(0,Math.min(buttons.length-1,old+Number(button.dataset.learnMove)));
   if(!TURN_STEPS[g][index])return;buttons.forEach((b,i)=>{b.classList.toggle('on',i===index);b.setAttribute('aria-pressed',String(i===index));});scope.querySelector('.learn-turn-body').innerHTML=turnBody(g,index);scope.querySelector('[data-learn-move="-1"]').disabled=index===0;scope.querySelector('[data-learn-move="1"]').disabled=index===buttons.length-1;
  }else if(button.matches('[data-rule-answer]')){
   const card=button.closest('[data-rule-check]'),q=RULE_CHECKS[g][Number(card.dataset.ruleCheck)],correct=(button.dataset.ruleAnswer==='yes')===q.yes;
   for(const b of card.querySelectorAll('[data-rule-answer]')){b.setAttribute('aria-pressed',String(b===button));b.classList.toggle('on',b===button);}
   const answer=card.querySelector('.rule-check-answer');answer.hidden=false;answer.innerHTML=`<b>${correct?'Correct.':'Try the rule:'} ${q.yes?'Yes.':'No.'}</b><p>${esc(q.why)}</p>${refButton(g,q.ref)}`;
  }else if(button.matches('[data-rule-load],[data-rule-book-retry]'))openBook(scope,button);
  else if(button.matches('[data-rule-reference],[data-rule-find]')){
   let ref;try{ref=button.dataset.ruleReference?JSON.parse(button.dataset.ruleReference):lessonReference(g,button.dataset.ruleFind);}catch{return;}openRuleReference(scope,ref,{trigger:button});
  }else if(button.matches('[data-rule-back]'))closeRuleReference(scope);
  else if(button.matches('[data-rule-retry]'))openRuleReference(scope,state.reference,{retry:true});
  else if(button.matches('[data-rule-home]')){++state.seq;showView(scope,state,'home');reveal(state.libraryTrigger?.isConnected?state.libraryTrigger:scope.querySelector('[data-learn-start]'));}
  else if(button.matches('[data-rule-type]'))scope.querySelector('[data-rule-search]').focus();
  else if(button.matches('[data-rule-doc],[data-rule-chapter],[data-rule-more]')){
   if(!state.pack)return;
   if(button.matches('[data-rule-more]'))state.limit+=25;
   else{const attr=button.matches('[data-rule-doc]')?'doc':'chapter';state[attr]=button.dataset[attr==='doc'?'ruleDoc':'ruleChapter'];state.limit=25;for(const b of scope.querySelectorAll(`[data-rule-${attr}]`)){b.classList.toggle('on',b===button);b.setAttribute('aria-pressed',String(b===button));}}
   renderBook(scope);
  }
 });
 root.addEventListener('input',event=>{
  const input=event.target,scope=input.closest?.('[data-learning-root]');if(!scope||handledEvents.has(event))return;handledEvents.add(event);
  if(input.matches('[data-learn-search]')){let count=0;const q=input.value.toLowerCase().trim();for(const t of scope.querySelectorAll('[data-learn-topic],[data-learn-keyword]')){t.hidden=!q.split(/\s+/).every(w=>t.dataset.search.includes(w));if(!t.hidden&&t.matches('[data-learn-topic]'))count++;}scope.querySelector('[data-learn-count]').textContent=count+' topics';scope.querySelector('[data-learn-empty]').hidden=count>0;}
  else if(input.matches('[data-rule-search]')){const state=stateFor(scope);if(state.pack){state.query=input.value;state.limit=25;renderBook(scope);}}
 });
 root.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const scope=event.target.closest?.('[data-learning-root]');if(scope&&stateFor(scope).view==='source'&&!handledEvents.has(event)){handledEvents.add(event);event.preventDefault();event.stopPropagation();closeRuleReference(scope);}});
}
