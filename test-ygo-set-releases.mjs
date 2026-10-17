import assert from 'node:assert/strict';
import {
  YGO_SET_CACHE_KEY, YGO_SET_LEGACY_CACHE_KEY, normalizeYgo, normalizeYgoSet,
  normalizeYgoSets, ygoSetId, resolveYgoSet, migrateYgoSetCache,
  ygoSetPrintings, summarizeYgoSetContents, ygoSource,
} from './ygo.js';

// Synthetic provider fixtures. Printing-row totals below deliberately differ
// from the independently verified official unique-card checklist sizes.
const original = {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08',num_of_cards:355,set_image:'https://images.ygoprodeck.com/images/sets/LOB.jpg'};
const anniversary = {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-21',num_of_cards:14};
const starter = {set_code:'SDY',set_name:'Starter Deck: Yugi',tcg_date:'2002-03-29',num_of_cards:102};
const sample = {set_code:'SDY',set_name:'Starter Deck: Yugi (Demo)',tcg_date:'2002-03-29',num_of_cards:10};
const tin1 = {set_code:'CT10',set_name:'2013 Collectible Tins Wave 1',tcg_date:'2013-08-30',num_of_cards:10};
const tin2 = {set_code:'CT10',set_name:'2013 Collectible Tins Wave 2',tcg_date:'2013-11-22',num_of_cards:10};
const rawSets = [original,anniversary,starter,sample,tin1,tin2];
const sets = normalizeYgoSets(rawSets), lob = normalizeYgoSet(original), ann = normalizeYgoSet(anniversary);
assert.equal(sets.length,6);
assert.equal(new Set(sets.map(s=>s.id)).size,6,'shared prefixes never collide');
assert.deepEqual(normalizeYgoSets([...rawSets].reverse()),sets,'identity and order independent of response order');
assert.equal(lob.expectedUniqueCards,126);
assert.equal(lob.count,126,'compatibility count is an independently known unique checklist size');
assert.equal(lob.printingCount,355,'provider rows are not mislabeled as unique cards');
assert.equal(ann.expectedUniqueCards,126);
assert.equal(normalizeYgoSet(starter).expectedUniqueCards,50);
assert.equal(normalizeYgoSet(sample).expectedUniqueCards,null,'a code match is not an official checklist match');
assert.equal(normalizeYgoSet({...original,tcg_date:'2025-01-01'}).expectedUniqueCards,null,'unknown rerelease cannot borrow original evidence');
assert.equal(normalizeYgoSet({...original,tcg_date:''}).expectedUniqueCards,null,'missing date cannot establish the exact known release');
assert.equal(lob.image,original.set_image,'preserve supplied release art');
assert.equal(ann.image,'','do not borrow original artwork using the shared prefix');
assert.equal(normalizeYgoSet({...original,set_image:'javascript:alert(1)'}).image,'');
assert.equal(normalizeYgoSet({...original,set_image:'http://example.test/logo.jpg'}).image,'');
assert.equal(normalizeYgoSet({...tin1,num_of_cards:'10'}).count,null);
assert.equal(normalizeYgoSet({...tin1,num_of_cards:'not a count'}).printingCount,null);
assert.equal(normalizeYgoSet({...tin1,num_of_cards:true}).printingCount,null);
assert.match(lob.provenance.expectedUniqueCards.url,/pid=11101000/);
assert.match(ann.provenance.expectedUniqueCards.url,/pid=2000001240000/);
assert.equal(normalizeYgoSet(null),null);
assert.equal(normalizeYgoSet({...original,set_name:'Bad\ud800name'}),null,'malformed Unicode cannot poison the whole catalogue or be repaired into a collision');
assert.deepEqual(normalizeYgoSets([null,{}]),[]);
assert.equal(normalizeYgoSets([original,{...original,num_of_cards:356}])[0].printingCount,356,'duplicate metadata does not sum counts');

// NFC is the only Unicode folding. Do not use lossy lowercase slugs, accent
// removal or punctuation stripping for release identity.
const accented = {code:'X',date:'2023-01-01',name:'Caf\u00e9: A/B'};
assert.equal(ygoSetId(accented),ygoSetId({...accented,name:'Cafe\u0301: A/B'}));
assert.notEqual(ygoSetId(accented),ygoSetId({...accented,name:'Cafe: A/B'}));
assert.notEqual(ygoSetId(accented),ygoSetId({...accented,name:'caf\u00e9: A/B'}));
assert.notEqual(ygoSetId({...accented,name:'A B'}),ygoSetId({...accented,name:'A  B'}));
assert.notEqual(ygoSetId({code:'A:B',date:'',name:'C'}),ygoSetId({code:'A',date:'B',name:'C'}));
assert.match(ygoSetId(accented),/^ygo:[A-Za-z0-9._~%:-]+$/);
assert.equal(decodeURIComponent(encodeURIComponent(ann.id)),ann.id,'canonical ID survives hash routing');
assert.ok(ann.id.length>80,'callers must not truncate long canonical IDs');

for(const code of ['LOB','SDY','CT10']) {
  const result=resolveYgoSet(sets,code);
  assert.equal(result.status,'ambiguous');
  assert.equal(result.set,null);
  assert.equal(result.candidates.length,2);
}
assert.equal(resolveYgoSet(sets,lob.id).set.id,lob.id);
assert.equal(resolveYgoSet(rawSets,anniversary.set_name).set.id,ann.id);
assert.equal(resolveYgoSet(sets,'missing').status,'missing');
assert.equal(resolveYgoSet(sets,'').status,'missing');
assert.equal(resolveYgoSet([original],'lob').set.id,lob.id,'unique legacy code accepts ordinary URL casing');
assert.equal(resolveYgoSet([original,{...original,tcg_date:'2023-07-14'}],original.set_name).status,'ambiguous','same name with distinct release date still needs a choice');
const sameName=normalizeYgoSets([original,{...original,tcg_date:'2023-07-14'}]);
assert.ok(sameName.every(s=>s.providerNameAmbiguous),'provider name-only membership cannot distinguish same-name releases by date');
assert.equal(resolveYgoSet([original,{...original,tcg_date:'2023-07-14'}],lob.id).set.providerNameAmbiguous,true,'canonical resolution retains other same-name/date ambiguity even with a raw catalogue');

assert.equal(YGO_SET_CACHE_KEY,'cardforge-ygo-sets-v3');
assert.equal(YGO_SET_LEGACY_CACHE_KEY,'cardforge-ygo-sets-v2');
const legacy={at:1234,list:rawSets.map(s=>({id:s.set_code,name:s.set_name,code:s.set_code,date:s.tcg_date,count:s.num_of_cards,image:''}))};
const migrated=migrateYgoSetCache(legacy);
assert.equal(migrated.schema,3);
assert.equal(migrated.at,1234,'migration never makes an old catalogue appear freshly fetched');
assert.equal(migrated.needsRefresh,true);
assert.equal(migrated.list.length,6);
assert.equal(new Set(migrated.list.map(s=>s.id)).size,6);
assert.equal(migrated.list.find(s=>s.id===ann.id).count,126);
assert.equal(migrated.list.find(s=>s.id===ann.id).printingCount,14);
assert.equal(migrated.list.find(s=>s.code==='CT10').count,null);
assert.equal(legacy.list[0].id,'LOB','migration does not alter cached source objects');
assert.equal(migrateYgoSetCache({schema:3,at:4567,list:sets}).needsRefresh,false);
assert.equal(migrateYgoSetCache({...migrated}).needsRefresh,true,'a persisted migration remains refreshable');
assert.equal(migrateYgoSetCache({schema:3,at:4567,list:[{...lob,id:'LOB'}]}).needsRefresh,true);
assert.equal(migrateYgoSetCache({list:[]}),null);
assert.equal(migrateYgoSetCache(null),null);

const print=(set,code,rarity='Common')=>({set_name:set.set_name,set_code:code,set_rarity:rarity,set_price:'0.25'});
const rawCard=(id,set,prints=[])=>({id,name:'Fixture card '+id,type:'Spell Card',card_prices:[{tcgplayer_price:'9'}],card_sets:[print(set,set.set_code+'-EN'+String(id).padStart(3,'0')),...prints]});
const mixed=normalizeYgo(rawCard(1,original,[print(anniversary,'LOB-EN001'),print(starter,'SDY-001')]));
Object.freeze(mixed);
Object.freeze(mixed.sets);
mixed.sets.forEach(Object.freeze);
const snapshot=JSON.stringify(mixed);
assert.equal(ygoSetPrintings(mixed,lob).length,1);
assert.equal(ygoSetPrintings(mixed,ann).length,1);
assert.equal(ygoSetPrintings(mixed,normalizeYgoSet(sample)).length,0);
assert.equal(ygoSetPrintings({...mixed,sets:[{name:lob.name,code:'LOBB-001'}]},lob).length,0);

const partial=summarizeYgoSetContents(ann,[mixed,...Array.from({length:13},(_,i)=>normalizeYgo(rawCard(i+2,anniversary)))]);
assert.equal(partial.loadedUniqueCards,14);
assert.equal(partial.expectedUniqueCards,126);
assert.equal(partial.printingCount,14);
assert.equal(partial.completeness,'partial','exhausted provider pagination does not prove full official coverage');
assert.equal(partial.coverageReason,'fewer-than-expected');
assert.equal(partial.cards[0].setContext.releaseId,ann.id);
assert.equal(partial.cards[0].setContext.printings[0].name,ann.name);
assert.equal(partial.cards[0].setContext.edition,'unknown');
assert.equal(partial.cards[0].prices.usd,9,'do not replace generic price or infer release-specific price');
assert.deepEqual(partial.cards[0].sets,mixed.sets,'all source printing rows stay in their original order');
assert.equal(JSON.stringify(mixed),snapshot,'context cannot mutate the global card object');
assert.equal(mixed.setContext,undefined);
assert.notEqual(partial.cards[0],mixed);
assert.notEqual(partial.cards[0].setContext.printings[0],mixed.sets[1]);

const regional=normalizeYgo(rawCard(1,original,[print(original,'LOB-001')]));
const duplicate=summarizeYgoSetContents(lob,[mixed,regional,mixed]);
assert.equal(duplicate.loadedUniqueCards,1,'regional/printing rows deduplicate on card passcode');
assert.equal(duplicate.cards[0].setContext.printings.length,2,'distinct regional printing identities remain selectable');
assert.equal(duplicate.cards[0].setContext.printingAmbiguous,true);
assert.ok(duplicate.cards[0].sets.some(p=>p.name===ann.name),'other releases remain on the card for inventory/deck semantics');
const separateRows=summarizeYgoSetContents(ann,[normalizeYgo(rawCard(1,original)),normalizeYgo(rawCard(1,anniversary))]);
assert.equal(separateRows.cards[0].sets.length,2,'duplicate card rows retain all printings even when only one row belongs to the selected release');
const unrelated=summarizeYgoSetContents(ann,[normalizeYgo(rawCard(2,original))]);
assert.equal(unrelated.loadedUniqueCards,0,'same-prefix original cards must not pad the anniversary checklist');
assert.equal(unrelated.excludedRows,1);

const full=Array.from({length:126},(_,i)=>normalizeYgo(rawCard(i+1,original)));
assert.equal(summarizeYgoSetContents(lob,full).completeness,'complete');
const dateAmbiguous=summarizeYgoSetContents(sameName.find(s=>s.date===lob.date),full);
assert.equal(dateAmbiguous.completeness,'unknown','matching counts cannot establish release dates absent from provider membership');
assert.equal(dateAmbiguous.coverageReason,'provider-release-date-ambiguous');
assert.ok(dateAmbiguous.cards.every(c=>c.setContext.releaseAmbiguous && c.setContext.printingAmbiguous));
assert.equal(summarizeYgoSetContents(lob,[...full,full[0]]).loadedUniqueCards,126);
assert.equal(summarizeYgoSetContents(lob,full,{paginationComplete:false}).completeness,'partial');
assert.equal(summarizeYgoSetContents(lob,[...full,normalizeYgo(rawCard(127,original))]).completeness,'unknown','surplus unexpected cards are not silently called complete');
const unknown=summarizeYgoSetContents(normalizeYgoSet(tin1),[normalizeYgo(rawCard(1,tin1))]);
assert.equal(unknown.completeness,'unknown');
assert.equal(unknown.expectedUniqueCards,null);
assert.equal(unknown.loadedUniqueCards,1);
assert.throws(()=>summarizeYgoSetContents('LOB',[]),/specific.*release/);

// Adapter tests are fully mocked: no live provider calls, retries, proxy routes
// or account / provider configuration changes are needed for this regression.
const savedFetch=globalThis.fetch;
try {
  let requests=[];
  globalThis.fetch=async url=>{
    requests.push(new URL(url));
    if(new URL(url).pathname.endsWith('/cardsets.php'))return Response.json(rawSets);
    assert.equal(new URL(url).searchParams.get('cardset'),ann.name);
    return Response.json({data:Array.from({length:14},(_,i)=>rawCard(i+1,anniversary)),meta:{rows_remaining:0}});
  };
  assert.deepEqual(await ygoSource.sets(),sets);
  const loaded=await ygoSource.setContents(ann);
  assert.equal(loaded.loadedUniqueCards,14);
  assert.equal(loaded.completeness,'partial');
  assert.equal(loaded.provenance.membership.match,'exact-release-name-and-code');
  assert.ok(loaded.provenance.membership.loadedAt);
  assert.equal(requests.length,2);
  assert.ok(Array.isArray(await ygoSource.setCards(ann)),'setCards keeps the existing array contract');

  requests=[];
  globalThis.fetch=async url=>{
    requests.push(new URL(url));
    return Response.json(new URL(url).searchParams.get('offset')==='0'
      ? {data:Array.from({length:100},(_,i)=>rawCard(i+1,original)),meta:{rows_remaining:26}}
      : {data:[rawCard(100,original),...Array.from({length:26},(_,i)=>rawCard(i+101,original))],meta:{rows_remaining:'0'}});
  };
  const all=await ygoSource.setContents(lob);
  assert.equal(all.loadedUniqueCards,126);
  assert.equal(all.completeness,'complete');
  assert.deepEqual(requests.map(u=>u.searchParams.get('offset')),['0','100']);

  requests=[];
  globalThis.fetch=async url=>{
    requests.push(new URL(url));
    return requests.length===1?Response.json({data:[rawCard(1,original)],meta:{rows_remaining:125}}):Response.json({error:'Provider access denied'},{status:403});
  };
  const interrupted=await ygoSource.setContents(lob);
  assert.equal(interrupted.loadedUniqueCards,1);
  assert.equal(interrupted.completeness,'partial');
  assert.equal(interrupted.paginationComplete,false);
  assert.equal(interrupted.coverageReason,'provider-request-failed');
  assert.match(interrupted.loadError,/denied/);
  assert.equal(requests.length,2,'403 is not retried or bypassed');

  let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({error:'Provider access denied'},{status:403});};
  await assert.rejects(ygoSource.setContents(lob),/denied/);
  assert.equal(calls,1,'first-page failure propagates without a retry');
  await assert.rejects(ygoSource.sets(),/denied/);
  globalThis.fetch=async()=>Response.json({not:'a catalogue'});
  await assert.rejects(ygoSource.sets(),/invalid response/);

  calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({data:[rawCard(1,original)],meta:{rows_remaining:125}});};
  const repeated=await ygoSource.setContents(lob);
  assert.equal(calls,2,'repeating provider page is bounded without 20 redundant requests');
  assert.equal(repeated.loadedUniqueCards,1);
  assert.equal(repeated.completeness,'partial');
  assert.equal(repeated.coverageReason,'provider-repeated-page');

  calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({data:[rawCard(calls,original)],meta:{rows_remaining:126}});};
  const capped=await ygoSource.setContents(lob);
  assert.equal(calls,20);
  assert.equal(capped.loadedUniqueCards,20);
  assert.equal(capped.completeness,'partial');
  assert.equal(capped.coverageReason,'provider-page-limit');
} finally { globalThis.fetch=savedFetch; }

console.log('PASS: Yu-Gi-Oh! canonical release identity, legacy ambiguity, v3 cache migration, exact printing context, regional deduplication, official/unknown counts, partial coverage and bounded provider errors.');
