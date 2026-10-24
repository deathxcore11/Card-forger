// A bounded, current Standard reference lane. Source qualification is not a
// strategy proof: the caller must run its exact-list plan/support assessment.
// No fetch, application-state writes, automatic repair or tournament-stat editing.
import { cardKey, effectiveCopyLimit } from './core.js';
import { fitsTypeRestrictions } from './planner.js';
import { eligiblePrinting } from './mtg-cheap.js';

export const REFERENCE_POLICY = Object.freeze({ eventDays:14, snapshotHours:12, maxEntries:12, maxCandidates:2, batchWidth:4, maxUniqueNames:150 });
const DAY=864e5, STANDARD=Object.freeze({id:'standard',name:'Standard',legality:'standard',copies:4});
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const text=value=>typeof value==='string'?value.trim():'';
const knownName=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!/[<>\u0000-\u001f\u007f]/.test(value);
const issue=(code,message,details={})=>({code,message,...details});
const standard=value=>typeof value==='string'&&value.toLowerCase()==='standard';
const count=rows=>rows.reduce((n,r)=>n+r.qty,0);
const bounded=(value,fallback,maximum)=>Number.isInteger(value)&&value>0?Math.min(value,maximum):fallback;
const valueOf=(provider,name)=>typeof provider==='function'?provider(name):provider instanceof Map?provider.get(cardKey(name))??provider.get(name):provider?.[cardKey(name)]??provider?.[name];
const mode=value=>['bo1','bo3'].includes(String(value).toLowerCase())?String(value).toLowerCase():'unspecified';
const possibleFrontForm=(a,b)=>cardKey(a)===cardKey(b)||[a,b].some((name,i)=>{const parts=String(name).split(' // ');return parts.length===2&&parts.every(knownName)&&cardKey(parts[0])===cardKey(i?a:b);});
const platform=value=>['arena','mtgo','paper'].includes(String(value).toLowerCase())?String(value).toLowerCase():'unspecified';
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d))?$/.test(value))return null;
 const day=value.slice(0,10),dayTime=Date.parse(day),time=Date.parse(value);
 return Number.isFinite(time)&&Number.isFinite(dayTime)&&new Date(dayTime).toISOString().slice(0,10)===day?time:null;
}
function officialUrl(value,{event=false}={}){
 if(typeof value!=='string'||/[\u0000-\u0020\\]|%2f|%5c|%2e/i.test(value))return '';
 try{const url=new URL(value);return url.protocol==='https:'&&['www.mtgo.com','mtgo.com'].includes(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&(!event||/^\/decklist\/standard-(?:challenge|league|championship|showcase|qualifier|super-qualifier|last-chance)[a-z0-9-]*\d{4}-\d{2}-\d{2}[a-z0-9-]*$/.test(url.pathname))?url.href:'';}catch{return '';}
}
function aggregate(rows,zone,issues){
 if(!Array.isArray(rows)||rows.length>75){issues.push(issue('malformed-list',`${zone} list must contain at most 75 explicit card rows.`,{zone}));return [];}
 const by=new Map();
 for(const row of rows){
  if(!knownName(row?.name)||!Number.isInteger(row?.qty)||row.qty<=0||row.qty>75){issues.push(issue('invalid-quantity','Card names and positive integer quantities are required; no rows were silently discarded.',{zone,name:row?.name??null}));continue;}
  const key=cardKey(row.name),old=by.get(key);by.set(key,{name:old?.name||row.name.trim(),qty:(old?.qty||0)+row.qty,...(row.land===true?{land:true}:{})});
 }
 return [...by.values()].sort((a,b)=>cardKey(a.name).localeCompare(cardKey(b.name)));
}
export function referenceListSignature(deck={}){
 const counts=new Map();
 for(const [zone,rows] of [['main',deck.cards||deck.main||[]],['side',deck.side||[]]])for(const row of rows){const key=JSON.stringify([zone,cardKey(row.name)]);counts.set(key,(counts.get(key)||0)+row.qty);}
 return JSON.stringify([...counts].sort(([a],[b])=>a.localeCompare(b)));
}
// Only a genuinely user-supplied or conservatively legacy seed is a hard anchor.
export function referenceRequiredAnchors(request={}){
 const seedRequired=request.seedOrigin==='user'||request.seedOrigin===undefined;
 return [...new Map([...(request.requiredAnchorNames||[]),...(request.required_cards||[]),...(seedRequired?[request.seed||request.seedCard?.name]:[])].filter(knownName).map(name=>[cardKey(name),name])).values()];
}
export function referenceRequestFingerprint(request={}){
 const fields=['game','format','platform','matchMode','seedOrigin','theme','style','goal','easy','budget','budgetMode','budgetBoundary','budgetBasis','ownedOnly','preferOwned','colors','creatureTypesOnly','excludedSubtypes','required_cards','excluded_cards','requireLoop','loopOutput','unsupportedLoop','loopConflict','avoid_infinite'];
 return JSON.stringify([...fields.map(field=>[field,request[field]??null]),['requiredAnchorNames',referenceRequiredAnchors(request).map(cardKey).sort()]]);
}
function sourceMode(deck,data,eventUrl){
 const requested=mode(deck.sourceMatchMode??deck.matchMode??data.sourceMatchMode??data.matchMode),evidence=deck.sourceMatchModeEvidence??data.sourceMatchModeEvidence;
 const valid=requested!=='unspecified'&&evidence&&mode(evidence.matchMode)===requested&&text(evidence.statement)&&officialUrl(evidence.url)&&(['event','publisher-policy'].includes(evidence.kind))&&(evidence.kind!=='event'||evidence.url===eventUrl);
 return {sourceMatchMode:valid?requested:'unspecified',sourceMatchModeEvidence:valid?clone(evidence):null};
}
function modeCoverage(origin,request,sideIncluded){
 const requested=mode(request.matchMode),requestedPlatform=platform(request.platform),modeMatched=requested!=='unspecified'&&origin.sourceMatchMode===requested;
 const platformMatched=requestedPlatform==='unspecified'||requestedPlatform===origin.sourcePlatform;
 const mismatch=requested!=='unspecified'&&!modeMatched||!platformMatched;
 return {requestedMatchMode:requested,requestedPlatform,sourceMatchMode:origin.sourceMatchMode,sourcePlatform:origin.sourcePlatform,sideIncluded,modeMatched,platformMatched,modeMismatch:mismatch,evidenceScope:mismatch?'exploratory-main-deck-reference':'published-source-list',testedForRequestedMode:modeMatched&&platformMatched};
}
function differences(origin,deck){
 const before=new Map(),after=new Map();
 for(const [map,list] of [[before,canonicalReferenceList(origin,{main:origin.rawMain,side:origin.rawSide})],[after,canonicalReferenceList(origin,deck)]])for(const [zone,rows] of Object.entries(list))for(const row of rows){const id=JSON.stringify([zone,cardKey(row.name)]),old=map.get(id);map.set(id,{zone,name:row.name,qty:(old?.qty||0)+row.qty});}
 return [...new Set([...before.keys(),...after.keys()])].sort().map(id=>{const old=before.get(id),next=after.get(id);return {zone:(next||old).zone,name:(next||old).name,before:old?.qty||0,after:next?.qty||0,delta:(next?.qty||0)-(old?.qty||0)};}).filter(row=>row.delta);
}
// Recompute this after EVERY list edit. The original record belongs only to the
// published source: an adaptation never inherits its placing or win/loss record.
export function referenceAdaptation(origin,deck,request={}){
 const canonicalOriginalListSignature=referenceListSignature(canonicalReferenceList(origin,{main:origin.rawMain,side:origin.rawSide})),currentListSignature=referenceListSignature(canonicalReferenceList(origin,deck)),changes=differences(origin,deck),sameList=currentListSignature===canonicalOriginalListSignature,coverage=modeCoverage(origin,request,(deck.side||[]).length>0);
 return {kind:sameList?'exact-source-list':changes.every(row=>row.zone==='side'&&row.after===0)?'main-deck-only':'adapted-list',changes,originalListSignature:origin.originalListSignature,canonicalOriginalListSignature,currentListSignature,sameList,sourceResultAppliesToExactList:sameList&&!coverage.modeMismatch,retainedPackages:[],lostCapabilities:changes.length?['Original tournament-list performance evidence does not establish the adapted list’s performance.']:[],...coverage,testedForRequestedMode:sameList&&coverage.testedForRequestedMode,evidenceScope:!sameList?'adapted-source-reference':coverage.evidenceScope};
}
function diversity(candidates,limit){
 const pool=[...candidates],selected=[];
 const weights=candidate=>new Map(candidate.main.filter(row=>!row.land).map(row=>[cardKey(row.name),row.qty]));
 const distance=(a,b)=>{const aa=weights(a),bb=weights(b),keys=new Set([...aa.keys(),...bb.keys()]);let shared=0,total=0;for(const key of keys){shared+=Math.min(aa.get(key)||0,bb.get(key)||0);total+=Math.max(aa.get(key)||0,bb.get(key)||0);}return total?1-shared/total:0;};
 while(pool.length&&selected.length<limit){let at=0;if(selected.length){let best=-1;for(let i=0;i<pool.length;i++){const score=Math.min(...selected.map(chosen=>distance(chosen,pool[i])));if(score>best){best=score;at=i;}}}selected.push(...pool.splice(at,1));}
 return selected;
}
/** Qualify bounded cached source entries. This is stricter than editorial curation.
 * now is caller-supplied. cacheState may be metaState()'s {at,error}; a recent
 * cache write never rejuvenates an expired fetchedAt or event date.
 */
export function referenceCandidates(data,request={},options={}){
 const {now,cacheState}=options,rejections=[],notes=[],reject=(code,message,details)=>rejections.push(issue(code,message,details));
 const done=candidates=>({candidates,rejections,notes,constructionBasis:candidates.length?'reference':'heuristic',policy:REFERENCE_POLICY});
 if(!Number.isFinite(now)){reject('invalid-clock','Reference checks require a supplied current timestamp.');return done([]);}
 if(request.game!=='mtg'||!standard(request.format)||data?.game!=='mtg'||!standard(data.format)||data.sourceFormat!==undefined&&!standard(data.sourceFormat)){reject('unsupported-format','This bounded reference lane accepts only explicit Magic Standard source data and requests.');return done([]);}
 if(data.sourceUrl!==undefined&&!officialUrl(data.sourceUrl)||data.source!==undefined&&text(data.source)&&!/^(?:Magic Online(?: \(official decklists\))?|MTGO)$/i.test(text(data.source))){reject('conflicting-source-provenance','Declared source URL or label conflicts with the official Magic Online source lane.');return done([]);}
 if(request.commander||request.commanders?.length){reject('commander-slot','Standard has no commander slot.');return done([]);}
 if(data.stale||data.error||cacheState?.error||cacheState?.stale){reject('stale-source','A stale or failed-refresh snapshot is not current reference evidence.');return done([]);}
 const fetched=timestamp(data.fetchedAt);
 if(fetched===null||fetched>now||now-fetched>REFERENCE_POLICY.snapshotHours*3600e3){reject('stale-snapshot','Source fetch time is missing, invalid, future-dated or older than 12 hours.');return done([]);}
 if(cacheState?.at!==undefined&&(!Number.isFinite(cacheState.at)||cacheState.at>now||now-cacheState.at>REFERENCE_POLICY.snapshotHours*3600e3)){reject('stale-cache','The supplied cache timestamp is not current.');return done([]);}
 if(!Array.isArray(data.decks)){reject('missing-source-lists','No structured source lists were available.');return done([]);}
 const candidates=[],seen=new Set(),limit=bounded(options.maxEntries,REFERENCE_POLICY.maxEntries,REFERENCE_POLICY.maxEntries);
 for(const deck of data.decks.slice(0,limit)){
  const problems=[],key=text(deck?.key),eventUrl=officialUrl(deck?.eventUrl||deck?.url,{event:true}),sourceUrl=officialUrl(deck?.sourceUrl||deck?.url||deck?.eventUrl,{event:true}),eventDate=deck?.eventDate||deck?.date,date=timestamp(eventDate);
  if(!key||!text(deck?.event)||!eventUrl||!sourceUrl||eventUrl!==sourceUrl)problems.push(issue('missing-provenance','An allowlisted official Standard event URL, source key and event name are required.'));
  if(deck?.stale||deck?.game&&deck.game!=='mtg'||deck?.format&&!standard(deck.format)||deck?.sourceFormat&&!standard(deck.sourceFormat)||deck?.commander||deck?.commanders?.length||/\bcEDH\b/i.test(`${deck?.event||''} ${deck?.name||''}`))problems.push(issue('wrong-source-format','Wrong-format, Commander/cEDH or stale source entries cannot seed Standard.'));
  if(date===null||date>now||now-date>REFERENCE_POLICY.eventDays*DAY)problems.push(issue('event-date','Event date is missing, malformed, future-dated or outside the 14-day source window.'));
  const urlDate=eventUrl.match(/(\d{4}-\d{2}-\d{2})/)?.[1];if(date!==null&&urlDate!==String(eventDate).slice(0,10))problems.push(issue('event-date-mismatch','Event URL and event date disagree.'));
  const declaredDays=data.days;if(declaredDays!==undefined&&(!Number.isFinite(declaredDays)||declaredDays<=0||date!==null&&now-date>Math.min(REFERENCE_POLICY.eventDays,declaredDays)*DAY))problems.push(issue('source-window','Event falls outside its declared source window.'));
  if(deck?.sourcePlatform&&platform(deck.sourcePlatform)!=='mtgo'||data.sourcePlatform&&platform(data.sourcePlatform)!=='mtgo')problems.push(issue('source-platform','An MTGO source cannot claim another source platform.'));
  const rawMain=deck?.rawMain??deck?.main,rawSide=deck?.rawSide??deck?.side??[],main=aggregate(rawMain,'main',problems),side=aggregate(rawSide,'side',problems);
  if(count(main)!==60)problems.push(issue(count(main)>60?'unsupported-main-size':'incomplete-main',count(main)>60?'A source list above 60 cards is unsupported by this construction lane, not necessarily illegal.':'This construction lane requires exactly 60 main-deck cards.'));
  if(count(side)>15)problems.push(issue('sideboard-limit','The source sideboard exceeds 15 cards.'));
  const includeSideboard=mode(request.matchMode)!=='bo1'&&options.includeSideboard!==false;
  const mainNames=new Set(main.map(row=>cardKey(row.name))),allNames=new Set([...main,...(includeSideboard?side:[])].map(row=>cardKey(row.name)));
  for(const name of referenceRequiredAnchors(request))if(!mainNames.has(cardKey(name))&&!main.some(row=>possibleFrontForm(row.name,name)))problems.push(issue('missing-required-anchor',`The source main deck lacks required card ${name}.`,{name}));
  for(const name of request.excluded_cards||[])if(allNames.has(cardKey(name)))problems.push(issue('excluded-card',`The source list contains excluded card ${name}.`,{name}));
  if(mode(request.matchMode)==='bo3'&&(!includeSideboard||!side.length))problems.push(issue('bo3-sideboard-unavailable','A BO3 request needs an included, validated and priced source sideboard; main-only is partial.'));
  if(problems.length){rejections.push(...problems.map(problem=>({...problem,key})));continue;}
  const originalListSignature=referenceListSignature({main,side});if(seen.has(originalListSignature)){reject('duplicate-list','Duplicate logical source list was not resolved twice.',{key});continue;}seen.add(originalListSignature);
  const referenceOrigin=freeze({key,source:'Magic Online (official decklists)',sourceUrl,eventUrl,event:text(deck.event),eventDate, fetchedAt:data.fetchedAt,sourceDays:data.days??REFERENCE_POLICY.eventDays,sourceFormat:'Standard',sourcePlatform:'mtgo',...sourceMode(deck,data,eventUrl),record:clone(deck.record??null),place:clone(deck.place??null),rank:clone(deck.rank??null),players:clone(deck.players??null),player:clone(deck.player??null),rawMain:clone(rawMain),rawSide:clone(rawSide),originalListSignature});
  const candidate={key,name:text(deck.name)||text(deck.archetype)||'Standard reference',main,side:includeSideboard?side:[],referenceOrigin,requestFingerprint:referenceRequestFingerprint(request)};
  candidate.adaptation=referenceAdaptation(referenceOrigin,candidate,request);candidates.push(candidate);
 }
 candidates.sort((a,b)=>timestamp(b.referenceOrigin.eventDate)-timestamp(a.referenceOrigin.eventDate)||(Number(a.referenceOrigin.rank)||999)-(Number(b.referenceOrigin.rank)||999)||a.key.localeCompare(b.key));
 const selected=diversity(candidates,bounded(options.maxCandidates,REFERENCE_POLICY.maxCandidates,REFERENCE_POLICY.maxCandidates));
 if(selected.some(candidate=>candidate.adaptation.modeMismatch))notes.push('Source match mode or platform does not match the request; this is exploratory main-deck reference evidence, not mode-matched performance.');
 if(selected.some(candidate=>candidate.adaptation.kind==='main-deck-only'))notes.push('Only the source main deck is selected. The original sideboard remains in provenance; this is not the complete tournament list or a BO1-tested result.');
 return done(selected);
}
function completeCard(card){
 if(!card||card.brief||!knownName(card.name)||!(typeof card.id==='string'&&card.id||typeof card.oracle_id==='string'&&card.oracle_id)||!text(card.type_line)||!Array.isArray(card.color_identity)||card.color_identity.some(color=>!['W','U','B','R','G'].includes(color))||!card.legalities)return false;
 const faces=card.card_faces,knownColors=colors=>Array.isArray(colors)&&colors.every(color=>['W','U','B','R','G'].includes(color));
 if(!knownColors(card.colors)&&!(Array.isArray(faces)&&faces.length&&faces.every(face=>knownColors(face.colors))))return false;
 if(faces!==undefined&&(!Array.isArray(faces)||!faces.length||faces.some(face=>!knownName(face?.name)||!text(face.type_line)||typeof face.oracle_text!=='string'||typeof face.mana_cost!=='string')))return false;
 return faces?.length?true:typeof card.oracle_text==='string'&&typeof card.mana_cost==='string';
}
// Front-name aliases are accepted only from complete, internally consistent
// two-face transform/modal records. Split/adventure/back-face/fuzzy names are
// deliberately outside this lane. A full-name exact match needs no alias.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function dfcIdentity(card){
 if(!completeCard(card)||!['transform','modal_dfc'].includes(card.layout)||!uuid(card.id)||!uuid(card.oracle_id)||card.card_faces?.length!==2)return null;
 const faces=card.card_faces,front=cardKey(faces[0].name),back=cardKey(faces[1].name),canonical=cardKey(card.name);
 if(front===back||canonical!==cardKey(faces.map(face=>face.name).join(' // ')))return null;
 // When supplied, provider identity links must corroborate the record rather
 // than contradict it. A mismatched Oracle/printing is never an alias proof.
 if(card.uri&&card.uri!==`https://api.scryfall.com/cards/${card.id}`)return null;
 if(card.prints_search_uri){try{const query=new URL(card.prints_search_uri).searchParams.get('q');if(!query||!query.split(/\s+/).includes('oracleid:'+card.oracle_id))return null;}catch{return null;}}
 return {front,canonical,canonicalName:card.name,oracleId:card.oracle_id,printingId:card.id};
}
function resolvedIdentity(sourceName,card){
 if(!completeCard(card))return null;
 const source=cardKey(sourceName),dfc=dfcIdentity(card);
 if(source===cardKey(card.name))return {canonical:source,canonicalName:card.name,aliases:dfc?[dfc.front,source]:[source],oracleId:card.oracle_id??null,printingId:card.id??null,dfc,kind:'exact'};
 return dfc&&source===dfc.front?{...dfc,aliases:[dfc.front,dfc.canonical],dfc,kind:'front-face'}:null;
}
function canonicalReferenceList(origin,deck){
 const aliases=new Map(),conflicts=new Set(),sourceNames=new Set([...(origin.rawMain||[]),...(origin.rawSide||[])].map(row=>cardKey(row.name)));
 // This is reproducible full-card evidence, not a user-provided name map. Saved
 // evidence is re-resolved/replaced by validateReferenceCandidate before use.
 for(const evidence of origin.resolvedIdentities||[]){const identity=resolvedIdentity(evidence?.sourceName,evidence?.card),key=cardKey(evidence?.sourceName);if(!sourceNames.has(key)||identity?.kind!=='front-face')continue;const previous=aliases.get(key);if(previous&&(previous.oracleId!==identity.oracleId||previous.canonical!==identity.canonical))conflicts.add(key);else aliases.set(key,identity);}
 const convert=rows=>(rows||[]).map(row=>{const key=cardKey(row.name),identity=conflicts.has(key)?null:aliases.get(key);return {...row,name:identity?.canonicalName||row.name};});
 return {main:convert(deck.cards||deck.main),side:convert(deck.side)};
}
/** Validate exact resolved rows with injected current metadata/quotes/inventory.
 * priceDeck and withinBudgetCap should be the existing construction functions.
 * inspectPlan is the existing exact-list plan/support boundary, not a text matcher.
 */
export function validateReferenceCandidate(candidate,request={},options={}){
 const issues=[],notes=[],rows=[],quotes={},quoteEvidence={},metadata=options.metadata;
 if(!candidate?.referenceOrigin)return {ok:false,issues:[issue('missing-provenance','Reference origin is missing.')],notes,rows};
 if(candidate.requestFingerprint!==referenceRequestFingerprint(request))issues.push(issue('request-changed','Constraints changed after reference qualification; qualify again.'));
 // Requalify time/provenance, including BO3 delivery, rather than trusting a saved verdict.
 const origin=candidate.referenceOrigin,source={game:'mtg',format:'Standard',source:origin.source,fetchedAt:origin.fetchedAt,days:origin.sourceDays??REFERENCE_POLICY.eventDays,decks:[{...origin,name:candidate.name,main:origin.rawMain,side:origin.rawSide,url:origin.sourceUrl,date:origin.eventDate}]};
 const qualified=referenceCandidates(source,request,{now:options.now,cacheState:options.cacheState,includeSideboard:(candidate.side||[]).length>0});
 if(!qualified.candidates.length)issues.push(...qualified.rejections);
 const parsed=[];for(const [zone,list] of [['main',candidate.main],['side',candidate.side]])parsed.push(...aggregate(list,zone,issues).map(row=>({...row,zone})));
 if(count(parsed.filter(row=>row.zone==='main'))!==60)issues.push(issue('incomplete-main','The exact candidate does not contain 60 main-deck cards.'));
 if(count(parsed.filter(row=>row.zone==='side'))>15)issues.push(issue('sideboard-limit','The exact candidate exceeds 15 sideboard cards.'));
 if(mode(request.matchMode)==='bo3'&&!parsed.some(row=>row.zone==='side'))issues.push(issue('bo3-sideboard-unavailable','The exact BO3 candidate has no included sideboard.'));
 const identities=parsed.map(row=>{const card=valueOf(metadata,row.name);return {row,card,identity:resolvedIdentity(row.name,card)};}),canonicalSeen=new Map(),oracleSeen=new Map(),printingSeen=new Map(),sourceSeen=new Map(),resolvedIdentities=[],originalNames=[...(origin.rawMain||[]),...(origin.rawSide||[])].map(row=>row.name);
 for(const {row,card,identity} of identities){
  if(!identity)continue;
  const previous=canonicalSeen.get(identity.canonical),oracle=identity.oracleId,printing=identity.printingId,sourceKey=cardKey(row.name),priorSource=sourceSeen.get(sourceKey),savedProof=(origin.resolvedIdentities||[]).find(proof=>{const previous=resolvedIdentity(proof.sourceName,proof.card);return previous?.kind==='front-face'&&originalNames.some(name=>cardKey(name)===cardKey(proof.sourceName))&&(previous.canonical===identity.canonical||identity.aliases.includes(cardKey(proof.sourceName)));}),priorIdentity=savedProof&&resolvedIdentity(savedProof.sourceName,savedProof.card),currentSourceIdentity=savedProof&&resolvedIdentity(savedProof.sourceName,card);
  if(priorSource&&(priorSource.canonical!==identity.canonical||priorSource.oracleId!==oracle||priorSource.printingId!==printing)||priorIdentity&&(currentSourceIdentity?.kind!=='front-face'||priorIdentity.canonical!==identity.canonical||priorIdentity.oracleId!==oracle))issues.push(issue('card-identity-conflict','A source name no longer resolves to the same verified card identity.',{name:row.name}));sourceSeen.set(sourceKey,identity);
  if(previous&&((previous.identity.kind==='front-face'||identity.kind==='front-face')&&(!oracle||previous.identity.oracleId!==oracle||previous.identity.printingId!==printing)||oracle&&previous.identity.oracleId&&previous.identity.oracleId!==oracle)||oracle&&oracleSeen.has(oracle)&&oracleSeen.get(oracle)!==identity.canonical||printing&&printingSeen.has(printing)&&printingSeen.get(printing)!==JSON.stringify([identity.canonical,oracle]))issues.push(issue('card-identity-conflict','Resolved source names disagree on a canonical card, Oracle identity or printing identity.',{name:row.name}));
  canonicalSeen.set(identity.canonical,{identity,card});if(oracle)oracleSeen.set(oracle,identity.canonical);if(printing)printingSeen.set(printing,JSON.stringify([identity.canonical,oracle]));
  // A later exact-list recheck receives canonical delivered rows, not the raw
  // publisher front name. Re-prove that original front from CURRENT full card
  // metadata; otherwise aliases disappear or changed Oracle IDs slip through.
  if(identity.dfc)for(const sourceName of originalNames)if(cardKey(sourceName)===identity.dfc.front&&!resolvedIdentities.some(proof=>cardKey(proof.sourceName)===cardKey(sourceName)))resolvedIdentities.push({sourceName,card:clone(card)});
 }
 const resolvedOrigin=freeze({...origin,resolvedIdentities}),canonicalRows=[];
 const counts=new Map(),required=new Set(referenceRequiredAnchors(request).map(cardKey)),excluded=new Set((request.excluded_cards||[]).map(cardKey)),colors=request.colors||[];
 for(const {row:sourceRow,card,identity} of identities){
  if(!identity){canonicalRows.push(sourceRow);issues.push(issue('unresolved-card',`${sourceRow.name} lacks complete matching current card metadata.`,{name:sourceRow.name,zone:sourceRow.zone}));continue;}
  const row={...sourceRow,name:identity.canonicalName},key=identity.canonical;canonicalRows.push(row);
  if(card.legalities.standard!=='legal')issues.push(issue('card-legality',`${row.name} is ${card.legalities.standard||'of unknown legality'} in current Standard.`,{name:row.name,legality:card.legalities.standard??'unknown'}));
  if(identity.aliases.some(alias=>excluded.has(alias)))issues.push(issue('excluded-card',`${row.name} was explicitly excluded.`,{name:row.name}));
  if(!fitsTypeRestrictions(card,request))issues.push(issue('type-restriction',`${row.name} does not meet the requested creature-type restrictions.`,{name:row.name}));
  if(colors.length&&card.color_identity.some(color=>!colors.includes(color)))issues.push(issue('color-restriction',`${row.name} falls outside the requested colors.`,{name:row.name}));
  // This purchasing/collection lane defaults to physical play. Source platform
  // and match-mode attribution remain separate; explicit Arena/MTGO requests
  // are checked against their own platform rather than forced through paper.
  const requestedPlatform=platform(request.platform),playPlatform=requestedPlatform==='unspecified'?'paper':requestedPlatform;
  if(playPlatform==='paper'?!eligiblePrinting(card,row.name,{format:'standard'}):!Array.isArray(card.games)||!card.games.includes(playPlatform))issues.push(issue('platform-unverified',`${row.name} is not verified as an eligible ${playPlatform} printing.`,{name:row.name,platform:playPlatform}));
  if(/^A-/i.test(card.name)||card.rebalanced===true||(card.card_faces||[]).some(face=>/^A-/i.test(face.name)))issues.push(issue('rebalanced-standard','Rebalanced digital versions cannot establish current Standard card eligibility.',{name:row.name}));
  if(row.zone==='main')for(const alias of identity.aliases)required.delete(alias);
  counts.set(key,{card,name:row.name,qty:(counts.get(key)?.qty||0)+row.qty});
  const supplied=valueOf(options.quotes,row.name),value=typeof supplied==='number'?supplied:supplied?.price,price=typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  const owned=valueOf(options.owned,row.name),available=Number.isInteger(owned)&&owned>=0?owned:0;
  quotes[key]=price;quoteEvidence[key]=supplied&&typeof supplied==='object'?clone(supplied.evidence??{kind:'injected-app-reference',printingId:card.id??null}):{kind:price===null?'unknown':'injected-app-reference',printingId:card.id??null};
  rows.push({...row,id:key,card,price,owned:available});
 }
 for(const name of required)issues.push(issue('missing-required-anchor',`Required main-deck card ${name} is missing.`,{name}));
 for(const {card,name,qty} of counts.values())if(qty>effectiveCopyLimit(card,STANDARD))issues.push(issue('copy-limit',`${name} exceeds its combined main-plus-side copy limit.`,{name,qty}));
 if(request.ownedOnly)for(const {name,qty} of counts.values()){const owned=valueOf(options.owned,name);if(!Number.isInteger(owned)||owned<qty)issues.push(issue('owned-inventory',`Not enough available owned copies of ${name} for main plus side.`,{name,required:qty,available:Number.isInteger(owned)&&owned>0?owned:0}));}
 const deck={name:candidate.name,format:'Standard',cards:aggregate(canonicalRows.filter(row=>row.zone==='main'),'main',issues).map(({name,qty})=>({name,qty})),side:aggregate(canonicalRows.filter(row=>row.zone==='side'),'side',issues).map(({name,qty})=>({name,qty})),commander:'',constructionBasis:'reference',referenceOrigin:resolvedOrigin,referencePrices:quotes,referenceQuoteEvidence:quoteEvidence,referenceRequestFingerprint:referenceRequestFingerprint(request)};
 deck.referenceAdaptation=referenceAdaptation(resolvedOrigin,deck,request);deck.adaptation=deck.referenceAdaptation;
 const pricing=typeof options.priceDeck==='function'?options.priceDeck(rows,request.budgetBasis||'total'):null;
 const finiteBudget=typeof request.budget==='number'&&Number.isFinite(request.budget);
 if(finiteBudget&&(!pricing||pricing.estimate===null||!Number.isFinite(pricing.estimate)))issues.push(issue('unknown-price','The requested budget has unresolved card quotes; unknown prices are not zero.'));
 if(finiteBudget&&(!options.withinBudgetCap||pricing&&Number.isFinite(pricing.estimate)&&!options.withinBudgetCap(pricing.estimate,request)))issues.push(issue('budget-cap','The exact main-plus-side estimate does not have a verified pass for the requested budget boundary.'));
 if(rows.some(row=>row.price===null))notes.push('Some reference prices are unknown. Price coverage is separate from list and source eligibility.');
 if(request.avoid_infinite)issues.push(issue('unsupported-negative-constraint','This bounded source lane cannot verify the absence of every possible infinite interaction.'));
 if(request.unsupportedLoop)issues.push(issue('unsupported-loop',String(request.unsupportedLoop)));
 if(request.loopConflict)issues.push(issue('loop-conflict','The requested interaction conflicts with a retained constraint.'));
 const needsTheme=!!(text(request.theme)||text(request.style)),needsPlan=!!(needsTheme||request.requireLoop||request.avoid_infinite||request.unsupportedLoop||request.loopConflict);
 let plan=null;
 if(typeof options.inspectPlan==='function'){
  plan=options.inspectPlan(request,rows,deck);
  for(const problem of plan?.issues||[])issues.push(issue('requested-plan',typeof problem==='string'?problem:problem.message||problem.text||'Requested plan is not supported.'));
  if(needsTheme&&plan?.theme?.status!=='supported')issues.push(issue('requested-plan-unverified','Requested playstyle support is not established by this reference.'));
  if(request.requireLoop&&plan?.combo?.status!=='verified')issues.push(issue('requested-loop-unverified','The requested interaction has no verified exact-list package evidence.'));
 }
 else if(needsPlan)issues.push(issue('requested-plan-unverified','The requested playstyle or interaction needs an exact-list plan check.'));
 if(deck.referenceAdaptation.modeMismatch)notes.push('This source does not establish performance for the requested match mode/platform.');
 return {ok:issues.length===0,deck,rows,pricing,plan,issues,notes,sourceEligible:qualified.candidates.length>0,priceVerified:!!pricing&&Number.isFinite(pricing.estimate),strategyVerified:false};
}
/** Bounded adapter around caller-owned services. It does not fetch or mutate
 * app state itself. Replaced builds abort; lookup failures reject a candidate.
 */
export async function resolveReferenceCandidates(data,request={},options={}){
 const current=options.current||(()=>true),check=()=>{if(current()===false)throw new DOMException('Reference build replaced','AbortError');};check();
 const selected=referenceCandidates(data,request,options),metadata=new Map(),quotes=new Map(),lookupIssues=[];
 const names=[...new Map(selected.candidates.flatMap(candidate=>[...candidate.main,...candidate.side]).map(row=>[cardKey(row.name),row.name])).values()];
 const bound=bounded(options.maxUniqueNames,REFERENCE_POLICY.maxUniqueNames,REFERENCE_POLICY.maxUniqueNames),width=bounded(options.batchWidth,REFERENCE_POLICY.batchWidth,REFERENCE_POLICY.batchWidth);
 if(names.length>bound)return {...selected,candidates:[],decks:[],assessments:[],constructionBasis:'heuristic',rejections:[...selected.rejections,issue('resolution-bound',`Reference resolution requires ${names.length} names, above the ${bound}-name work bound.`)]};
 for(let at=0;at<names.length;at+=width){
  check();await Promise.all(names.slice(at,at+width).map(async name=>{
   check();let card=null;
   try{card=await options.resolve?.(name,true);}catch(error){check();if(error?.name==='AbortError')throw error;lookupIssues.push(issue('card-lookup-failed',`Could not resolve ${name}.`,{name}));}check();
   if(card)metadata.set(cardKey(name),card);
  }));check();
 }
 const resolved=names.map(name=>{const card=metadata.get(cardKey(name));return {name,card,identity:resolvedIdentity(name,card)};}),byCanonical=new Map(),byOracle=new Map(),byPrinting=new Map(),conflicting=new Set();
 for(const entry of resolved){const identity=entry.identity;if(!identity)continue;const previous=byCanonical.get(identity.canonical),oracle=identity.oracleId,printing=identity.printingId;
  // Never share a quote across conflicting resolver results, even when the
  // conflict is split across two separate reference candidates. Different
  // selected printing IDs also need a new explicit printing/quote choice.
  if(previous&&(previous.oracleId!==oracle||previous.printingId!==printing))conflicting.add(identity.canonical);
  for(const [key,map] of [[oracle,byOracle],[printing,byPrinting]])if(key){const prior=map.get(key);if(prior&&prior.canonical!==identity.canonical){conflicting.add(prior.canonical);conflicting.add(identity.canonical);}map.set(key,identity);}
  byCanonical.set(identity.canonical,identity);
 }
 for(const {name,identity} of resolved)if(identity&&conflicting.has(identity.canonical)){metadata.delete(cardKey(name));lookupIssues.push(issue('card-identity-conflict','Conflicting source aliases cannot share a canonical card quote.',{name}));}
 const quoteCards=[...new Map(resolved.filter(entry=>entry.identity&&!conflicting.has(entry.identity.canonical)).map(entry=>[entry.identity.canonical,entry.card])).values()];
 for(let at=0;at<quoteCards.length;at+=width){
  check();await Promise.all(quoteCards.slice(at,at+width).map(async card=>{const name=card.name;try{check();const quote=await options.quote?.(name,card);check();quotes.set(cardKey(name),quote??null);}catch(error){check();if(error?.name==='AbortError')throw error;lookupIssues.push(issue('quote-lookup-failed',`Could not quote ${name}.`,{name}));}}));check();
 }
 const assessments=selected.candidates.map(candidate=>{check();return validateReferenceCandidate(candidate,request,{...options,metadata,quotes});});check();
 return {...selected,candidates:assessments.filter(result=>result.ok).map(result=>result.deck),decks:assessments.filter(result=>result.ok).map(result=>result.deck),assessments,rejections:[...selected.rejections,...lookupIssues,...assessments.flatMap(result=>result.issues.map(problem=>({...problem,key:result.deck?.referenceOrigin.key})))],constructionBasis:assessments.some(result=>result.ok)?'reference':'heuristic'};
}
