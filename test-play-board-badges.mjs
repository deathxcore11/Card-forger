import test from 'node:test';
import assert from 'node:assert/strict';
import {currentKeywords,tileBadges,badgeSummary,tileLayerHtml,counterList,playerCounterBadges,playerCountersHtml,crewValue} from './play-board-badges.js';
import {BOARD_ICONS,boardIcon} from './play-board-icons.js';
import {battlefieldGroups} from './experiments/phase-engine/match-table.mjs';

const card=o=>({known:true,zone:'Battlefield',types:['Creature'],type:'Creature — Angel',text:'',counters:{},...o});
const keys=o=>currentKeywords(o).map(k=>k.key||'-:'+k.text);

test('keyword icons come only from lines that are nothing but keywords, or from a native list',()=>{
 assert.deepEqual(keys({text:'Flying, vigilance\nWhenever this attacks, draw a card.'}),['flying','vigilance']);
 assert.deepEqual(keys({text:'Creatures you control have flying.'}),[],'a keyword inside a sentence never makes an icon');
 assert.deepEqual(keys({text:'Flash\nFlying (This creature can’t be blocked except by creatures with flying or reach.)\nWard {2}'}),['-:Flash','flying','ward'],'reminder text is ignored and costs stay');
 assert.deepEqual(currentKeywords({text:'Ward {2}\nProtection from red'}).map(k=>k.text),['Ward {2}','Protection from red'],'the cost or quality stays as live text');
 assert.deepEqual(keys({text:'Deathtouch\nWhen this enters, destroy target creature.'}),['deathtouch']);
 assert.deepEqual(keys({text:'',keywords:['Flying','FirstStrike','Ward:2']}),['flying','first-strike','ward'],'a native list wins');
 assert.deepEqual(currentKeywords({keywords:['Ward:2']}).map(k=>k.text),['Ward 2']);
 assert.equal(crewValue({text:'Flying\nCrew 3 (Tap any number of creatures you control with total power 3 or more: This becomes an artifact creature.)'}),3);
 assert.deepEqual(keys({text:'Equip {2}'}),['-:Equip {2}'],'keywords without an icon are still listed for the preview');
 // Bridges with the 4.2.7 adapter patch: Forge's own objects, printed or granted.
 const native=currentKeywords({text:'Flying',keywords:[{keyword:'WARD',text:'Ward\u2014Pay 2 life.'},{keyword:'FIRST_STRIKE',text:'First strike'},{keyword:'CREW',text:'Crew 3'},{keyword:'PROTECTION',text:'Protection from red'},{keyword:'PROTECTION',text:'Protection from blue'}]});
 assert.deepEqual(native.map(k=>[k.key,k.text]),[['ward','Ward\u2014Pay 2 life'],['first-strike','First strike'],[null,'Crew 3'],['protection','Protection from red'],['protection','Protection from blue']],'native objects win over the printed text');
 assert.deepEqual(currentKeywords({text:'Flying',keywords:[]}),[],'an empty native list means the card has none now (it lost flying)');
 assert.equal(tileBadges(card({keywords:[{keyword:'PROTECTION',text:'Protection from red'},{keyword:'PROTECTION',text:'Protection from blue'}]})).keywords.shown.length,1,'one icon per keyword even with two qualities');
 assert.equal(crewValue({crew:2,text:'Crew 3'}),2,'Forge\u2019s crew number wins');
});

test('the keyword rail shows up to three, or two and a live "+N", ordered by what changes combat',()=>{
 const three=tileBadges(card({text:'Vigilance, deathtouch, haste'}));
 assert.deepEqual(three.keywords.shown.map(k=>k.key),['deathtouch','vigilance','haste']);assert.equal(three.keywords.more,0);
 const five=tileBadges(card({text:'Trample, haste, deathtouch, lifelink, menace'}));
 assert.deepEqual(five.keywords.shown.map(k=>k.key),['menace','trample']);assert.equal(five.keywords.more,3);
 assert.equal(five.keywords.all.length,5,'every keyword stays in the full list');
 assert.match(tileLayerHtml(five),/cs-more"><b>\+3</);
});

test('state, combat, counters and damage follow the snapshot without recomputing the rules',()=>{
 const b=tileBadges(card({tapped:true,summoningSick:true,attacking:true,damage:2,power:3,toughness:4,counters:{P1P1:2,STUN:1,OIL:3},commander:true}),{actionable:true});
 assert.deepEqual(b.stateAll.map(s=>s.icon),['tapped','summoning-sick','commander']);assert.equal(b.state.length,2,'the corner keeps two slots');
 assert.equal(b.combat.icon,'attacking');assert.equal(b.activation,true,'the usable-now mark is Forge’s own offer');
 assert.equal(b.damage,2,'damage is reported on its own; power and toughness are never changed here');
 assert.deepEqual(b.counters.all.map(c=>c.name),['P1P1','STUN','OIL']);assert.equal(b.counters.shown.length,0,'with damage marked, the rail keeps one slot for it');assert.equal(b.counters.more,3);
 assert.equal(tileBadges(card({attacking:false,tapped:false,summoningSick:true,types:['Artifact'],type:'Artifact'})).state.length,0,'only creatures show summoning sickness');
 const vigilant=tileBadges(card({attacking:true,tapped:false}));assert.equal(vigilant.combat.icon,'attacking');assert.ok(!vigilant.stateAll.some(s=>s.icon==='tapped'),'an attacker can stay untapped');
 assert.equal(tileBadges(card({known:false})),null,'face-down and hidden cards get nothing');
 assert.equal(tileBadges(card({zone:'Hand'})),null,'only permanents on the battlefield');
});

test('planeswalkers and battles read their current counters; missing values are left out',()=>{
 const pw=tileBadges(card({types:['Planeswalker'],type:'Legendary Planeswalker — Chandra',counters:{LOYALTY:4}}));
 assert.deepEqual([pw.plaque.kind,pw.plaque.value],['loyalty',4]);assert.equal(pw.counters.all.find(c=>c.name==='LOYALTY').count,4);assert.equal(pw.counters.shown.length,0,'the plaque is not repeated in the rail');
 assert.equal(tileBadges(card({types:['Planeswalker'],type:'Planeswalker',counters:{}})).plaque,null,'no loyalty reported means no invented zero');
 assert.deepEqual(tileBadges(card({types:['Battle'],type:'Battle — Siege',counters:{DEFENSE:5}})).plaque.value,5);
 assert.equal(tileBadges(card({types:['Enchantment'],type:'Enchantment — Saga',counters:{LORE:2}})).counters.shown[0].icon,'saga');
});

test('attachments use native ids, and the summary names everything the icons stand for',()=>{
 const sword={id:9,known:true,name:'Bonesplitter',type:'Artifact — Equipment'},aura={id:10,known:true,name:'Pacifism',type:'Enchantment — Aura'},hidden={id:11,known:false};
 const b=tileBadges(card({name:'Goblin',attachments:[9,10,11,99],text:'Haste',damage:1}),{cardsById:new Map([[9,sword],[10,aura],[11,hidden]])});
 assert.deepEqual(b.attachments.map(a=>a.kind),['equipment','aura'],'unknown or hidden attachments are not named');
 assert.match(badgeSummary(b),/^Haste · 1 damage marked · With Bonesplitter, Pacifism$/);
 assert.equal(tileBadges(card({attachedTo:4}),{cardsById:new Map([[4,{id:4,known:true,name:'Grizzly Bears'}]])}).stateAll[0].label,'Attached to Grizzly Bears');
});

test('counter and player badges, icons and escaping',()=>{
 assert.deepEqual(counterList({M1M1:1,P1P1:2,ZERO:0,BAD:-1,'<x>':1}).map(c=>c.name),['P1P1','M1M1','<x>']);
 assert.deepEqual(playerCounterBadges({POISON:3,ENERGY:0,EXPERIENCE:2,OTHER:5}).map(c=>c.name),['POISON','EXPERIENCE']);
 assert.doesNotMatch(playerCountersHtml(playerCounterBadges({POISON:3})),/<script/);
 assert.doesNotMatch(tileLayerHtml(tileBadges(card({counters:{'<img src=x onerror=1>':2}}))),/<img/,'counter names are escaped');
 for(const name of ['flying','tapped','summoning-sick','attacking','blocking','loyalty','marked-damage','zone-library','activated-ability'])assert.match(boardIcon(name),/^<svg class="cs-icon" viewBox="0 0 24 24" aria-hidden="true"/);
 assert.ok(Object.values(BOARD_ICONS).every(svg=>!/#[0-9a-f]{6}/i.test(svg)),'icons draw in currentColor so the theme decides their colour');
 assert.equal(boardIcon('nope'),'');
});

test('mana rocks are drawn with the lands but stay artifacts',()=>{
 const groups=battlefieldGroups([{id:1,known:true,types:['Artifact'],text:'{T}: Add {C}{C}.'},{id:2,known:true,types:['Land']},{id:3,known:true,types:['Artifact'],text:'Equipped creature gets +2/+0.'},{id:4,known:true,types:['Artifact','Creature'],text:'{T}: Add {G}.'}]);
 assert.deepEqual(groups.map(g=>[g.key,g.cards.map(c=>c.id)]),[['creatures',[4]],['lands',[1,2]],['other',[3]]]);
});
