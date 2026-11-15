// Regression (owner, app 0.4.83, 15 Nov 2026): Your Scans held Jizukiru MP16-EN235 and Virtual World Mai-Hime - Lulu
// MP21-EN173, both ready. Add failed with "This scanned printing is not verified for the selected release".
// Cause: the scanner checked the release against its own set list, but the save runs where no Yu-Gi-Oh! set list
// had been loaded yet (the app's Collection engine), so every checked release looked unknown.
// The answers below are the real YGOPRODeck responses for those two cards (set list cut to their sets).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {S,blank} from './store.js';
import {registerTcg,ui,currentYgoCatalogue} from './tcg.js';

const answers=JSON.parse(readFileSync('test-fixtures/scan-save/ygo-two-cards.json','utf8'));
const store=new Map();let setListDown=false;
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
globalThis.document={querySelector:()=>null,getElementById:()=>null,addEventListener(){}};
globalThis.fetch=async u=>{
  const url=String(u?.url||u),hit=answers[url];
  if(!hit||(setListDown&&/cardsets\.php/.test(url)))throw Error('offline: '+url);
  return new Response(hit.body,{status:hit.status,headers:{'content-type':'application/json'}});
};
S.state=blank();S.state.settings.game='ygo';S.ui.scan={};S.ui.view='scan';
const context={A:{},C:{},I:{},commit:async fn=>fn(S.state),render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(context);

// The scanner's side: set list loaded, both cards checked and ready, as on the owner's screen.
await context.loadSets('ygo');
const scans=[];
for(const [id,print,releaseName] of [['63941210','MP16-EN235|Rare','2016 Mega-Tin Mega Pack'],['49088914','MP21-EN173|Prismatic Secret Rare','2021 Tin of Ancient Battles']]){
  const cand=await context.scanCandById('ygo',id,'fixture',true,{print,releaseName});
  assert.equal(cand.setReleaseUnverified,false);assert(cand.setReleaseId);
  // Items cross to the saving side as JSON.
  scans.push(JSON.parse(JSON.stringify({captureId:'cap-'+id,qty:1,finish:'1st-edition',variantKey:'1st-edition',condition:'Near Mint',lang:'en',print:cand.print,cand,releaseName:cand.releaseName,setReleaseId:cand.setReleaseId,setReleaseUnverified:false,printingAmbiguous:false})));
}
const forgetSetList=()=>{ui('ygo').sets.list=[];store.clear();assert.equal(currentYgoCatalogue().length,0);};

// The saving side has never loaded a Yu-Gi-Oh! set list: it loads one, then saves both cards with their release.
forgetSetList();
await context.scanAddMany(scans,'ygo');
const saved=S.state.tcg.ygo.collection;
assert.equal(saved.length,2);
assert.deepEqual(saved.map(e=>[e.name,e.printing,e.rarity,e.edition,e.setReleaseUnverified]),[
  ['Jizukiru, the Star Destroying Kaiju','MP16-EN235','Rare','1st-edition',false],
  ['Virtual World Mai-Hime - Lulu','MP21-EN173','Prismatic Secret Rare','1st-edition',false]]);
assert(saved.every((e,i)=>e.setReleaseId===scans[i].setReleaseId));

// No set list and no connection: nothing is saved, and the reason is the set list, not the card.
forgetSetList();setListDown=true;
await assert.rejects(context.scanAddMany(scans.map(x=>({...x,captureId:x.captureId+'-b'})),'ygo'),e=>{assert.equal(e.code,'SCAN_SETS_UNAVAILABLE');assert.doesNotMatch(e.message,/not verified/);return true;});
assert.equal(S.state.tcg.ygo.collection.length,2);
console.log('scan save without a loaded set list: ok');
