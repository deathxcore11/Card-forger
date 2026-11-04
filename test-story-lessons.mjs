import assert from 'node:assert/strict';
import {createLessonCoach,isLessonBattle,LESSON_BATTLES,SAY} from './story-lessons.js';
// Minimal DOM stand-in: the coach only needs createElement/append/querySelector.
const mk=()=>{const n={cls:new Set(),children:[],classList:{add:c=>n.cls.add(c),remove:c=>n.cls.delete(c)},set className(v){v.split(' ').forEach(c=>n.cls.add(c))},setAttribute(){},append(c){n.children.push(c)},remove(){},querySelector:()=>({textContent:'',addEventListener(){}}),querySelectorAll:()=>[],addEventListener(){}};return n;};
const doc={createElement:mk},root={...mk(),querySelector:()=>null};
globalThis.requestAnimationFrame=f=>f();globalThis.CSS={escape:String};
const store={seen:new Set(),save(){}};
const card=(id,o)=>({id,controller:0,zone:'Hand',types:[],keywords:[],manaCost:'',tapped:false,summoningSick:false,...o});
const surf=(o)=>({phase:'playing',game:{status:{surface:{seat:0,turn:1,activeSeat:0,phase:'PreCombatMain',stack:[],prioritySeat:0,hand:[],cards:[],...o}}}});
assert.ok(isLessonBattle('a1b1')&&!isLessonBattle('a1b5'));
let t=0;const now=()=>(t+=30000);
// Lesson 1 turn 1: a land in hand and none on the field -> land whisper.
let c=createLessonCoach({root,battle:{id:'a1b1'},doc,store,now});
const land=card(1,{types:['Land']});
c.update(surf({hand:[1],cards:[land]}));
assert.ok(store.seen.has('land'),'land whisper shown once');
// Not repeated.
const before=store.seen.size;c.update(surf({hand:[1],cards:[land]}));assert.equal(store.seen.size,before);
// Non-lesson battle: no lesson concepts at all.
const s2={seen:new Set(),save(){}};c.destroy();
c=createLessonCoach({root,battle:{id:null},doc,store:s2,now});c.update(surf({hand:[1],cards:[land]}));assert.equal(s2.seen.size,0);
// New mechanic word in a later act: first sight of Flanking.
c.update(surf({cards:[card(9,{zone:'Battlefield',controller:1,keywords:['Flanking'],types:['Creature']})]}));
assert.ok(s2.seen.has('w:Flanking'));
// Every lesson concept has a line.
for(const k of Object.values(LESSON_BATTLES).flat())assert.ok(SAY[k],k);
console.log('story lessons ok');
// Stack lists name only cards that exist in the right deck, within the engine's limits (15 names).
import {readFileSync} from 'node:fs';
import {LESSON_STACKS,lessonSetup} from './story-lessons.js';
const act=JSON.parse(readFileSync('data/story/act-1.json','utf8'));
for(const b of act.battles.slice(0,4)){
  const st=LESSON_STACKS[b.id],names=d=>new Set(d.cards.map(r=>r.name));
  const hero=names(b.hero.deck),vil=names(b.lessonDeck.deck);
  for(const [side,set] of [['hero',hero],['villain',vil]]){assert.ok(st[side].length<=15);for(const n of st[side])assert.ok(set.has(n),`${b.id} ${side}: ${n}`);}
  assert.equal(st.hero.slice(0,7).filter(n=>/^(Plains|Island)$/.test(n)).length>=3||b.id==='a1b4',true);
}
assert.equal(lessonSetup('a1b5',true),null);assert.equal(lessonSetup('a1b1'),null,'off until the host deploy');
// The request: first player, quick style, stack + no mulligan; ordinary Story stays random with no setup.
const {exactForgeInput}=await import('./play-forge-host-client.js');
const deck={name:'d',cards:[{name:'Plains',qty:60}]};
const base={playStyle:'quick',match:{mode:'cpu',format:'Vintage',difficulty:'Medium',startingPlayer:'random',podSize:2},selected:deck,opponent:deck};
const plain=exactForgeInput(base);assert.equal(plain.startingPlayer,'random');assert.equal(plain.setup,undefined);
const les=exactForgeInput({...base,lesson:lessonSetup('a1b1',true)},{startingPlayer:'random'});
assert.equal(les.startingPlayer,'first');assert.equal(les.setup.noMulligan,true);assert.deepEqual(les.setup.stack.hero.slice(0,2),['Plains','Savannah Lions']);
console.log('lesson stacks ok');
