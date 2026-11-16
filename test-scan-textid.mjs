// The owner's real photos of 2026-11-14 (a foil Virtual World Kirin - Lili under a flash, the same
// card in purple light, a small gold-rare Twin Twisters) all came back "couldn't make that out".
// The reader had read the name almost right each time; the name lookup threw it away. These are
// the exact strings the reader produced from those photos (test-fixtures/scan-real), run against
// the real Yu-Gi-Oh! catalogue. Fails on the code that shipped in app 0.4.82 / web 4.3.200.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {textNameMatch,textNameMatches,fitInside,textPick} from './scan-textid.js';
const load=g=>{const raw=JSON.parse(gunzipSync(readFileSync(new URL(`./scanidx/${g}-catalog-v1.json.gz`,import.meta.url))));raw.signals=JSON.parse(gunzipSync(readFileSync(new URL(`./scanidx/${g}-signals-v1.json.gz`,import.meta.url))));return compileCatalog(raw);};
const ygo=load('ygo'),mtg=load('mtg');
const names=(pack,read)=>[...new Set(lookupCatalog(pack,read).cands.map(c=>c.name))];
const KIRIN='Virtual World Kirin - Lili';

// 1. The glare photo: the title strip as it was read, wrong letters and stray marks included.
for(const name of ['a ee ee en\nIRTUAL WORLD KIRIN - LiL','| VIRTUAL WORLD KIRIN - LiL €','VIRTUAL WORLD KIRIN ~ LILI @|','/IRTUAL WORLD KIRN - Lig €\n(RTUAL WORLD KIRIN - LILI L']){
 const got=lookupCatalog(ygo,{name,code:'',full:'',stats:'',titles:[{text:name,source:'title',confidence:54}]});
 assert.deepEqual([...new Set(got.cands.map(c=>c.name))],[KIRIN],JSON.stringify(name));
 assert(got.cands.every(c=>!c.exact),'a roughly read name proposes the card for review; it never verifies a printing');
}
// 2. The purple-light photo: no title at all, only rules text, with the stats.
const purple='[WYRM/ EFFECT) If thes card = in your hand You can tareet 1+ “Virtual World” card you control. send | Virtual Word” ard of a diferent type (Monster. Spell, Trap) irom your Deck | 10 the GY and you 80 Special Summon thus card. then, you can send 1 Vira | Word” card of the third type from your Dec 10 the GY. except “Virtual World inn - | For the rest of thes wn you an onty Special Summon Level Rank J or hegher moncters You can onty use the efiect of Virtual World Grn - Ul” once per tum ATK /1800 DEF/ 600';
assert.deepEqual(names(ygo,{name:'-\nf AN\nf ~\n{ Cs\n',full:purple}),[KIRIN]);
assert.equal(textNameMatch(ygo,{full:purple}).backed,'ATK and DEF','a rough rules-text reading needs the card’s own numbers behind it');
// The same rough text without the stats names nothing: the numbers are what carried it.
assert.equal(textNameMatch(ygo,{full:purple.replace(/ATK.*$/,'')}),null);
// 3. Rules text that says the name cleanly, twice.
const clean='If this card is in your hand: You can target 1 "Virtual World" card you control; send 1 "Virtual World" card of a different type from your Deck to the GY, except "Virtual World Kirin - Lili". You can only use this effect of "Virtual World Kirin - Lili" once per turn.';
assert.deepEqual(names(ygo,{name:'',full:clean}),[KIRIN]);
// 4. What was read off the small Twin Twisters photo names nothing by itself (no name was readable)...
const twin={name:'Ce ETE.\n| pe rh itl Si a =~ MUTE, LL HE —\nBEE S20 FN OE TS i Te eA\nLZ TTT Tere meet\nI [vars meg erears Sr —',code:'to 2 Speliv Traps on the eld 1:4',full:'destroy them\n\nDucard 0 card hen target up 10 2 Speliv Traps on the Tela\n\nJad 1 Card, Un Lar\n\nCup 10 4 Spells Traps on the licks\n\nsestroy them'};
assert.deepEqual(names(ygo,twin),[],'noise must not be turned into a card');
assert.deepEqual(names(mtg,twin),[],'noise must not be turned into a card of another game either');
// ...but it does pick Twin Twisters out of the cards the picture found most alike.
const shortlist=[{key:'52035300',text:'Mystical Space Typhoon Target 1 Spell/Trap on the field; destroy that target.'},{key:'43898403',text:'Twin Twisters Discard 1 card, then target up to 2 Spells/Traps on the field; destroy them.'},{key:'5318639',text:'Harpie\'s Feather Duster Destroy all Spells and Traps your opponent controls.'},{key:'49966326',text:KIRIN+' '+clean}];
assert.equal(textPick(shortlist,twin)?.key,'43898403');
assert.equal(textPick(shortlist,{full:'Ww 44 ar JE i Ti um ig'}),null,'too little text picks nothing');
// 5. Guards. Ordinary rules words never name a card; a short name needs an exact title.
assert.equal(textNameMatch(ygo,{full:'Target 1 monster your opponent controls; destroy that target. You can only activate 1 card per turn.'}),null);
assert.equal(textNameMatch(ygo,{name:'Dro1l & Lock Bird'})?.key,'drolllockbird');
assert.equal(textNameMatch(mtg,{name:'Bojt'}),null);
assert.equal(fitInside('kirin','xxkirnxx',1).d,1);assert.equal(fitInside('kirin','xxxxxx',1),null);
assert(textNameMatches(ygo,{name:'VIRTUAL WORLD KIRIN - LiL'}).length>=1);
console.log('PASS: the names read off the owner’s real foil photos find their card; noise finds none.');
