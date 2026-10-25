// Research-only presentation selection. No fetch, deck mutation, match start,
// construction verdict or CPU skill claim. The caller owns the catalog snapshot.
const day=86400000;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max=512)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
function date(x){check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'invalid-date');return Date.parse(x);}
function url(x){check(text(x,4096),'invalid-source-url');const u=new URL(x);check(u.protocol==='https:'&&!u.username&&!u.password,'invalid-source-url');}
const name=x=>x.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
export function deckContentsKey(deck,format){
 check(plain(deck)&&['Standard','Commander'].includes(format),'invalid-deck');
 const zones=['main','commanders','side'].map(zone=>{
  const rows=deck[zone];check(Array.isArray(rows)&&rows.length<=2000,'invalid-zone');
  const counts=new Map();
  for(const r of rows){check(plain(r)&&text(r.name)&&Number.isSafeInteger(r.qty)&&r.qty>0&&r.qty<=1000,'invalid-card-row');const key=name(r.name),qty=(counts.get(key)||0)+r.qty;check(qty<=10000,'invalid-card-count');counts.set(key,qty);}
  return [zone,[...counts].sort(([a],[b])=>cmp(a,b))];
 });
 check(zones[0][1].length>0,'empty-main');
 // This key groups equal named cards/quantities/zones for shelf variety only.
 // Printing/finish variants remain separate original records; it is not a
 // canonical Oracle-ID resolver or a saved-match integrity hash.
 return JSON.stringify([format,...zones]);
}
function rank(seed,key){let h=2166136261;for(const c of seed+'\0'+key){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function entry(row){
 check(plain(row)&&text(row.id,180)&&text(row.archetype,180),'invalid-identity');
 check(['Standard','Commander'].includes(row.format),'invalid-format');
 check(row.format==='Standard'?row.scope==='standard':['commander','cedh'].includes(row.scope),'invalid-scope');
 check(['precon','meta','curated','saved','generated','import'].includes(row.kind),'invalid-kind');
 check(plain(row.source)&&text(row.source.id,160)&&text(row.source.version,200),'missing-source-version');url(row.source.url);
 check(row.listStatus==='loaded','missing-list');
 const published=date(row.publishedAt),added=row.addedAt===null?null:date(row.addedAt);
 return {row,key:deckContentsKey(row.deck,row.format),published,added,group:name(row.archetype)};
}
export function selectDeckShelf(rows,{format,scope,section='featured',asOf,rotationKey,previousIds=[],limit=6,maxAgeDays=30}={}){
 check(Array.isArray(rows)&&rows.length<=5000,'catalog-limit');
 check(['Standard','Commander'].includes(format)&&(format==='Standard'?scope==='standard':['commander','cedh'].includes(scope)),'invalid-scope');
 check(['featured','meta','new'].includes(section)&&text(rotationKey,160),'invalid-rotation');
 check(Number.isInteger(limit)&&limit>=1&&limit<=24&&Number.isInteger(maxAgeDays)&&maxAgeDays>=1&&maxAgeDays<=365,'invalid-options');
 check(Array.isArray(previousIds)&&previousIds.length<=1000&&previousIds.every(id=>text(id,180)),'invalid-history');
 const now=date(asOf),previous=new Set(previousIds),seen=new Set(),groups=new Map(),rejected=[],omitted=[];
 for(const row of rows){
  // Ambiguous source identity is a catalog failure, not an arbitrary winner.
  if(text(row?.id,180)){check(!seen.has(row.id),'duplicate-id');seen.add(row.id);}
  let parsed;try{parsed=entry(row);}catch(error){rejected.push({id:text(row?.id,180)?row.id:null,reason:error.message});continue;}
  const {published,added,key}=parsed;
  let reason=null;
  if(row.format!==format||row.scope!==scope)reason='different-scope';
  else if(published>now||(added!==null&&added>now))reason='future-date';
  else if(section==='meta'&&row.kind!=='meta')reason='not-meta';
  else if(section==='meta'&&now-published>maxAgeDays*day)reason='stale-meta';
  else if(section==='new'&&(added===null||now-added>maxAgeDays*day))reason='not-new-to-catalog';
  if(reason){omitted.push({id:row.id,reason});continue;}
  const group=groups.get(key)||[];group.push(parsed);groups.set(key,group);
 }
 const choices=[...groups.values()].map(variants=>{
  variants.sort((a,b)=>b.published-a.published||cmp(a.row.id,b.row.id));
  const selected=variants[0];return {...selected,ids:variants.map(v=>v.row.id).sort(cmp),seen:variants.some(v=>previous.has(v.row.id)),rank:rank(rotationKey,selected.key)};
 });
 const selected=[],archetypes=new Map(),sources=new Map();
 while(choices.length&&selected.length<limit){
  choices.sort((a,b)=>Number(a.seen)-Number(b.seen)||
   (archetypes.get(a.group)||0)-(archetypes.get(b.group)||0)||
   (sources.get(a.row.source.id)||0)-(sources.get(b.row.source.id)||0)||
   a.rank-b.rank||cmp(a.row.id,b.row.id));
  const chosen=choices.shift();selected.push({id:chosen.row.id,equivalentIds:chosen.ids});
  archetypes.set(chosen.group,(archetypes.get(chosen.group)||0)+1);sources.set(chosen.row.source.id,(sources.get(chosen.row.source.id)||0)+1);
 }
 return {schema:1,format,scope,section,asOf,rotationKey,selections:selected,distinctLists:groups.size,rejected,omitted,
  // Shelf membership is never an authorization to enter gameplay.
  matchAdmission:'unverified'};
}

export function metaShelfEntries(data,{sourceId,snapshotVersion,firstSeen={}}={}){
 check(plain(data)&&data.game==='mtg'&&['Standard','EDH'].includes(data.format)&&Array.isArray(data.decks)&&data.decks.length<=5000,'invalid-meta-feed');
 check(text(sourceId,160)&&text(snapshotVersion,200)&&plain(firstSeen),'invalid-feed-source');
 const format=data.format==='EDH'?'Commander':'Standard',scope=data.format==='EDH'?'cedh':'standard';
 return data.decks.map(deck=>({id:deck.key,format,scope,kind:'meta',archetype:deck.archetype||deck.name,
  publishedAt:deck.date,addedAt:Object.hasOwn(firstSeen,deck.key)?firstSeen[deck.key]:null,
  listStatus:Array.isArray(deck.main)&&deck.main.length?'loaded':'missing',
  source:{id:sourceId,version:snapshotVersion,url:deck.eventUrl||deck.url},
  // Retain complete rows for later preview/validation; never truncate to a few
  // representative cards or attach a fabricated printing to name-only data.
  deck:{main:structuredClone(deck.main),side:structuredClone(deck.side??[]),commanders:structuredClone(deck.commanders??[])}}));
}
