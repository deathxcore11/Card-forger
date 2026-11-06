// Random opponents use the shared checked builder. This module selects a deck;
// engine admission and CPU piloting remain independent match-start gates.
import {normalizeCommanderTarget} from './commander-evidence.js';
// Every format Play supports gets random decks (Quick Play, Practice, CPU seats).
export const RANDOM_DECK_FORMATS=Object.freeze(['Standard','Commander','Modern','Pioneer','Legacy','Vintage','Pauper','Standard Brawl']);
// Build one checked random deck without selecting it. The Play deck queue
// calls this in the background; the builder below calls it on demand.
export function createRandomDeckProducer({pipeline,pickSeed,random=()=>crypto.getRandomValues(new Uint32Array(1))[0],forgeSeed=null,comboChance=0.2}={}){
 if(typeof pipeline?.build!=='function'||typeof pipeline?.recheck!=='function'||typeof pickSeed!=='function')throw Error('OPPONENT_BUILDER_REQUIRED');
 const seedCode=forgeSeed||(()=>{const n=random();return Array.from({length:6},(_,i)=>'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[(Math.floor(n/Math.pow(32,i))+i*7)%32]).join('');});
 return async function produce({format,targetBracket=null,deckStyle='classic',power=null}={},{current=()=>true,onStatus=()=>{}}={}){
  if(!RANDOM_DECK_FORMATS.includes(format)||!['classic','infinite-mana'].includes(deckStyle))throw Error('INVALID_OPPONENT_OPTIONS');
  const bracket=normalizeCommanderTarget(targetBracket);if(format!=='Commander'&&bracket!==null)throw Error('COMMANDER_BRACKET_ONLY');
  // Random decks are Casual by default, with Varied picks and a seed (Deck Forge, spec 12).
  const request={game:'mtg',format,targetBracket:bracket,deckStyle,budget:'',budgetBasis:'total',budgetMode:'cap',preferOwned:false,ownedOnly:false,randomSeed:random(),forge:{power:power==='strong'||bracket&&bracket>=3?'strong':'casual',variation:'varied',seed:seedCode()}};
  const seed=await pickSeed(request);if(!current())return null;if(!seed?.name)throw Error('No legal build-around was returned.');
  const run=extra=>pipeline.build({...request,...extra,seed:seed.name,seedCard:seed,seedCards:[seed]},{current,onStatus});
  // About one random deck in five is built to hold a reviewed, verified mana-loop package
  // (the same proof the AI builder uses). If that cannot be met for this seed or format,
  // fall back to the normal synergy build, so a combo is never forced into a bad list.
  let result=null;
  if(deckStyle==='classic'&&comboChance>0&&random()%1000<comboChance*1000){
   try{const tried=await run({requireLoop:'infinite-mana'});if(!current())return null;if(tried?.ok&&tried.plan?.combo?.status==='verified'&&pipeline.recheck(tried))result=tried;}catch(e){if(!current())return null;}
  }
  if(!result){result=await run({});if(!current())return null;}
  if(!result?.ok||!pipeline.recheck(result))throw Error(result?.message||'The generated list did not pass its construction checks.');
  if(result.deck?.format!==format||result.request?.format!==format||result.request?.targetBracket!==bracket||result.request?.deckStyle!==deckStyle)throw Error('The generated list changed the requested format, bracket or style.');
  return structuredClone({...result.deck,name:result.deck.name||seed.name+' · Random deck',practiceBuild:{source:'shared-random-builder',combo:result.plan?.combo?.status==='verified'?'verified-mana-loop':null,request:result.request,bracket:result.bracket||result.plan?.bracket||null}});
 };
}
export function createPracticeOpponentBuilder({pipeline,pickSeed,readScope,onSelect,onChange=()=>{},random=()=>crypto.getRandomValues(new Uint32Array(1))[0],queue=null,produce=null}={}){
 if(typeof pipeline?.build!=='function'||typeof pipeline?.recheck!=='function'||typeof pickSeed!=='function'||typeof readScope!=='function'||typeof onSelect!=='function')throw Error('OPPONENT_BUILDER_REQUIRED');
 const make=produce||createRandomDeckProducer({pipeline,pickSeed,random});
 let sequence=0,activeScope=null,state={busy:false,status:'',error:null,result:null};
 const snapshot=()=>{if(activeScope!==null&&activeScope!==key()){sequence++;activeScope=null;state={busy:false,status:'',error:null,result:null};}return structuredClone(state);},publish=()=>onChange(snapshot());
 const key=()=>JSON.stringify(readScope());
 return {snapshot,cancel(){sequence++;state={...state,busy:false,status:'Build cancelled.',error:null};publish();},
  async build({format,targetBracket=null,deckStyle='classic'}={}){
   if(!RANDOM_DECK_FORMATS.includes(format)||!['classic','infinite-mana'].includes(deckStyle))throw Error('INVALID_OPPONENT_OPTIONS');
   const bracket=normalizeCommanderTarget(targetBracket);if(format!=='Commander'&&bracket!==null)throw Error('COMMANDER_BRACKET_ONLY');
   const ticket=++sequence,scope=key(),current=()=>ticket===sequence&&scope===key(),ask={format,targetBracket:bracket,deckStyle};
   activeScope=scope;state={...state,request:ask,busy:true,status:'Choosing a build-around…',error:null};publish();
   try{
    // A deck the queue already finished is handed over at once; one it is
    // still building is awaited instead of starting a second build.
    let deck=queue?.take(ask)||null;
    if(!deck&&queue?.pending(ask)){state.status='Finishing your next deck…';publish();await queue.pending(ask);if(!current())return null;deck=queue.take(ask);}
    if(!deck){deck=await make(ask,{current,onStatus:message=>{if(current()){state.status=String(message);publish();}}});if(!current())return null;queue?.warm([ask]);}
    onSelect(deck);state={request:ask,busy:false,status:'Deck built. Review the exact list before playing.',error:null,result:deck};publish();return structuredClone(deck);
   }catch(error){if(!current())return null;state={...state,busy:false,status:'',error:error.message};publish();return null;}
   finally{if(ticket===sequence&&!current()){state={busy:false,status:'',error:null,result:null};publish();}}
  }
 };
}
