// Actual Ask relay/client tool orchestration; transport and card data are
// explicit fixtures. This does not prove live MTG Wiki or model availability.
import assert from 'node:assert/strict';
import {aiAskRoute} from './ai-ask-route.js';
import {runAskLoop} from './ai-ask-loop.js';
import {makeAskTools} from './ai-tools.js';
import {readMtgWikiReference,readMtgWikiDaily} from './mtg-wiki-client.js';
import {cardKey} from './core.js';
const u=content=>({type:'message',role:'user',content});
const origin='https://fixture.invalid',env={OPENAI_API_KEY:'mock-only',AI_LIMITS_ENABLED:'false'};
const call=(name,args,id)=>({type:'function_call',name,call_id:id,arguments:JSON.stringify(args)});
const source={title:'Bloodlust',url:'https://mtg.wiki/page/Bloodlust',authority:'community-reference'};
const prompt='Build a mono-black Vampire Bloodlust Commander deck under $100';
const lookup=call('wiki_lookup',{game:'mtg',query:'Bloodlust'},'wiki');
let payload;
const relay=async(items,output)=>{
 const response=await aiAskRoute(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'mtg',items})}),env,{fetcher:async(_,init)=>{payload=JSON.parse(init.body);return Response.json({output});}});
 assert.equal(response.status,200);return response.json();
};
await relay([u(prompt)],[lookup]);
assert.equal(payload.tool_choice,'required');
assert.deepEqual(payload.tools.map(t=>t.name).sort(),['build_deck','game_concepts','wiki_lookup']);
assert.equal(payload.parallel_tool_calls,false);
assert(payload.instructions.includes('Bloodlust')&&payload.instructions.includes('community explanations'));
await relay([u(prompt),lookup,{type:'function_call_output',call_id:'wiki',output:JSON.stringify({status:'unavailable',extract:'',source})}],[call('build_deck',{},'build')]);
assert.deepEqual(payload.tool_choice,{type:'function',name:'build_deck'},'a reference round must proceed to app construction');
assert.match(payload.instructions,/unavailable or not-found results supply no new facts/);

const catalogue={};let referenceCalls=0;
const tools=makeAskTools({S:{state:{collection:[],decks:[]},catalog:catalogue},T:{game:()=> 'mtg'},meta:name=>catalogue[cardKey(name)],readMtgWikiReference:async(topic,options)=>{referenceCalls++;assert.equal(topic,'Bloodlust');return {status:'available',extract:'An informal growth mechanic.',source,results:[{source,extract:'An informal growth mechanic.'}]};}});
const local=await tools.game_concepts({game:'mtg',query:'Bloodlust'});
assert.equal(local.concepts[0].id,'bloodlust');assert.equal(local.concepts[0].sourceAuthority,'community-reference');
assert.equal(local.concepts[0].builderCoverage.status,'modeled');
assert.equal((await tools.game_concepts({game:'ygo',query:'Bloodlust'})).concepts.length,0);
assert.equal((await tools.wiki_lookup({game:'ygo',query:'Bloodlust'})).reason,'public-topic-required');
assert.equal(referenceCalls,0);
const refused=await tools.wiki_lookup({game:'mtg',query:'private account password'}, {userRequest:prompt});
assert.equal(refused.reason,'public-topic-required');assert.equal(referenceCalls,0);
const reference=await tools.wiki_lookup({game:'mtg',query:'Bloodlust'},{userRequest:prompt});
assert.equal(reference.status,'available');assert.equal(referenceCalls,1);
assert.equal(reference.source.authority,'community-reference');

// Even when a model uses a reference, the authoritative original mechanic,
// type, color and cap survive a deliberately simplified build proposal.
let rounds=0,builds=0;
const answer=await runAskLoop({game:'mtg',items:[u(prompt)],tools:{...tools,build_deck:async args=>{
 builds++;assert.equal(args.budget,100);assert.deepEqual(args.colors,['B']);assert.match(args.style,/bloodlust/i);assert.match(args.style,/vampire/i);
 return {terminal:true,ready:false,note:'Fixture result: the app has not established a complete plan.'};
}},fetcher:async()=>Response.json({calls:[++rounds===1?lookup:call('build_deck',{game:'mtg',format:'Commander',style:'Vampires',budget:100,colors:[]},'build')]})});
assert.equal(builds,1);assert.match(answer.text,/not established/);

// Public reference requests use their own literal endpoint and no account data.
for(const daily of [false,true]){
 let sent;
 const fetcher=async(path,init)=>{sent={path,...init};return Response.json({status:'unavailable',extract:'',source,httpStatus:403});};
 const result=daily?await readMtgWikiDaily({fetcher}):await readMtgWikiReference('Bloodlust',{fetcher});
 assert.equal(result.status,'unavailable');assert.equal(sent.path,'/api/reference/mtg-wiki');assert.equal(sent.credentials,'omit');assert.equal(sent.redirect,'error');
 assert.deepEqual(JSON.parse(sent.body),daily?{daily:true}:{title:'Bloodlust'});
 assert.deepEqual(Object.keys(sent.headers),['Content-Type']);assert(sent.signal instanceof AbortSignal);
}
console.log('PASS: one bounded online Magic reference preparation precedes forced app construction; source authority, unavailable status, hard requests and public-topic-only credential-free transport remain separate.');
