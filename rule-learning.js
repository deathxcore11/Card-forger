import {esc} from './ui.js';
import {RULE_DEX,ruleText} from './rule-dex.js';
import {LESSONS,TURN_STEPS,RULE_CHECKS} from './rule-lessons.js';
import {readRecord,writeRecord} from './storage.js';
const names={mtg:'Magic',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'},packs=new Map();
let manifest;
export function lessonMatches(lesson,query){const terms=String(query||'').toLowerCase().trim().split(/\s+/).filter(Boolean);return terms.every(t=>Object.values(lesson).join(' ').toLowerCase().includes(t));}
export function searchRulebook(pack,query='',doc='',chapter=''){
 const q=query.trim().toLowerCase(),id=q.replace(/\.$/,'');
 return (pack?.entries||[]).filter(e=>(doc===''||String(e.doc)===String(doc))&&(!chapter||e.chapter===chapter)&&(String(e.id).replace(/\.$/,'')===id||lessonMatches(e,q))).sort((a,b)=>(String(b.id)===id?1:0)-(String(a.id)===id?1:0));
}
const refButton=(g,ref)=>`<button type="button" class="link small" data-rule-find="${esc(ref)}">Read the source · ${esc(ref)} →</button>`;
function turnBody(g,index){const step=TURN_STEPS[g][index];return `<p class="eyebrow">Step ${index+1} of ${TURN_STEPS[g].length}</p><h3>${esc(step[0])}</h3><p>${esc(step[1])}</p><div class="note small">${esc(step[2])}</div>${refButton(g,step[3])}`;}
export function interactiveRules(g){
 if(!LESSONS[g])return '';
 return `<section class="rule-learning" data-learning-root data-game="${g}">
 <section class="panel learn-turn"><p class="eyebrow">Try a turn</p><h3>Tap through a ${esc(names[g])} turn</h3><div class="learn-step-rail" aria-label="Turn steps">${TURN_STEPS[g].map((s,i)=>`<button type="button" class="chip pick ${i===0?'on':''}" aria-pressed="${i===0}" data-learn-step="${i}">${i+1}. ${esc(s[0])}</button>`).join('')}</div><div class="learn-turn-body" aria-live="polite">${turnBody(g,0)}</div><div class="row between"><button type="button" class="btn ghost small" data-learn-move="-1" disabled>Previous step</button><button type="button" class="btn ghost small" data-learn-move="1">Next step</button></div></section>
 <section class="panel"><p class="eyebrow">Go deeper</p><h3>Learn the play, then the exception</h3><label class="learn-search">Find a topic or keyword<input type="search" data-learn-search placeholder="Try timing, Energy, targets…" autocomplete="off"></label><p class="small muted" data-learn-count aria-live="polite">${LESSONS[g].length} topics</p><div class="learn-topic-grid">${LESSONS[g].map(t=>`<details class="learn-topic" data-learn-topic data-search="${esc(Object.values(t).join(' ').toLowerCase())}"><summary><b>${esc(t.title)}</b><small>${esc(t.summary)}</small></summary><p>${ruleText(g,t.detail)}</p><div class="learn-example"><span class="eyebrow">At the table</span><p>${esc(t.example)}</p></div>${refButton(g,t.ref)}</details>`).join('')}</div><p class="muted small" data-learn-empty hidden>No matching topics. Try the full rulebook below.</p><div class="learn-keywords">${Object.entries(RULE_DEX[g]).map(([key,r])=>`<button type="button" class="chip" data-act="ruleHint" data-game="${g}" data-rule="${esc(key)}" data-learn-keyword data-search="${esc((key+' '+r.definition).toLowerCase())}">${esc(r.label)}</button>`).join('')}</div></section>
 <section class="panel"><p class="eyebrow">Try the decision</p><h3>Can I do this?</h3><div class="rule-check-grid">${RULE_CHECKS[g].map((q,i)=>`<section class="rule-check" data-rule-check="${i}"><h4>${esc(q.q)}</h4><div class="row wrap"><button type="button" class="btn ghost small" data-rule-answer="yes" aria-pressed="false">Yes</button><button type="button" class="btn ghost small" data-rule-answer="no" aria-pressed="false">No</button></div><div class="rule-check-answer" role="status" hidden></div></section>`).join('')}</div></section>
 <section class="panel rule-library"><p class="eyebrow">The full reference</p><h3>Search the official books</h3><p class="small muted">Dated text from the supplied rulebooks, searchable on this device after one download. Printed diagrams remain in the official PDFs. Older editions are marked; later official updates take precedence.</p>${g==='ygo'?'<div class="note small">Use the <a class="link" href="https://www.yugioh-card.com/en/play/2021_rules_update/" target="_blank" rel="noopener noreferrer">later rules update ↗</a> alongside version 10 and the 2017 guide, especially for Extra Deck placement.</div>':''}<button type="button" class="btn ghost block" data-rule-load>Open searchable rulebook</button><div data-rule-browser hidden><label class="learn-search">Search text or rule number<input type="search" data-rule-search placeholder="${g==='mtg'?'Try 903.8, ward, combat damage':'Try Special Summon, evolution, Checkup…'}" autocomplete="off"></label><div class="learn-book-filters" data-rule-docs aria-label="Rulebooks"></div>${g==='mtg'?`<div class="learn-book-filters" data-rule-chapters aria-label="Rules chapters">${[['','All chapters'],['1','Game concepts'],['2','Parts of a card'],['3','Card types'],['4','Zones'],['5','Turn structure'],['6','Spells & abilities'],['7','Additional rules'],['8','Multiplayer'],['9','Casual & Commander'],['Glossary','Glossary']].map(([id,label])=>`<button type="button" class="chip pick ${!id?'on':''}" data-rule-chapter="${id}" aria-pressed="${!id}">${label}</button>`).join('')}</div>`:''}<p class="foot" data-rule-result-count aria-live="polite"></p><div class="rules-list" data-rule-results></div><button type="button" class="btn ghost small" data-rule-more hidden>Show more rules</button></div><p class="small muted" data-rule-notice role="status"></p><div data-rule-sources></div></section></section>`;
}
export function cardRuleHelp(g,card){
 const text=[card?.oracle_text,card?.text,card?.type_line,card?.typeLine,...(card?.card_faces||[]).map(f=>f.oracle_text)].filter(Boolean).join(' ').toLowerCase();
 const terms=Object.entries(RULE_DEX[g]||{}).filter(([key])=>text.includes(key.toLowerCase())).slice(0,12);
 return `<section class="guide-sec card-rule-help"><h3>Explore the rules</h3><p class="small muted">Tap a mechanic for its meaning, or open the complete interactive guide.</p><div class="row wrap">${terms.map(([key,r])=>`<button type="button" class="chip" data-act="ruleHint" data-game="${g}" data-rule="${esc(key)}">${esc(r.label)}</button>`).join('')}<button type="button" class="btn ghost small" data-act="learnGame" data-game="${g}">Rules & how to play →</button></div></section>`;
}
async function loadPack(g){
 if(packs.has(g))return packs.get(g);
 const promise=(async()=>{
  manifest ||= await fetch('rulebooks/manifest.json').then(r=>{if(!r.ok)throw Error('Rulebook download unavailable.');return r.json();}).then(async d=>{await writeRecord('cardstashy-rule-manifest-v1',d).catch(()=>{});return d;}).catch(()=>readRecord('cardstashy-rule-manifest-v1'));
  if(!manifest?.[g])throw Error('Open the rulebook once while online to save its reference.');
  const entry=manifest[g];const key='cardstashy-rules-'+g+'-'+entry.sha256;
  try{const saved=await readRecord(key);if(saved?.schema===1&&saved.game===g)return saved;}catch{}
  const response=await fetch(entry.file);if(!response.ok)throw Error('Rulebook download unavailable.');
  const bytes=new Uint8Array(await response.arrayBuffer());let raw;
  if(bytes[0]===31&&bytes[1]===139){if(typeof DecompressionStream==='undefined')throw Error('Use the official PDF links on this browser.');raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else raw=new TextDecoder().decode(bytes);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==entry.sha256)throw Error('The rulebook download was incomplete. Please retry.');
  const pack=JSON.parse(raw);if(pack.schema!==1||pack.game!==g||pack.entries.length!==entry.count)throw Error('Wrong rulebook download.');
  await writeRecord(key,pack).catch(()=>{});return pack;
 })();packs.set(g,promise);promise.catch(()=>packs.delete(g));return promise;
}
const browserState=new WeakMap();
function sourceLinks(pack){return pack.sources.map((s,i)=>`<a class="mini-row store" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc(s.title)}</b><small>${esc(s.date)}${s.legacy?' · older reference, use current updates':''}</small></span><span>PDF / source ↗</span></a>`).join('');}
function ruleEntryText(text,g){
 if(g!=='mtg')return esc(text);
 return String(text).split(/(\b\d{3}\.\d+[a-z]?\b)/g).map((part,i)=>i%2?`<button type="button" class="rule-word" data-rule-find="${esc(part)}">${esc(part)}</button>`:esc(part)).join('');
}
function renderBook(root){
 const state=browserState.get(root);if(!state)return;
 const hits=searchRulebook(state.pack,state.query,state.doc,state.chapter),box=root.querySelector('[data-rule-results]');
 box.innerHTML=hits.slice(0,state.limit).map(e=>`<details ${state.query&&e.id===state.query?'open':''}><summary><b>${esc(e.title)}</b><small>${esc(state.pack.sources[e.doc].title)} · PDF page ${e.page}</small></summary><p class="rule-source-text">${ruleEntryText(e.text,state.pack.game)}</p><a class="link small" href="${esc(state.pack.sources[e.doc].url)}#page=${e.page}" target="_blank" rel="noopener noreferrer">Open PDF / source ↗</a></details>`).join('')||'<p class="muted">No matching rules. Try a shorter term or another book.</p>';
 root.querySelector('[data-rule-result-count]').textContent=`${hits.length} results · showing ${Math.min(state.limit,hits.length)}`;root.querySelector('[data-rule-more]').hidden=hits.length<=state.limit;
}
async function openBook(root,query){
 const button=root.querySelector('[data-rule-load]'),notice=root.querySelector('[data-rule-notice]');button.disabled=true;notice.textContent='Opening the reference…';
 try{
  const pack=await loadPack(root.dataset.game);if(!root.isConnected)return;
  const state=browserState.get(root)||{pack,query:'',doc:'',chapter:'',limit:25};if(query!==undefined){state.query=query;state.doc='';state.chapter='';state.limit=25;}
  browserState.set(root,state);root.querySelector('[data-rule-browser]').hidden=false;button.hidden=true;
  root.querySelector('[data-rule-docs]').innerHTML=[['','All books'],...pack.sources.map((s,i)=>[String(i),s.title])].map(([id,label])=>`<button type="button" class="chip pick ${id===state.doc?'on':''}" data-rule-doc="${id}" aria-pressed="${id===state.doc}">${esc(label)}</button>`).join('');
  root.querySelector('[data-rule-search]').value=state.query;root.querySelector('[data-rule-sources]').innerHTML=sourceLinks(pack);notice.textContent='Saved for offline reference on this device.';renderBook(root);
  if(query!==undefined)root.querySelector('[data-rule-search]').focus({preventScroll:true});
 }catch(e){notice.textContent=e.message;}finally{button.disabled=false;}
}
export function attachRuleLearning(root=document){
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('button'),scope=button?.closest?.('[data-learning-root]');if(!scope)return;
  const g=scope.dataset.game;
  if(button.matches('[data-learn-step],[data-learn-move]')){
   const buttons=[...scope.querySelectorAll('[data-learn-step]')],old=buttons.findIndex(b=>b.getAttribute('aria-pressed')==='true'),index=button.dataset.learnStep!==undefined?Number(button.dataset.learnStep):Math.max(0,Math.min(buttons.length-1,old+Number(button.dataset.learnMove)));
   buttons.forEach((b,i)=>{b.classList.toggle('on',i===index);b.setAttribute('aria-pressed',String(i===index));});scope.querySelector('.learn-turn-body').innerHTML=turnBody(g,index);scope.querySelector('[data-learn-move="-1"]').disabled=index===0;scope.querySelector('[data-learn-move="1"]').disabled=index===buttons.length-1;
  }else if(button.matches('[data-rule-answer]')){
   const card=button.closest('[data-rule-check]'),q=RULE_CHECKS[g][Number(card.dataset.ruleCheck)],correct=(button.dataset.ruleAnswer==='yes')===q.yes;
   for(const b of card.querySelectorAll('[data-rule-answer]')){b.setAttribute('aria-pressed',String(b===button));b.classList.toggle('on',b===button);}
   const answer=card.querySelector('.rule-check-answer');answer.hidden=false;answer.innerHTML=`<b>${correct?'Correct.':'Try the rule:'} ${q.yes?'Yes.':'No.'}</b><p>${esc(q.why)}</p>${refButton(g,q.ref)}`;
  }else if(button.matches('[data-rule-load]'))openBook(scope);
  else if(button.matches('[data-rule-find]'))openBook(scope,button.dataset.ruleFind);
  else if(button.matches('[data-rule-doc],[data-rule-chapter],[data-rule-more]')){
   const state=browserState.get(scope);if(!state)return;
   if(button.matches('[data-rule-more]'))state.limit+=25;
   else {const attr=button.matches('[data-rule-doc]')?'doc':'chapter';state[attr]=button.dataset[attr==='doc'?'ruleDoc':'ruleChapter'];state.limit=25;for(const b of scope.querySelectorAll(`[data-rule-${attr}]`)){b.classList.toggle('on',b===button);b.setAttribute('aria-pressed',String(b===button));}}
   renderBook(scope);
  }
 });
 root.addEventListener('input',event=>{
  const input=event.target,scope=input.closest?.('[data-learning-root]');if(!scope)return;
  if(input.matches('[data-learn-search]')){let count=0;const q=input.value.toLowerCase().trim();for(const t of scope.querySelectorAll('[data-learn-topic],[data-learn-keyword]')){t.hidden=!q.split(/\s+/).every(w=>t.dataset.search.includes(w));if(!t.hidden&&t.matches('[data-learn-topic]'))count++;}scope.querySelector('[data-learn-count]').textContent=count+' topics';scope.querySelector('[data-learn-empty]').hidden=count>0;}
  else if(input.matches('[data-rule-search]')){const state=browserState.get(scope);if(state){state.query=input.value;state.limit=25;renderBook(scope);}}
 });
}
