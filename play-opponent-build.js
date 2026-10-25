// Random opponents use the shared checked builder. This module selects a deck;
// engine admission and CPU piloting remain independent match-start gates.
import {normalizeCommanderTarget} from './commander-evidence.js';
export function createPracticeOpponentBuilder({pipeline,pickSeed,readScope,onSelect,onChange=()=>{},random=()=>crypto.getRandomValues(new Uint32Array(1))[0]}={}){
 if(typeof pipeline?.build!=='function'||typeof pipeline?.recheck!=='function'||typeof pickSeed!=='function'||typeof readScope!=='function'||typeof onSelect!=='function')throw Error('OPPONENT_BUILDER_REQUIRED');
 let sequence=0,activeScope=null,state={busy:false,status:'',error:null,result:null};
 const snapshot=()=>{if(activeScope!==null&&activeScope!==key()){sequence++;activeScope=null;state={busy:false,status:'',error:null,result:null};}return structuredClone(state);},publish=()=>onChange(snapshot());
 const key=()=>JSON.stringify(readScope());
 return {snapshot,cancel(){sequence++;state={...state,busy:false,status:'Build cancelled.',error:null};publish();},
  async build({format,targetBracket=null,deckStyle='classic'}={}){
   if(!['Standard','Commander'].includes(format)||!['classic','infinite-mana'].includes(deckStyle))throw Error('INVALID_OPPONENT_OPTIONS');
   const bracket=normalizeCommanderTarget(targetBracket);if(format!=='Commander'&&bracket!==null)throw Error('COMMANDER_BRACKET_ONLY');
   const ticket=++sequence,scope=key(),current=()=>ticket===sequence&&scope===key();
   activeScope=scope;state={...state,request:{format,targetBracket:bracket,deckStyle},busy:true,status:'Choosing an opponent build-around…',error:null};publish();
   try{
    const request={game:'mtg',format,targetBracket:bracket,deckStyle,budget:'',budgetBasis:'total',budgetMode:'cap',preferOwned:false,ownedOnly:false,randomSeed:random()};
    const seed=await pickSeed(request);if(!current())return null;if(!seed?.name)throw Error('No legal build-around was returned.');
    const result=await pipeline.build({...request,seed:seed.name,seedCard:seed,seedCards:[seed]},{current,onStatus:message=>{if(current()){state.status=String(message);publish();}}});
    if(!current())return null;
    if(!result?.ok||!pipeline.recheck(result))throw Error(result?.message||'The generated list did not pass its construction checks.');
    if(result.deck?.format!==format||result.request?.format!==format||result.request?.targetBracket!==bracket||result.request?.deckStyle!==deckStyle)throw Error('The generated list changed the requested format, bracket or style.');
    const deck=structuredClone({...result.deck,name:result.deck.name||seed.name+' · CPU opponent',practiceBuild:{source:'shared-random-builder',request:result.request,bracket:result.bracket||result.plan?.bracket||null}});
    onSelect(deck);state={request:{format,targetBracket:bracket,deckStyle},busy:false,status:'Opponent built. Review the exact list before playing.',error:null,result:deck};publish();return structuredClone(deck);
   }catch(error){if(!current())return null;state={...state,busy:false,status:'',error:error.message};publish();return null;}
   finally{if(ticket===sequence&&!current()){state={busy:false,status:'',error:null,result:null};publish();}}
  }
 };
}
