import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {fullCardNameHints,textVerifiedMatch,scanView} from './scancam.js';
import {rankScanCandidates,signalEvidence} from './scan-signals.js';
import {S,blank} from './store.js';
const correct={id:'swsh8-101',name:'Vikavolt',hp:150,set:{id:'swsh8',number:'101',total:264},attacks:[{name:'Bite'},{name:'Electro Blaster'}]},wrong={id:'pitch-black-026',name:'Vikavolt',hp:160,set:{id:'pitch-black',number:'026',total:84},attacks:[{name:'Quick Dive'},{name:'Giga Railgun'}]};
const read={name:'STAGE 2 Vikavolt HP150',code:'101/264',stats:'Bite\nElectro Blaster'};
assert.deepEqual(signalEvidence('ptcg',wrong,read).conflicts,['HP','collector number']);
assert.deepEqual(rankScanCandidates('ptcg',[{id:wrong.id,name:wrong.name,card:wrong,exact:true},{id:correct.id,name:correct.name,card:correct,exact:true}],read).map(c=>c.id),['swsh8-101']);
assert.equal(textVerifiedMatch('ptcg',{name:wrong.name,card:wrong,exact:true},read),false);
// Actual text observed from the provided raw photo using installed native
// Tesseract block/sparse segmentation. The private image is NOT included.
const rawRead={name:'mat texture was outside the card title',code:'E) 101/264 * = Wok pathos\n©2021 Pokémon / Nintendo / Creatures / GAME FREAK',full:'w150 4%\nSEES Vikavolt\noe\nEvolves from Charjabug\nBite\nElectro Blaster\nweakness resistance retreat'};
const hints=fullCardNameHints('ptcg',rawRead.full);assert(hints.includes('SEES Vikavolt'));rawRead.name=[...hints,rawRead.name].join('\n');
const pack=compileCatalog(JSON.parse(gunzipSync(readFileSync('scanidx/ptcg-catalog-v1.json.gz'))));
const found=lookupCatalog(pack,rawRead);assert.equal(found.cands[0]?.id,'swsh8-101','layout-anchored full read plus independent collector code recovers Fusion Strike printing');assert.equal(textVerifiedMatch('ptcg',found.cands[0],rawRead),false,'mixed background and fuzzy title recover a review candidate, not an exact printing');assert(found.cands.every(c=>c.card.set.total!==84));
// Conservative contract correction: exact title provenance, not a search-word
// expansion, is required in addition to the independent printed identifier.
const exactTitle={...rawRead,titles:[{text:'Vikavolt HP150',source:'title',confidence:95},{text:'SEES Vikavolt',source:'full-hint',confidence:null},{text:'mat texture was outside the card title',source:'full-hint',confidence:null}]};
const exactCandidate=lookupCatalog(pack,exactTitle).cands[0];assert.equal(exactCandidate.id,'swsh8-101');
assert.equal(textVerifiedMatch('ptcg',exactCandidate,exactTitle),true,'exact primary title plus independent101/264 survives weak full-frame hints');
for(const other of ['Charjabug','Vikavolt V'])assert.equal(textVerifiedMatch('ptcg',exactCandidate,{...exactTitle,titles:[...exactTitle.titles,{text:other,source:'title',confidence:95}]}),false,'strong competing primary title keeps printing review-only');
const missingCode={...rawRead,code:'',full:'SEES Vikavolt\noe\nEvolves from Charjabug\nElectro Blaster'};assert(lookupCatalog(pack,missingCode).cands.every(c=>!textVerifiedMatch('ptcg',c,missingCode)),'title/attack alone cannot prove set or variation');
globalThis.localStorage={getItem:()=>null};S.state=blank();S.ui.scan={camOn:true};assert.doesNotMatch(scanView('ptcg','Pokémon'),/id="camGuide"|scan-frame-hint|<polygon/,'no detector-tracking outline is rendered');
console.log('PASS: Vikavolt HP150101/264 rejects HP160026/84; raw-photo OCR layout hint recovers swsh8-101 review-only; independent exact title+footer verifies, strong title conflict rejects; unrestricted live view never renders alignment corners or detector polygons.');
