import {simulateMatchup,gamePlan} from './matchup.js';
import {buildMatchupPlan} from './matchup-plan.js';
import {parseMatchupIntent,selectMatchupOpponent,buildMatchupRequest,matchupFormat} from './ai-matchup-core.js';
export const matchupFingerprint=deck=>JSON.stringify([deck?.id,deck?.format,deck?.cards,deck?.side,deck?.commander,deck?.commanders]);
// All results are ephemeral: nothing writes a collection, deck or Power score. The read is the app's own
// simulation (matchup.js) put into words by matchup-plan.js: no AI, no network once the cards are known.
// profile(deck) returns the matchup.js profile of a list ({cards, side, commander}), or null while cards load.
export function createMagicMatchups({getDeck,state,lookup,loadMeta,metaKey,resolveNames,capture,current,render,profile}){
 let active=null;
 const cancel=()=>{if(active){active.controller.abort();active.st.busy=false;active=null;}};
 function begin(message){cancel();const deck=getDeck();if(!deck)throw Error('Open a Magic deck first.');const st=state(deck),ticket=capture(),fingerprint=matchupFingerprint(deck),controller=new AbortController();const op={st,deck:structuredClone(deck),ticket,fingerprint,controller};st.controller=controller;active=op;st.busy=true;st.error='';st.result=null;st.message=message||'Finding a matching opponent…';render();return op;}
 const valid=op=>active===op&&!op.controller.signal.aborted&&current(op.ticket)&&matchupFingerprint(getDeck())===op.fingerprint&&state(getDeck())===op.st;
 function finish(op){if(active===op){op.st.busy=false;active=null;if(current(op.ticket))render();}}
 async function select(){
  const op=begin();try{
   const key=metaKey(op.deck);if(!key)throw Error('No supported tournament source is available for this format. Paste an opponent list instead.');
   const data=await loadMeta(key);if(!valid(op))return;
   const format=matchupFormat(op.deck.format).name;
   if(data.format&&matchupFormat(data.format).id!==matchupFormat(format).id)throw Error('The source returned a different format. Paste a matching list instead.');
   const seen=new Set(),pool=[];
   for(const a of [...(data.archetypes||[])].sort((a,b)=>(b.share||0)-(a.share||0))){const d=a.best;if(d?.main?.length&&!seen.has(d.key||d.name)){seen.add(d.key||d.name);pool.push({...d,name:d.archetype||d.name||a.name,share:a.share});}}
   for(const d of data.decks||[])if(d.main?.length&&!seen.has(d.key||d.name)){seen.add(d.key||d.name);pool.push(d);}
   const sample=pool.filter(d=>{try{return !d.format||matchupFormat(d.format).id===matchupFormat(format).id;}catch{return false;}}).slice(0,16);if(!sample.length)throw Error('This source has no complete opponent lists for '+format+'. Paste an opponent list in that format instead.');
   const names=[...new Set(sample.flatMap(d=>[...(d.main||[]),...(d.side||[]),...(d.commanders||[])].map(r=>typeof r==='string'?r:r.name)).filter(Boolean))];
   if(names.length>600)throw Error('The loaded field is too large to resolve safely. Paste one opponent list instead.');
   await resolveNames(names);if(!valid(op))return;
   const candidates=sample.map(d=>{const cards=d.main||[],records=[...cards,...(d.commanders||[]),...(d.commander?[d.commander]:[])].map(r=>lookup(typeof r==='string'?r:r.name));return {...d,format,name:d.archetype||d.name||'Tournament opponent',cards,colors:records.every(c=>Array.isArray(c?.color_identity))?[...new Set(records.flatMap(c=>c.color_identity))]:null,provenance:{kind:'meta',source:data.source||'',date:d.date||data.updatedAt||'',fetchedAt:data.fetchedAt||'',url:d.url||data.sourceUrl||'',stale:!!data.stale}};});
   const intent=parseMatchupIntent(op.st.question),colors=op.st.colors.length?op.st.colors:intent.colors;
   const normalizeName=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
   const questionWords=' '+normalizeName(op.st.question)+' ';
   const named=candidates.flatMap(candidate=>[candidate.name,candidate.archetype]).filter(name=>normalizeName(name).length>=4&&questionWords.includes(' '+normalizeName(name)+' ')).sort((a,b)=>b.length-a.length)[0]||'';
   const opponent=selectMatchupOpponent(candidates,{format,colors,name:named,mode:op.st.selectionMode==='random'||intent.mode==='random'?'random':'top',mono:intent.mono});
   if(!opponent)throw Error('No verified matching list was found in this source sample. Try another color or paste the exact opponent.');
   opponent.art=(opponent.cards||[]).map(row=>lookup(row.name)).find(card=>card?.image_uris?.art_crop)?.image_uris.art_crop||'';
   op.st.opponent=opponent;op.st.sampleCount=candidates.length;op.st.request=buildMatchupRequest({deck:op.deck,opponent,lookup,question:op.st.question,mode:op.st.mode});
  }catch(error){if(valid(op))op.st.error=error.message;}finally{finish(op);}
 }
 async function analyze(){
  const deck=getDeck();if(!deck||state(deck).busy)return;
  const op=begin('Simulating 2,000 games…');try{
   if(!op.st.opponent)throw Error('Choose and preview an opponent first.');
   const names=[...(op.deck.cards||[]),...(op.deck.side||[])].map(r=>r.name);if(op.deck.commander)names.push(op.deck.commander);
   const selection=JSON.stringify([op.st.opponent,op.st.question,op.st.mode]);
   await resolveNames(names);if(!valid(op)||selection!==JSON.stringify([op.st.opponent,op.st.question,op.st.mode]))return;
   const request=buildMatchupRequest({deck:op.deck,opponent:op.st.opponent,lookup,question:op.st.question,mode:op.st.mode});
   op.st.request=request;
   const oppNames=[...(op.st.opponent.cards||[]),...(op.st.opponent.side||[])].map(r=>r.name).filter(Boolean);
   await resolveNames(oppNames);if(!valid(op)||selection!==JSON.stringify([op.st.opponent,op.st.question,op.st.mode]))return;
   const me=profile?.(op.deck),them=profile?.({...op.st.opponent,cards:op.st.opponent.cards||op.st.opponent.main||[]});
   if(!me||!them)throw Error('A full list is needed on both sides to simulate this matchup. Finish the deck, or pick another opponent.');
   const sim=simulateMatchup('mtg',me,them);
   const rows=list=>(list||[]).map(r=>({qty:r.qty,name:r.name,c:lookup(r.name)})).filter(r=>r.c);
   const plan=op.st.mode==='bo3'?gamePlan('mtg',me,them,{main:rows(op.deck.cards),side:rows(op.deck.side),reprofile:list=>profile({...op.deck,cards:list.map(r=>({name:r.c.name,qty:r.qty})),side:[]}),sim:sim.win}):null;
   op.st.result=buildMatchupPlan({request,me,op:them,sim,plan,mode:op.st.mode});
  }catch(error){if(valid(op))op.st.error=error.name==='AbortError'?'Cancelled.':error.message;}finally{finish(op);}
 }
 return {select,analyze,cancel,valid,reset:cancel};
}
