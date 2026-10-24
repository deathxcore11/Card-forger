import {cardKey} from './core.js';
import {FORMATS} from './formats.js';
import {wikiSourceForGame,isAllowedWikiUrl} from './wiki-sources.js';

// A Wiki deck is an explicit source snapshot. It never enters construction,
// fills missing slots, chooses a format, or borrows a list from an archetype.
const MAX_DECKS=20,MAX_ROWS=200,MAX_TOTAL=1000;
const clean=value=>typeof value==='string'?value.normalize('NFC').trim():'';
const key=value=>clean(value).replace(/_/g,' ').toLocaleLowerCase('en-US');
const invalid=()=>Error('This article does not contain a supported source decklist.');
function articleTitle(game,url){
 try{const source=wikiSourceForGame(game);return isAllowedWikiUrl(game,url)?decodeURIComponent(new URL(url).pathname.slice(source.articlePath.length)).replace(/_/g,' '):'';}catch{return '';}
}
function exactCardReference(value){
 try{const url=new URL(value);if(url.origin!=='https://scryfall.com'||url.pathname!=='/search'||url.username||url.password||url.hash||url.href.length>900||url.searchParams.getAll('q').length!==1)return null;const match=(url.searchParams.get('q')||'').match(/^!"([^"<>\[\]{}|\\\u0000-\u001f]{1,180})"(?:\s+set:([a-z0-9]{2,8})(?:\s+cn:"([^"<>\u0000-\u001f]{1,30})")?)?$/i);return match?{name:match[1],...(match[2]?{set:match[2].toLowerCase()}:{}),...(match[3]?{number:match[3]}:{})}:null;}catch{return null;}
}
const formatName=value=>FORMATS.find(f=>f.name===value||f.id===value)?.name||null;
const imageFor=(card,name)=>{
 const face=card?.card_faces?.find(f=>cardKey(f.name)===cardKey(name)),value=face?.image_uris?.normal||card?.image_uris?.normal||card?.card_faces?.[0]?.image_uris?.normal||'';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
};

/** Validate one parser-owned deck and retain every sourced row in its order. */
export function readWikiSourceDeck(response,index,{game='mtg'}={}){
 const article=response?.article,provider=wikiSourceForGame(game),source=article?.source||response?.source;
 if(game!=='mtg'||response?.game!==game||response?.status!=='available'||response?.mode!=='article'||!article||article.game&&article.game!==game||!clean(article.title)||!source||!provider||!isAllowedWikiUrl(game,source.url)||key(articleTitle(game,source.url))!==key(article.title)||source.game&&source.game!==game)throw invalid();
 if(response.source&&(!isAllowedWikiUrl(game,response.source.url)||response.source.game&&response.source.game!==game||key(articleTitle(game,response.source.url))!==key(article.title)))throw invalid();
 const decks=article.decks;
 if(!Array.isArray(decks)||decks.length>MAX_DECKS||!Number.isSafeInteger(index)||index<0||index>=decks.length)throw invalid();
 const deck=decks[index],title=clean(deck?.title),rows=deck?.rows;
 if(!deck||!clean(deck.id)||deck.id.length>100||deck.game!==game||deck.evidenceKind!=='explicit-deck-container'||!title||title.length>200||/[<>\u0000-\u001f\u007f]/.test(title)||!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS||!Array.isArray(deck.evidence)||deck.evidence.length!==rows.length)throw invalid();
 const sourceUrl=deck.source?.url||source.url;
 if(!isAllowedWikiUrl(game,sourceUrl)||key(articleTitle(game,sourceUrl))!==key(article.title)||deck.source?.game&&deck.source.game!==game)throw invalid();
 let total=0;
 const snapshot=rows.map((row,i)=>{
  const name=clean(row?.name),evidence=clean(row?.evidence),raw=clean(deck.evidence[i]),card=exactCardReference(row?.cardUrl);
  if(!name||name.length>180||/[<>\u0000-\u001f\u007f]/.test(name)||!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>250||!['main','side','commander'].includes(row.zone)||evidence!==`${row.qty} ${name}`||raw!==evidence||!card||card.name!==name||row.set&&row.set!==card.set||row.number&&row.number!==card.number)throw invalid();
  total+=row.qty;if(total>MAX_TOTAL)throw invalid();
  return {name,qty:row.qty,zone:row.zone,cardUrl:row.cardUrl,evidence,...(card.set?{set:card.set}:{}),...(card.number?{number:card.number}:{})};
 });
 const declaredFormat=typeof deck.format==='string'?formatName(deck.format):null,commanders=snapshot.filter(r=>r.zone==='commander'),declaredCommander=clean(deck.commander);
 if(declaredCommander&&!snapshot.some(r=>key(r.name)===key(declaredCommander)))throw invalid();
 const commander=declaredCommander&&snapshot.some(r=>key(r.name)===key(declaredCommander))?declaredCommander:commanders.length===1&&commanders[0].qty===1?commanders[0].name:'';
 return {game,id:clean(deck.id),title,format:declaredFormat,commander,rows:snapshot,total,source:{...source,...deck.source,url:sourceUrl,title:article.title,publisher:provider.publisher,name:provider.name},canSave:false};
}

export function exportWikiDeck(snapshot){
 let zone='';const lines=[];
 for(const row of snapshot.rows){
  if(zone!==row.zone){if(lines.length)lines.push('');if(row.zone!=='main'||zone)lines.push(({main:'Deck',commander:'Commander',side:'Sideboard',extra:'Extra Deck'})[row.zone]);zone=row.zone;}
  lines.push(`${row.qty} ${row.name}`);
 }
 return lines.join('\n');
}

/** Reuse the existing shared/proven inspector, with explicit copy/import only. */
export function createWikiDeckHandoff(x){
 const entries=new Map();let serial=0;
 const live=item=>item&&item.current()&&x.game()===item.snapshot.game&&x.article()===item.article;
 const get=token=>{const item=entries.get(token);if(!live(item))throw Error('The article or workspace changed. Open the source deck again.');return item;};
 const open=async index=>{
  const article=x.article(),game=x.game(),snapshot=readWikiSourceDeck(article,index,{game}),token='wiki-source-'+(++serial),current=x.scope();
  const item={article,snapshot,current};entries.set(token,item);while(entries.size>20)entries.delete(entries.keys().next().value);
  const reference={token,sourceLabel:snapshot.source.name,sourceUrl:snapshot.source.url};
  const matched=row=>{const candidate=x.lookup?.(game,row.name);return candidate&&(cardKey(candidate.name)===cardKey(row.name)||candidate.card_faces?.some(f=>cardKey(f.name)===cardKey(row.name)))&&(!row.set||candidate.set===row.set)&&(!row.number||String(candidate.collector_number)===row.number)?candidate:null;};
  const cards=snapshot.rows.map(row=>{const card=matched(row);return {name:row.name,qty:row.qty,zone:row.zone==='commander'?'main':row.zone,id:card?.id||'',image:imageFor(card,row.name),referenceUSD:null};});
  const sharedItem={key:token,kind:'deck',game,title:snapshot.title,format:snapshot.format||'',commander:snapshot.commander,deckSchema:0,appearance:{},cards};
  const spec={g:game,key:token,title:snapshot.title,sharedItem,sourceReference:reference,rows:cards.map((r,i)=>({key:String(i),name:r.name,qty:r.qty,owned:0,price:null})),save:async()=>{get(token);throw Error('Use Import deck to choose a format and match this source list before saving.');}};
  if(x.hydrate)spec.load=async status=>{if(!live(item))return;await x.hydrate([...new Set(snapshot.rows.map(r=>r.name))],message=>{if(live(item))status(message);});if(!live(item))return;for(const [i,row]of snapshot.rows.entries()){const card=matched(row);Object.assign(cards[i],{id:card?.id||'',image:imageFor(card,row.name)});}};
  if(!live(item))throw Error('The article or workspace changed. Open the source deck again.');
  await x.openProven(spec);return token;
 };
 x.A.wikiDeck=button=>{const raw=button.dataset.wikiDeck;if(!/^(?:0|[1-9]\d?)$/.test(raw||''))throw invalid();return open(Number(raw));};
 x.A.wikiDeckExport=button=>{const {snapshot}=get(button.dataset.wikiResult);return x.exportText(exportWikiDeck(snapshot),snapshot);};
 x.A.wikiDeckImport=button=>{const {snapshot}=get(button.dataset.wikiResult);return x.importDeck({...structuredClone(snapshot),text:exportWikiDeck(snapshot)});};
 x.A.wikiDeckCard=button=>{const item=get(button.dataset.wikiResult),index=Number(button.dataset.index),row=Number.isSafeInteger(index)&&item.snapshot.rows[index];if(row)return x.card(item.snapshot.game,row,()=>live(item));};
 return {open};
}
