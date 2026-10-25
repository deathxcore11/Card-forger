import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
import {bootAcceptance} from './acceptance-inputs.mjs';import {prepare,deck} from './mechanics-fixtures.mjs';
import {projectInteraction,interactionSubmission} from './interaction-surface.mjs';
import {createSeatController} from './seat-surface.mjs';
const {engine:e,provenance}=await bootAcceptance(['Forest','Scarecrow Guide','Ghalta, Primal Hunger','Ordinary Bear','Tapestry Warden']);
const f=prepare(e,deck('Forest','Scarecrow Guide','Ghalta, Primal Hunger','Ordinary Bear','Tapestry Warden'),deck('Forest'));
const [guide]=f.move('Scarecrow Guide',0,'Battlefield'),[ghalta]=f.move('Ghalta, Primal Hunger',0,'Hand');f.move('Ordinary Bear',0,'Battlefield');f.move('Tapestry Warden',0,'Battlefield');f.move('Forest',0,'Battlefield',4);f.restore();
const report={provenance,engineered:true,seed:12345,steps:[]};
const snapshot=label=>{const state=e.get_filtered_game_state(0).state,legal=e.get_legal_actions_for_viewer_js(0),raw=e.get_viewer_snapshot_js(0).viewerInteraction;report.steps.push({label,waiting:state.waiting_for,legal,raw,projected:projectInteraction(raw,0)});return report.steps.at(-1);};
const result=e.submit_action(0,{type:'CastSpell',data:{object_id:ghalta,card_id:ghalta,targets:[],payment_mode:{type:'Manual'}}});assert.equal(result.status,'applied');
let step=snapshot('manual cast');
const o=step.projected.opportunities.find(o=>o.choices.some(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(guide))));assert(o,'scarecrow payment opportunity');
const c=o.choices.find(c=>c.available&&c.surfaces.some(s=>s.type==='object'&&s.reference===String(guide)));assert.equal(e.submit_interaction_js(0,interactionSubmission({interactionId:o.interactionId,response:{type:'choose',data:{choiceId:c.id}}})).status,'applied');
step=snapshot('guide mana activation');
assert.equal(step.waiting.type,'ChooseManaColor');assert.equal(step.raw.canSubmit,true);assert.deepEqual(step.raw.authorizedSubmitters,[0]);assert.equal(step.projected.canSubmit,false);
const controller=createSeatController({engine:e,seat:0,epoch:'human-mana-fixture'}),surface=controller.read(2);
assert(surface.canAct);assert.equal(surface.choices.length,5);assert(surface.choices.some(c=>c.label==='Choose green mana'));
const token=surface.choices.find(c=>c.label==='Choose green mana').token;
let browserSubmitted=false;
if(process.env.CARDSTASHY_MANA_BROWSER==='1'){
 const {createServer}=await import('node:http'),{readFile}=await import('node:fs/promises'),{resolve,extname,sep}=await import('node:path'),{createRequire}=await import('node:module');
 const {chromium}=createRequire(import.meta.url)(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
 const root=process.cwd();let revision=2;
 const snapshot=()=>({status:{revision,terminal:null,surface:{...controller.read(revision),awaitingHuman:true,interaction:projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0)}},busy:false,error:null,selected:null,pending:null,clock:null});
 const html=`<!doctype html><link rel="stylesheet" href="/experiments/phase-engine/match-table.css"><div id="table"></div><script type="module">import {mountMatchTable} from '/experiments/phase-engine/match-table.mjs';let state=await(await fetch('/snapshot')).json();let table;const session={snapshot:()=>state,inspect(){},async choose(token){const r=await fetch('/choose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw Error(await r.text());state=await r.json();table.render(state);}};table=mountMatchTable(document.querySelector('#table'),{session});table.render(state);</script>`;
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('content-type','text/html');return res.end(html);}
  if(req.url==='/snapshot'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(snapshot()));}
  if(req.url==='/choose'&&req.method==='POST'){let bytes='';for await(const chunk of req){bytes+=chunk;if(bytes.length>8192)throw Error('request too large');}const value=JSON.parse(bytes),actions=e.get_legal_actions_for_viewer_js(0).actions,chosen=controller.select(actions,777,{choice:value.token,revision,actor:0});assert.equal(e.submit_action(0,actions[chosen.index]).status,'applied');revision++;browserSubmitted=true;res.setHeader('content-type','application/json');return res.end(JSON.stringify(snapshot()));}
  const path=resolve(root,'.'+req.url.split('?')[0]);assert(path.startsWith(root+sep));res.setHeader('content-type',extname(path)==='.css'?'text/css':'text/javascript');res.end(await readFile(path));
 }catch(error){res.statusCode=500;res.end(String(error));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CARDSTASHY_CHROMIUM_PATH||'/workspace/scratch/7779ccf725c5/inputs/browser/chromium',headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto('http://127.0.0.1:'+server.address().port);const button=page.getByRole('button',{name:'Choose green mana',exact:true});await button.click();await page.waitForSelector('#table[data-decision="ManaPayment"]');assert(browserSubmitted);report.browser={status:'PASS',version:await browser.version(),control:'Choose green mana',returnedTo:'ManaPayment',scope:'actual rendered production table + real engine/seat-controller endpoint; controlled session transport, not full app'};}finally{await browser.close();await new Promise(r=>server.close(r));}
}
if(!browserSubmitted){const selection=controller.select(step.legal.actions,777,{choice:token,revision:2,actor:0});assert.equal(e.submit_action(0,step.legal.actions[selection.index]).status,'applied');}

step=snapshot('green selected');assert.equal(step.waiting.type,'ManaPayment');
assert.throws(()=>controller.select(step.legal.actions,777,{choice:token,revision:2,actor:0}),/STALE_CHOICE/);
report.surface=surface;
for(let n=0;n<12&&e.get_game_state().state.waiting_for.type==='ManaPayment';n++){
 const p=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0);
 let selected;
 for(const code of ['spendPoolMana','tapLandForMana','passPriority']){
  const opportunity=p.opportunities.find(o=>o.choices.some(c=>c.available&&c.surfaces.some(s=>s.type==='action'&&s.code===code)));
  if(opportunity){selected={o:opportunity,c:opportunity.choices.find(c=>c.available&&c.surfaces.some(s=>s.type==='action'&&s.code===code))};break;}
 }
 assert(selected,'available pool/land payment capability required');
 assert.equal(e.submit_interaction_js(0,interactionSubmission({interactionId:selected.o.interactionId,response:{type:'choose',data:{choiceId:selected.c.id}}})).status,'applied');
 snapshot('continue payment '+n);
}
assert.equal(e.get_game_state().state.waiting_for.type,'Priority');assert.equal(e.get_game_state().state.objects[ghalta].zone,'Stack');
for(let n=0;n<4&&e.get_game_state().state.stack.length;n++){
 const player=e.get_game_state().state.waiting_for.data.player,pass=e.get_legal_actions_for_viewer_js(player).actions.find(a=>a.type==='PassPriority');assert(pass);assert.equal(e.submit_action(player,pass).status,'applied');
}
assert.equal(e.get_game_state().state.objects[ghalta].zone,'Battlefield');report.status='PASS';report.ghaltaResolved=true;


await mkdir('test-results/human-mana',{recursive:true});await writeFile('test-results/human-mana/probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,offeredManaChoices:surface.choices.map(c=>c.label),returnedTo:step.waiting.type,ghaltaResolved:report.ghaltaResolved}));
