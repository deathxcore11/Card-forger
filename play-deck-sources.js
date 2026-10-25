// Adapt existing source records into temporary Play selections. No provider,
// builder, inventory or engine-admission implementation lives here.
import {canonicalPlayName} from './experiments/phase-engine/catalog-admission.mjs';
import {cardRuleSupport,PLAY_CARD_SUPPORT_VERSION} from './play-card-support.js';
import {reviewPracticeSetup} from './experiments/phase-engine/practice-preflight.mjs';
export const PLAY_DECK_SOURCES=Object.freeze([['yours','Your decks'],['precons','Precons'],['community','Community'],['meta','Meta'],['random','Random']]);
const clone=value=>structuredClone(value);
export function playSourceEntries({format,precons=[],metaData=null,community=[],references=[]}={}){
 const result={precons:[],community:[],meta:[]};
 for(const p of precons)if(p?.format===format&&typeof p.file==='string'&&Array.isArray(p.cards))result.precons.push({key:'precon:'+p.file,kind:'precons',detail:['Published precon',p.released].filter(Boolean).join(' · '),deck:{...clone(p),id:'play-precon:'+p.file,source:clone(p.source||{kind:'MTGJSON precon',author:'Wizards of the Coast',url:'https://mtgjson.com/api/v5/decks/'+encodeURIComponent(p.file)})}});
 if(metaData?.format===(format==='Commander'?'EDH':format))for(const d of metaData.decks||[]){
  if(!d?.key||!Array.isArray(d.main)||!Array.isArray(d.commanders||[])||!Array.isArray(d.side||[]))continue;
  result.meta.push({key:'meta:'+d.key,kind:'meta',detail:[d.place,d.event,d.date,format==='Commander'?'Competitive Commander':''].filter(Boolean).join(' · '),deck:{...clone(d),id:'play-meta:'+d.key,name:d.name,format,commander:d.commanders?.[0]?.name||'',cards:clone([...(d.commanders||[]),...d.main]),side:clone(d.side||[]),source:{kind:'Tournament list',author:d.player||'',website:metaData.source||'',url:d.url||d.eventUrl||'',description:[d.event,d.date].filter(Boolean).join(' · ')}}});
 }
 for(const entry of community)if(entry?.deck?.format===format&&Array.isArray(entry.deck.cards))result.community.push({key:'community:'+entry.key,kind:'community',detail:entry.detail||'Shared deck',deck:clone(entry.deck)});
 for(const d of references)if(d?.format===format&&Array.isArray(d.cards))result.community.push({key:'reference:'+d.id,kind:'community',detail:d.source?.author||d.source?.website||'Saved online list',deck:clone(d)});
 return result;
}
export function playDeckSupport(deck){
 if(!Array.isArray(deck?.cards)||!deck.cards.length||!Array.isArray(deck.side||[])||[...deck.cards,...(deck.side||[])].some(r=>typeof r?.name!=='string'||!r.name.trim()||!Number.isSafeInteger(r.qty)||r.qty<1))return {status:'review',label:'List needs review',detail:'Choose a complete list with valid card names and quantities.'};
 const review=reviewPracticeSetup({profile:{signedIn:true,ownerId:'presentation-check'},match:{format:deck?.format,mode:'cpu',difficulty:'Medium'},selected:deck,opponent:deck});
 const seat=review.seats?.player;
 if(!seat)return {status:'review',label:'List needs review',detail:'Rows, quantities or commander declaration need review before play.'};
 const affected=[...new Set([...deck.cards,...(deck.side||[])].map(row=>row.name))].map(name=>({name,kind:cardRuleSupport(canonicalPlayName(name))})).filter(card=>card.kind!=='available');
 const missing=affected.filter(card=>card.kind==='missing'),unimplemented=affected.filter(card=>card.kind==='unimplemented');
 if(affected.length)return {status:'unsupported',label:'Not supported yet',detail:`${missing.length} missing card definition${missing.length===1?'':'s'} · ${unimplemented.length} card${unimplemented.length===1?'':'s'} with unfinished rules. You can still browse and save this exact list.`,affected,coverageVersion:PLAY_CARD_SUPPORT_VERSION};
 return {status:'pool',label:'Rules available',detail:'Card definitions are installed for this exact list. Format legality is checked before dealing; individual interactions may still need fixes.',affected:[],coverageVersion:PLAY_CARD_SUPPORT_VERSION};
}
// The caller performs the normal account-scoped deck write only after Save deck.
export function preparePlayDeckSave(deck,id){
 if(typeof id!=='string'||!id||!deck||!['Standard','Commander'].includes(deck.format)||typeof deck.name!=='string'||!deck.name.trim()||!Array.isArray(deck.cards)||!Array.isArray(deck.side||[])||[...deck.cards,...(deck.side||[])].some(r=>typeof r?.name!=='string'||!r.name.trim()||!Number.isSafeInteger(r.qty)||r.qty<1))throw Error('This list needs review before it can be saved.');
 const copy=clone(deck);copy.id=id;copy.locked=false;copy.versions=[];return copy;
}
export const playDeckSaveKey=deck=>JSON.stringify([deck?.name,deck?.format,deck?.commander,deck?.commanders||[],deck?.cards,deck?.side||[],deck?.referencePriceSelections||null,deck?.source||null]);
export function createPlayDeckSaver({readScope,readDecks,newId,writeDeck}={}){
 let scopeKey=null,saved=new Map(),pending=new Map();
 const scope=()=>{const s=readScope(),key=JSON.stringify(s);if(key!==scopeKey){scopeKey=key;saved=new Map();pending=new Map();}return {key,allowed:!!s?.owner&&!s.locked};};
 function savedId(deck){if(!scope().allowed||!deck)return null;const key=playDeckSaveKey(deck),lists=readDecks()||[];const exact=lists.find(d=>d.id===deck.id&&playDeckSaveKey(d)===key);if(exact)return exact.id;const id=saved.get(key);return lists.some(d=>d.id===id&&playDeckSaveKey(d)===key)?id:null;}
 async function save(deck){const start=scope();if(!start.allowed)throw Error('Sign in before saving a deck.');const existing=savedId(deck);if(existing)return existing;const key=playDeckSaveKey(deck);if(pending.has(key))return pending.get(key);const copy=preparePlayDeckSave(deck,newId()),inFlight=pending,completed=saved;
  const job=(async()=>{await writeDeck(copy);if(scope().key!==start.key)throw Error('The account changed while saving. Review Your decks in the original account.');completed.set(key,copy.id);return copy.id;})();inFlight.set(key,job);try{return await job;}finally{inFlight.delete(key);}
 }
 return {save,savedId,isSaving:deck=>{scope();return !!deck&&pending.has(playDeckSaveKey(deck));}};
}
