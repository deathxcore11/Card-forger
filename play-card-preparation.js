// Resolve the selected printings for a single launch, without changing decks,
// collection, finish selections or the shared catalog. Host capture freezes them.
import {catalogCardMatchesName} from './experiments/phase-engine/catalog-admission.mjs';
export function createPracticeCardPreparation({resolveNames,lookup,fetchPrinting,selectionKey,isCurrent}={}){
 if([resolveNames,lookup,fetchPrinting,selectionKey,isCurrent].some(f=>typeof f!=='function'))throw Error('CARD_PREPARATION_READERS_REQUIRED');
 const printings=new Map();let prepared=false;
 const current=()=>{if(!isCurrent()){printings.clear();prepared=false;throw Error('ACCOUNT_CHANGED');}};
 const matches=catalogCardMatchesName;
 return {
  async prepare(setup){
   current();prepared=false;printings.clear();
   // Keep each row paired with its original deck for its saved reference choice.
   const requested=[];for(const deck of [setup.selected,setup.opponent])for(const row of [...(deck?.cards||[]),...(deck?.side||[])]){
    const id=row.printingId||deck.referencePriceSelections?.[selectionKey(row.name)]?.printingId||null;
    if(id!==null&&(typeof id!=='string'||!id||id.length>160))throw Error('INVALID_PRINTING_SELECTION');
    requested.push({name:row.name,id});
   }
   await resolveNames([...new Set(requested.map(r=>r.name))]);current();
   // Exact printing IDs are not name lookups: a different artwork/finish must
   // never silently replace the version chosen in the deck.
   for(const id of new Set(requested.map(r=>r.id).filter(Boolean))){
    current();let card=lookup(null,id);if(card?.id!==id)card=await fetchPrinting(id);current();
    const names=requested.filter(r=>r.id===id).map(r=>r.name);
    if(card?.id!==id||names.some(n=>!matches(card,n)))throw Error('SELECTED_PRINTING_UNAVAILABLE');
    printings.set(id,structuredClone(card));
   }
   current();prepared=true;
  },
  lookup(name,id){current();if(!prepared)throw Error('CARDS_NOT_PREPARED');const card=id?printings.get(id):lookup(name,null);return card?structuredClone(card):null;}
 };
}
