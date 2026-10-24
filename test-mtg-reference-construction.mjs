// Synthetic dated source/card fixtures exercise the contract, not a live meta claim.
import assert from 'node:assert/strict';
import {referenceCandidates,validateReferenceCandidate,referenceAdaptation,referenceListSignature,referenceRequiredAnchors,referenceRequestFingerprint,resolveReferenceCandidates,REFERENCE_POLICY} from './mtg-reference-construction.js';
import {priceDeck,withinBudgetCap} from './deck-construction.js';
const now=Date.parse('2026-10-24T12:00:00Z'),date='2026-10-23';
const card=(name,changes={})=>({id:'id-'+name,name,type_line:'Creature — Human Warrior',oracle_text:'Vigilance',mana_cost:'{1}{W}',cmc:2,colors:['W'],color_identity:['W'],legalities:{standard:'legal'},games:['paper','arena','mtgo'],...changes});
const names=Array.from({length:9},(_,i)=>'Fixture Threat '+i),sideNames=['Fixture Answer A','Fixture Answer B','Fixture Answer C','Fixture Answer D'];
const main=[...names.map(name=>({name,qty:4})),{name:'Plains',qty:24,land:true}],side=sideNames.map((name,i)=>({name,qty:i===3?3:4}));
const catalogue=new Map([...names,...sideNames].map(name=>[name.toLowerCase(),card(name)]));
catalogue.set('plains',card('Plains',{type_line:'Basic Land — Plains',oracle_text:'({T}: Add {W}.)',mana_cost:'',cmc:0,colors:[]}));
const event=(changes={})=>({key:'mtgo:fixture:1',name:'Fixture white combat',event:'Standard Challenge fixture',date,rank:1,record:'7-1',place:'1st',players:80,main:structuredClone(main),side:structuredClone(side),url:`https://www.mtgo.com/decklist/standard-challenge-32-${date}12345`,...changes});
const data=(deck=event(),changes={})=>({game:'mtg',format:'Standard',source:'Magic Online (official decklists)',days:14,fetchedAt:'2026-10-24T11:00:00Z',decks:[deck],...changes});
const request={game:'mtg',format:'Standard',seedOrigin:null,matchMode:'unspecified',budget:null,budgetMode:'cap',budgetBasis:'total',budgetBoundary:'inclusive'};
const options={now,metadata:catalogue,quotes:()=>1,owned:()=>0,priceDeck,withinBudgetCap};
const selected=(d=data(),r=request,o={})=>referenceCandidates(d,r,{now,...o});
const validated=(r=request,o={})=>validateReferenceCandidate(selected(data(),r).candidates[0],r,{...options,...o});
const has=(result,code)=>assert.ok((result.issues||result.rejections).some(problem=>problem.code===code),`${code}: ${JSON.stringify(result.issues||result.rejections)}`);

const original=data(),originalJSON=JSON.stringify(original),fresh=selected(original);
assert.equal(fresh.candidates.length,1);assert.equal(fresh.constructionBasis,'reference');
const valid=validateReferenceCandidate(fresh.candidates[0],request,options);
assert.equal(valid.ok,true,JSON.stringify(valid.issues));assert.equal(valid.rows.reduce((n,r)=>n+r.qty,0),75);
assert.equal(valid.pricing.estimate,75);assert.equal(valid.priceVerified,true);assert.equal(valid.deck.referenceOrigin.record,'7-1');
assert.equal(valid.deck.referenceOrigin.eventDate,date);assert.equal(valid.deck.referenceOrigin.sourceMatchMode,'unspecified','A sideboard is not mode evidence');
assert.equal(valid.strategyVerified,false,'A source/legality gate is not a final plan proof');
assert.equal(valid.deck.record,undefined);assert.equal(valid.deck.proven,undefined);assert.equal(valid.deck.source,undefined);
assert.equal(JSON.stringify(original),originalJSON,'No source rows/results are mutated');
assert.ok(Object.isFrozen(valid.deck.referenceOrigin));assert.ok(Object.isFrozen(valid.deck.referenceOrigin.rawMain));
assert.throws(()=>{valid.deck.referenceOrigin.record='99-0';},TypeError);
assert.equal(valid.deck.referenceOrigin.originalListSignature,referenceListSignature({main,side}));

for(const [d,code] of [
 [data(event(),{game:'ygo'}),'unsupported-format'],[data(event(),{format:'Modern'}),'unsupported-format'],[data(event(),{sourceFormat:'Modern'}),'unsupported-format'],
 [data(event(),{source:'EDHTop16'}),'conflicting-source-provenance'],[data(event(),{sourceUrl:'https://evil.test'}),'conflicting-source-provenance'],
 [data(event({format:'EDH',commander:'Commander fixture'})),'wrong-source-format'],[data(event({name:'cEDH fixture'})),'wrong-source-format'],
 [data(event(),{stale:true}),'stale-source'],[data(event(),{fetchedAt:'2026-10-23T23:59:59Z'}),'stale-snapshot'],
 [data(event(),{fetchedAt:'2026-10-25T00:00:00Z'}),'stale-snapshot'],[data(event(),{fetchedAt:'2026-02-31T00:00:00Z'}),'stale-snapshot'],
 [data(event({date:'2026-10-09'})),'event-date'],[data(event({date:'2026-10-25'})),'event-date'],
 [data(event({date:'2026-02-31'})),'event-date'],[data(event({date:'not a date'})),'event-date'],
 [data(event({date:'2026-10-22'})),'event-date-mismatch'],[data(event({event:''})),'missing-provenance'],
 [data(event({url:'https://www.mtgo.com.evil.test/decklist/standard-challenge-2026-10-23'})),'missing-provenance'],
 [data(event({url:'https://www.mtgo.com/decklist/modern-challenge-2026-10-23'})),'missing-provenance'],
 [data(event({url:'http://www.mtgo.com/decklist/standard-challenge-2026-10-23'})),'missing-provenance'],
 [data(event({url:'https://user:pass@www.mtgo.com/decklist/standard-challenge-2026-10-23'})),'missing-provenance'],
 [data(event({url:'https://www.mtgo.com/decklist/standard-challenge-2026-10-23#fragment'})),'missing-provenance'],
 [data(event({url:'https://www.mtgo.com/decklist/standard-challenge-2026-10-23?format=modern'})),'missing-provenance'],
 [data(event({sourcePlatform:'arena'})),'source-platform'],
]){const result=selected(d);assert.equal(result.candidates.length,0);has(result,code);}
has(selected(data(),request,{cacheState:{at:now,error:'Refresh failed'}}),'stale-source');
for(const cacheState of [{at:now,error:'Refresh failed'},{at:now,stale:true},{at:now-13*3600e3}]){const result=validateReferenceCandidate(fresh.candidates[0],request,{...options,cacheState});assert.equal(result.ok,false);assert.equal(result.sourceEligible,false);}
assert.equal(selected(data(event(),{source:'MTGO',sourceUrl:'https://www.mtgo.com/decklists'})).candidates[0].referenceOrigin.source,'Magic Online (official decklists)');
has(selected(data(),request,{cacheState:{at:now-13*3600e3}}),'stale-cache');
has(selected(data(event({date:'2026-10-09'})),request,{cacheState:{at:now}}),'event-date');
has(referenceCandidates(data(),request,{}),'invalid-clock');
const shortDate='2026-10-22',shortData=data(event({date:shortDate,url:`https://www.mtgo.com/decklist/standard-challenge-32-${shortDate}12345`}),{days:2,fetchedAt:'2026-10-23T22:00:00Z'}),shortNow=Date.parse('2026-10-23T23:00:00Z'),laterNow=Date.parse('2026-10-24T01:00:00Z');
const shortCandidate=selected(shortData,request,{now:shortNow}).candidates[0];assert.ok(shortCandidate);assert.equal(shortCandidate.referenceOrigin.sourceDays,2);
has(selected(shortData,request,{now:laterNow}),'source-window');
has(validateReferenceCandidate(shortCandidate,request,{...options,now:laterNow}),'source-window');
assert.equal(selected(data(),{...request,format:'Commander'}).candidates.length,0);

for(const qty of [0,-1,1.5,'4',NaN,Infinity])has(selected(data(event({main:[{name:names[0],qty},...main.slice(1)]}))),'invalid-quantity');
has(selected(data(event({main:[{name:'Plains',qty:60}],side:[{name:sideNames[0],qty:.5}]}))),'invalid-quantity');
has(selected(data(event({main:[{name:names[0],qty:4}]}))),'incomplete-main');
const oversized=selected(data(event({main:[...main,{name:'Plains',qty:1}]})));has(oversized,'unsupported-main-size');assert.match(oversized.rejections[0].message,/not necessarily illegal/);
has(selected(data(event({side:[...side,{name:sideNames[0],qty:1}]}))),'sideboard-limit');
const duplicates=selected(data(event({main:[...main.map(row=>row.name===names[0]?{...row,qty:3}:row),{name:'  FIXTURE   THREAT 0 ',qty:1}]})));
assert.equal(duplicates.candidates[0].main.length,main.length,'Canonical duplicate names aggregate');
const overflowMain=main.map(row=>row.name===names[0]?{...row,qty:5}:row.name==='Plains'?{...row,qty:23}:row);
const overflow=selected(data(event({main:overflowMain}))).candidates[0];has(validateReferenceCandidate(overflow,request,options),'copy-limit');
const sharedMain=main.map(row=>row.name===names[0]?{...row,qty:3}:row.name==='Plains'?{...row,qty:25}:row),sharedSide=[{name:names[0],qty:2}];
has(validateReferenceCandidate(selected(data(event({main:sharedMain,side:sharedSide}))).candidates[0],request,options),'copy-limit');
for(const changed of [{brief:true},{legalities:{}},{legalities:{standard:'banned'}},{legalities:{standard:'not_legal'}},{oracle_text:undefined},{mana_cost:undefined},{color_identity:undefined},{colors:undefined},{id:undefined},{name:'Wrong card'}]){
 const map=new Map(catalogue);map.set(names[0].toLowerCase(),card(names[0],changed));const result=validated(request,{metadata:map});assert.equal(result.ok,false,JSON.stringify(changed));
}
const missing=new Map(catalogue);missing.delete('plains');has(validated(request,{metadata:missing}),'unresolved-card');
// Physical/default Standard needs an actual eligible paper printing, even if
// a synthetic digital/promotional record incorrectly says Standard legal.
for(const changes of [{games:['arena'],digital:true},{games:['mtgo'],digital:true},{games:undefined},{games:['paper'],digital:true},{games:['paper'],oversized:true},{games:['paper'],border_color:'gold'},{games:['paper'],set_type:'memorabilia'}])for(const requestedPlatform of [undefined,'paper']){
 const map=new Map(catalogue);map.set(names[0].toLowerCase(),card(names[0],changes));has(validated({...request,platform:requestedPlatform},{metadata:map}),'platform-unverified');
}
const arenaCatalogue=new Map([...catalogue].map(([name,original])=>[name,{...original,games:['arena'],digital:false}]));
assert.equal(validated({...request,platform:'arena'},{metadata:arenaCatalogue}).ok,true,'Explicit Arena does not require paper availability');
const mtgoCatalogue=new Map([...catalogue].map(([name,original])=>[name,{...original,games:['mtgo'],digital:true}]));
assert.equal(validated({...request,platform:'mtgo'},{metadata:mtgoCatalogue}).ok,true,'Explicit MTGO does not force a physical printing');
const alchemyCatalogue=new Map(arenaCatalogue);alchemyCatalogue.set(names[0].toLowerCase(),{...arenaCatalogue.get(names[0].toLowerCase()),legalities:{standard:'not_legal',alchemy:'legal'}});
has(validated({...request,platform:'arena'},{metadata:alchemyCatalogue}),'card-legality');
const rebalancedName='A-'+names[0],rebalancedMain=main.map(row=>row.name===names[0]?{...row,name:rebalancedName}:row),rebalancedCatalogue=new Map(catalogue);rebalancedCatalogue.set(rebalancedName.toLowerCase(),card(rebalancedName,{games:['paper','arena'],digital:false}));
for(const requestedPlatform of [undefined,'paper','arena']){
 const rebalancedRequest={...request,platform:requestedPlatform},candidate=selected(data(event({main:rebalancedMain})),rebalancedRequest).candidates[0];has(validateReferenceCandidate(candidate,rebalancedRequest,{...options,metadata:rebalancedCatalogue}),'rebalanced-standard');
}
const flaggedRebalanced=new Map(catalogue);flaggedRebalanced.set(names[0].toLowerCase(),card(names[0],{rebalanced:true}));has(validated(request,{metadata:flaggedRebalanced}),'rebalanced-standard');

const copied=new Map(catalogue);copied.set(names[0].toLowerCase(),card(names[0],{card_faces:[{name:names[0],type_line:'Creature — Human',mana_cost:'{W}',oracle_text:'Vigilance',colors:['W']},{name:'Fixture back',type_line:'Creature — Human',mana_cost:'',oracle_text:'Flying',colors:['W']}],colors:undefined}));assert.equal(validated(request,{metadata:copied}).ok,true,'Complete face-level colors can replace missing top-level colors');
const copyAllowed=new Map(catalogue);copyAllowed.set(names[0].toLowerCase(),card(names[0],{oracle_text:'A deck can have any number of cards named Fixture Threat 0.'}));assert.equal(validateReferenceCandidate(overflow,request,{...options,metadata:copyAllowed}).ok,true);

const explicit={...request,seed:'Not in source',seedOrigin:'user'};has(selected(data(),explicit),'missing-required-anchor');
has(selected(data(),{...request,seed:'Not in source',seedOrigin:undefined}),'missing-required-anchor');
const automatic={...request,seed:'Not in source',seedOrigin:'automatic',seedCard:card('Not in source')};assert.equal(selected(data(),automatic).candidates.length,1);assert.equal(validated(automatic).ok,true);
assert.deepEqual(referenceRequiredAnchors(automatic),[]);
has(selected(data(),{...automatic,requiredAnchorNames:['Not in source']}),'missing-required-anchor');
has(selected(data(),{...request,required_cards:[sideNames[0]]}),'missing-required-anchor','Sideboard card is not a playable main anchor');
has(selected(data(),{...request,excluded_cards:[sideNames[0]]}),'excluded-card');
const bo1ExcludedSide={...request,matchMode:'bo1',excluded_cards:[sideNames[0]]};assert.equal(validated(bo1ExcludedSide).ok,true,'A BO1 exclusion does not erase immutable provenance for an undelivered source sideboard');
has(selected(data(),{...request,matchMode:'bo3',excluded_cards:[sideNames[0]]}),'excluded-card');
const mainOnlyExcludedSide={...request,excluded_cards:[sideNames[0]]},mainOnlyCandidate=selected(data(),mainOnlyExcludedSide,{includeSideboard:false}).candidates[0];assert.ok(mainOnlyCandidate);assert.equal(validateReferenceCandidate(mainOnlyCandidate,mainOnlyExcludedSide,options).ok,true);
assert.notEqual(referenceRequestFingerprint(explicit),referenceRequestFingerprint(automatic));
assert.notEqual(referenceRequestFingerprint(request),referenceRequestFingerprint({...request,matchMode:'bo3'}));
assert.notEqual(referenceRequestFingerprint(request),referenceRequestFingerprint({...request,unsupportedLoop:'Extra turns are not supported'}));
assert.notEqual(referenceRequestFingerprint(request),referenceRequestFingerprint({...request,loopConflict:true}));
assert.equal(referenceRequestFingerprint(automatic),referenceRequestFingerprint({...automatic,seed:'Another auto anchor'}),'Automatic scouting choices are not request constraints');
has(validateReferenceCandidate(fresh.candidates[0],{...request,colors:['U']},options),'request-changed');
has(validated({...request,colors:['U']}),'color-restriction');
has(validated({...request,creatureTypesOnly:['Elf']}),'type-restriction');
has(validated({...request,excludedSubtypes:['Human']}),'type-restriction');
has(validated({...request,theme:'a narrow exact plan'}),'requested-plan-unverified');
for(const result of [null,{}, {issues:[]},{issues:[],theme:{status:'not-requested'}}])for(const field of ['theme','style'])has(validated({...request,[field]:'Mill'},{inspectPlan:()=>result}),'requested-plan-unverified');
for(const result of [null,{}, {issues:[]},{issues:[],combo:{status:'not-requested'}}])has(validated({...request,requireLoop:'infinite-mana'},{inspectPlan:()=>result}),'requested-loop-unverified');
assert.equal(validated({...request,requireLoop:'infinite-mana'},{inspectPlan:()=>({issues:[],combo:{status:'verified'}})}).ok,true,'A loop-only request may use verified package evidence without inventing a textual theme');
has(validated({...request,unsupportedLoop:'Extra turns are not supported'},{inspectPlan:()=>({issues:[]})}),'unsupported-loop');
has(validated({...request,loopConflict:true},{inspectPlan:()=>({issues:[]})}),'loop-conflict');
has(validated({...request,theme:'a narrow exact plan'},{inspectPlan:()=>({issues:[],theme:{status:'unverified'}})}),'requested-plan-unverified');
has(validated({...request,avoid_infinite:true},{inspectPlan:()=>({issues:[]})}),'unsupported-negative-constraint');
assert.equal(validated({...request,theme:'Combat'},{inspectPlan:()=>({issues:[],theme:{status:'supported'}})}).ok,true);

for(const name of ['Plains',sideNames[0]])has(validated({...request,budget:100},{quotes:n=>n===name?null:1}),'unknown-price');
has(validated({...request,budget:75,budgetBoundary:'exclusive'}),'budget-cap');
assert.equal(validated({...request,budget:75}).ok,true);
has(validated({...request,budget:74}),'budget-cap');
assert.equal(validated({...request,budget:70,budgetMode:'target',allowance:5}).ok,true,'Target mode is not silently converted to a hard cap');
assert.equal(validated(request,{quotes:()=>null}).ok,true,'Uncapped references retain explicit unknown-price coverage');
assert.equal(validated(request,{quotes:()=>null}).pricing.estimate,null);assert.equal(validated(request,{quotes:()=>null}).priceVerified,false);
const unpricedBo3=validated({...request,matchMode:'bo3'},{quotes:()=>null});assert.equal(unpricedBo3.ok,true);assert.equal(unpricedBo3.priceVerified,false);assert.equal(unpricedBo3.pricing.estimate,null);assert.equal(unpricedBo3.pricing.unpriced,75);assert.equal(unpricedBo3.pricing.subtotal,0);
has(validated({...request,ownedOnly:true},{owned:()=>0}),'owned-inventory');
const sharedSource=selected(data(event({main:sharedMain,side:[{name:names[0],qty:1}]})),{...request,ownedOnly:true}).candidates[0];
has(validateReferenceCandidate(sharedSource,{...request,ownedOnly:true},{...options,owned:n=>n===names[0]?3:100}),'owned-inventory');
assert.equal(validateReferenceCandidate(sharedSource,{...request,ownedOnly:true},{...options,owned:n=>n===names[0]?4:100}).ok,true);
const ownedRequest={...request,budget:0,budgetBasis:'purchase',ownedOnly:true};
assert.equal(validated(ownedRequest,{quotes:()=>null,owned:()=>100}).ok,true,'No missing purchases have an unknown price; owned copies are not bought twice');
assert.equal(validated(ownedRequest,{quotes:()=>null,owned:()=>100}).pricing.estimate,0);

const bo3={...request,matchMode:'bo3'},bo1={...request,matchMode:'bo1',platform:'arena'};
has(selected(data(event({side:[]})),bo3),'bo3-sideboard-unavailable');
has(selected(data(),bo3,{includeSideboard:false}),'bo3-sideboard-unavailable');
const unknownBo3=validated(bo3);assert.equal(unknownBo3.ok,true);assert.equal(unknownBo3.deck.adaptation.modeMismatch,true);assert.equal(unknownBo3.deck.adaptation.testedForRequestedMode,false);
const evidence={kind:'event',url:event().url,matchMode:'bo3',statement:'Synthetic publisher event metadata explicitly identifies best-of-three matches.'};
const modeSource=data(event({sourceMatchMode:'bo3',sourceMatchModeEvidence:evidence}));
const knownBo3=validateReferenceCandidate(selected(modeSource,bo3).candidates[0],bo3,options);assert.equal(knownBo3.ok,true);assert.equal(knownBo3.deck.adaptation.modeMatched,true);
assert.equal(knownBo3.deck.referenceOrigin.record,'7-1');
const crossMode=validateReferenceCandidate(selected(modeSource,bo1).candidates[0],bo1,options);assert.equal(crossMode.ok,true);assert.equal(crossMode.deck.side.length,0);assert.equal(crossMode.deck.referenceOrigin.rawSide.length,4);assert.equal(crossMode.pricing.estimate,60);assert.equal(crossMode.deck.adaptation.kind,'main-deck-only');assert.equal(crossMode.deck.adaptation.sourceResultAppliesToExactList,false);assert.equal(crossMode.deck.adaptation.testedForRequestedMode,false);
assert.equal(selected(data(event({sourceMatchMode:'bo3'})),bo3).candidates[0].referenceOrigin.sourceMatchMode,'unspecified','Unsubstantiated mode field is not evidence');
assert.equal(selected(data(event({sourceMatchMode:'bo3',sourceMatchModeEvidence:{...evidence,url:'https://evil.test/policy'}})),bo3).candidates[0].referenceOrigin.sourceMatchMode,'unspecified');
const edited=structuredClone(knownBo3.deck);edited.cards.find(row=>row.name===names[0]).qty--;edited.cards.find(row=>row.name==='Plains').qty++;
const adapted=referenceAdaptation(knownBo3.deck.referenceOrigin,edited,bo3);assert.equal(adapted.kind,'adapted-list');assert.equal(adapted.sameList,false);assert.equal(adapted.sourceResultAppliesToExactList,false);assert.equal(adapted.changes.length,2);assert.equal(adapted.testedForRequestedMode,false);assert.equal(adapted.evidenceScope,'adapted-source-reference');assert.equal(knownBo3.deck.referenceOrigin.record,'7-1');
const reordered={...knownBo3.deck,cards:[...knownBo3.deck.cards].reverse()};assert.equal(referenceAdaptation(knownBo3.deck.referenceOrigin,reordered,bo3).sameList,true);

const near=event({key:'mtgo:fixture:2',rank:2,main:main.map(row=>row.name===names[0]?{...row,name:'Near threat'}:row)}),far=event({key:'mtgo:fixture:3',rank:3,main:main.map(row=>row.land?row:{...row,name:row.name+' different'})});
const diverse=selected(data(event(),{decks:[event(),event({key:'duplicate'}),near,far]}));assert.equal(diverse.candidates.length,2);assert.deepEqual(diverse.candidates.map(row=>row.key),['mtgo:fixture:1','mtgo:fixture:3']);has(diverse,'duplicate-list');
const bounded=selected(data(event(),{decks:Array.from({length:30},(_,i)=>event({key:'entry'+i,main:main.map(row=>row.land?row:{...row,name:row.name+' '+i})}))}),request,{maxCandidates:99,maxEntries:99});assert.equal(bounded.candidates.length,2);assert.equal(REFERENCE_POLICY.maxEntries,12);

let active=0,peak=0,resolveCalls=0,quoteCalls=0;
const resolved=await resolveReferenceCandidates(data(),request,{...options,current:()=>true,resolve:async name=>{resolveCalls++;active++;peak=Math.max(peak,active);await Promise.resolve();active--;return catalogue.get(name.toLowerCase());},quote:async()=>{quoteCalls++;return {price:1,evidence:{kind:'test-current-app-quote'}};}});
assert.equal(resolved.decks.length,1);assert.equal(resolveCalls,14);assert.equal(quoteCalls,14);assert.ok(peak<=4);assert.equal(resolved.decks[0].referenceQuoteEvidence.plains.kind,'test-current-app-quote');
const failed=await resolveReferenceCandidates(data(),request,{...options,resolve:async()=>{throw Error('Unavailable');}});assert.equal(failed.decks.length,0);has(failed,'card-lookup-failed');has(failed,'unresolved-card');
const boundedResolution=await resolveReferenceCandidates(data(),request,{...options,maxUniqueNames:2,resolve:()=>{throw Error('Must not call');}});has(boundedResolution,'resolution-bound');assert.equal(boundedResolution.constructionBasis,'heuristic');assert.deepEqual(boundedResolution.decks,[]);assert.deepEqual(boundedResolution.candidates,[]);
let calls=0;await assert.rejects(resolveReferenceCandidates(data(),request,{...options,current:()=>false,resolve:()=>{calls++;}}),{name:'AbortError'});assert.equal(calls,0);
let current=true,quoteAfterCancel=0;await assert.rejects(resolveReferenceCandidates(data(),request,{...options,current:()=>current,resolve:async name=>{current=false;return catalogue.get(name.toLowerCase());},quote:()=>{quoteAfterCancel++;return 1;}}),{name:'AbortError'});assert.equal(quoteAfterCancel,0);
let currentAtQuote=true;await assert.rejects(resolveReferenceCandidates(data(),request,{...options,current:()=>currentAtQuote,resolve:async name=>catalogue.get(name.toLowerCase()),quote:async()=>{currentAtQuote=false;return 1;}}),{name:'AbortError'});
assert.equal(JSON.stringify(original),originalJSON);
console.log('MTG reference construction: source, legality, intent, sideboard, pricing, provenance, diversity and cancellation passed.');
