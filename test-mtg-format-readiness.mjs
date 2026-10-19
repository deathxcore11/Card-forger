// Rules/eligibility controls, not empirical strategic calibration. These invented
// cards make complete, coherent lists so a failed rule cannot hide behind an
// unmapped strategy. Their legalities are fixtures, not claims about real cards.
import assert from 'node:assert/strict';
import {FORMATS,formatOf,formatReadinessIssues,MTG_CONSTRUCTION_EVIDENCE} from './formats.js';
import {cardKey,validateDeck,physicalRequirements} from './core.js';
import {S,blank,slim,STORAGE,CATALOG_RECORD} from './store.js';
import {validateWorkspace} from './confidence.js';
import {readRecord,writeRecords} from './storage.js';
import {mtgPower,powerReadiness,shownPower,powerEligibility,powerChip,powerPanel,mtgMetaKey} from './power.js';
import {competitiveScore} from './scouting.js';
import {metaState,MTG_META_FORMATS} from './meta.js';
import {parseDeckImport} from './deck-flow.js';

const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
let seq=0;
function fixture(id) {
  const f=formatOf(id),catalog={},cards=[];
  const add=(name,type_line,oracle_text='',extra={})=>{
    const c={name,type_line,oracle_text,mana_cost:'{1}{U}',cmc:2,colors:['U'],color_identity:['U'],legalities:{[f.legality]:'legal'},...extra};
    catalog[cardKey(name)]=c;return c;
  };
  const land=add('Island','Basic Land — Island','{T}: Add {U}.',{cmc:0,mana_cost:'',produced_mana:['U']});
  const leader=f.commander?add('Fixture Leader',f.commander==='planeswalker'?'Legendary Planeswalker — Fixture':'Legendary Creature — Bird','Flying',{mana_cost:'{3}{U}',cmc:4,power:'4',toughness:'4',loyalty:'4',pdhCommander:true}):null;
  if(leader)cards.push({name:leader.name,qty:1});
  const lands=Math.round(f.size*.4);cards.push({name:land.name,qty:lands});
  let remaining=f.size-lands-(leader?1:0),i=0;
  while(remaining>0){
    const qty=Math.min(f.copies===1?1:4,remaining),role=i%5;
    const c=add(`Fixture spell ${i++}`,role<3?'Creature — Bird':role===3?'Instant':'Sorcery',role<3?'Flying':role===3?'Counter target spell.':'Draw two cards.',role<3?{power:'3',toughness:'3'}:{});
    cards.push({name:c.name,qty});remaining-=qty;
  }
  return {deck:{id:`format-readiness-${++seq}`,name:`${f.name} fixture`,format:f.name,commander:leader?.name,cards,side:[]},catalog};
}
function assess({deck,catalog}) {
  S.state=blank();S.catalog=catalog;
  const validation=validateDeck(deck,catalog,physicalRequirements(deck));
  const readiness=powerReadiness('mtg',deck,formatOf(deck),name=>catalog[cardKey(name)]),power=mtgPower(deck);
  assert.deepEqual(power.readiness,readiness,'public Power uses the same current format checks');
  assert.equal(validation.ready,readiness.eligible,'saved-deck validator and Power agree when all copies are owned');
  for(const issue of formatReadinessIssues(deck))assert.ok(validation.issues.some(i=>i.code===issue.code)&&readiness.issues.includes(issue.text),'both paths retain the precise unresolved reason');
  return {validation,readiness,power};
}
function eligible(f) {
  const out=assess(f);
  assert.equal(out.readiness.eligible,true,out.readiness.issues.join('\n'));
  assert.ok(Number.isFinite(shownPower(out.power)),'coherent control has a supported public estimate');
  assert.equal(powerEligibility(out.power).eligible,true);
  return out;
}
function unavailable(f,pattern) {
  const out=assess(f);
  assert.equal(out.readiness.eligible,false);
  assert.match([...out.readiness.issues,...out.validation.issues.map(i=>i.text)].join('\n'),pattern);
  assert.equal(out.power.score,null);assert.equal(shownPower(out.power),null);
  assert.equal(out.power.ctx.score,null);assert.equal(out.power.ctx.fieldEstimate,null);
  assert.equal(competitiveScore(out.power),null);assert.equal(powerEligibility(out.power).eligible,false);
  assert.match(powerChip(out.power),/unavailable|incomplete/);
  assert.match(powerPanel(out.power),/unavailable/);
  return out;
}
async function reopen(f) {
  // Exercise the production durable storage boundary, workspace validator and
  // slim catalog, not just a cloned in-memory deck. No account/network writes.
  const state={...blank(),decks:[f.deck],activeDeck:f.deck.id};
  await writeRecords([[STORAGE,validateWorkspace(state)],[CATALOG_RECORD,Object.fromEntries(Object.entries(f.catalog).map(([k,c])=>[k,slim(c)]))]]);
  S.state=blank();S.catalog={};
  const restored=validateWorkspace(await readRecord(STORAGE)),catalog=await readRecord(CATALOG_RECORD);
  assert.deepEqual(restored.decks[0],JSON.parse(JSON.stringify(f.deck)),'saved format, declarations and side entries survive reopening unchanged');
  return {deck:restored.decks[0],catalog};
}

assert.equal(MTG_CONSTRUCTION_EVIDENCE.checkedAt,'2026-10-19');
assert.equal(MTG_CONSTRUCTION_EVIDENCE.comprehensiveRules.effectiveAt,'2026-09-25');
assert.ok(MTG_CONSTRUCTION_EVIDENCE.comprehensiveRules.sections.includes('100.4b'));
assert.equal(FORMATS.length,22,'no unsupported format is hidden or removed');
assert.equal(formatOf('brawl').size,100);assert.equal(formatOf('brawl').life,25);
assert.equal(formatOf('standardbrawl').size,60,'Arena Brawl evidence must not turn Standard Brawl into100');
assert.equal(formatOf('brawl').sideboard,0);assert.equal(formatOf('limited').sideboard,Infinity);

// Standard preserves15, main+side copy limits and minimum (not exact)60.
{
  const f=fixture('standard');f.deck.side=[{name:'Island',qty:15}];
  const base=eligible(await reopen(f));
  f.deck.side[0].qty=16;unavailable(await reopen(f),/limit is 15/);
  f.deck.side[0].qty=15;assert.equal(shownPower(eligible(await reopen(f)).power),shownPower(base.power),'same-ID repair restores the estimate');
  f.deck.side=[{name:'Fixture spell 0',qty:1}];unavailable(await reopen(f),/5 copies/);
  f.deck.side=[];f.deck.cards.find(r=>r.name==='Island').qty++;eligible(await reopen(f));
}

// Limited's unused pool may exceed15. This does not certify pool provenance.
{
  const f=fixture('limited');
  const base=eligible(await reopen(f));
  f.deck.side=[{name:'Fixture spell 0',qty:16}];
  const pool=eligible(await reopen(f));
  assert.equal(shownPower(pool.power),shownPower(base.power),'unused pool is not main-deck strategic output');
  assert.equal(pool.readiness.mainTotal,40);assert.equal(pool.readiness.total,56);
  assert.match(formatOf(f.deck).note,/Pool membership is not verified/);
  const original=f.deck.cards.find(r=>r.name==='Island').qty;f.deck.cards.find(r=>r.name==='Island').qty--;
  unavailable(await reopen(f),/39\/40|needs at least 40/);
  f.deck.cards.find(r=>r.name==='Island').qty=original;eligible(await reopen(f));
  f.deck.cards.find(r=>r.name==='Island').qty++;eligible(await reopen(f));
  f.deck.cards.find(r=>r.name==='Island').qty=original;
  delete f.catalog[cardKey('Fixture spell 0')];
  const missing=assess(await reopen(f));assert.equal(missing.readiness.unknown,20);assert.equal(shownPower(missing.power),null,'uncapped pool is not permission to ignore unresolved side cards');
}

// Full legal main-deck controls, side-row mutation, same-ID restore, exact size,
// and persistence across every Commander-family profile whose side handling changed.
for(const id of ['brawl','standardbrawl','commander','duel','predh','paupercommander']){
  const f=fixture(id),base=eligible(await reopen(f));
  f.deck.side=[{name:'Island',qty:1}];
  const blocked=unavailable(await reopen(f),id==='brawl'?/no ordinary sideboard/:/outside-deck rules need verification/);
  assert.ok(blocked.validation.issues.some(i=>i.code==='outside-deck-role-unverified'&&i.kind==='unverified'));
  assert.ok(!blocked.validation.issues.some(i=>i.kind==='sideboard'),'unknown role is not falsely asserted illegal');
  f.deck.side=[];assert.equal(shownPower(eligible(await reopen(f)).power),shownPower(base.power));
  f.deck.cards.find(r=>r.name==='Island').qty++;unavailable(await reopen(f),/cards over|101\/100|61\/60/);
  f.deck.cards.find(r=>r.name==='Island').qty--;eligible(await reopen(f));
  const spell=f.catalog[cardKey('Fixture spell 0')],legality=formatOf(id).legality;
  spell.legalities[legality]='banned';unavailable(await reopen(f),/banned|not legal/);
  spell.legalities[legality]='legal';assert.equal(shownPower(eligible(await reopen(f)).power),shownPower(base.power),'same-ID legality repair remains effective');
  f.deck.cards.find(r=>r.name==='Fixture spell 0').qty++;f.deck.cards.find(r=>r.name==='Island').qty--;
  unavailable(await reopen(f),/2 copies/);
  f.deck.cards.find(r=>r.name==='Fixture spell 0').qty--;f.deck.cards.find(r=>r.name==='Island').qty++;
  eligible(await reopen(f));
}

// The current parser loses a Companion heading's distinction. A Companion
// keyword cannot silently manufacture a valid declaration or imply a blanket ban.
for(const id of ['commander','brawl']){
  const f=fixture(id),name='Fixture Companion';
  f.catalog[cardKey(name)]={name,type_line:'Creature — Bird',oracle_text:'Companion — Your starting deck contains only cards with even mana values.',cmc:2,mana_cost:'{1}{U}',power:'3',toughness:'3',color_identity:['U'],legalities:{[formatOf(id).legality]:'legal'}};
  f.deck.side=parseDeckImport(`Deck\n1 Island\n\nCompanion\n1 ${name}`).side;
  assert.equal(f.deck.side[0].name,name);
  const out=unavailable(await reopen(f),/Companion.*unresolved/);
  assert.ok(!out.validation.issues.some(i=>i.kind==='legality'));
  f.deck.side=[];eligible(await reopen(f));
}

// No honest positive Oathbreaker eligibility is representable yet. A complete
// list, a plausible instant/sorcery, a guessed field or new artwork cannot clear
// the required selection/validation gap. Its ordinary checks remain active.
{
  const f=fixture('oathbreaker');
  assert.ok(f.deck.cards.some(r=>/Instant|Sorcery/.test(f.catalog[cardKey(r.name)].type_line)));
  const out=unavailable(await reopen(f),/designated.*Signature Spell/);
  assert.equal(out.readiness.incomplete,false);assert.equal(out.validation.count,60);
  f.deck.side=[{name:'Island',qty:1}];unavailable(await reopen(f),/outside-deck rules need verification/);f.deck.side=[];
  f.deck.signatureSpell='Fixture spell 3';unavailable(await reopen(f),/does not yet record or verify/);
  delete f.deck.signatureSpell;
  for(const c of Object.values(f.catalog))if(/Instant|Sorcery/.test(c.type_line))Object.assign(c,{type_line:'Creature — Bird',oracle_text:'Flying',power:'3',toughness:'3'});
  unavailable(await reopen(f),/Signature Spell/);
  f.deck.cards.find(r=>r.name==='Island').qty--;unavailable(await reopen(f),/59\/60|slots remain/);
  f.deck.cards.find(r=>r.name==='Island').qty++;
  f.catalog[cardKey(f.deck.commander)].type_line='Legendary Creature — Bird';unavailable(await reopen(f),/cannot lead|planeswalker as your Oathbreaker/);
  assert.match(formatOf(f.deck).note,/readiness and Power remain unavailable/);
}

// Duel has an explicitly declared feed. Use it, never substitute EDH; preserve
// eligibility gates even when a complete list exactly matches a reference.
{
  assert.ok(MTG_META_FORMATS.some(([name])=>name==='Duel Commander'));
  assert.equal(mtgMetaKey({format:'Duel Commander'}),'mtg:Duel Commander');
  assert.equal(mtgMetaKey({format:'Commander'}),'mtg:EDH');
  for(const format of ['PreDH','Pauper Commander','Brawl','Standard Brawl','Oathbreaker','Limited (40-card)'])assert.equal(mtgMetaKey({format}),null,format+' does not inherit another format feed');
  const f=fixture('duel'),reference=(key,name)=>({key,name,archetype:name,rank:1,main:f.deck.cards.filter(r=>r.name!==f.deck.commander),commanders:[{name:f.deck.commander,qty:1}]});
  Object.assign(metaState('mtg:EDH'),{at:300,data:{decks:[reference('wrong-format','Wrong EDH reference')],archetypes:[]}});
  Object.assign(metaState('mtg:Duel Commander'),{at:301,data:{decks:[reference('right-format','Duel reference')],archetypes:[]}});
  const out=eligible(await reopen(f));assert.equal(out.power.metaKey,'mtg:Duel Commander');assert.equal(out.power.match.deck.key,'right-format');assert.equal(out.power.from,'meta');assert.ok(Number.isFinite(competitiveScore(out.power)));
  f.deck.side=[{name:'Island',qty:1}];const blocked=unavailable(await reopen(f),/outside-deck/);assert.equal(blocked.power.match.deck.key,'right-format','reference evidence does not override eligibility');
  f.deck.side=[];eligible(await reopen(f));
  Object.assign(metaState('mtg:Duel Commander'),{at:302,data:null});
  const noDuel=eligible(await reopen(f));assert.equal(noDuel.power.metaLoaded,false);assert.equal(noDuel.power.match,null);assert.equal(competitiveScore(noDuel.power),null,'loaded EDH cannot stand in for absent Duel evidence');
  Object.assign(metaState('mtg:EDH'),{at:303,data:null});
}
console.log('PASS: source-versioned Magic readiness; Standard15/copies/minimum; Limited unused pool and unresolved data; Brawl/Commander-family outside-deck roles; Oathbreaker signature coverage gate; format-specific Duel references; actual durable save/reopen, same-ID repair and public/competitive Power gates. Synthetic eligibility controls are not strategic calibration.');

// CR903.12e belongs to the60-card Brawl profile, not all Commander variants.
{
 const f=fixture('standardbrawl');
 for(const c of Object.values(f.catalog))if(!/Land/.test(c.type_line)){c.color_identity=[];c.colors=[];c.mana_cost='{2}';c.cmc=2;}
 eligible(await reopen(f));
 const forest={...f.catalog[cardKey('Island')],name:'Forest',type_line:'Basic Land — Forest',color_identity:['G'],oracle_text:'{T}: Add {G}.',produced_mana:['G']};f.catalog[cardKey('Forest')]=forest;
 f.deck.cards.find(r=>r.name==='Island').qty--;f.deck.cards.push({name:'Forest',qty:1});unavailable(await reopen(f),/color identity/);
 f.deck.cards.pop();f.deck.cards.find(r=>r.name==='Island').qty++;eligible(await reopen(f));
 f.catalog[cardKey('Fixture spell 0')].color_identity=['U'];unavailable(await reopen(f),/color identity/);f.catalog[cardKey('Fixture spell 0')].color_identity=[];eligible(await reopen(f));
 const ordinary=fixture('commander');for(const c of Object.values(ordinary.catalog))if(!/Land/.test(c.type_line)){c.color_identity=[];c.colors=[];c.mana_cost='{2}';c.cmc=2;}unavailable(await reopen(ordinary),/color identity/);
}
