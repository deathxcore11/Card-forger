import test from 'node:test';import assert from 'node:assert/strict';
import {attackScore,makeSearchBudget} from './cpu-tactical-planning.mjs';
import {estimateBlocks} from './cpu-combat-evaluation.mjs';import {CPU_PROFILES,CPU_LABELS_READY} from './cpu-difficulty-config.mjs';
const creature=(controller,power,toughness,keywords=[])=>({known:true,creature:true,controller,power,toughness,keywords,damage:0,tapped:false});
const score=(combat,level='Hard')=>attackScore(combat,[{object:0,target:{kind:'player',seat:1}}],CPU_PROFILES[level],makeSearchBudget(CPU_PROFILES[level],()=>0));
const position=()=>({seat:0,life:[2,4],objects:[creature(0,4,5),creature(1,2,2)]});
test('all tiers accept the profitable forced block instead of fearing the dead blocker',()=>{for(const level of ['Easy','Medium','Hard'])assert.equal(score(position(),level),4);});
test('tapped surviving opponent still threatens its next turn; refusal can be correct',()=>{const c=position();c.objects.push({...creature(1,4,4),tapped:true});assert(score(c)<0);});
test('dead vigilance attacker is not counted as a future defender',()=>{
 const c={seat:0,life:[2,1],objects:[creature(0,4,4,['Vigilance']),creature(1,1,1,['Deathtouch']),{...creature(1,2,2),tapped:true}]};assert(Math.abs(score(c)-(-29.6))<1e-9);
});
test('defender-only survivor does not invent counterattack damage',()=>{const c=position();c.objects.push({...creature(1,100,100,['Defender']),tapped:true});assert.equal(score(c),4);});
test('immediate victory has no next-turn counterattack penalty',()=>{const c=position();c.objects=[creature(0,4,5),{...creature(1,10000,10000),tapped:true}];assert(score(c)>1000);});
test('predicted casualties retain public indices and uncertain outcomes stay uncertain',()=>{
 const c=position();Object.assign(c,{complete:false,uncertain:true,attackers:[{object:0,target:{kind:'player',seat:1}}],legalBlocks:[[1,0]]});
 const e=estimateBlocks(c,[[1,0]]);assert.deepEqual(e.predictedCasualties,[1]);assert.equal(e.outcome,'unknown');assert.equal(e.confidence,'estimate');
 c.objects[1].keywords=['Indestructible'];assert.deepEqual(estimateBlocks(c,[[1,0]]).predictedCasualties,[]);
});
test('limited-beta profiles are ready for integration enablement',()=>assert.equal(CPU_LABELS_READY,true));
