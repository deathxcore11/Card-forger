// Real token artwork for the Play table. Forge names a token ("Goblin Token") and gives its
// stats, colors and type line, but no printing, so the table looks it up on Scryfall once
// and remembers the answer. Presentation only: the rules still come from Forge.
import {createScryfallClient} from './scryfall-client.js';
const STORE='cardstashy.tokenArt.v1',LIMIT=240,MISS_TTL=864e5;
const memory=new Map(),pending=new Map();let api=null,stored=null;
const storage=win=>{try{return win?.localStorage||null;}catch{return null;}};
function load(win){
 if(stored)return stored;stored={};
 try{const data=JSON.parse(storage(win)?.getItem(STORE)||'{}');if(data&&typeof data==='object')stored=data;}catch{}
 return stored;
}
function save(win,key,value){
 const all=load(win);all[key]=value;const keys=Object.keys(all);
 for(const k of keys.slice(0,Math.max(0,keys.length-LIMIT)))delete all[k];
 try{storage(win)?.setItem(STORE,JSON.stringify(all));}catch{}
}
const baseName=card=>String(card?.name||'').replace(/\s+token$/i,'').trim();
const stat=v=>/^\d+$/.test(String(v??''))?String(v):null;
const colorTerm=card=>Array.isArray(card?.tokenColors)?`c=${card.tokenColors.join('').toLowerCase()||'c'}`:'';
export function tokenArtKey(card){
 if(!card?.isToken||!baseName(card))return '';
 return [baseName(card).toLowerCase(),stat(card.power)||'',stat(card.toughness)||'',colorTerm(card)].join('|');
}
// Most exact first: name with stats and colors, then the name alone, then the creature types.
function queries(card){
 const name=baseName(card).replace(/"/g,''),p=stat(card.power),t=stat(card.toughness),stats=p&&t?`pow=${p} tou=${t}`:'',color=colorTerm(card);
 const subtypes=String(card.type||'').split(/\s+[—-]\s+/)[1]?.split(/\s+/).filter(w=>/^[A-Za-z']+$/.test(w))||[];
 const list=[`t:token !"${name}" ${stats} ${color}`,`t:token !"${name}"`];
 if(subtypes.length)list.push(`t:token ${subtypes.map(s=>'t:'+s.toLowerCase()).join(' ')} ${stats} ${color}`);
 return [...new Set(list.map(q=>q.replace(/\s+/g,' ').trim()))];
}
function pick(card){
 const uris=card?.image_uris||card?.card_faces?.[0]?.image_uris;
 return uris?.normal?{art:uris.art_crop||uris.normal,normal:uris.normal,large:uris.large||uris.normal}:null;
}
function artwork(found){
 if(!found)return null;const imageSources=[...new Set([found.normal,found.large].filter(Boolean))];
 return {imageSources,imageUrl:found.normal,artImageUrl:found.art,tokenPrinting:true};
}
// Synchronous: the artwork when it is known, otherwise null (and undefined while unknown).
export function cachedTokenArt(card,win){
 const key=tokenArtKey(card);if(!key)return null;
 if(memory.has(key))return artwork(memory.get(key));
 const hit=load(win)[key];
 if(hit&&(hit.art||Date.now()-(hit.at||0)<MISS_TTL)){memory.set(key,hit.art?hit:null);return artwork(memory.get(key));}
 return undefined;
}
// One lookup per token kind, shared by every copy on the table; resolves to the artwork or null.
export function loadTokenArt(card,win){
 const key=tokenArtKey(card);if(!key)return Promise.resolve(null);
 const known=cachedTokenArt(card,win);if(known!==undefined)return Promise.resolve(known);
 if(pending.has(key))return pending.get(key);
 api||=createScryfallClient({fetcher:(...args)=>win.fetch(...args),maxActive:2});
 const job=(async()=>{
  let found=null,failed=false;
  for(const q of queries(card)){
   try{const data=await api(`/cards/search?${new URLSearchParams({q,order:'released',dir:'desc',unique:'art'})}`);found=pick(data?.data?.[0]);if(found)break;}
   catch(e){if(e?.status!==404){failed=true;break;}}
  }
  // A network failure is only remembered until reload; a real "no printing" is kept for a day.
  memory.set(key,found);if(!failed)save(win,key,found?{...found,at:Date.now()}:{art:null,at:Date.now()});
  pending.delete(key);return artwork(found);
 })();
 pending.set(key,job);return job;
}
