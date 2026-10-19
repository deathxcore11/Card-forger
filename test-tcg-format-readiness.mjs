// Source-versioned eligibility regressions, not empirical Power calibration.
// Cards/decks below are synthetic rule probes, except the organizer's banned
// names and printing identifiers. No claim that invented cards are real/legal.
// Uses registered app saves + actual storage read/write and Power rendering,
// with in-memory localStorage, no browser, provider call, upload or user data.
import assert from 'node:assert/strict';
import {normalizePtcg,validatePtcg,ptcgLegality,glcCardEligibility,PTCG_FORMATS} from './ptcg.js';
import {normalizeYgo,validateYgo,ygoLegality,YGO_FORMATS,YGO_FORMAT_RULES,ygoZoneRange} from './ygo.js';
import {GLC_RULES,GLC_BANS} from './ptcg-glc-rules.js';
import {powerReadiness,tcgPower,shownPower} from './power.js';
import {S,blank,STORAGE} from './store.js';
import {blankGame} from './games.js';
import {registerTcg,cache,tcgDeck,tcgDecks,tcgSharedPage} from './tcg.js';
import {writeRecord,readRecord} from './storage.js';

const format=(game,id)=>(game==='ptcg'?PTCG_FORMATS:YGO_FORMATS).find(f=>f.id===id);
const glc=format('ptcg','glc'),speed=format('ygo','speed'),goat=format('ygo','goat');
const clone=x=>structuredClone(x),issues=(game,x,f=format(game,x.deck.format))=>(game==='ptcg'?validatePtcg:validateYgo)(x.deck,id=>x.cards[id],f);
const blocking=rows=>rows.filter(x=>['bad','pending'].includes(x.level));
const row=(c,qty=1)=>({cardId:c.id,name:c.name,qty});
let sequence=0;
function pokemon(name,more={}) {
  return normalizePtcg({id:`xy1-${++sequence}`,name,category:'Pokemon',stage:'Basic',types:['Grass'],hp:100,rarity:'Common',legal:{standard:false,expanded:true},attacks:[{name:'Fixture attack',cost:['Grass'],damage:30}],set:{id:'xy1',name:'Synthetic XY identity'},...more});
}
function pokemonFixture(cards=[pokemon('Fixture Grass attacker')]) {
  const energy=pokemon('Basic Grass Energy',{category:'Energy',stage:null,types:[],energyType:'Normal'});
  return {cards:Object.fromEntries([...cards,energy].map(c=>[c.id,c])),deck:{id:'format-probe-'+(++sequence),name:'Synthetic GLC probe',format:'glc',zones:{main:[...cards.map(c=>row(c)),row(energy,60-cards.length)],extra:[],side:[]}}};
}
function ygoFixture(id,{main=format('ygo',id).main[0],extra=0,side=0}={}) {
  const f=format('ygo',id),cards={},zones={main:[],extra:[],side:[]};
  for (const [zone,n] of Object.entries({main,extra,side})) for(let i=0;i<n;i++) {
    const id=String(++sequence),c=normalizeYgo({id,name:`Synthetic ${zone} ${id}`,type:zone==='extra'?'Fusion Monster':'Normal Monster',frameType:zone==='extra'?'fusion':'normal',level:4,atk:1000,def:1000,race:'Warrior',attribute:'LIGHT',desc:'',misc_info:[{formats:f.pool?[f.pool.toLowerCase()]:[]}],card_prices:[]});
    cards[id]=c;zones[zone].push(row(c));
  }
  return {cards,deck:{id:'format-probe-'+(++sequence),name:'Synthetic '+f.name+' probe',format:id,zones}};
}
function check(game,x,expected,pattern) {
  const f=format(game,x.deck.format),found=issues(game,x,f),readiness=powerReadiness(game,x.deck,f,id=>x.cards[id]);
  assert.equal(readiness.eligible,expected,JSON.stringify(found));
  if(expected)assert.deepEqual(blocking(found),[]);
  if(pattern)assert.match(found.map(i=>i.text).join(' | '),pattern);
  const p=tcgPower(game,x.deck,f,id=>x.cards[id]);
  assert.equal(p.readiness.eligible,expected);
  if(!expected)assert.equal(shownPower(p),null,'invalid or unresolved eligibility blocks displayed Power');
  else assert(Number.isFinite(shownPower(p)),'eligible synthetic construction gets a finite heuristic, not a calibration claim');
  return found;
}

assert.equal(glc.legal,undefined,'GLC must not substitute Expanded bans');
assert.equal(GLC_RULES.latestBanEffectiveAt,'2026-04-20');assert.equal(GLC_RULES.checkedAt,'2026-10-19');
assert.equal(GLC_BANS.length,13);assert.match(GLC_RULES.banList,/gymleaderchallenge.com\/ban-list$/);
const glcGood=pokemonFixture();check('ptcg',glcGood,true);
check('ptcg',pokemonFixture([pokemon('Fixture Grass'),pokemon('Fixture Fire',{types:['Fire']})]),false,/share one printed type/);
check('ptcg',pokemonFixture([pokemon('Fixture dual A',{types:['Grass','Fire']}),pokemon('Fixture dual B',{types:['Fire','Water']})]),true);
check('ptcg',pokemonFixture([pokemon('Fixture dual A',{types:['Grass','Fire']}),pokemon('Fixture dual B',{types:['Fire','Water']}),pokemon('Fixture dual C',{types:['Water','Grass']})]),false,/no common type/);
check('ptcg',pokemonFixture([pokemon('Missing type',{types:[]})]),false,/type needs verification/);
for(const c of [pokemon('Radiant fixture'),pokemon('Fixture ex'),pokemon('Prism Trainer ◇',{category:'Trainer'}),pokemon('Prism Energy ◇',{category:'Energy',energyType:'Special'}),pokemon('ACE fixture',{category:'Trainer',rarity:'ACE SPEC Rare'})])check('ptcg',pokemonFixture([pokemon('Fixture Grass'),c]),false,/Rule Box|ACE SPEC/);
const seal=pokemon('Forest Seal Stone',{category:'Trainer',effect:'The Pokémon V this card is attached to can use the VSTAR Power on this card.'});
assert.equal(seal.ruleBox,false,'mentioning a VSTAR Power does not make a Trainer a Rule Box');
check('ptcg',pokemonFixture([pokemon('Fixture Grass'),seal]),true);
assert.equal(pokemon('ACE search fixture',{category:'Trainer',effect:'Search your deck for an ACE SPEC card.'}).aceSpec,false,'references to ACE SPEC do not make a card ACE SPEC');
for(const name of ['Delinquent','Hex Maniac'])check('ptcg',pokemonFixture([pokemon('Fixture Grass'),pokemon(name,{id:`xy9-${++sequence}`,category:'Trainer',legal:{standard:false,expanded:false},set:{id:'xy9',name:'Synthetic XY identity'}})]),true);
for(const names of [["Boss’s Orders",'Lysandre'],["Boss's Orders (Ghetsis)",'Lysandre'],["Professor's Research (Professor Oak)",'Professor Sycamore'],['Professor Juniper','Professor Sycamore']])check('ptcg',pokemonFixture([pokemon('Fixture Grass'),...names.map(name=>pokemon(name,{category:'Trainer'}))]),false,/allows 1 with the same name/);
check('ptcg',pokemonFixture([pokemon('Fixture Grass'),pokemon('Hop',{category:'Trainer'}),pokemon('Hau',{category:'Trainer'})]),true);
for(const ban of GLC_BANS) {
  for(const [set,number] of ban.printings || [['xy1','1']]) {
    const c=pokemon(ban.name,{id:`${set}-${number}`,set:{id:set,number},category:['Oranguru','Kyogre','Raikou','Marshadow','Duskull'].includes(ban.name)?'Pokemon':ban.name.includes('Energy')?'Energy':'Trainer'});
    assert.equal(glcCardEligibility(c).status,'not_legal',ban.name+' '+set+' '+number);
  }
}
const bannedRaikou=pokemon('Raikou',{id:'swsh4-050',set:{id:'swsh4',number:'050/185'}});
check('ptcg',pokemonFixture([bannedRaikou]),false,/GLC ban list/);
check('ptcg',pokemonFixture([pokemon('Raikou',{id:'xy1-99',set:{id:'xy1',number:'99'}})]),true);
const unknownRaikou=pokemon('Raikou',{id:'unknown',set:null});
check('ptcg',pokemonFixture([unknownRaikou]),false,/exact set and collector number/);
check('ptcg',pokemonFixture([{...bannedRaikou,set:{id:'xy1',number:'50'}}]),false,/identity conflict/);
const noPool=pokemon('Unknown printing',{id:'unknown',set:null,legal:{}});check('ptcg',pokemonFixture([noPool]),false,/pool.*eligibility needs verification/);
check('ptcg',pokemonFixture([{...glcGood.cards[glcGood.deck.zones.main[0].cardId],released:'2099-01-01'}]),false,/release is later than the verified GLC rules snapshot/);
assert.equal(normalizePtcg({id:'unknown',name:'Unknown'}).legal.standard,null,'normalization preserves missing legality, not false');
const legacy=pokemon('Vintage Pokémon',{id:'base1-1',set:{id:'base1',number:'1'},legal:{expanded:false}});
check('ptcg',pokemonFixture([legacy]),false,/predates the Black & White/);
check('ptcg',pokemonFixture([pokemon('Fixture Grass'),pokemon('Old Trainer',{category:'Trainer',id:'base1-91',set:{id:'base1',number:'91'},legal:{expanded:false}})]),false,/older-print reprint eligibility/);
const cc=pokemon('Charizard',{id:'cel25cc-CC002',set:{id:'cel25cc',number:'CC002'},legal:{expanded:true}});
assert.equal(ptcgLegality(cc,glc),'not_legal','commemorative reprint date is not its original card-pool era');
for(const name of ['Reshiram','Zekrom'])assert.equal(ptcgLegality({...cc,name},glc),'legal');
check('ptcg',pokemonFixture([pokemon('Fixture Grass'),pokemon('Classic Switch',{id:'clb-1',category:'Trainer',set:{id:'clb',name:'Pokémon TCG Classic'},legal:{expanded:false}})]),false,/functional reprint eligibility/);
const missing=clone(glcGood);delete missing.cards[missing.deck.zones.main[0].cardId];check('ptcg',missing,false,/card details not loaded/);

assert.deepEqual([speed.extra,speed.side,speed.firstTurnCards,speed.secondTurnCards],[6,6,4,5]);
assert.deepEqual([goat.main[0],goat.main[1],goat.extra,goat.firstTurnCards,goat.secondTurnCards],[40,Infinity,Infinity,6,6]);
assert.deepEqual([format('ygo','edison').firstTurnCards,format('ygo','edison').secondTurnCards],[6,6]);
assert.match(YGO_FORMAT_RULES.edison.source,/edison-rule-differences/);
assert.match(YGO_FORMAT_RULES.speed.source,/Addendum_1.2_KDE-US.pdf$/);assert.equal(YGO_FORMAT_RULES.speed.effectiveAt,'2022-03-11');
assert.match(ygoZoneRange(goat,'main'),/40.*no maximum/i);assert.match(ygoZoneRange(goat,'extra'),/No maximum/);assert.doesNotMatch(ygoZoneRange(goat,'main')+ygoZoneRange(goat,'extra'),/Infinity/);
const speedGood=ygoFixture('speed',{extra:6,side:6});const speedIssues=check('ygo',speedGood,true);
assert(speedIssues.some(i=>i.level==='warn'&&/logo.*event-specific/.test(i.text)),'pool-only scope stays visible');
check('ygo',ygoFixture('speed',{extra:7}),false,/Extra Deck has 7/);check('ygo',ygoFixture('speed',{side:7}),false,/Side Deck has 7/);
check('ygo',ygoFixture('speed',{main:19}),false,/needs 20–30/);check('ygo',ygoFixture('speed',{main:31}),false,/needs 20–30/);
const skill=clone(speedGood);skill.deck.skill='Declared skill';check('ygo',skill,false,/Skill is declared/);
// Same ID and zones: declaration edits must invalidate cached eligibility.
delete skill.deck.skill;check('ygo',skill,true);skill.deck.skillCards=['Declared skill'];check('ygo',skill,false,/Skill is declared/);
const sideSkill=clone(speedGood),sideId=sideSkill.deck.zones.side[0].cardId;sideSkill.cards[sideId].category='Skill';check('ygo',sideSkill,false,/Side Deck Skills count/);
sideSkill.deck.zones.side[0].qty=2;check('ygo',sideSkill,false,/Side Deck has 7/);
const absentPool=clone(speedGood);absentPool.cards[absentPool.deck.zones.main[0].cardId].pools=[];check('ygo',absentPool,false,/format pool.*not verified/);
assert.equal(ygoLegality({pools:[]},speed),'unknown');
const incompatible=clone(speedGood);incompatible.cards[incompatible.deck.zones.main[0].cardId].pools=['TCG'];check('ygo',incompatible,false,/isn’t available in Speed Duel/);
const goatGood=ygoFixture('goat',{main:61,extra:16,side:15});check('ygo',goatGood,true);
check('ygo',ygoFixture('goat',{main:39}),false,/needs 40\+ \(no maximum\)/);
check('ygo',ygoFixture('goat',{side:1}),false,/intended Side Deck variant/);check('ygo',ygoFixture('goat',{side:16}),false,/Side Deck has 16/);
check('ygo',ygoFixture('goat',{side:0}),true);
const noBan=clone(goatGood);delete noBan.cards[noBan.deck.zones.main[0].cardId].ban.goat;check('ygo',noBan,false,/ban-status data not verified/);
const malformedBan=clone(goatGood);malformedBan.cards[malformedBan.deck.zones.main[0].cardId].ban.goat='unknown';check('ygo',malformedBan,false,/ban-status data not verified/);
const badCopy=clone(goatGood);badCopy.deck.zones.main[0].qty=4;check('ygo',badCopy,false,/4 copies.*allows 3/);
for(const id of ['edison','md','dl'])check('ygo',ygoFixture(id),false,/isn't in the data/);
const edisonProbe=ygoFixture('edison'),edisonPower=tcgPower('ygo',edisonProbe.deck,format('ygo','edison'),id=>edisonProbe.cards[id]);
assert.equal(shownPower(edisonPower),null,'sourced hand diagnostics cannot supply a missing banlist');
assert.match(edisonPower.sims[0].note,/6 cards/,'unavailable overall still uses the correct first-turn diagnostic window');
// Passed custom profile must be in memo evidence, not just the format ID.
const custom=ygoFixture('speed',{extra:6});
assert.equal(tcgPower('ygo',custom.deck,speed,id=>custom.cards[id]).readiness.eligible,true);
assert.equal(tcgPower('ygo',custom.deck,{...speed,extra:5},id=>custom.cards[id]).readiness.eligible,false);
assert.equal(tcgPower('ygo',custom.deck,speed,id=>custom.cards[id]).readiness.eligible,true);

// Real registered save action, durable serializer and reopen + actual Power UI.
// This is app-action integration; hosted browser/DOM interaction is separate QA.
const records=new Map(),values=new Map();
globalThis.localStorage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
globalThis.document={querySelector:q=>values.has(q)?{value:values.get(q)}:null,body:{dataset:{}}};
globalThis.fetch=async()=>{throw Error('Network forbidden in format readiness fixtures');};
S.state=blank();S.state.tcg={ptcg:blankGame(),ygo:blankGame()};
const A={},C={},I={};let saves=0;
registerTcg({A,C,I,commit:async fn=>{const next=clone(S.state);await fn(next);await writeRecord(STORAGE,next);S.state=next;saves++;},render(){},toast(){},go(){},closeSheet(){},openSheet(){},writeRecord});
async function savedCheck(game,fixture,eligible) {
  const x=clone(fixture),id=x.deck.id;S.state.settings.game=game;Object.assign(cache[game],x.cards);S.state.tcg[game].decks=[x.deck];
  values.set('#tDmName',x.deck.name+' saved');values.set('#tDmFormat',x.deck.format);
  await A.tDeckSave({dataset:{id}});
  S.state=blank();S.state=await readRecord(STORAGE);const reopened=S.state.tcg[game].decks[0];
  assert.equal(reopened.name,x.deck.name+' saved');assert.deepEqual(reopened.zones,x.deck.zones);
  assert.deepEqual(reopened.skill,x.deck.skill,'unsupported Skill declaration cannot disappear on save');
  const p=tcgPower(game,reopened,format(game,reopened.format),cardId=>cache[game][cardId]);assert.equal(p.readiness.eligible,eligible);
  const checked=issues(game,{deck:reopened,cards:cache[game]}),bad=checked.filter(i=>i.level==='bad').length,pending=checked.some(i=>i.level!=='warn'),
    label=bad?`${bad} to fix`:pending?'Unverified · checks pending':checked.length?'Profile checked · caveats':'',tone=bad?'bad':checked.length?'warn':'ok';
  S.ui.tdeckTab={[game+':'+id]:'insights'};const html=tcgDeck(id);
  assert.match(html,/Deck Power/);assert.doesNotMatch(html,/<b>null<\/b>|NaN/);
  assert(html.includes(`class="review-badge ${tone}"`),'badge severity follows issue kind, not issue count');
  if(label)assert(html.includes(`>${label}</button>`));
  assert.doesNotMatch(html,/Unverified · card data pending/,'profile and unresolved-rule caveats are not all missing card data');
  S.ui.tdeckTab[game+':'+id]='cards';const cardsHtml=tcgDeck(id);
  if(label)assert(cardsHtml.includes(`<summary>Rules review · ${label}</summary>`));
  S.ui.decksTab='mine';const tiles=tcgDecks();if(label)assert(tiles.includes(label));
  if(checked.length&&!bad&&!pending){
    assert(eligible,'informational profile caveats do not change eligibility');
    assert.match(cardsHtml,game==='ygo'&&reopened.format==='speed'?/Speed Duel checks cover constructed sizes/:/GOAT uses original organizer rules/,'exact profile limitation stays visible');
    assert.doesNotMatch(cardsHtml,/Rules review · \d+ to fix/);assert.match(tiles,/chip dark warn/);
    assert.match(tcgSharedPage({...reopened,game}),/Profile checked · caveats/);
  }
  assert.deepEqual(issues(game,{deck:reopened,cards:cache[game]}),checked,'rendering never changes diagnostic issues');
  assert.equal(shownPower(tcgPower(game,reopened,format(game,reopened.format),cardId=>cache[game][cardId])),shownPower(p),'presentation changes never alter the Power estimate');
  if(game==='ygo'){const f=format(game,reopened.format);assert.ok(html.includes(`1st (${f.firstTurnCards||5})`));assert.ok(html.includes(`2nd (${f.secondTurnCards||6})`));assert.doesNotMatch(html,/Infinity/);}

  if(!eligible){assert.equal(shownPower(p),null);assert.match(html,/power unavailable<\/button>/);}
  else assert(Number.isFinite(shownPower(p)));
}
for(const [game,good,bad] of [['ptcg',glcGood,pokemonFixture([bannedRaikou])],['ygo',speedGood,skill],['ygo',goatGood,ygoFixture('goat',{side:1})]]) {
  await savedCheck(game,good,true);await savedCheck(game,bad,false);
}
await savedCheck('ygo',noBan,false);await savedCheck('ygo',ygoFixture('speed',{main:19}),false);
assert.equal(saves,8);
console.log('PASS: source-versioned GLC independent bans/type/Rule Box/ACE SPEC/shared names; Speed 6-card zones and optional unresolved Skills; unlimited GOAT sizes with explicit side-policy uncertainty; missing-data gates; same-ID Power memo; eight registered save/storage/reopen/Power UI cases with distinct bad/pending/profile-caveat labels. Directional eligibility regressions, not calibrated strength.');
