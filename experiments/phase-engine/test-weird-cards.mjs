// Weird-card gameplay checks on the shipped Practice runtime and expanded rules
// database. Engineered positions (see mechanics-fixtures.mjs), then every
// action goes through the engine's own submit boundary and must be offered.
// Run: node --test experiments/phase-engine/test-weird-cards.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {RUNTIME_IDENTITY,EXPANDED_RULES_IDENTITY,validateRuntimeManifest} from './runtime-assets.mjs';
import {prepare,deck} from './mechanics-fixtures.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('./runtime/a86578b23adcd26c/',import.meta.url);
const manifest=validateRuntimeManifest(JSON.parse(await readFile(new URL('manifest.json',root),'utf8')));
const wasm=gunzipSync(Buffer.concat(await Promise.all(manifest.chunks.map(c=>readFile(new URL(c.path,root))))));
assert.equal(digest(wasm),RUNTIME_IDENTITY.wasmSha256);
const rules=Buffer.concat(await Promise.all(EXPANDED_RULES_IDENTITY.chunks.map(c=>readFile(new URL(c.path,root)))));
assert.equal(digest(rules),EXPANDED_RULES_IDENTITY.sha256);
const catalog=JSON.parse(gunzipSync(rules));

const NAMES=['Plains','Island','Swamp','Mountain','Forest','Tropical Island',
 'Lightning Bolt','Lightning Helix','Counterspell','Shatter','Ancestral Recall','Krosan Grip','Abrupt Decay','Raise the Alarm',
 'Grizzly Bears','Serra Angel','Darksteel Myr','Ornithopter','Kor Firewalker','Slippery Bogle','Elvish Visionary','Tarmogoyf','Isamaru, Hound of Konda',
 'Gitaxian Probe','Fog','Platinum Angel','Laboratory Maniac','Humility','Rest in Peace','Worship','Leyline of Punishment','Doubling Season','Parallel Lives','Torpor Orb','Panharmonicon','Blood Moon'];
globalThis.fetch=async()=>{throw Error('Network forbidden in weird-card checks');};
const e=await import(new URL(manifest.glue.path,root));await e.default({module_or_path:wasm});
assert.equal(e.load_card_database(JSON.stringify(Object.fromEntries(NAMES.map(n=>{const k=n.toLowerCase();assert(catalog[k],'missing '+n);return [k,catalog[k]];})))),NAMES.length);

const state=()=>JSON.parse(e.export_game_state_json()).state;
const obj=id=>state().objects[id];
const life=seat=>state().players[seat].life;
const offered=actor=>e.get_legal_actions_for_viewer_js(actor).actions;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// own/opp: extra non-land cards per deck. place: [key,name,owner,zone,count].
function setup({land='Mountain',oppLand='Forest',own=[],opp=[],place=[],emptyLibrary=[]}){
 const f=prepare(e,deck(land,...own),deck(oppLand,...opp)),ids={};
 for(const [key,name,owner,zone,count=1]of place){const found=f.move(name,owner,zone,count);ids[key]=count===1?found[0]:found;}
 for(const seat of emptyLibrary){
  for(const id of f.s.players[seat].library){f.s.objects[id].zone='Exile';f.s.exile.push(id);}
  f.s.players[seat].library=[];
 }
 f.restore();return ids;
}
function submit(actor,action){
 assert(offered(actor).some(a=>same(a,action)),'action not offered: '+JSON.stringify(action));
 const r=e.submit_action(actor,action);assert.equal(r.status,'applied',JSON.stringify(r).slice(0,400));return r;
}
function cast(id,actor=0){
 const a=offered(actor).find(a=>a.type==='CastSpell'&&a.data.object_id===id&&a.data.payment_mode?.type==='Auto');
 assert(a,'no cast offer for '+obj(id)?.name);return submit(actor,a);
}
const canCast=(id,actor)=>offered(actor).some(a=>a.type==='CastSpell'&&a.data.object_id===id);
function legalTargets(){const w=state().waiting_for;assert.equal(w.type,'TargetSelection');return w.data.selection.current_legal_targets;}
// The engine picks a sole legal target itself; then check the stacked spell got it.
function target(t,actor=0){
 if(state().waiting_for.type==='TargetSelection')return submit(actor,{type:'ChooseTarget',data:{target:t}});
 const top=state().stack.at(-1);assert(same(top?.kind?.data?.ability?.targets,[t]),'expected target '+JSON.stringify(t)+' on stack top');
}
// Pass until the stack is empty, answering only priority and simple choices.
function resolve(limit=40){
 for(let n=0;n<limit;n++){
  const s=state();if(s.waiting_for.type==='GameOver'||(!s.stack.length&&s.waiting_for.type==='Priority'))return s;
  if(s.waiting_for.type!=='Priority')throw Error('unexpected choice while resolving: '+s.waiting_for.type);
  submit(s.waiting_for.data.player,{type:'PassPriority'});
 }
 throw Error('stack did not resolve');
}
const gameOver=()=>state().waiting_for.type==='GameOver';
const winner=()=>{const w=state().waiting_for;return w.type==='GameOver'?w.data.winner:null;};

test('indestructible: Lightning Bolt marks damage but Darksteel Myr survives',()=>{
 const id=setup({own:['Lightning Bolt'],opp:['Darksteel Myr'],place:[['m','Mountain',0,'Battlefield'],['bolt','Lightning Bolt',0,'Hand'],['myr','Darksteel Myr',1,'Battlefield']]});
 cast(id.bolt);target({Object:id.myr});resolve();
 assert.equal(obj(id.myr).zone,'Battlefield');assert.equal(obj(id.myr).damage_marked,3);
});

test('Platinum Angel: opponent at 0 life does not lose until the Angel leaves',()=>{
 const id=setup({own:['Lightning Bolt','Shatter'],opp:['Platinum Angel'],place:[['m','Mountain',0,'Battlefield',2],['bolt','Lightning Bolt',0,'Hand'],['shatter','Shatter',0,'Hand'],['angel','Platinum Angel',1,'Battlefield']]});
 cast(id.bolt);target({Player:1});resolve();
 assert.equal(life(1),17);
 // Drop to 0 the long way would need more bolts; set via a second engineered pass instead.
 const save=JSON.parse(e.export_game_state_json());save.state.players[1].life=0;e.restore_game_state(JSON.stringify(save));
 for(let n=0;n<4&&!gameOver();n++)submit(state().waiting_for.data.player,{type:'PassPriority'});
 assert(!gameOver(),'player at 0 life lost despite Platinum Angel');
});

test('control: without Platinum Angel, 0 life ends the game',()=>{
 setup({opp:['Grizzly Bears'],place:[['bear','Grizzly Bears',1,'Battlefield']]});
 const save=JSON.parse(e.export_game_state_json());save.state.players[1].life=0;e.restore_game_state(JSON.stringify(save));
 for(let n=0;n<4&&!gameOver();n++)submit(state().waiting_for.data.player,{type:'PassPriority'});
 assert.equal(winner(),0);
});

test('Platinum Angel: destroying it lets the 0-life player lose',()=>{
 const id=setup({own:['Shatter'],opp:['Platinum Angel'],place:[['m','Mountain',0,'Battlefield',2],['shatter','Shatter',0,'Hand'],['angel','Platinum Angel',1,'Battlefield']]});
 const save=JSON.parse(e.export_game_state_json());save.state.players[1].life=0;e.restore_game_state(JSON.stringify(save));
 cast(id.shatter);target({Object:id.angel});resolve();
 assert.equal(winner(),0,'game should end once Platinum Angel is gone');
});

test('Laboratory Maniac: drawing from an empty library wins',()=>{
 const id=setup({land:'Island',own:['Ancestral Recall','Laboratory Maniac'],place:[['i','Island',0,'Battlefield'],['recall','Ancestral Recall',0,'Hand'],['lab','Laboratory Maniac',0,'Battlefield']],emptyLibrary:[0]});
 cast(id.recall);target({Player:0});resolve();
 assert.equal(winner(),0);
});

test('Humility: creatures become 1/1 and lose flying',()=>{
 const id=setup({land:'Plains',own:['Humility','Serra Angel'],place:[['p','Plains',0,'Battlefield',4],['h','Humility',0,'Hand'],['angel','Serra Angel',0,'Battlefield']]});
 assert.equal(obj(id.angel).power,4);
 cast(id.h);resolve();
 const a=obj(id.angel);assert.equal(a.power,1);assert.equal(a.toughness,1);assert(!a.keywords.includes('Flying'),'Serra Angel kept '+a.keywords);
});

test('Rest in Peace: a creature that dies is exiled instead',()=>{
 const id=setup({own:['Lightning Bolt','Rest in Peace'],opp:['Grizzly Bears'],place:[['m','Mountain',0,'Battlefield'],['bolt','Lightning Bolt',0,'Hand'],['rip','Rest in Peace',0,'Battlefield'],['bear','Grizzly Bears',1,'Battlefield']]});
 cast(id.bolt);target({Object:id.bear});resolve();
 assert.equal(obj(id.bear).zone,'Exile');assert.equal(obj(id.bolt).zone,'Exile');
});

test('protection and hexproof: Bolt cannot target Kor Firewalker or an opposing Slippery Bogle',()=>{
 const id=setup({own:['Lightning Bolt','Slippery Bogle'],opp:['Kor Firewalker','Slippery Bogle','Grizzly Bears'],place:[['m','Mountain',0,'Battlefield'],['bolt','Lightning Bolt',0,'Hand'],['kor','Kor Firewalker',1,'Battlefield'],['bogle','Slippery Bogle',1,'Battlefield'],['bear','Grizzly Bears',1,'Battlefield'],['mine','Slippery Bogle',0,'Battlefield']]});
 cast(id.bolt);const t=legalTargets().map(x=>x.Object).filter(Boolean);
 assert(!t.includes(id.kor),'protection from red ignored');assert(!t.includes(id.bogle),'hexproof ignored');
 assert(t.includes(id.bear));assert(t.includes(id.mine),'own hexproof creature should still be targetable');
});

test('Worship: life cannot drop below 1 while its controller has a creature',()=>{
 const id=setup({own:['Lightning Bolt'],opp:['Worship','Grizzly Bears'],place:[['m','Mountain',0,'Battlefield'],['bolt','Lightning Bolt',0,'Hand'],['w','Worship',1,'Battlefield'],['bear','Grizzly Bears',1,'Battlefield']]});
 const save=JSON.parse(e.export_game_state_json());save.state.players[1].life=2;e.restore_game_state(JSON.stringify(save));
 cast(id.bolt);target({Player:1});resolve();
 assert.equal(life(1),1);assert(!gameOver());
});

test('Leyline of Punishment: Lightning Helix deals damage but its controller gains no life',()=>{
 const id=setup({own:['Lightning Helix','Plains'],opp:['Leyline of Punishment'],place:[['m','Mountain',0,'Battlefield'],['p','Plains',0,'Battlefield'],['helix','Lightning Helix',0,'Hand'],['ley','Leyline of Punishment',1,'Battlefield']]});
 const save=JSON.parse(e.export_game_state_json());save.state.players[0].life=10;e.restore_game_state(JSON.stringify(save));
 cast(id.helix);target({Player:1});resolve();
 assert.equal(life(1),17);assert.equal(life(0),10);
});

test('control: Counterspell can answer a normal spell',()=>{
 const id=setup({own:['Shatter'],oppLand:'Island',opp:['Counterspell','Ornithopter'],place:[['m','Mountain',0,'Battlefield',2],['shatter','Shatter',0,'Hand'],['i','Island',1,'Battlefield',2],['cs','Counterspell',1,'Hand'],['orn','Ornithopter',1,'Battlefield']]});
 cast(id.shatter);target({Object:id.orn});submit(0,{type:'PassPriority'});
 assert(canCast(id.cs,1),'Counterspell should be castable in response');
 cast(id.cs,1);target({Object:id.shatter},1);resolve();
 assert.equal(obj(id.orn).zone,'Battlefield');assert.equal(obj(id.shatter).zone,'Graveyard');
});

test('split second: Krosan Grip cannot be responded to with Counterspell',()=>{
 const id=setup({land:'Forest',own:['Krosan Grip'],oppLand:'Island',opp:['Counterspell','Ornithopter'],place:[['f','Forest',0,'Battlefield',3],['grip','Krosan Grip',0,'Hand'],['i','Island',1,'Battlefield',2],['cs','Counterspell',1,'Hand'],['orn','Ornithopter',1,'Battlefield']]});
 cast(id.grip);target({Object:id.orn});submit(0,{type:'PassPriority'});
 assert(!canCast(id.cs,1),'Counterspell offered against split second');
 resolve();assert.equal(obj(id.orn).zone,'Graveyard');
});

test('can\'t be countered: Abrupt Decay resolves through Counterspell',()=>{
 const id=setup({land:'Swamp',own:['Abrupt Decay','Forest'],oppLand:'Island',opp:['Counterspell','Ornithopter'],place:[['s','Swamp',0,'Battlefield'],['f','Forest',0,'Battlefield'],['decay','Abrupt Decay',0,'Hand'],['i','Island',1,'Battlefield',2],['cs','Counterspell',1,'Hand'],['orn','Ornithopter',1,'Battlefield']]});
 cast(id.decay);target({Object:id.orn});submit(0,{type:'PassPriority'});
 assert(canCast(id.cs,1),'Counterspell may still target an uncounterable spell');cast(id.cs,1);target({Object:id.decay},1);
 resolve();assert.equal(obj(id.orn).zone,'Graveyard','Abrupt Decay was countered');
});

test('Doubling Season + Parallel Lives: Raise the Alarm makes 8 Soldiers',()=>{
 const id=setup({land:'Plains',own:['Raise the Alarm','Doubling Season','Parallel Lives'],place:[['p','Plains',0,'Battlefield',2],['r','Raise the Alarm',0,'Hand'],['ds','Doubling Season',0,'Battlefield'],['pl','Parallel Lives',0,'Battlefield']]});
 const before=state().battlefield.length;cast(id.r);resolve();
 const s=state(),tokens=s.battlefield.slice(before).map(x=>s.objects[x]).filter(o=>o.name==='Soldier');
 assert.equal(tokens.length,8);
});

test('Panharmonicon: Elvish Visionary\'s enter trigger happens twice',()=>{
 const id=setup({land:'Forest',own:['Elvish Visionary','Panharmonicon'],place:[['f','Forest',0,'Battlefield',2],['ev','Elvish Visionary',0,'Hand'],['ph','Panharmonicon',0,'Battlefield']]});
 const hand=state().players[0].hand.length;cast(id.ev);resolve();
 assert.equal(state().players[0].hand.length,hand-1+2);
});

test('Torpor Orb: Elvish Visionary\'s enter trigger does not happen',()=>{
 const id=setup({land:'Forest',own:['Elvish Visionary'],opp:['Torpor Orb'],place:[['f','Forest',0,'Battlefield',2],['ev','Elvish Visionary',0,'Hand'],['orb','Torpor Orb',1,'Battlefield']]});
 const hand=state().players[0].hand.length;cast(id.ev);resolve();
 assert.equal(state().players[0].hand.length,hand-1);
});

test('Tarmogoyf: counts card types across all graveyards',()=>{
 const id=setup({land:'Forest',own:['Tarmogoyf','Lightning Bolt','Grizzly Bears'],place:[['g','Tarmogoyf',0,'Battlefield'],['b','Lightning Bolt',0,'Graveyard'],['f','Forest',1,'Graveyard'],['bear','Grizzly Bears',0,'Graveyard'],['mf','Forest',0,'Battlefield']]});
 submit(0,{type:'PassPriority'});// any action refreshes characteristics
 const g=obj(id.g);assert.equal(g.power,3);assert.equal(g.toughness,4);
});

test('Blood Moon: a nonbasic dual becomes a Mountain',()=>{
 const id=setup({land:'Mountain',opp:['Tropical Island','Blood Moon'],place:[['t','Tropical Island',1,'Battlefield'],['bm','Blood Moon',0,'Battlefield']],own:['Blood Moon']});
 submit(0,{type:'PassPriority'});
 const t=obj(id.t);assert.deepEqual(t.card_types.subtypes,['Mountain']);
});

test('legend rule: a second Isamaru forces a choice',()=>{
 const id=setup({land:'Plains',own:['Isamaru, Hound of Konda','Isamaru, Hound of Konda'],place:[['p','Plains',0,'Battlefield'],['a','Isamaru, Hound of Konda',0,'Battlefield'],['b','Isamaru, Hound of Konda',0,'Hand']]});
 cast(id.b);submit(0,{type:'PassPriority'});submit(1,{type:'PassPriority'});
 const w=state().waiting_for;assert.equal(w.type,'ChooseLegend');
 const keep=offered(0).find(a=>a.type!=='PassPriority');submit(0,keep);
 assert.equal([id.a,id.b].filter(x=>obj(x).zone==='Battlefield').length,1);
});

test('Phyrexian mana: Gitaxian Probe is castable with no lands by paying 2 life',()=>{
 const id=setup({land:'Island',own:['Gitaxian Probe'],place:[['probe','Gitaxian Probe',0,'Hand']]});
 assert(canCast(id.probe,0),'Gitaxian Probe not castable for life');
 cast(id.probe);target({Player:1});
 for(let n=0;n<6&&state().waiting_for.type!=='Priority';n++){const a=offered(0).find(a=>a.type!=='CancelCast');submit(0,a);}
 resolve();assert.equal(life(0),18);assert.equal(obj(id.probe).zone,'Graveyard');
});

function combat(fog){
 const id=setup({land:'Mountain',own:['Grizzly Bears'],opp:['Fog'],place:[['bear','Grizzly Bears',0,'Battlefield'],['fog','Fog',1,'Hand'],['f','Forest',1,'Battlefield']]});
 let fogged=false;
 for(let n=0;n<40&&state().phase!=='PostCombatMain';n++){
  const s=state(),w=s.waiting_for,actor=w.data?.player;
  if(w.type==='DeclareAttackers'){const a=offered(actor).find(a=>a.type==='DeclareAttackers'&&JSON.stringify(a.data).includes(String(id.bear)));assert(a,'bear cannot attack');submit(actor,a);continue;}
  if(w.type==='DeclareBlockers'){const a=offered(actor).find(a=>a.type==='DeclareBlockers');submit(actor,a);continue;}
  if(fog&&w.type==='Priority'&&actor===1&&!fogged&&s.combat&&canCast(id.fog,1)){cast(id.fog,1);fogged=true;continue;}
  assert.equal(w.type,'Priority','unexpected '+w.type);submit(actor,{type:'PassPriority'});
 }
 assert.equal(state().phase,'PostCombatMain');assert.equal(fogged,fog,'Fog was never castable during combat');
 return life(1);
}

test('control: an unblocked Grizzly Bears deals 2',()=>assert.equal(combat(false),18));
test('Fog: an attacking creature deals no combat damage',()=>assert.equal(combat(true),20));
