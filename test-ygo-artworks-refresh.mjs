// Yu-Gi-Oh! card page: a detail refresh must not shrink the artworks already known for the card.
// YGOPRODeck lists every artwork in searches but only the looked-up passcode's artwork when a card
// is fetched by passcode, which used to collapse Blue-Eyes (8 artworks) and Dark Magician (9) to 1.
import assert from 'node:assert/strict';
import {normalizeYgo} from './ygo.js';
import {ensureCard,SOURCES,cache} from './tcg.js';

const raw={id:46986414,name:'Dark Magician',type:'Normal Monster',frameType:'normal',desc:"''The ultimate wizard.''",race:'Spellcaster',attribute:'DARK',level:7,atk:2500,def:2100,card_sets:[],card_images:[46986414,36996508,38033121].map(id=>({id}))};
const byPasscode=id=>normalizeYgo({...raw,card_images:[{id:Number(id)}]});
// From a search: every artwork, but no exact printing prices yet, so opening the card refreshes it.
cache.ygo[String(raw.id)]=normalizeYgo(raw);
const original=SOURCES.ygo.get;
try{
  SOURCES.ygo.get=async id=>byPasscode(id);
  const card=await ensureCard('ygo',String(raw.id));
  assert.equal(card.artworks.length,1+2,'refresh keeps both alternate artworks');
  assert.deepEqual(card.artworks.map(a=>a.id),['46986414','36996508','38033121']);
  assert.deepEqual(card.artworks.map(a=>a.label),['Default artwork','Alternate artwork','Alternate artwork']);
  assert.equal(cache.ygo[String(raw.id)].artworks.length,3,'the cached card keeps them too');
  // A later search that lists a newly added artwork still adds it.
  cache.ygo[String(raw.id)].fetchedAt=undefined;
  SOURCES.ygo.get=async()=>normalizeYgo({...raw,card_images:[...raw.card_images,{id:46986415}]});
  const again=await ensureCard('ygo',String(raw.id));
  assert.deepEqual(again.artworks.map(a=>a.id),['46986414','36996508','38033121','46986415']);
}finally{SOURCES.ygo.get=original;}
console.log('PASS: a Yu-Gi-Oh! detail refresh by passcode keeps every known artwork and still adds new ones.');
process.exit(0);
