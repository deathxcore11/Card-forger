// User-intent and recovery regression: production loop, tools, builder and UI
// renderer with synthetic catalogue/model responses. No paid provider is used.
import assert from 'node:assert/strict';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal} from './ai-build-contract.js';
import {runAskLoop,resumeBuildChoice} from './ai-ask-loop.js';
import {makeAskTools} from './ai-tools.js';
import {aiAskRoute} from './ai-ask-route.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {isDeckBuildRequest} from './ai-deck-goal.js';
import {cardKey} from './core.js';
import {ASK_BUILD_ARGS,ASK_BUILD_CARDS,SAI} from './tests/ai-deck-build-fixtures.mjs';
const u=content=>({type:'message',role:'user',content});
const a=content=>({type:'message',role:'assistant',content});
const call=(args,id='build')=>({type:'function_call',name:'build_deck',call_id:id,arguments:JSON.stringify(args)});
const args={...ASK_BUILD_ARGS,goal:'strongest',required_cards:[],excluded_cards:[],colors:[],candidate_cards:[],avoid_infinite:false};
const context=()=>{
 const cards=structuredClone(ASK_BUILD_CARDS),catalog=Object.fromEntries(cards.map(c=>[cardKey(c.name),c]));let opened=null;
 const x={S:{state:{collection:[],decks:[]},catalog,ui:{}},T:{game:()=> 'mtg'},meta:n=>catalog[cardKey(n)],resolve:async n=>catalog[cardKey(n)],cacheCard:c=>(catalog[cardKey(c.name)]=c),inv:()=>({owned:0,available:0}),api:async p=>({data:new URL(p,'https://fixture.invalid').searchParams.get('q').includes('is:commander')?[SAI]:cards}),openMtgDraft:d=>{opened=d;}};
 return {x,tools:makeAskTools(x),get opened(){return opened;}};
};

// Real provider arguments captured on the configured review preview, 2026-10-19.
// Replaying them is deterministic; this test makes no paid provider call.
const recordedGoblin={game:'mtg',style:'aggressive',budget:0,format:'',seed:'Goblin',commander:'',budget_basis:'total',goal:'strongest',required_cards:['Goblin'],excluded_cards:[],colors:['R'],avoid_infinite:false,candidate_cards:['Goblin Chieftain','Goblin Guide','Goblin Piledriver','Goblin Warchief','Siege-Gang Commander']};
const recordedPrompt='can you make a red deck using a goblin Commander',recordedContract=readBuildContract([u(recordedPrompt)]);
const normalizedGoblin=applyUserBuildIntent(recordedGoblin,recordedContract);
assert.equal(normalizedGoblin.format,'Commander');assert.equal(normalizedGoblin.seed,'');assert.deepEqual(normalizedGoblin.required_cards,[]);assert.match(normalizedGoblin.style,/goblin/);assert.equal(validateBuildProposal(normalizedGoblin,recordedContract).ok,true);
let replayCalls=0,replayBuilds=0;
const replay=await runAskLoop({game:'mtg',items:[u(recordedPrompt)],fetcher:async()=>{replayCalls++;return Response.json({calls:[call(recordedGoblin)]});},tools:{build_deck:async p=>{replayBuilds++;assert.deepEqual(p,normalizedGoblin);return {terminal:true,note:'Existing builder reached.'};}}});
assert.equal(replayCalls,1);assert.equal(replayBuilds,1);assert.match(replay.text,/Existing builder reached/);
const genericContract=readBuildContract([u('Build me a mono-red deck for $50')]);
const automatic=applyUserBuildIntent({...recordedGoblin,seed:'Rotated Fixture',required_cards:['Rotated Fixture'],budget:900},genericContract);assert.equal(automatic.seed,'');assert.deepEqual(automatic.required_cards,[]);assert.equal(automatic.budget,50);assert.ok(automatic.candidate_cards.includes('Rotated Fixture'));
for(const name of ['Goblin','Goblin Guide','Angel of Destiny']){
 const exact=readBuildContract([u(`Build a red Commander deck; include "${name}"`)]),p=applyUserBuildIntent({...recordedGoblin,seed:name,required_cards:[name]},exact);assert.equal(p.seed,name);assert.ok(p.required_cards.includes(name));
}
const unquoted=readBuildContract([u('Build a mono-red deck around Lightning Bolt')]);assert.equal(unquoted.autoSelectSeed,false);assert.equal(applyUserBuildIntent({...recordedGoblin,seed:'Lightning Bolt',required_cards:['Lightning Bolt']},unquoted).seed,'Lightning Bolt');
const continued=readBuildContract([u('Build me a mono-red deck for $50'),u('idk pick a random one that would be fun and easy to play')]);assert.equal(continued.autoSelectSeed,true);assert.equal(continued.budget,50);assert.deepEqual(applyUserBuildIntent({...recordedGoblin,required_cards:['Rotated Fixture']},continued).required_cards,[]);
const protectedFollowup=readBuildContract([u('Build me a mono-red deck for $50'),u('Build around Lightning Bolt')]);assert.equal(protectedFollowup.autoSelectSeed,false);
for(const followup of ['Use Lightning Bolt','Keep Lightning Bolt','With Lightning Bolt','I want Lightning Bolt in it','Make it use Lightning Bolt','稲妻']){const c=readBuildContract([u('Build me a mono-red deck for $50'),u(followup)]);assert.equal(c.autoSelectSeed,false,followup);const p=applyUserBuildIntent({...recordedGoblin,seed:'Lightning Bolt',required_cards:['Lightning Bolt']},c);assert.equal(p.seed,'Lightning Bolt');assert.ok(p.required_cards.includes('Lightning Bolt'));}
console.log('PASS: captured real Goblin proposal restores the player theme and format in one model round; generic choices cannot invent required identities; quoted and unquoted named cards remain required.');
for(const [style,wantTribe] of [['mono-red aggressive beginner-friendly easy to play',false],['goblin aggressive',true]]){
 const queries=[];await prepareMtgDeck({...args,style,format:'Standard',seed:'',commander:'',colors:['R'],required_cards:[]},{api:async p=>{queries.push(new URL(p,'https://fixture.invalid').searchParams.get('q'));return {data:[]};}});
 assert.ok(queries[0].includes('f:standard'));assert.ok(queries[0].includes('id=r'));assert.doesNotMatch(queries[0],/aggressive|aggro|beginner|friendly|easy|play/);assert.equal(/t:goblin/.test(queries[0]),wantTribe);
}
// Search transport failure must not erase a separately resolved, theme-matching
// legal candidate, or present network failure as evidence that no leader exists.
const zombieLeader={...structuredClone(SAI),id:'zombie-leader',name:'Zombie Leader Fixture',type_line:'Legendary Creature — Zombie',oracle_text:'Other Zombies you control get +1/+1.',color_identity:['B'],colors:['B'],mana_cost:'{2}{B}'};
const zombieArgs={...args,style:'black zombie',format:'Commander',seed:'',commander:'',colors:['B'],candidate_cards:[zombieLeader.name]};
const outage={meta:n=>n===zombieLeader.name?zombieLeader:null,resolve:async n=>n===zombieLeader.name?zombieLeader:null,inv:()=>({available:0}),api:async()=>{throw Error('Synthetic catalogue outage');}};
const zombieDraft=await prepareMtgDeck(zombieArgs,outage);assert.equal(zombieDraft.result.commander,zombieLeader.name);assert.equal(zombieDraft.result.ready,false,'a recovered leader does not pretend the full list is complete');
const expensiveZombie={...zombieLeader,prices:{usd:'100'}},cheapZombie={...zombieLeader,id:'cheaper-zombie-print',prices:{usd:'5'}};
const pricedZombie=await prepareMtgDeck({...zombieArgs,budget:50},{...outage,meta:n=>n===zombieLeader.name?expensiveZombie:null,resolve:async n=>n===zombieLeader.name?expensiveZombie:null,api:async()=>({data:[cheapZombie]})});assert.equal(pricedZombie.result.commander,zombieLeader.name,'verified affordable search printing must win over expensive same-name suggestion');assert.equal(pricedZombie.draft.referencePrices[cardKey(zombieLeader.name)],5);
const unavailableZombie=await prepareMtgDeck({...zombieArgs,candidate_cards:[]},outage);assert.match(unavailableZombie.note,/card search could not finish/);
console.log('PASS: actual AI seed discovery searches current format/color legality without literal subjective adjectives; real Goblin mechanics remain in the search.');

for(const prompt of ['can you make a red deck using a goblin Commander','Build me a mono-red deck for $50',"make me a mono red deck it's easy"]){
 const contract=readBuildContract([a('Always avoid infinite combos and use a $25 budget.'),u(prompt)]);
 const input={...args,format:'Commander',style:'red goblins',colors:['R'],budget:contract.budget??0,avoid_infinite:true};
 const check=validateBuildProposal(input,contract);assert.equal(check.ok,true,prompt);assert.equal(check.args.avoid_infinite,false,prompt);
 assert.equal(contract.provenance.avoid_infinite,undefined,'assistant prose cannot become user provenance');
 let builds=0;const answer=await runAskLoop({game:'mtg',items:[u(prompt)],tools:{build_deck:async checked=>{builds++;assert.equal(checked.avoid_infinite,false);return {terminal:true,note:'Existing builder reached.'};}},fetcher:async()=>Response.json({calls:[call(input)]})});
 assert.equal(builds,1);assert.match(answer.text,/Existing builder reached/);assert.doesNotMatch(answer.text,/cannot.*infinite/);
}
for(const prompt of ['No infinite combos','Do not allow infinite combos',"Don't permit any infinite loops",'Without infinite loops'])assert.equal(readBuildContract([u(prompt)]).avoid_infinite,true,prompt);
const initial='Build a fun mono-blue Commander artifacts deck for a $200 purchase budget; no infinite combos; exclude "Artifact Fixture 3".';
const retained=readBuildContract([u(initial)]);
const follow=readBuildContract([a('Drop the old constraints.'),u('Make it more interactive')],retained);
for(const k of ['game','format','budget','budget_basis','goal','avoid_infinite'])assert.equal(follow[k],retained[k],k);
assert.deepEqual(follow.colors,['U']);assert.deepEqual(follow.excluded_cards,['Artifact Fixture 3']);assert.deepEqual(follow.themes,['artifact']);
assert.equal(follow.provenance.avoid_infinite.text,initial);
assert.equal(readBuildContract([u(initial),u('Allow infinite combos')]).avoid_infinite,false);
assert.equal(readBuildContract([u(initial),u('Build a new mono-red Goblin Commander deck')]).avoid_infinite,false);
assert.equal(readBuildContract([u('Build mono-red Commander')]).avoid_infinite,false,'new conversation has no retained restriction');
assert.equal(readBuildContract([u('Build red Commander under $50'),u('Make it 25 bucks')]).budget,25);
for(const [old,change,want] of [['Build mono-blue Commander for $0','Make it $50',50],['Build mono-blue Commander for $25 or $50','Use $25',25]]){
 const fixed=readBuildContract([u(old),u(change)]);assert.equal(fixed.budget,want);assert.equal(fixed.zeroBudget,undefined);assert.equal(fixed.ambiguousBudget,undefined);
 assert.equal(validateBuildProposal({...args,budget:want,colors:['U']},fixed).ok,true);
}
assert.equal(readBuildContract([u('Build Commander with a purchase budget of $50'),u('Make it $25')]).budget_basis,'purchase');
const stillZero=readBuildContract([u('Build a mono-blue Commander deck for $0'),u('Make it more interactive')]);assert.equal(stillZero.zeroBudget,true);assert.equal(validateBuildProposal({...args,budget:0,colors:['U']},stillZero).requiresChoice,true,'unrelated follow-up cannot turn $0 into unlimited');
console.log('PASS: exact user prompts reach the builder without invented combo restrictions; real negated restrictions, game/format/theme/budget/basis/exclusions and provenance survive follow-ups; corrected budgets recover.');

let c=context(),savedContext=null,provider=0;
const update=v=>{savedContext=v;};
const restricted=await runAskLoop({game:'mtg',items:[u('Build an artifacts Commander deck under $200 with no infinite combos')],tools:c.tools,onBuildContext:update,fetcher:async()=>{provider++;return Response.json({calls:[call({...args,avoid_infinite:false})]});}});
assert.equal(provider,1);assert.match(restricted.text,/You asked for no infinite combos/);assert.deepEqual(restricted.choices.map(v=>v.id),['unverified','revise','cancel']);
assert.equal(savedContext.args.avoid_infinite,true,'model false cannot delete the user restriction');assert.equal(c.tools.pendingItem(),null);assert.equal(c.opened,null);
const oldContract=structuredClone(savedContext.contract);
const revise=await resumeBuildChoice({choice:'revise',context:savedContext,tools:c.tools,onBuildContext:update});assert.match(revise.text,/stays in place/);assert.deepEqual(savedContext.contract,oldContract);
const unverified=await resumeBuildChoice({choice:'unverified',context:savedContext,tools:c.tools,onBuildContext:update});
assert.match(unverified.text,/Unverified draft: 100\/100/);assert.match(unverified.text,/Infinite combos have not been verified/);assert.equal(provider,1,'continuation uses existing app tools without another model invocation');
assert.equal(savedContext.args.avoid_infinite,true);assert.equal(c.x.S.state.decks.length,0);assert.equal(c.opened,null);
await c.tools.open(c.tools.pendingItem());assert.equal(c.opened.total,100);assert.deepEqual(c.opened.unverifiedConstraints,['infinite_combos']);assert.equal(c.opened.legalChecked,true);assert.match(c.opened.warnings.join(' '),/do not prove the absence of all loops/);
const {S,blank}=await import('./store.js'),{buildSheet}=await import('./views.js');const before={state:S.state,catalog:S.catalog,build:S.ui.build};
try{S.state=blank();S.catalog=c.x.S.catalog;S.ui.build={seed:c.opened.buildAround,format:'Commander',results:{Commander:[c.opened]},openTier:0,avail:()=>0};const html=buildSheet();assert.match(html,/Needs review/);assert.match(html,/Save draft/);assert.match(html,/Unverified restriction/);assert.match(html,/power unavailable/);assert.doesNotMatch(html,/>Legality checked</);}finally{S.state=before.state;S.catalog=before.catalog;S.ui.build=before.build;}
const denied=await resumeBuildChoice({choice:'unverified',context:{...savedContext,choices:[]},tools:c.tools});assert.match(denied.text,/expired/);
console.log('PASS: genuine combo restriction offers functioning app-owned choices, explicit consent resumes the same exact request once, full unverified draft is disclosed, preview/save remain human actions, and no extra model call is needed.');

c=context();savedContext=null;const format=await runAskLoop({game:'mtg',items:[u('Build me a mono-red deck for $50')],onBuildContext:update,tools:c.tools,fetcher:async()=>Response.json({calls:[call({...args,style:'red',colors:['R'],budget:50,format:'Standard',seed:'',commander:'',avoid_infinite:true})]})});
assert.ok(format.choices.some(v=>v.id==='format:Commander'));assert.equal(savedContext.args.format,'','model-selected format is not user choice');assert.equal(savedContext.args.budget,50);
// A budget choice is made before any card lookup; its amount is retained when
// the player next chooses the actual supported format.
savedContext=null;const cheapPrompt="make me a fun Yu-Gi-Oh deck that doesn't cost that much is good for beginners";
let toolCalls=0;
const affordable=await runAskLoop({game:'ygo',items:[u(cheapPrompt)],tools:{build_deck:async v=>{toolCalls++;return {requiresChoice:true,formats:[{id:'tcg',name:'Advanced (TCG)'}],note:'Choose a format.'};}},onBuildContext:update,fetcher:async()=>Response.json({calls:[call({...args,game:'ygo',style:'fun beginner',goal:'fun',budget:25,format:'Advanced (TCG)',seed:'',commander:'',avoid_infinite:true})]})});
assert.equal(toolCalls,0);assert.match(affordable.text,/What spending limit/);assert.doesNotMatch(affordable.text,/budget 0|Correct only|repeated the same lookup/);assert.ok(affordable.choices.some(v=>v.id==='budget:50'));
await resumeBuildChoice({choice:'budget:50',context:savedContext,tools:{build_deck:async v=>{toolCalls++;assert.equal(v.budget,50);assert.equal(v.game,'ygo');assert.equal(v.avoid_infinite,false);return {requiresChoice:true,formats:[{id:'tcg',name:'Advanced (TCG)'}],note:'Choose a format.'};}},onBuildContext:update});
assert.equal(toolCalls,1);assert.equal(savedContext.contract.budget,50);assert.equal(savedContext.contract.provenance.budget.source,'user-choice');assert.equal(savedContext.contract.budgetUnspecified,undefined);assert.ok(savedContext.choices.some(v=>v.id==='format:Advanced (TCG)'));
const cancelled=await resumeBuildChoice({choice:'cancel',context:savedContext,tools:c.tools,onBuildContext:update});assert.match(cancelled.text,/cancelled/);assert.equal(savedContext,null);
let forbidden=0;const stop=await runAskLoop({game:'mtg',items:[u(initial),u('Cancel this build')],tools:{cancel:()=>{}},fetcher:async()=>{forbidden++;throw Error('unexpected provider');}});assert.match(stop.text,/cancelled/);assert.equal(forbidden,0);assert.equal(readBuildContract([u(initial),u('Cancel this build'),u('Make it red')]).avoid_infinite,false);
console.log('PASS: missing formats and invented numeric budgets become bounded user choices, exact $50 and all other constraints survive, cancellation costs no model call and clears the prior restriction.');

// Pokémon's exact named seed and fun/theme preference already fit the existing
// builder. Required_cards containing that same seed must not be a blanket refusal.
let tcgOpened=null;
const charizard={id:'charizard-ex-fixture',name:'Charizard ex',game:'ptcg',types:['Fire'],category:'Pokemon'};
const tcgContext={S:{state:{collection:[],decks:[]},ui:{}},T:{game:()=> 'ptcg',SOURCES:{ptcg:{formats:[{id:'standard',name:'Standard'}],byName:async n=>cardKey(n)===cardKey(charizard.name)?charizard:null,search:async()=>({cards:[]})}}},openTcgBuild:(...v)=>{tcgOpened=v;}};
const tcgTools=makeAskTools(tcgContext);
for(const goal of ['fun','theme']){
 const out=await tcgTools.build_deck({game:'ptcg',format:'Standard',seed:'Charizard ex',required_cards:['Charizard ex'],goal,style:'Fire beginner',budget:50});
 assert.equal(out.reviewAvailable,true);assert.equal(out.seed,'Charizard ex');assert.equal(out.complete,false);assert.equal(out.goal,goal);assert.match(out.note,/not a verified playability/);await tcgTools.open(tcgTools.pendingItem());assert.deepEqual(tcgOpened.slice(0,4),['ptcg',charizard.id,50,'standard']);
}
// A name lookup can return a rotated printing. Resolve a same-name legal printing
// using the chosen format, then hydrate the search hit before offering the action.
let searched=0;
const oldCharizard={...charizard,id:'rotated-charizard',legal:false},legalCharizard={...charizard,id:'legal-charizard',legal:true};
const ps=tcgContext.T.SOURCES.ptcg;
Object.assign(ps,{byName:async()=>oldCharizard,legality:c=>c.legal===false?'not_legal':c.legal===true?'legal':'unknown',limit:()=>4,get:async id=>id===legalCharizard.id?legalCharizard:oldCharizard,search:async spec=>{searched++;assert.equal(spec.format,'standard');assert.equal(spec.exactName,true);return {cards:[{id:legalCharizard.id,name:charizard.name}]};}});
let compatible=await tcgTools.build_deck({game:'ptcg',format:'Standard',seed:'Charizard ex',required_cards:['Charizard ex'],goal:'fun',budget:50});assert.equal(compatible.reviewAvailable,true);await tcgTools.open(tcgTools.pendingItem());assert.equal(tcgOpened[1],legalCharizard.id);assert.equal(searched,1);
ps.get=async()=>oldCharizard;tcgTools.reset();compatible=await tcgTools.build_deck({game:'ptcg',format:'Standard',seed:'Charizard ex',required_cards:['Charizard ex'],budget:50});assert.equal(compatible.reviewAvailable,undefined);assert.match(compatible.note,/Standard-compatible printing/);assert.equal(tcgTools.pendingItem(),null);
const extra=await tcgTools.build_deck({game:'ptcg',format:'Standard',seed:'Charizard ex',required_cards:['Other ex'],goal:'theme',budget:50});assert.equal(extra.requiresChoice,true);assert.match(extra.note,/multiple required cards/);
assert.equal(tcgContext.S.state.decks.length,0);assert.equal(tcgContext.S.state.collection.length,0);
console.log('PASS: Charizard ex fun/theme requests use the exact existing Pokémon builder, matching seed requirement is retained, unsupported extra requirements stay explicit, budget remains exact and nothing autosaves.');

// Game-format choices come from actual adapters, including typed follow-ups.
const {PTCG_FORMATS}=await import('./ptcg.js'),{YGO_FORMATS}=await import('./ygo.js');
const formatTools=makeAskTools({S:{state:{},ui:{}},T:{game:()=> 'ptcg',SOURCES:{ptcg:{formats:PTCG_FORMATS},ygo:{formats:YGO_FORMATS}}}});
for(const [game,formats,next,labels,wrong] of [['ptcg',PTCG_FORMATS,'Expanded',['Standard','Expanded','Unlimited'],/Commander|Modern/],['ygo',YGO_FORMATS,'OCG',['Advanced (TCG)','Traditional (TCG)','OCG'],/Commander|Modern|Pokémon/]]){
 let ctx=null,received;
 const bridge={buildFormats:formatTools.buildFormats,build_deck:async a=>{received=a;return a.format?{game,terminal:true,note:'Existing builder '+a.format}:{game,requiresChoice:true,formats,note:'Choose a format.'};}};
 const prompt='Build me a deck';const initialAnswer=await runAskLoop({game,items:[u(prompt)],tools:bridge,onBuildContext:v=>ctx=v,fetcher:async()=>Response.json({calls:[call({...args,game,format:'Commander',budget:0,seed:'',commander:''})]})});
 assert.deepEqual(initialAnswer.choices.filter(c=>c.id.startsWith('format:')).map(c=>c.label),labels);
 const guidance=await resumeBuildChoice({choice:'revise',context:ctx,tools:bridge,onBuildContext:v=>ctx=v});assert.ok(guidance.choices.some(c=>c.id==='format:'+next));const clicked=await resumeBuildChoice({choice:'format:'+next,context:ctx,tools:bridge});assert.match(clicked.text,new RegExp('Existing builder '+next));assert.doesNotMatch(guidance.text,wrong);for(const label of labels)assert.ok(guidance.text.includes(label));
 const typed=await runAskLoop({game,items:[u(prompt),u(next)],buildContext:ctx,tools:bridge,fetcher:async()=>Response.json({calls:[call({...args,game,format:'Commander',budget:0,seed:'',commander:''})]})});assert.equal(received.format,next);assert.equal(received.game,game);assert.match(typed.text,new RegExp('Existing builder '+next));
}
for(const [game,format] of [['ptcg','Expanded'],['ygo','OCG'],['ygo','Advanced (TCG)'],['ygo','Traditional (TCG)']]){
 const options={game,formats:formatTools.buildFormats()},direct=readBuildContract([u('Build a deck in '+format)],null,options),history=readBuildContract([u('Build a deck in '+format+' for $50'),u('Make it easy')],null,options);
 assert.equal(direct.format,format);assert.equal(history.format,format);assert.equal(history.budget,50);
}
const formatOptions={game:'ptcg',formats:formatTools.buildFormats()},cappedPokemon=readBuildContract([u('Build a Pokémon Standard deck for $50')],null,formatOptions);
const unlimitedFormat=readBuildContract([u('Unlimited')],cappedPokemon,formatOptions);assert.equal(unlimitedFormat.format,'Unlimited');assert.equal(unlimitedFormat.budget,50,'Unlimited format does not mean unlimited spending');
const noCapPokemon=readBuildContract([u('Use an unlimited budget')],cappedPokemon,formatOptions);assert.equal(noCapPokemon.format,'Standard');assert.equal(noCapPokemon.budget,0);
console.log('PASS: actual Pokémon/YGO adapter formats drive buttons, revision guidance and typed follow-ups without Magic format leakage.');

// Exercise the real Worker route with a mocked provider boundary: direct deck
// requests must request build_deck, while information questions remain tools.
for(const prompt of ['can you make a red deck using a goblin Commander','Build me a mono-red deck for $50',"make me a fun Yu-Gi-Oh deck that doesn't cost that much is good for beginners",'make me a deck that stars Charizard ex']){
 assert.equal(isDeckBuildRequest(prompt),true);let payload;
 const origin='https://fixture.invalid',response=await aiAskRoute(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'mtg',items:[u(prompt)]})}),{OPENAI_API_KEY:'mock-only',AI_LIMITS_ENABLED:'false'},{fetcher:async(_,init)=>{payload=JSON.parse(init.body);return Response.json({output:[call(args)]});}});
 assert.equal(response.status,200);assert.equal(payload.tool_choice,'required');assert.deepEqual(payload.tools.map(t=>t.name).sort(),['build_deck','deck_context','game_concepts','wiki_lookup']);assert.equal(payload.parallel_tool_calls,false);assert.match(payload.instructions,/avoid_infinite true only/);
}
assert.equal(isDeckBuildRequest('How do I build a deck?'),false);assert.equal(isDeckBuildRequest("What's the newest Magic set?"),false);
const fabricated=await runAskLoop({game:'mtg',items:[u('Build a red Commander deck')],tools:{},fetcher:async()=>Response.json({answer:{text:'Your complete deck is ready and already saved!',source:'app'}})});assert.match(fabricated.text,/No deck was prepared/);assert.doesNotMatch(fabricated.text,/already saved/);
console.log('PASS: actual Worker route requests the existing builder for direct deck requests; how-to/informational prompts remain separate, and an unexecuted model success cannot become a built-deck claim.');

