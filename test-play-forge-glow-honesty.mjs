import assert from 'node:assert/strict';
import {bendsOwnCost,provenUnaffordable} from './experiments/forge-proof/forge-table.mjs';
// A card that only changes what OTHER spells cost doesn't bend its own cost.
assert.equal(bendsOwnCost('Spells you cast cost {1} less to cast.'),false);
assert.equal(bendsOwnCost('Noncreature spells cost {1} more to cast.'),false);
assert.equal(bendsOwnCost('This spell costs {2} less to cast if you control a Knight.'),true);
assert.equal(bendsOwnCost('Convoke'),true);
assert.equal(bendsOwnCost('Flying'),false);
// Such a card with no mana to pay for it stays dark (proven unaffordable), where the old check kept it lit.
const hand={id:1,known:true,zone:'Hand',controller:0,types:['Creature'],manaCost:'{2}{W}',text:'Flying\nSpells you cast cost {1} less to cast.',name:'Pilot'};
const surface={seat:0,cards:[hand]};
assert.equal(provenUnaffordable(hand,surface,{}),true);
const land={id:2,known:true,zone:'Battlefield',controller:0,types:['Land'],type:'Basic Land - Plains',text:'',name:'Plains',tapped:false};
assert.equal(provenUnaffordable(hand,{seat:0,cards:[hand,land,{...land,id:3},{...land,id:4}]},{}),false);
console.log('glow honesty ok');
