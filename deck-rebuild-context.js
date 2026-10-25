import {opponentProfile} from './deck-matchup-plan.js';
import {cardBracketEvidence,commanderDeckRows} from './commander-evidence.js';
const clone=x=>structuredClone(x);
export function createRebuildContext(result,{current=()=>true,lookup=()=>null}={}){
 if(!result?.deck||!result?.request)throw Error('Choose a current deck to rebuild.');
 const request=clone(result.request),deck=clone(result.deck),signature=JSON.stringify([deck.cards,deck.side,deck.commander,request]);
 let opponent=null,revision=0;
 const check=()=>{if(!current())throw Error('The source deck or workspace changed. Reopen coaching from that deck.');};
 return {
  key:signature,
  current:()=>{try{check();return true;}catch{return false;}},
  request:()=>{check();return clone(request);},deck:()=>{check();return clone(deck);},
  setOpponent(value){check();opponent=clone(value);revision++;},
  revision:()=>revision,
  matchup(){check();return opponentProfile(opponent,lookup);},
  contract(){check();return {game:request.game,format:request.format,seed:request.seed||deck.buildAround||'',commander:deck.commander||request.commander||'',budget:request.budget??0,budget_basis:request.ownedOnly?'owned':request.budgetBasis||'total',budgetMode:request.budgetMode||'cap',targetBracket:request.targetBracket??null,deckStyle:request.deckStyle||'classic',loopSource:request.loopSource||null,required_cards:clone(request.required_cards||[]),excluded_cards:clone(request.excluded_cards||[]),colors:clone(request.colors||[]),avoid_infinite:request.avoid_infinite===true,requireLoop:request.requireLoop??null,themes:[],creatureTypesOnly:clone(request.creatureTypesOnly||[]),excludedSubtypes:clone(request.excludedSubtypes||[]),provenance:{source:{source:'selected-deck-context',value:signature}}};},
  read(){
   check();const summarize=d=>{
    const rows=commanderDeckRows(d),anchorName=d.commander||d.buildAround||request.seed,anchor=anchorName?lookup(anchorName):null,evidence=rows.flatMap(r=>{const c=lookup(r.name),e=cardBracketEvidence(c),flags=[e.gameChanger&&'game-changer',e.extraTurn&&'extra-turn',e.massLandDenial&&'land-denial'].filter(Boolean);return flags.length?[{name:r.name,flags}]:[];});
    return {name:d.name||d.buildAround||'Selected deck',format:d.format||request.format,commander:d.commander||null,cardEncoding:'[quantity,name]',cards:rows.map(r=>[r.qty,r.name]),side:(d.side||[]).map(r=>[r.qty,r.name]),evidence,anchor:anchor?{name:anchor.name,type:anchor.type_line||null,rules:String(anchor.oracle_text||'').slice(0,1800)}:null};
   };
   const value={game:request.game,source:summarize(deck),constraints:this.contract(),opponent:opponent?summarize(opponent):null,opponentProfile:opponent?{signals:Object.fromEntries(Object.entries(this.matchup().signals).map(([kind,names])=>[kind,{count:names.length,examples:names.slice(0,8)}])),unknownCount:this.matchup().unknown.length}:null,revision,
    purpose:'Suggest contextual directions or clarify a material ambiguity, then use the shared builder. Preserve supplied constraints unless the player changes them. Matchup plans are estimates, not played results.'};
   delete value.constraints.provenance;
   if(JSON.stringify(value).length>11500)throw Error('The two lists exceed this bounded conversation context. Use a smaller comparison.');
   return value;
  }
 };
}
