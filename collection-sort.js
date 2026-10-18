import {options} from './ui.js';
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export const collectionSortOptions=(game)=>[['set-order','Set year · card number'],['value','Collection value'],['impact','Deck-building value'],['name','Name'],['set','Set'],['rarity','Rarity'],['recent','Recently added'],...(game==='mtg'?[['color','Color'],['mv','Mana value']]:[])];
export const defaultCollectionDirection=sort=>['name','set','rarity','color','mv'].includes(sort)?'asc':'desc';
export function collectionSortControls(game,sort,direction){
 const items=collectionSortOptions(game),selected=items.some(([key])=>key===sort)?sort:'recent',dir=direction||defaultCollectionDirection(selected),prefix=game==='mtg'?'':'t';
 return `<div class="collection-sort-controls"><label class="collection-sort-label">Sort<select data-change="${prefix? 'tCollSort':'collSort'}" aria-label="Sort collection">${options(items,selected)}</select></label><label class="collection-direction-label"><span class="sr-only">Sort direction</span><select data-change="${prefix?'tCollDirection':'collDirection'}" aria-label="Collection sort direction">${options([['asc','Ascending'],['desc','Descending']],dir)}</select></label></div>`;
}
const present=x=>x!==null&&x!==undefined&&x!==''&&!(typeof x==='number'&&!Number.isFinite(x));
function compareKnown(a,b,dir,numeric=false){if(!present(a)||!present(b))return present(a)?-1:present(b)?1:0;const n=numeric?Number(a)-Number(b):collator.compare(String(a),String(b));return dir==='desc'?-n:n;}
// Normalized descriptors only. Sort never changes lots or their valuation source.
export function compareCollectionRows(a,b,sort='recent',direction){
 const dir=direction||defaultCollectionDirection(sort);
 const tie=()=>collator.compare(a.name||'',b.name||'')||collator.compare(a.set||'',b.set||'')||collator.compare(String(a.number||''),String(b.number||''))||collator.compare(String(a.id||''),String(b.id||''));
 if(sort==='set-order'){
  const date=x=>/^\d{4}(?:-|$)/.test(String(x.date||''))?String(x.date):null;
  return compareKnown(date(a),date(b),dir)||collator.compare(a.set||'',b.set||'')||collator.compare(String(a.number||''),String(b.number||''))||tie();
 }
 const field={value:'value',impact:'impact',name:'name',set:'set',rarity:'rarity',recent:'recent',color:'color',mv:'mv'}[sort]||'name';
 return compareKnown(a[field],b[field],dir,['value','impact','color','mv','recent'].includes(field)&&typeof a[field]==='number'&&typeof b[field]==='number')||(sort==='impact'?compareKnown(a.value,b.value,dir,true):0)||tie();
}
