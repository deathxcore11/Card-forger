import assert from 'node:assert/strict';
import {createScannerPrintingPicker,scannerPrintingSelection} from './scanner-printing.js';
import {createPrintingPicker,printingRows,printingSelection} from './printing-picker.js';
import {setContextCard} from './tcg.js';
import {normalizeYgoSets} from './ygo.js';
import {registerScanner,scanConfirmation} from './scancam.js';
import {loadBatch,saveBatch} from './scan-batch.js';
import {savePrefs,loadSession} from './scansession.js';
import {S,blank} from './store.js';

// No provider calls, photos, paid services or browser processes in this fixture.
const previous={fetch:globalThis.fetch,localStorage:globalThis.localStorage,document:globalThis.document};
let network=0,storageWrites=0;
globalThis.fetch=()=>{network++;throw Error('Live network is prohibited in scanner printing tests.');};
globalThis.localStorage={getItem:()=>null,setItem:()=>storageWrites++,removeItem:()=>storageWrites++};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const mtg={id:'magic-a',oracle_id:'same-oracle',name:'Lightning Bolt',games:['paper'],set:'lea',set_name:'Alpha',collector_number:'161',rarity:'common',released_at:'1993-08-05',finishes:['nonfoil','foil'],tcgplayer_id:11,prices:{usd:'20',usd_foil:'30'}};
const mtgB={...mtg,id:'magic-b',set:'m11',set_name:'Magic 2011',collector_number:'146',released_at:'2010-07-16',finishes:['nonfoil','etched'],tcgplayer_id:21,tcgplayer_etched_id:22};
const ptcg={game:'ptcg',id:'base1-58',name:'Pikachu',set:{id:'base1',name:'Base Set',number:'58',total:102},released:'1999-01-09',rarity:'Common',variants:[{key:'normal',label:'Normal',productId:30},{key:'detail:shadowless-1st',label:'Shadowless · First Edition',productId:31}]};
const ptcgB={...ptcg,id:'base2-87',set:{id:'base2',name:'Base Set 2',number:'87',total:130},released:'2000-02-24',variants:[{key:'normal',label:'Normal',productId:32}]};
const ygoCatalogue=normalizeYgoSets([{set_code:'TST',set_name:'Test first release',tcg_date:'2002-01-01'},{set_code:'TST',set_name:'Test anniversary release',tcg_date:'2023-01-01'}]);
const ygo={game:'ygo',id:'89631139',name:'Blue-Eyes White Dragon',sets:[{name:'Test first release',code:'TST-001',rarity:'Rare',productId:41,quotes:[{edition:'1st Edition',market:10},{edition:'Unlimited',market:5}]},{name:'Test anniversary release',code:'TST-EN001',rarity:'Ultra Rare',productId:42,quotes:[{edition:'Unlimited',market:15}]}]};
const byId=new Map([mtg,mtgB,ptcg,ptcgB,ygo].map(c=>[c.id,c]));
const candidate=card=>({id:card.id,name:card.name,exact:false,card});
const project=(game,card,release,catalogue,opts)=>setContextCard(game,card,release,catalogue,opts);

function harness(game,card,dependencies={}) {
  const initial=[{id:'capture-A',captureRevision:'revision-1',game,selectedGame:'mtg',originalShot:'data:image/jpeg;base64,PRIVATE_ORIGINAL',shot:'data:image/jpeg;base64,PRIVATE_THUMB',at:123,location:'Binder A',qty:3,condition:'Lightly Played',lang:'ja',read:{name:card.name,code:'unreadable'},cands:[candidate(card)],status:'review'},
    {id:'capture-B',captureRevision:'revision-2',game:'mtg',originalShot:'SECOND_PRIVATE_ORIGINAL',qty:1,status:'unresolved'}];
  const model={queue:structuredClone(initial),globalGame:'mtg',camera:{live:true,stream:'same-stream',captures:2},search:{q:'Unchanged search',page:4,filters:{rarity:'rare'}},confirm:{batchId:'capture-A',captureRevision:'revision-1',game},collection:[],callbacks:0,cancels:0};
  let context=null,html='';
  const A={},C={},I={},body={scrollTop:0,contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[]};
  const picker=createPrintingPicker({A,C,I,getContext:()=>context,getBody:()=>body,openSheet:(next,ctx)=>{html=next;context=ctx;},back:()=>{context=null;}});
  const calls={magic:[],search:[],detail:[],catalogue:[]};
  let canonicalCatalogue=game==='ygo'?[]:[];
  const helper=createScannerPrintingPicker({openPicker:picker.open,
    requestMagic:async(path,options)=>{calls.magic.push(path);return path.startsWith('/cards/search')?{data:[mtg,mtgB],has_more:false}:byId.get(decodeURIComponent(path.slice('/cards/'.length)));},
    sources:{ptcg:{search:async spec=>{calls.search.push(spec);return spec.page===0?{cards:[ptcg,{...ptcg,id:'ex-decoy',name:'Pikachu ex'},ptcgB],more:false}:{cards:[],more:false};}}},
    ensureCard:async(g,id)=>{calls.detail.push([g,id]);return byId.get(id);},
    getCatalogue:()=>canonicalCatalogue,
    loadCatalogue:async g=>{calls.catalogue.push(g);canonicalCatalogue=ygoCatalogue;return canonicalCatalogue;},
    projectCard:project,...dependencies});
  const config=()=>{
    const confirm=model.confirm,entry=model.queue.find(x=>x.id===confirm.batchId);
    return {game:confirm.game,candidate:entry.cands?.[0]||candidate(card),captureId:entry.id,captureRevision:entry.captureRevision,parentContext:null,
      isCurrent:identity=>model.confirm===confirm&&model.queue.some(x=>x.id===identity.captureId&&x.captureRevision===identity.captureRevision),
      onSelect:(result,identity)=>{
        model.callbacks++;
        model.queue=model.queue.map(row=>row.id===identity.captureId?{...row,cands:[result.candidate],finish:result.finish,printingConfirmed:true,reviewSource:result.reviewSource,selectedIndex:0,status:'review'}:row);
        Object.assign(confirm,{i:0,finish:result.finish,printingConfirmed:true});
      },onCancel:()=>model.cancels++};
  };
  return {model,initial,picker,helper,A,C,I,calls,config,get html(){return html;},get context(){return context;}};
}

try {
  for(const [game,card,pick] of [['mtg',mtg,row=>row.cardId===mtgB.id&&row.finish==='etched'],['ptcg',ptcg,row=>row.variantKey==='detail:shadowless-1st'],['ygo',ygo,row=>row.productId===41&&row.edition==='1st-edition']]) {
    const h=harness(game,card),before=structuredClone(h.model);
    await h.helper.open(h.config());
    assert.equal(h.picker.state.game,game,'review game is separate from the global game');
    assert.equal(h.picker.state.purpose,'scan');
    assert.match(h.html,/Use this printing/);
    assert.match(h.html,/Nothing (?:is )?added automatically/);
    assert.match(h.html,/Set/);assert.match(h.html,/Sort/);
    assert.match(h.html,game==='ygo'?/Edition/:/Version \/ finish|Finish/);
    assert.deepEqual(h.model,before,'opening and loading do not mutate a capture, camera, collection or Search');
    const row=h.picker.state.rows.find(pick);assert.ok(row,`precise ${game} printing exists`);
    h.picker.choose(row.key);
    assert.equal(h.context,null,'selection returns to the unchanged live scanner rather than opening card detail');
    assert.equal(h.model.callbacks,1);assert.equal(h.picker.choose(row.key),false,'a repeat click cannot apply twice');
    const after=h.model.queue[0],selected=after.cands[0];
    for(const field of ['id','captureRevision','originalShot','shot','at','location','qty','condition','lang','read','selectedGame'])assert.deepEqual(after[field],before.queue[0][field],`${game} preserves ${field}`);
    assert.deepEqual(h.model.queue.map(x=>x.id),['capture-A','capture-B']);assert.deepEqual(h.model.queue[1],before.queue[1]);
    assert.equal(after.status,'review','manual choice never becomes automatically ready');
    assert.equal(selected.exact,false,'manual review cannot fabricate an OCR match');
    assert.equal(selected.printingConfirmed,true);assert.equal(selected.reviewSource,'printing-picker');
    assert.equal(selected.printingSelection.cardId,row.cardId);assert.equal(selected.printingSelection.productId,row.productId);
    assert.equal(selected.printingSelection.releaseId,row.releaseId);assert.equal(selected.printingSelection.variantKey,row.variantKey);
    assert.equal(selected.printingSelection.edition,row.edition);assert.equal(selected.printingSelection.printingKey,row.printingKey);
    assert.equal(after.finish,game==='ygo'?row.edition:game==='ptcg'?row.variantKey:row.finish);
    assert.deepEqual(h.model.collection,[],'choosing a printing is not saving it');assert.deepEqual(h.model.camera,before.camera,'stream stays live; no duplicate capture');
    assert.deepEqual(h.model.search,before.search);assert.equal(h.model.globalGame,before.globalGame);
    if(game==='ygo'){assert.equal(selected.print,'TST-001|Rare');assert.deepEqual(h.calls.catalogue,['ygo'],'canonical catalogue loader is reused');assert.equal(selected.card.setContext.status,'resolved');}
    if(game==='ptcg'){assert.deepEqual(h.calls.search,[{q:'Pikachu',sort:'new',page:0,exactName:true}]);assert.ok(!h.calls.detail.some(([,id])=>id==='ex-decoy'),'different name suffixes never hydrate');}
  }

  // Cancel leaves every byte of capture and review metadata untouched.
  for(const [game,card] of [['mtg',mtg],['ptcg',ptcg],['ygo',ygo]]){
    const h=harness(game,card),before=structuredClone(h.model);
    await h.helper.open(h.config());h.A.printingPickerCancel();
    assert.deepEqual({...h.model,cancels:before.cancels},before);assert.equal(h.model.cancels,1);assert.equal(h.context,null);
  }

  // Late page A cannot paint/select onto capture B, even if the picker stayed open.
  const slow=deferred(),h=harness('ptcg',ptcg,{sources:{ptcg:{search:()=>slow.promise}}});
  const pending=h.helper.open(h.config()),a=h.model.confirm;
  h.model.confirm={batchId:'capture-B',captureRevision:'revision-2',game:'mtg'};
  slow.resolve({cards:[ptcg],more:false});await pending;
  assert.equal(h.picker.state.rows.length,0);assert.equal(h.model.callbacks,0);assert.equal(a.i,undefined);
  assert.deepEqual(h.model.queue,h.initial);

  // A retry retains its capture ID but changes revision: old rows cannot apply.
  const retry=harness('ptcg',ptcg);await retry.helper.open(retry.config());
  const oldKey=retry.picker.state.rows[0].key;
  retry.model.queue[0].captureRevision='replacement-photo';retry.picker.choose(oldKey);
  assert.equal(retry.model.callbacks,0);assert.equal(retry.model.queue[0].captureRevision,'replacement-photo');
  assert.equal(retry.model.queue[0].cands[0].printingConfirmed,undefined);

  // Cancel before slow results, then open another review. The first completion
  // cannot reopen its popup, update the newer rows, or invoke either selection.
  const gate=deferred(),launch=harness('ptcg',ptcg,{sources:{ptcg:{search:()=>gate.promise}}});
  const old=launch.helper.open(launch.config());launch.picker.cancel();
  launch.model.confirm={batchId:'capture-A',captureRevision:'revision-1',game:'ptcg'};
  const next=launch.helper.open(launch.config());gate.resolve({cards:[ptcgB],more:false});await Promise.all([old,next]);
  assert.equal(launch.picker.state.rows.length,1);assert.equal(launch.picker.state.rows[0].cardId,ptcgB.id);
  assert.equal(launch.model.callbacks,0);assert.equal(launch.model.cancels,1);

  // The Magic seed hydrates by exact ID; cancelling during that lookup never opens UI.
  const seedGate=deferred(),seed=harness('mtg',{id:'magic-a',name:mtg.name},{requestMagic:()=>seedGate.promise});
  const seedPending=seed.helper.open(seed.config());seed.helper.abandon();seedGate.resolve(mtg);await seedPending;
  assert.equal(seed.picker.state,null);assert.equal(seed.model.callbacks,0);

  // Exact-name pagination is the normal source adapter, not a Search reset.
  let pages=0;const paged=harness('ptcg',ptcg,{sources:{ptcg:{search:async spec=>{pages++;assert.equal(spec.exactName,true);return {cards:[spec.page?ptcgB:ptcg],more:!spec.page};}}}});
  await paged.helper.open(paged.config());while(paged.picker.state.busy)await new Promise(r=>setTimeout(r,0));assert.equal(pages,2,'carousel automatically loads all exact-name pages');assert.equal(paged.picker.state.nextCursor,null);
  paged.C.printingPickerFilter({dataset:{field:'finish'},value:'normal'});paged.A.printingPickerView({dataset:{id:'list'}});
  await paged.A.printingPickerMore();assert.equal(pages,2);assert.equal(paged.picker.state.rows.length,3);
  assert.equal(paged.picker.state.filters.finish,'normal');assert.equal(paged.picker.state.view,'list');

  // Details unavailable: visible but unselectable, with no invented variant.
  const missing=harness('ptcg',ptcg,{ensureCard:async()=>{throw Error('fixture unavailable');}});
  await missing.helper.open(missing.config());
  assert.equal(missing.picker.state.complete,false);assert.ok(missing.picker.state.rows.every(row=>!row.selectable));
  assert.match(missing.html,/could not be loaded/);assert.equal(missing.model.callbacks,0);

  // Selection identities are revalidated using the shipped row builder. A
  // forged ID, suffix, release, product or variant never reaches scanner state.
  const rows=printingRows('ptcg',[ptcg],{source:ptcg,projectCard:(card,release,opts)=>project('ptcg',card,release,[],opts)}),valid=printingSelection(rows[1]);
  const params={game:'ptcg',source:ptcg,projectCard:(card,release,opts)=>project('ptcg',card,release,[],opts)};
  assert.ok(scannerPrintingSelection(valid,params));
  for(const patch of [{cardId:'another'},{productId:999},{variantKey:'foil'},{releaseId:'another'},{game:'ygo'},{card:{...ptcg,name:'Pikachu ex'}}])assert.equal(scannerPrintingSelection({...valid,...patch},params),null);
  const original=structuredClone(ptcg);scannerPrintingSelection(valid,params);assert.deepEqual(ptcg,original,'source card is not modified');
  const coarse={...ptcg,variants:[{key:'firstEdition',label:'First Edition · finish unconfirmed'}]},coarseRows=printingRows('ptcg',[coarse],{source:coarse,projectCard:params.projectCard});
  const coarseSelection=scannerPrintingSelection(printingSelection(coarseRows[0]),{...params,source:coarse});
  assert.equal(coarseSelection.finish,'','edition-only source evidence cannot assume a finish');
  assert.equal(coarseSelection.candidate.finishUnconfirmed,true);assert.equal(coarseSelection.selection.variantKey,'firstEdition','original edition/variant context remains available');
  assert.equal(network,0);assert.equal(storageWrites,0,'helper performs zero collection/queue/storage writes');
  console.log('PASS: scanner reuses all-game printing picker; exact identity/finish/edition/product; queue metadata and camera continuity; cancellation, stale capture/revision, pagination and zero automatic writes.');

  // Exercise the actual registered scanner hook, existing picker, persisted
  // batch and explicit-save boundary together, with only source data mocked.
  const memory=new Map();
  globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  globalThis.document={getElementById:()=>null,addEventListener(){},querySelector:()=>null};
  for(const [game,card,pick] of [['mtg',mtg,row=>row.cardId===mtgB.id&&row.finish==='etched'],['ptcg',ptcg,row=>row.variantKey==='detail:shadowless-1st'],['ygo',ygo,row=>row.productId===41&&row.edition==='1st-edition']]){
    const h=harness(game,card),A={},C={},saved=[];
    S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={camOn:true};
    for(const g of ['mtg','ptcg','ygo'])savePrefs(g,{sounds:false,haptics:false});
    saveBatch(h.initial);
    registerScanner({A,C,render(){},toast(){},game:()=>S.state.settings.game,
      setOf:(g,c)=>g==='mtg'?c.card.set:g==='ptcg'?c.card.set.id:c.print.split('|')[0],
      numberOf:(g,c)=>g==='mtg'?c.card.collector_number:g==='ptcg'?c.card.set.number:c.print.split('|')[0],
      priceOf:()=>null,openPrintingPicker:config=>h.helper.open(config),addMany:async(g,items)=>saved.push({game:g,items})});
    assert.equal(typeof A.scanChangePrinting,'function','registered scanner exposes the real printing action');
    A.scanBatchReview({dataset:{id:'capture-A'}});
    assert.match(scanConfirmation(game,S.ui.scan,{}),/data-act="scanChangePrinting"[^>]*>Browse every printing/);
    const original=loadBatch(),q=S.ui.scan.confirm;
    await A.scanChangePrinting();h.picker.cancel();
    assert.deepEqual(loadBatch(),original,'cancel does not persist any candidate or metadata change');
    assert.equal(S.ui.scan.confirm,q);assert.equal(saved.length,0);assert.equal(S.ui.scan.camOn,true);
    await A.scanChangePrinting();const row=h.picker.state.rows.find(pick);h.picker.choose(row.key);
    const selected=loadBatch()[0];assert.equal(selected.cands[0].id,row.cardId);
    assert.equal(selected.cands[0].exact,false);assert.equal(selected.status,'review');
    for(const field of ['id','captureRevision','originalShot','shot','at','location','qty','condition','lang','read','selectedGame'])assert.deepEqual(selected[field],original[0][field],`${game}: actual hook preserves ${field}`);
    assert.equal(S.ui.scan.confirm.qty,3);assert.equal(S.ui.scan.confirm.condition,'Lightly Played');assert.equal(S.ui.scan.confirm.lang,'ja');
    assert.equal(S.state.settings.game,'mtg');assert.equal(S.ui.scan.camOn,true);assert.equal(saved.length,0);
    A.scanDismiss();assert.equal(saved.length,0);assert.equal(S.ui.scan.confirm,null);assert.equal(S.ui.scan.camOn,true);
    await A.scanBatchSave();assert.equal(saved.length,0,'return to camera and Save ready do not auto-save a manual-review row');
    assert.deepEqual(loadBatch().map(x=>x.id),['capture-A','capture-B']);
    A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanConfirm();
    assert.equal(saved.length,1,'only Add to collection saves');
    assert.equal(saved[0].game,game);const item=saved[0].items[0];
    assert.equal(item.captureId,'capture-A');assert.equal(item.id,row.cardId);assert.equal(item.productId,row.productId);
    assert.equal(item.qty,3);assert.equal(item.condition,'Lightly Played');assert.equal(item.lang,'ja');assert.equal(item.location,'Binder A');
    assert.equal(item.cand.exact,false);assert.equal(item.cand.printingConfirmed,true);
    if(game==='ygo'){assert.equal(item.setReleaseId,row.releaseId);assert.equal(item.finish,row.edition);assert.equal(item.print,'TST-001|Rare');}
    assert.equal(S.ui.scan.camOn,true);assert.equal(S.ui.scan.confirm,null);assert.deepEqual(loadSession(game),[],'explicit save cannot duplicate into a session');
    assert.deepEqual(loadBatch().map(x=>x.id),['capture-B']);

    // Re-select, then choose a different finish in the compact review. An etched
    // or detailed product must not remain attached to another chosen variant.
    saveBatch(h.initial);A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanChangePrinting();
    h.picker.choose(h.picker.state.rows.find(pick).key);
    C.scanConfirmFinish({value:game==='mtg'?'nonfoil':game==='ptcg'?'normal':'unlimited'});
    await A.scanConfirm();assert.equal(saved.length,2);
    assert.notEqual(saved[1].items[0].productId,row.productId,'changing finish clears or replaces the previously selected product');
    if(game==='ptcg')assert.equal(saved[1].items[0].productId,30);
  }

  // Guard the scanner callback itself, independently of the picker controller.
  const guarded=harness('ptcg',ptcg),callbacks=[],A={},C={};
  S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={camOn:true};saveBatch(guarded.initial);
  registerScanner({A,C,render(){},toast(){},game:()=>S.state.settings.game,priceOf:()=>null,openPrintingPicker:async config=>callbacks.push(config),addMany:async()=>assert.fail('A stale picker may never save')});
  const payload=scannerPrintingSelection(valid,params);
  A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanChangePrinting();
  A.scanBatchReview({dataset:{id:'capture-B'}});const beforeB=loadBatch(),confirmB=S.ui.scan.confirm;
  callbacks[0].onSelect(payload);assert.deepEqual(loadBatch(),beforeB);assert.equal(S.ui.scan.confirm,confirmB);
  A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanChangePrinting();
  saveBatch(loadBatch().map(row=>row.id==='capture-A'?{...row,captureRevision:'new-photo'}:row));
  const beforeRevision=loadBatch();callbacks[1].onSelect(payload);assert.deepEqual(loadBatch(),beforeRevision,'same ID with new photo rejects old callback');

  // Coarse edition-only and missing variant records remain useful identified
  // printings, but neither UI input nor forced stale state can fabricate finish.
  for(const unknown of [coarse,{...ptcg,variants:[]}]){
    const h=harness('ptcg',unknown,{sources:{ptcg:{search:async()=>({cards:[unknown],more:false})}},ensureCard:async()=>unknown}),A={},C={};let saves=0;
    S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={camOn:true};saveBatch(h.initial);
    registerScanner({A,C,render(){},toast(){},game:()=>S.state.settings.game,priceOf:()=>null,openPrintingPicker:config=>h.helper.open(config),addMany:async()=>saves++});
    A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanChangePrinting();h.picker.choose(h.picker.state.rows[0].key);
    assert.equal(S.ui.scan.confirm.finish,'');assert.equal(loadBatch()[0].status,'review');assert.equal(loadBatch()[0].cands[0].finishUnconfirmed,true);
    assert.match(scanConfirmation('ptcg',S.ui.scan,{}),/data-act="scanConfirm"[^>]*disabled/);
    C.scanConfirmFinish({value:unknown.variants.length?'firstEdition':'normal'});assert.equal(S.ui.scan.confirm.finish,'');
    await A.scanConfirm();assert.equal(saves,0);
    S.ui.scan.confirm.finish=unknown.variants.length?'firstEdition':'normal';await A.scanConfirm();
    assert.equal(saves,0,'forced unsupported finish is also rejected at save');assert.equal(S.ui.scan.camOn,true);assert.equal(loadBatch().length,2);
  }

  // Yu-Gi-Oh! can have a verified release/code/rarity without edition quotes.
  // Keep the user's printing choice, but never quietly assume Unlimited.
  {
    const unknown={...ygo,sets:ygo.sets.map(print=>({...print,quotes:[]}))},h=harness('ygo',unknown,{ensureCard:async()=>unknown}),A={},C={},saved=[];
    S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={camOn:true};saveBatch(h.initial);
    registerScanner({A,C,render(){},toast(){},game:()=>S.state.settings.game,priceOf:()=>null,setOf:()=> 'TST',numberOf:(g,c)=>c.print.split('|')[0],openPrintingPicker:config=>h.helper.open(config),addMany:async(g,items)=>saved.push({game:g,items})});
    A.scanBatchReview({dataset:{id:'capture-A'}});await A.scanChangePrinting();
    const row=h.picker.state.rows.find(row=>row.number==='TST-001');assert.equal(row.edition,'');assert.equal(row.selectable,true);
    h.picker.choose(row.key);
    const selected=loadBatch()[0];assert.equal(selected.cands[0].print,'TST-001|Rare');assert.equal(selected.cands[0].setReleaseId,row.releaseId);
    assert.equal(selected.cands[0].printingConfirmed,true);assert.equal(selected.cands[0].finishUnconfirmed,true);assert.equal(selected.cands[0].exact,false);
    assert.equal(selected.finish,'');assert.equal(selected.status,'review');assert.equal(S.ui.scan.confirm.finish,'');
    assert.match(scanConfirmation('ygo',S.ui.scan,{}),/data-act="scanConfirm"[^>]*disabled/);
    await A.scanConfirm();assert.equal(saved.length,0,'unknown edition never saves or assumes Unlimited');
    C.scanConfirmFinish({value:'unlimited'});assert.equal(S.ui.scan.confirm.finish,'unlimited');await A.scanConfirm();
    assert.equal(saved.length,1);assert.equal(saved[0].game,'ygo');assert.equal(saved[0].items[0].finish,'unlimited');assert.equal(saved[0].items[0].setReleaseId,row.releaseId);
    assert.equal(saved[0].items[0].productId,'','an edition-unspecified product is not rebound to a manually chosen edition');
    assert.equal(S.state.settings.game,'mtg');assert.equal(S.ui.scan.camOn,true);assert.deepEqual(loadBatch().map(row=>row.id),['capture-B']);
  }
  assert.equal(network,0);
  console.log('PASS: real scanner → shared picker → queue → explicit save across all games; cancellation and stale callbacks; condition/language/location/revision preservation; no autosave or duplicate capture; product follows changed finish.');
} finally {
  globalThis.fetch=previous.fetch;globalThis.localStorage=previous.localStorage;globalThis.document=previous.document;
}
