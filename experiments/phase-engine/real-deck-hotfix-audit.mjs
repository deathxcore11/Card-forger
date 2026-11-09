import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {bootAcceptance} from './acceptance-inputs.mjs';
import {compiledCardSupport} from './compiled-card-support.mjs';
import {prepareMatchInput,evaluateMatchAdmission} from './match-input.mjs';
import {createPracticeCatalogReview} from '../../play-catalog-review.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const upstreamPath=process.argv[2],output=resolve(process.argv[3]||'test-results/real-deck-hotfix-audit');
assert(upstreamPath,'Usage: node experiments/phase-engine/real-deck-hotfix-audit.mjs /pinned/card-data-84d5fd2af84e2f12.json [output-directory]');
await mkdir(output,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const {engine:e,catalog}=await bootAcceptance(['Forest','Plains','Mountain','The Arkenstone','Seek the Heart']);
const installedRaw=gunzipSync(await readFile(root+'experiments/phase-engine/runtime/a86578b23adcd26c/card-rules.bin')).toString('utf8');
assert.equal(e.load_card_database(installedRaw),6137);
const result={source:'e4e938bb93b8257590ab7e54dde81bd9684b281a',runtime:'a86578b23adcd26c',cases:[]};
const ordinary=compiledCardSupport(catalog,'installed');
const angels=JSON.parse(await readFile(root+'experiments/phase-engine/fixtures/deck-001/calling-all-angels.json','utf8'));
const ai=prepareMatchInput({player:angels,opponent:angels,format:'Commander',difficulty:'Medium',runtimeIdentity:'audit'});
const before=evaluateMatchAdmission(e,ai,ordinary);
result.cases.push({name:'installed Calling All Angels',admitted:before.admitted,playerMissing:before.seats.player.unsupported.length,reasons:before.seats.player.reasons.slice(0,4)});
assert.equal(before.admitted,false);assert.equal(before.seats.player.unsupported.length,44);
for(const name of ['The Arkenstone // Seek the Heart','The Arkenstone']){
 const d={name:'Arkenstone diagnostic',format:'Standard',cards:[{name:'Forest',qty:56},{name,qty:4}],side:[]};
 const i=prepareMatchInput({player:d,opponent:d,format:'Standard',difficulty:'Medium',runtimeIdentity:'audit'});
 const a=evaluateMatchAdmission(e,i,ordinary);
 result.cases.push({name:'engine '+name,admitted:a.admitted,seat:a.seats.player});
}
result.cases.push({name:'priority export',available:typeof e.get_priority_capability_v1_js==='function'});
const arkenstone={name:'The Arkenstone // Seek the Heart',oracle_id:'09f09d0a-6054-4545-b81e-0295773cc5f0',legalities:{standard:'legal'},card_faces:[{name:'The Arkenstone'},{name:'Seek the Heart'}]};
const deck={name:'Catalog diagnostic',format:'Standard',cards:[{name:arkenstone.name,qty:60}],side:[]};
const review=createPracticeCatalogReview({lookupNames:async()=>({data:[arkenstone]}),isCurrent:()=>true});
const proof=await review({selected:deck,opponent:deck,match:{format:'Standard'}});
result.cases.push({name:'full-name catalog matching with known card metadata fixture',passes:proof.player.cards[0].legality==='legal',note:'Fixture metadata only; actual owner lookup response remains NOT TESTED.'});
const upstreamBytes=await readFile(upstreamPath);assert.equal(sha(upstreamBytes),'84d5fd2af84e2f125b740eeb05637785b2e8df26d34e41a2cd628697dae30513');
const upstream=JSON.parse(upstreamBytes);result.upstreamSha256=sha(upstreamBytes);
const additions=Object.fromEntries(before.seats.player.unsupported.map(n=>[n.toLowerCase(),upstream[n.toLowerCase()]]));
assert.equal(Object.keys(additions).length,44);assert(Object.values(additions).every(Boolean));
const schema=[];
for(const [key,record]of Object.entries(additions)){
 try{const count=e.load_card_database(JSON.stringify({plains:catalog.plains,[key]:record}));schema.push({name:record.name,loaded:count===2});}
 catch(error){schema.push({name:record.name,loaded:false,error:String(error.message||error)});}
}
result.cases.push({name:'44 absent angel definitions deserialize into existing runtime',passed:schema.filter(r=>r.loaded).length,failed:schema.filter(r=>!r.loaded),note:'Schema compatibility only; card behavior is not certified.'});
assert(schema.every(r=>r.loaded));
// Preserve original numeric tokens, including u64 values beyond JS safe integers.
// Never parse/stringify the full installed database for an engine reload.
const safeIntegers=v=>{if(typeof v==='number'&&Number.isInteger(v))assert(Number.isSafeInteger(v),'Unsafe integer in selected candidate record');if(v&&typeof v==='object')for(const x of Object.values(v))safeIntegers(x);};safeIntegers(additions);
const expandedRaw=installedRaw.trim().slice(0,-1)+','+JSON.stringify(additions).slice(1);
await writeFile(join(output,'expanded-data.sha256'),sha(expandedRaw)+'\n');
const expanded=JSON.parse(expandedRaw);assert.equal(e.load_card_database(expandedRaw),6181);
const after=evaluateMatchAdmission(e,ai,compiledCardSupport(expanded,'diagnostic-expansion'));
result.cases.push({name:'experimental Calling All Angels expansion',admitted:after.admitted,reasons:after.seats.player.reasons,note:'Only a local diagnostic. No production data, rules or guards were changed.'});
assert.equal(after.admitted,true);
const format=e.getFormatRegistry().find(f=>f.format==='Commander').default_config;
const init=e.initialize_game(ai.engineLists,7331,format,null,2,0);assert(Array.isArray(init.events));
const state=e.get_game_state().state;
result.cases.push({name:'exact Calling All Angels initialization',players:state.players.map(p=>({life:p.life,cardsInLibrary:p.library.length})),objects:Object.keys(state.objects).length,note:'Initialization only. No complete match or human/CPU mechanic coverage claimed.'});
const [{makeCpuObservation},{analyzeCpu},{cpuLegalCandidates},{createCpuPlaybook}]=await Promise.all(['cpu-public-observation.mjs','cpu-public-policy.mjs','cpu-legal-candidates.mjs','cpu-playbook.mjs'].map(p=>import(root+'experiments/phase-engine/'+p)));
const sourceNames=['cpu-public-observation.mjs','cpu-public-policy.mjs','cpu-legal-candidates.mjs','cpu-playbook.mjs','cpu-difficulty-config.mjs','visible-cpu-policy.mjs','match-input.mjs','compiled-card-support.mjs','real-deck-hotfix-audit.mjs'];
result.moduleSha256=Object.fromEntries(await Promise.all(sourceNames.map(async name=>[name,sha(await readFile(new URL(name,import.meta.url)))])));
const started=performance.now(),playbook=createCpuPlaybook(ai.engineLists.player),rng=[777,777];
const match={name:'experimental exact Angels Medium mirror',status:'NOT TESTED',seed:7331,accepted:0,decisionKinds:{},trace:[],note:'Bounded direct-policy diagnostic; no rendered UI, worker/account journey, or comprehensive mechanic certification.'};
try{
 for(let step=0;step<1000;step++){
  const s=e.get_game_state().state;match.turn=s.turn_number;
  if(s.waiting_for.type==='GameOver'){match.status='PASS';match.outcome=s.waiting_for;break;}
  if(performance.now()-started>120000){match.stopReason='120-second local diagnostic bound';break;}
  let offered=null;
  for(const actor of [0,1]){const legal=e.get_legal_actions_for_viewer_js(actor);if(legal.actions.length){offered={actor,legal,...cpuLegalCandidates(e,actor,legal.actions)};break;}}
  assert(offered,'NO_LEGAL_CANDIDATE');
  const {actor,legal,actions}=offered;
  const observation=makeCpuObservation(e.get_filtered_game_state(actor),actor,actions,{difficulty:'Medium',legal,playbook});
  const choice=analyzeCpu(observation,rng[actor]);rng[actor]=choice.rng;
  assert(actions[choice.index],'CPU_PROPOSAL_OUT_OF_RANGE');
  const applied=e.submit_action(actor,actions[choice.index]);assert.equal(applied.status,'applied',JSON.stringify(applied));
  match.trace.push({actor,decision:s.waiting_for.type,action:actions[choice.index]});
  match.accepted++;match.decisionKinds[s.waiting_for.type]=(match.decisionKinds[s.waiting_for.type]||0)+1;
  if(step%50===0)console.log(JSON.stringify({diagnosticProgress:match.accepted,turn:match.turn}));
 }
}catch(error){match.status='FAIL';match.error=String(error.stack||error);const failedState=e.get_game_state().state;match.waiting=failedState.waiting_for;match.sourceName=failedState.objects[match.waiting.data?.pending_cast?.card_id]?.name||null;await writeFile(join(output,'failure-state.json'),e.export_game_state_json());}
result.cases.push(match);
await writeFile(join(output,'report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,status:match.status,accepted:match.accepted,turn:match.turn,sourceName:match.sourceName,decision:match.waiting?.type}));if(match.status==='FAIL')process.exitCode=1;
