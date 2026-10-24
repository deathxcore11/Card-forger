// Independent original full pair scan verifies unchanged evidence and ordering.
import assert from 'node:assert/strict';
import {mtgSelfConflicts,mtgEffectProfile} from './mtg-effects.js';
const facesOf=c=>c?.card_faces?.length?c.card_faces:[c||{}];
const withoutReminder=s=>String(s||'').replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g,'').trim();
function legacySelfConflicts(cards=[]) {
  const rows=[...new Map(cards.filter(Boolean).map(c=>[c.name,c])).values()],out=[];
  const text=c=>facesOf(c).map(f=>withoutReminder(f.oracle_text)).join('\n').toLowerCase().replace(/[’‘]/g,"'");
  for(const blocker of rows){
    const t=text(blocker),enter=/creatures entering(?: the battlefield)?(?: or dying)? don't cause abilities[^.]*trigger/.test(t),
      life=/\b(?:players|you) can't gain life\b/.test(t),pay=/players can't pay life/.test(t);
    for(const provider of rows){
      const p=text(provider),effects=mtgEffectProfile(provider).provides;
      if(enter&&/(?:when|whenever) [^\n,.]*\benters?\b/.test(p)&&(/\bcreature\b/i.test(provider.type_line||'')||/\bcreature[^\n,.]*\benters?\b/.test(p)))
        out.push({blocker:blocker.name,provider:provider.name,kind:'creature-enter-trigger',status:'conditional',reason:`${blocker.name} suppresses creature-entering triggers while present; ${provider.name}'s affected route needs sequencing or removal of the blocker.`});
      if(life&&effects.some(e=>e.tag==='lifegain'))out.push({blocker:blocker.name,provider:provider.name,kind:'life-gain',status:'conditional',reason:`${blocker.name} prevents your life gain while present.`});
      if(pay&&/(?:pay \d+ life[^:]*:|^[^:\n]*\bpay \d+ life\b[^:\n]*:)/m.test(p))out.push({blocker:blocker.name,provider:provider.name,kind:'life-payment',status:'conditional',reason:`${blocker.name} prevents paying life to activate ${provider.name}'s affected ability while present.`});
    }
  }
  return out;
}

const card=(name,oracle_text,type_line='Creature')=>({name,oracle_text,type_line});
const orb=card('Trigger blocker',"Creatures entering the battlefield don't cause abilities to trigger.",'Artifact');
const life=card('Life blocker',"Players can't gain life.",'Enchantment');
const pay=card('Payment blocker',"Players can't pay life.",'Creature');
const entering=card('Entering creature','When this creature enters the battlefield, draw a card.');
const gain=card('Life provider','When this creature enters the battlefield, you gain 3 life.');
const activation=card('Payment provider','Pay 2 life: Draw a card.');
const plain=card('Ordinary creature','Flying');
for(const cards of [[],[plain],[orb,entering,gain],[life,gain],[pay,activation],[orb,life,pay,entering,gain,activation,plain,plain],[plain,pay,activation,life,gain,orb,entering]])assert.deepEqual(mtgSelfConflicts(cards),legacySelfConflicts(cards),'Exact original conflict rows, reasons and insertion order retained');
const all=mtgSelfConflicts([orb,life,pay,entering,gain,activation]);for(const kind of ['creature-enter-trigger','life-gain','life-payment'])assert(all.some(r=>r.kind===kind));
let reads=0;const ordinary=Array.from({length:100},(_,i)=>({name:'Ordinary '+i,type_line:'Creature',get oracle_text(){reads++;return 'Flying';}}));
assert.deepEqual(mtgSelfConflicts(ordinary),[]);assert.equal(reads,100,'Unrestricted cards require one text read each, not a useless100×100 provider scan');
console.log('PASS: self-conflict short circuit preserves all three blocker types and exact original ordering; no-blocker work is linear.');
