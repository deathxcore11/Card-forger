import {digestSha256} from './ui-review-sha256.mjs';
// Only this dedicated fixture supplies WebCrypto SHA-256 on the HTTP preview.
if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(algorithm,bytes)=>{if(algorithm!=='SHA-256')throw Error('UNSUPPORTED_TEST_DIGEST');return digestSha256(bytes);}}});
// Bounded UI evidence only: engineered initial board, real delivered engine,
// production seat/interaction projection and journal; scripted pass-only opponent.
import {loadEngineAssets,RUNTIME_IDENTITY} from './runtime-assets.mjs?ui-review=4';
import {createJournal} from './worker-journal.mjs';
import {createSeatController} from './seat-surface.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {submitHumanCommand} from './human-command.mjs';
let journal,engine,controller,save=null,boot;const epoch='ui-combat-evidence',mutations=[];
const names=['Ordinary Bear','Llanowar Elves','Scarecrow Guide','Ghalta, Primal Hunger'],cpu=['Bear Cub','Lashwhip Predator','Tapestry Warden'];
function setup(){
 const list=a=>[...Array(60-a.length*2).fill('Forest'),...a,...a];
 engine.initialize_game({player:{main_deck:list(names)},opponent:{main_deck:list(cpu)}},4119,engine.getFormatRegistry().find(f=>f.format==='Vintage').default_config,null,2,1);
 const saved=JSON.parse(engine.export_game_state_json()),s=saved.state;
 for(const p of s.players){p.hand=[];p.library=Object.values(s.objects).filter(o=>o.owner===p.id).map(o=>o.id);for(const id of p.library)s.objects[id].zone='Library';}
 s.phase='PreCombatMain';s.waiting_for={type:'Priority',data:{player:1}};s.active_player=1;s.priority_player=1;s.turn_number=4;s.battlefield=[];s.priority_pass_count=0;s.priority_passes=[];s.combat=null;
 function move(name,owner,zone,n=1){const rows=Object.values(s.objects).filter(o=>o.name===name&&o.owner===owner&&o.zone==='Library').slice(0,n);if(rows.length!==n)throw Error('SETUP_CARD_MISSING');for(const o of rows){s.players[owner].library=s.players[owner].library.filter(id=>id!==o.id);o.zone=zone;o.tapped=false;if(zone==='Battlefield'){s.battlefield.push(o.id);o.entered_battlefield_turn=1;}else s.players[owner][zone.toLowerCase()].push(o.id);}return rows;}
 for(const n of names.slice(0,3))move(n,0,'Battlefield');for(const n of cpu)move(n,1,'Battlefield');for(const owner of [0,1])move('Forest',owner,'Battlefield',4);
 for(const n of ['Ordinary Bear','Scarecrow Guide','Ghalta, Primal Hunger'])move(n,0,'Hand');move('Forest',0,'Hand',3);
 engine.restore_game_state(JSON.stringify(saved));
 for(let i=0;i<30;i++){
  const st=engine.get_filtered_game_state(0).state;if(st.waiting_for.type==='DeclareBlockers')return;
  const lists=[0,1].map(actor=>({actor,actions:engine.get_legal_actions_for_viewer_js(actor).actions}));
  const row=lists.find(r=>r.actions.length);if(!row)throw Error('SETUP_NO_ACTION');const action=row.actions.find(a=>a.type==='PassPriority')||row.actions.filter(a=>a.type==='DeclareAttackers').sort((a,b)=>b.data.attacks.length-a.data.attacks.length)[0];if(!action)throw Error('SETUP_NO_ATTACK');
  const result=engine.submit_action(row.actor,action);if(!['applied','Applied'].includes(result.status))throw Error('SETUP_REJECTED');
 }throw Error('SETUP_BOUND');
}
async function bind(){
 postMessage({diagnostic:'Worker started · fixture 5'});
 const loaded=await loadEngineAssets({baseURL:new URL('./runtime/a86578b23adcd26c/',import.meta.url),loadCards:true,cacheStorage:null,fetcher:async(url,options)=>{postMessage({diagnostic:'Fetching '+url.pathname});const r=await fetch(url,options);postMessage({diagnostic:'Received '+url.pathname+' ('+r.status+')'});const b=await r.arrayBuffer();postMessage({diagnostic:'Read '+b.byteLength+' bytes from '+url.pathname});return new Response(b,{status:r.status,headers:r.headers});},onProgress:p=>postMessage({progress:p})});engine=loaded.engine;controller=createSeatController({engine,seat:0,epoch});
 const adapter={humanSeat:0,start:setup,save:()=>engine.export_game_state_json(),restore:s=>engine.restore_game_state(s),
  summary(revision){const state=engine.get_filtered_game_state(0).state,raw=engine.get_viewer_snapshot_js(0).viewerInteraction;return{surface:{...controller.read(revision),awaitingHuman:raw.authorizedSubmitters?.includes(0)===true,interaction:projectInteraction(raw,0)},terminal:state.waiting_for.type==='GameOver'?{winner:state.waiting_for.data?.winner??null}:null,clock:{state:'other-actor'}};},
  legal(){for(const actor of [0,1]){const {actions}=engine.get_legal_actions_for_viewer_js(actor);if(actions.length)return{actor,actions};}return{actor:null,actions:[]};},
  apply(actor,action){const r=engine.submit_action(actor,action);if(!['applied','Applied'].includes(r.status))throw Error('ENGINE_REJECTED');mutations.push({actor,action:action.type});},
  respond(submission){const r=engine.submit_interaction_js(0,submission);if(['applied','Applied'].includes(r.status)){mutations.push({actor:0,action:'InteractionSubmission',submission});return true;}if(['rejected','Rejected'].includes(r.status))return false;throw Error('ENGINE_RESPONSE');},
  act:command=>submitHumanCommand(engine,command)};
 journal=createJournal({engine:adapter,storage:{read:async()=>save,write:async next=>{save=structuredClone(next);}},choose:(actions,rng,ctx)=>ctx.actor===0?controller.select(actions,rng,ctx):{index:Math.max(0,actions.findIndex(a=>a.type==='PassPriority')),rng},version:'ui-combat-004',epoch});
 return{runtime:RUNTIME_IDENTITY.wasmSha256,seed:4119,evidence:'Engineered position; real engine and production UI/session. Not a full match, production CPU, Commander or account test.'};
}
self.onmessage=async({data:m})=>{try{if(m.op==='boot'){boot=bind();postMessage({id:m.id,ok:true,result:await boot});return;}await boot;const reply=await journal({...m,v:1,epoch});postMessage({...reply,id:m.id});if(reply.ok){const v=reply.result.surface;postMessage({evidence:{revision:reply.result.revision,phase:v.phase,decision:v.decision.kind,life:v.players.map(p=>p.life),cards:v.cards.filter(c=>c.zone==='Battlefield'||c.zone==='Graveyard').map(c=>({id:c.id,name:c.known?c.name:'Face down',zone:c.zone,tapped:c.tapped,damage:c.damage})),mutations:structuredClone(mutations)}});}}catch(e){postMessage({diagnostic:'Fixture failure: '+String(e.stack||e)});postMessage({id:m.id,ok:false,error:String(e.message)});}};
