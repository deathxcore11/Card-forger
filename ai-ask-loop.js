// Shared, bounded orchestration. Repeated calls never spend another lookup and a
// completed builder draft is returned immediately rather than repeatedly planned.
const APP_TOOLS = new Set(['app_help','search_cards','card_details','my_collection','list_sets','set_cards','meta_decks','my_decks','build_deck']);
export const ASK_LIMITS = Object.freeze({rounds:8,tools:12,parallel:3});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function boundedToolOutput(out) { const json=JSON.stringify(out)??'null';return json.length<=12000?json:JSON.stringify({error:'Result too large. Narrow the request to fewer cards or sets.'}); }
export function partialAnswer(records,reason='I reached the search limit.') {
 const build=[...records].reverse().find(r=>r.name==='build_deck');
 if(build){const r=build.out;return {text:[r.note||r.error||'The deck draft could not be completed.',r.reviewAvailable?'Tap '+(r.actionLabel||'Review the deck draft')+' to inspect the cards and checks.':'',!r.terminal?reason:''].filter(Boolean).join(' ').slice(0,1200),source:'app',show:[],suggestions:r.requiresChoice?['Choose a different commander']:[]};}
 const useful=records.flatMap(r=>(r.out?.card?[r.out.card]:r.out?.cards||[]).filter(c=>c?.name).map(card=>({card,game:r.out.game}))).slice(0,6);
 const errors=[...new Set(records.map(r=>r.out?.error).filter(Boolean))].slice(0,2);
 return {text:[reason,useful.length?'Here are the cards I could verify so far.':errors.join(' ')||'I could not verify enough app data for a complete answer.','Nothing was saved.'].join(' '),source:'app',show:useful.map(({card:c,game})=>({kind:'card',game:['mtg','ptcg','ygo'].includes(game)?game:'mtg',ref:c.ref||c.id||c.name,label:c.name})),suggestions:[]};
}
export async function runAskLoop({game,items,tools,fetcher=fetch,signal,current=()=>true,onCalls=()=>{}}) {
 const seen=new Map(),records=[];
 for(let round=0;round<ASK_LIMITS.rounds;round++){
  if(!current()||signal?.aborted)return null;
  const finish=round===ASK_LIMITS.rounds-1||records.length>=ASK_LIMITS.tools;
  const r=await fetcher('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game,items,finish}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(70000)]):AbortSignal.timeout(70000)});
  if(!current()||signal?.aborted)return null;
  let data;try{data=await r.json();}catch{throw Error('Ask AI is unavailable. Check your connection.');}
  if(!current()||signal?.aborted)return null;
  if(!r.ok){if(records.length)return partialAnswer(records,data.message||'The assistant could not finish this answer.');throw Error(data.message||'Ask AI is unavailable right now.');}
  if(data.answer)return data.answer;
  const calls=Array.isArray(data.calls)?data.calls.slice(0,6):[];
  if(!calls.length||finish)return partialAnswer(records);
  onCalls(calls);
  let progressed=false,builds=0;
  const execute=async call=>{
   if(!current()||signal?.aborted)return {call,out:{cancelled:true}};
   if(!APP_TOOLS.has(call?.name))return {call,out:{error:'That is not an allowed assistant tool.'}};
   let args,out,key;
   try{args=JSON.parse(call.arguments||'{}');key=call.name+':'+JSON.stringify(canonical(args));}catch{return {call,out:{error:'The assistant sent invalid tool arguments.'}};}
   if(seen.has(key))return {call,out:await seen.get(key),repeated:true};
   if(seen.size>=ASK_LIMITS.tools)return {call,out:{error:'The search budget is exhausted. Finish with the verified results.'}};
   if(call.name==='build_deck'&&builds++)return {call,out:{error:'Prepare one deck at a time. Use the first draft or ask which alternative the player prefers.'}};
   progressed=true;
   const pending=Promise.resolve().then(()=>!current()||signal?.aborted?{cancelled:true}:tools?.[call.name]?.(args)??{error:'Not available in this app.'}).catch(e=>({error:String(e.message||e).slice(0,200)}));seen.set(key,pending);
   out=await pending;return {call,out};
  };
  // Read-only calls may share a batch. Builder setup is ordered to preserve the
  // one pending draft action, never racing two different prepared decks.
  const results=[];
  const reads=calls.filter(c=>c.name!=='build_deck'),buildCalls=calls.filter(c=>c.name==='build_deck');
  for(let i=0;i<reads.length;i+=ASK_LIMITS.parallel){results.push(...await Promise.all(reads.slice(i,i+ASK_LIMITS.parallel).map(execute)));if(!current()||signal?.aborted)return null;}
  for(const call of buildCalls){results.push(await execute(call));if(!current()||signal?.aborted)return null;}
  for(const {call,out,repeated} of results){items.push(call,{type:'function_call_output',call_id:call.call_id,output:boundedToolOutput(out)});if(!repeated)records.push({name:call.name,out});}
  const terminal=records.find(r=>r.name==='build_deck'&&r.out?.terminal);
  if(terminal)return partialAnswer([terminal],'');
  if(!progressed)return partialAnswer(records,'The assistant repeated the same lookup, so I stopped that loop.');
 }
 return partialAnswer(records);
}
