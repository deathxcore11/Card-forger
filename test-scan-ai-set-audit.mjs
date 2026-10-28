import assert from 'node:assert/strict';
import {registerScanner} from './scancam.js';
import {scannerLookupHTML} from './scanner-review.js';
import {S,blank} from './store.js';

globalThis.localStorage={m:new Map(),getItem(k){return this.m.get(k)??null;},setItem(k,v){this.m.set(k,v);}};
const fields=new Map();
globalThis.document={getElementById:id=>fields.get(id)||null,addEventListener(){}};
globalThis.fetch=async()=>{throw Error('No external requests in this fixture');};
let checks=0;
for(const [game,name,number,set] of [
 ['mtg','Lightning Bolt','146','Magic 2010'],
 ['ptcg','Pikachu','58/102','Base Set'],
 ['ygo','Dark Magician','LOB-EN005','Legend of Blue Eyes White Dragon'],
]){
 S.state=blank();S.state.settings.game=game;S.ui.view='scan';fields.clear();
 const A={},I={},requests=[];let writes=0;
 registerScanner({A,I,C:{},game:()=>game,render(){},toast(){},priceOf:()=>null,
  identifyPhoto:async()=>({game,name,number,set,readable:true}),
  lookupCandidates:async(g,query)=>{requests.push({g,...query});return [1,2].map(i=>({id:String(i),name,card:{id:String(i),name}}));},
  addMany:async()=>writes++});
 S.ui.scan={confirm:{game,i:-1,qty:3,condition:'Near Mint',lang:'en',finish:''},cands:[],shot:'data:image/jpeg;base64,'+'A'.repeat(128)};
 await A.scanIdentifyAI();
 assert.equal(requests[0].set,set,`${game}: the AI set clue reaches catalogue lookup`);checks++;
 assert.equal(requests[0].strictName,true);checks++;
 assert.equal(S.ui.scan.confirm.setDraft,set,`${game}: the set is visible and editable`);checks++;
 assert.match(scannerLookupHTML(S.ui.scan.confirm),/id="scanMatchSet"/);checks++;
 assert.equal(S.ui.scan.confirm.qty,3);assert.equal(S.ui.scan.confirm.finish,'');assert.equal(writes,0);checks+=3;
 assert(S.ui.scan.cands.every(c=>c.exact===false&&c.printingConfirmed===false));checks++;
 I.scanSetDraft({value:'Corrected set'});
 await A.scanFind();
 assert.equal(requests.at(-1).set,'Corrected set');checks++;
 // Existing DOM fields may be deliberately cleared before the input handler fires.
 // Empty values must override old drafts rather than resurrecting stale OCR.
 fields.set('scanMatchName',{value:name});fields.set('scanMatchNumber',{value:''});fields.set('scanMatchSet',{value:''});
 await A.scanFind();
 assert.equal(requests.at(-1).number,'');assert.equal(requests.at(-1).set,'');checks+=2;
 assert.equal(writes,0);checks++;
}
console.log(`PASS ${checks} AI/manual set handoff checks across MTG, Pokémon and Yu-Gi-Oh; no collection writes.`);
