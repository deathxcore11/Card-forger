import test from 'node:test';import assert from 'node:assert/strict';
import {bootAcceptance} from './acceptance-inputs.mjs';
import {PRACTICE_STARTER_ROWS} from '../../play-starter-deck.js';
import {readShippedResponseProof,shippedResponseAbsent} from './shipped-response-proof.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
test('pinned shipped runtime automatically passes the screenshot creature-only response window without mutation during proof',async()=>{
const {engine:e}=await bootAcceptance(PRACTICE_STARTER_ROWS.map(r=>r.name));
const deck={main_deck:PRACTICE_STARTER_ROWS.flatMap(r=>Array(r.qty).fill(r.name)),sideboard:[],commander:[]};
const started=e.initialize_game({player:deck,opponent:deck},7331,e.getFormatRegistry().find(f=>f.format==='Standard').default_config,null,2,0);assert(started.events);
const save=JSON.parse(e.export_game_state_json()),s=save.state;
for(const p of s.players){p.library.push(...p.hand);p.hand=[];}
const take=(name,owner,zone)=>{const id=s.players[owner].library.find(id=>s.objects[id].name===name);assert(id,name);s.players[owner].library=s.players[owner].library.filter(n=>n!==id);s.objects[id].zone=zone;s.objects[id].tapped=zone==='Battlefield';s.objects[id].entered_battlefield_turn=zone==='Battlefield'?1:null;if(zone==='Battlefield')s.battlefield.push(id);else s.players[owner].hand.push(id);return id;};
for(const n of ['Ordinary Bear','Tarmogoyf','Forest','Scarecrow Guide','Bear Cub','Ghalta, Primal Hunger','Scarecrow Guide'])take(n,0,'Hand');
take('Forest',0,'Battlefield');take('Forest',1,'Battlefield');take('Forest',1,'Battlefield');take('Virulent Emissary',1,'Battlefield');take('Virulent Emissary',1,'Battlefield');
s.turn_number=3;s.active_player=1;s.priority_player=0;s.waiting_for={type:'Priority',data:{player:0}};s.phase='DeclareAttackers';s.priority_pass_count=0;s.priority_passes=[];
e.restore_game_state(JSON.stringify(save));const before=e.export_game_state_json();const view=e.get_filtered_game_state(0).state;
const proof=readShippedResponseProof(e,0,RUNTIME_IDENTITY.wasmSha256);assert(shippedResponseAbsent(view));
assert.equal(proof?.status,'no-response');const {adapter,close}=createMatchAuthority({engine:e,epoch:'screenshot',runtimeIdentity:RUNTIME_IDENTITY.wasmSha256,policyWorker:{terminate(){}}});assert.equal(adapter.priorityCapability(0).coverage,'complete');close();assert.equal(e.export_game_state_json(),before);const applied=e.submit_action(0,{type:'PassPriority'});assert.equal(applied.status,'applied');assert.equal(e.get_filtered_game_state(0).state.waiting_for.data.player,1);
});
