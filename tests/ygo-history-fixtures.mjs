// Synthetic exact-history payloads. These imports perform no fetch or browser work.
import assert from 'node:assert/strict';
import {CARDS,EXPECTED,VASM,MP25,YGO_SETS,providerFixture,validateFixtures as validateCards} from './card-polish-fixtures.mjs';
import {ygoSource} from '../ygo.js';
import {presentationQuote} from '../pricing-presentation.js';
import {setContextCard} from '../tcg.js';
import {readExactYgoHistoryRequest,exactYgoHistoryIdentity,canRequestExactYgoHistory} from '../ygo-history-identity.js';
import {validateHistory,historyKey} from '../shared-history.js';
export const EDITIONS={'1st-edition':{label:'1st Edition',values:[7,9]},unlimited:{label:'Unlimited',values:[17,19]},limited:{label:'Limited',values:[27,29]}};
export const PRINTING='VASM-EN001::Super Rare';
export const card=setContextCard('ygo',CARDS.ygo.find(c=>c.id===EXPECTED.ygo.multiple),VASM,YGO_SETS);
export const selectedQuote=(edition='1st-edition')=>presentationQuote('ygo',card,'reference',PRINTING,edition);
export const exactURL=q=>new URL('https://fixture.invalid/api/prices/recent?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish,releaseId:q.releaseId,edition:q.edition,rarity:q.rarity,selectedEdition:q.selectedEdition,currency:q.currency}));
export function historyFixture(url,{status='ready',points,echo={},seriesPatch={}}={}){
 const q=readExactYgoHistoryRequest(url);assert(q&&canRequestExactYgoHistory(q),'Hosted exact fixture rejects incomplete/generic requests instead of masking app regressions');
 const identity=exactYgoHistoryIdentity(q),edition=EDITIONS[q.selectedEdition],archive=url.pathname.endsWith('archive');
 return {...identity,status,...echo,series:status==='ready'?[{...identity,source:'Synthetic '+(archive?'archive':'recent')+' provider · '+edition.label,subtype:edition.label,productId:101,label:[VASM.name,q.edition,q.rarity,edition.label].join(' · '),archived:archive,historyProvider:archive?'archive':'recent',provenance:'https://tickermint.cards/card/101',attribution:'Synthetic fixture only, not live prices',points:points||[{date:'2026-09-13',value:edition.values[0]},{date:'2026-09-16',value:edition.values[1]}],...seriesPatch}]:[]};
}
export function staleStorage({both=false}={}){
 const q=selectedQuote(),payload=historyFixture(exactURL(q));
 if(both){const archive=exactURL(q);archive.pathname='/api/prices/archive';payload.series=[...historyFixture(archive,{points:[{date:'2026-09-13',value:11},{date:'2026-09-16',value:13}]}).series,...historyFixture(exactURL(q),{points:[{date:'2026-09-13',value:41},{date:'2026-09-16',value:43}]}).series];}
 return {'cardstashy-public-market-history-v4':{[historyKey(q)]:{...payload,checked:Date.parse('2026-10-16T00:00:00Z')}}};
}
export async function validateFixtures(){
 await validateCards();
 const originalFetch=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async input=>{const url=new URL(String(input));assert.equal(url.hostname,'db.ygoprodeck.com');const data=providerFixture(url);assert.notEqual(data,undefined);calls.push(url);return Response.json(data);};
  const sets=await ygoSource.sets();assert.deepEqual(sets.map(s=>s.id),YGO_SETS.map(s=>s.id));assert(sets.every(s=>s.id&&s.name));
  const contents=await ygoSource.setContents(sets.find(s=>s.id===VASM.id));
  assert.deepEqual(contents.cards.map(c=>c.id),[EXPECTED.ygo.multiple,EXPECTED.ygo.known,EXPECTED.ygo.unknown,EXPECTED.ygo.common],'Exact VASM membership excludes the separate MP25 printing');
  const mp25Contents=await ygoSource.setContents(sets.find(s=>s.id===MP25.id));
  assert.deepEqual(mp25Contents.cards.map(c=>c.id),[EXPECTED.ygo.edition],'MP25 edition fixture remains bound to its own release');
  assert.equal(calls.length,3);assert.equal(calls[1].searchParams.get('cardset'),VASM.name);assert.equal(calls[2].searchParams.get('cardset'),MP25.name);
 }finally{globalThis.fetch=originalFetch;}

 assert.equal(card.setContext.printingAmbiguous,true);assert.equal(selectedQuote().printing.quotes?.length||0,0);assert.equal(selectedQuote().value,null);
 for(const edition of Object.keys(EDITIONS)){const q=selectedQuote(edition),raw=historyFixture(exactURL(q)),result=validateHistory(raw,q);assert.equal(result.series[0].subtype,EDITIONS[edition].label);assert.deepEqual(result.series[0].points.map(p=>p.value),EDITIONS[edition].values);}
 const q=selectedQuote();for(const key of ['releaseId','edition','rarity','currency','selectedEdition'])for(const target of ['echo','seriesPatch'])assert.throws(()=>validateHistory(historyFixture(exactURL(q),{[target]:{[key]:'wrong'}}),q));
 assert.throws(()=>validateHistory(historyFixture(exactURL(q),{seriesPatch:{subtype:'Normal'}}),q));
 assert.deepEqual(validateHistory(historyFixture(exactURL(q),{points:[{date:'2026-09-13',value:0}]}),q).series[0].points,[]);
 for(const status of ['empty','unsupported','unavailable'])assert.deepEqual(validateHistory(historyFixture(exactURL(q),{status}),q).series,[]);
 assert.throws(()=>historyFixture(new URL('https://fixture.invalid/api/prices/recent?game=ygo&id=99020001&finish=reference')));
 assert.equal(Object.keys(staleStorage()['cardstashy-public-market-history-v4']).length,1);
 return 'PASS: exact YGO hosted fixtures validate all three physical editions, matching response/series identity, wrong release/code/rarity/currency/subtype rejection, zero/no points and stale cached observations. No browser/server/network started.';
}
