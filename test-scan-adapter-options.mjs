import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {conditionValue} from './condition-value.js';

// Exercise the actual app adapter rather than a copied implementation. This
// test has no browser, account, collection or outbound provider requests.
const source=readFileSync('app.js','utf8');
const line=source.split('\n').find(x=>x.trimStart().startsWith('candById: async '));
assert(line,'production scanner candidate adapter exists');
const calls=[],tcgCandidate={id:'fixture',card:{id:'fixture'}},magicCard={id:'magic-fixture'};
const context={tcgCtx:{scanCandById:async(...args)=>{calls.push(args);return tcgCandidate;}},api:async path=>{calls.push(['api',path]);return magicCard;},mtgScanCand:(card,why,exact)=>({card,why,exact})};
const adapter=vm.runInNewContext('({'+line+'}).candById',context);
const options={identityOnly:true};
assert.equal(await adapter('ptcg','fixture','Code matched',true,options),tcgCandidate);
assert.deepEqual(calls.pop(),['ptcg','fixture','Code matched',true,options]);
await adapter('ygo','fixture','Review',false);
const ordinary=calls.pop();assert.equal(ordinary[0],'ygo');assert.equal(ordinary[4].identityOnly,undefined,'ordinary detail lookup remains full');
const magic=await adapter('mtg','magic/fixture','Code matched',true,options);
assert.equal(magic.card,magicCard);assert.equal(magic.exact,true);assert.deepEqual(calls.pop(),['api','/cards/magic%2Ffixture']);
assert.equal(calls.length,0);
console.log('PASS: actual scanner app adapter forwards identity-only TCG options without changing ordinary hydration or Magic exact-ID lookup.');

// The real shared condition-fetch entry point must not spend provider capacity
// on a saved scanner release it cannot distinguish. No network is used here.
const fetchSource=source.slice(source.indexOf('function fetchConditionValue('),source.indexOf('\nlet magicPriceRefresh='));
let requested=0,projection={setContext:{status:'resolved',printings:[{code:'LOB-EN005',rarity:'Ultra Rare'}]}};
const single={id:'46986414',sets:[{code:'LOB-EN005',rarity:'Ultra Rare',name:'Original'}]};
let raw=single;
const fetchContext={T:{cardOf:()=>raw,setContextCard:()=>projection,currentYgoCatalogue:()=>[]},loadConditionQuotes:()=>{requested++;return Promise.resolve({changed:false});}};
vm.createContext(fetchContext);vm.runInContext(fetchSource,fetchContext);
const entry={printing:'LOB-EN005',rarity:'Ultra Rare',edition:'unlimited',condition:'Lightly Played'};
fetchContext.fetchConditionValue(single,{...entry,setReleaseUnverified:true},'ygo');assert.equal(requested,0);
raw={...single,sets:[...single.sets,{...single.sets[0],name:'Later release'}]};
fetchContext.fetchConditionValue(raw,{...entry,setReleaseId:'known-release'},'ygo');assert.equal(requested,0,'code-only condition feed cannot distinguish reused releases');
raw=single;projection={setContext:{status:'ambiguous',printings:[]}};
fetchContext.fetchConditionValue(single,{...entry,setReleaseId:'unknown-release'},'ygo');assert.equal(requested,0);
projection={setContext:{status:'resolved',printings:[{code:entry.printing,rarity:entry.rarity}]}};
fetchContext.fetchConditionValue(single,{...entry,setReleaseId:'known-release'},'ygo');assert.equal(requested,1,'unambiguous known release still uses existing provider path');
fetchContext.fetchConditionValue({id:'pk'},entry,'ptcg');fetchContext.fetchConditionValue({id:'magic'},entry,'mtg');assert.equal(requested,3,'other game provider paths are unchanged');
await Promise.resolve();
console.log('PASS: actual shared condition fetch skips unknown/reused YGO release keys without changing unambiguous or other-game quote requests.');

const magicPriceSource=source.slice(source.indexOf('const mtgScanPrice ='),source.indexOf('\nconst scannerPrintingPicker ='));
const magicPrice=vm.runInNewContext(magicPriceSource+'; mtgScanPrice',{conditionValue});
const quoted={card:{id:'exact-magic',prices:{usd:'12'},conditionQuotes:[{printingId:'exact-magic',finish:'nonfoil',language:'ja',condition:'Lightly Played',currency:'USD',price:7}]}};
assert.equal(magicPrice(quoted,'nonfoil',{condition:'Lightly Played',language:'ja'}),7,'same exact condition identity as Search reuses the cached quote');
assert.equal(magicPrice(quoted,'nonfoil',{condition:'Lightly Played',language:'en'}),null,'a different language cannot borrow the quote or Near Mint reference');
assert.equal(magicPrice(quoted,'foil',{condition:'Lightly Played',language:'ja'}),null,'finish-specific quote cannot cross variants');
assert.equal(magicPrice(quoted,'nonfoil',{condition:'Near Mint',language:'ja'}),12,'ordinary reference remains available and condition-labelled');
console.log('PASS: actual Magic scanner preview uses the shared exact-condition quote resolver, never a played-condition discount or another language/finish.');
