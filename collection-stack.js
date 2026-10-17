import {conditionName} from './condition-value.js';

const text=v=>String(v??'').trim();
const lower=v=>text(v).toLowerCase();
const number=v=>text(v).replace(/^0+(?=\d)/,'');
// A card name is never enough to collapse different printings. Unknown versions
// remain distinct from named versions; private values and storage locations stay
// attached to their own copies. Import provenance is tracked separately.
export function collectionStackKey(game,e){
 const printing=game==='mtg'
  ? [e.printingId||'',e.printingId?'':lower(e.name),e.printingId?'':lower(e.set||e.setName),e.printingId?'':number(e.collectorNumber),!!e.printingVerified,e.finish||'nonfoil']
  : [String(e.cardId||''),e.printing||'',e.rarity||'',e.variant||'',e.edition||'',e.setReleaseId||'',game==='ygo'&&(!e.setReleaseId||!!e.setReleaseUnverified),game==='ygo'&&!e.setReleaseId?e.releaseName||'':''];
 const condition=conditionName(e.condition);
 return JSON.stringify([game,printing,lower(e.language||'en'),condition,condition==='Unknown condition'?text(e.condition):'',text(e.location),
  !!e.signed,!!e.altered,!!e.misprint,!!e.proxy,e.grade||'',e.gradingCompany||'',e.certification||'',e.artworkId||'',
  e.manualValue??null,e.manualValue!=null?conditionName(e.manualValueCondition):'',e.purchasePrice??null,e.purchaseCurrency||'',e.notes||'']);
}

export function sourceQuantities(e){
 const rows=Array.isArray(e.sourceQuantities)?e.sourceQuantities.filter(x=>typeof x.sourceKey==='string'&&Number.isSafeInteger(x.qty)&&x.qty>0).map(x=>({...x})):[{sourceKey:e.sourceKey||'',qty:e.qty}];
 let delta=e.qty-rows.reduce((n,x)=>n+x.qty,0);
 if(delta>0)rows.push({sourceKey:'',qty:delta});
 // Quantity controls don't select an import. Remove unassigned copies first.
 for(const row of [...rows.filter(x=>!x.sourceKey),...rows.filter(x=>x.sourceKey).reverse()])if(delta<0){const removed=Math.min(row.qty,-delta);row.qty-=removed;delta+=removed;}
 const bySource=new Map();for(const row of rows)if(row.qty)bySource.set(row.sourceKey,(bySource.get(row.sourceKey)||0)+row.qty);
 return [...bySource].map(([sourceKey,qty])=>({sourceKey,qty}));
}
export function withoutCollectionSource(e,sourceKey){
 const parts=sourceQuantities(e).filter(x=>x.sourceKey!==sourceKey),qty=parts.reduce((n,x)=>n+x.qty,0);
 if(!qty)return null;
 return {...e,qty,reserved:Math.min(e.reserved||0,qty),sourceQuantities:parts,sourceKey:parts.length===1?parts[0].sourceKey:''};
}

const receipts=(game,e)=>{
 const rows=Array.isArray(e.scanReceipts)?e.scanReceipts.slice():[];
 if(e.scanCaptureId&&!rows.some(r=>r.id===e.scanCaptureId))rows.push({id:e.scanCaptureId,qty:e.qty,identity:collectionStackKey(game,e)});
 return rows;
};
function merge(game,target,entry){
 const sources=[...sourceQuantities(target),...sourceQuantities(entry)];
 const seen=new Set(),saved=[...receipts(game,target),...receipts(game,entry)].filter(r=>!seen.has(r.id)&&seen.add(r.id));
 if(saved.length)target.scanReceipts=saved;
 target.qty+=entry.qty;
 target.sourceQuantities=sourceQuantities({qty:target.qty,sourceQuantities:sources});
 target.sourceKey=target.sourceQuantities.length===1?target.sourceQuantities[0].sourceKey:'';
 target.reserved=(target.reserved||0)+(entry.reserved||0);
 // Product IDs are optional enrichment, never a reason to lose an exact variant.
 if(!target.productId&&entry.productId)target.productId=entry.productId;
 if(!target.conditionQuotes?.length&&entry.conditionQuotes?.length)target.conditionQuotes=entry.conditionQuotes;
 if(!target.scanCaptureId&&entry.scanCaptureId)target.scanCaptureId=entry.scanCaptureId;
 // Retain acquisition/import metadata from the absorbed rows for backup/export.
 target.stackOrigins=[...(target.stackOrigins||[]),...(entry.stackOrigins||[]),{id:entry.id,qty:entry.qty,addedAt:entry.addedAt,source:entry.source,raw:entry.raw,rawRows:entry.rawRows,importHash:entry.importHash}];
 return target;
}
const compatible=(a,b)=>!(a.productId&&b.productId&&String(a.productId)!==String(b.productId));
export function addCollectionEntry(collection,game,entry){
 const key=collectionStackKey(game,entry),same=collection.find(e=>collectionStackKey(game,e)===key&&compatible(e,entry)&&e.qty+entry.qty<=100000);
 if(same)return merge(game,same,entry);
 collection.push(entry);return entry;
}

// Run at the common workspace boundary: scan, Search, set view, import, deck
// acquisition and old saved duplicates all obey the same identity rules.
export function stackWorkspaceCollections(state){
 for(const [game,workspace] of [['mtg',state],...Object.entries(state.tcg||{})]){
  const byKey=new Map(),rows=[],aliases=new Map();
  for(const e of workspace.collection||[]){
   if(e.sourceQuantities)e.sourceQuantities=sourceQuantities(e);
   const key=collectionStackKey(game,e),candidates=byKey.get(key)||[],same=candidates.find(x=>compatible(x,e)&&x.qty+e.qty<=100000);
   if(same){merge(game,same,e);aliases.set(e.id,same.id);}
   else{rows.push(e);candidates.push(e);byKey.set(key,candidates);}
  }
  workspace.collection=rows;
  for(const binder of state.settings?.binders||[]){
   if((binder.game||'mtg')!==game)continue;
   if(aliases.has(binder.featured))binder.featured=aliases.get(binder.featured);
   if(Array.isArray(binder.favorites))binder.favorites=[...new Set(binder.favorites.map(id=>aliases.get(id)||id))];
  }
 }
 return state;
}

export function addScannedEntry(state,game,entry){
 const id=entry.scanCaptureId,identity=collectionStackKey(game,entry);
 if(id){
  for(const [g,workspace] of [['mtg',state],...Object.entries(state.tcg||{})])for(const lot of workspace.collection||[]){
   const prior=receipts(g,lot).find(r=>r.id===id);
   if(!prior)continue;
   if(prior.qty!==entry.qty||prior.identity!==identity)throw Error('This capture is already saved with different details. Check its collection entry before trying again.');
   return lot;
  }
  entry.scanReceipts=[{id,qty:entry.qty,identity}];
 }
 const workspace=game==='mtg'?state:state.tcg[game];
 return addCollectionEntry(workspace.collection,game,entry);
}
