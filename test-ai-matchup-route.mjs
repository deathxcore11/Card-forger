import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanMatchupRequest,validateMatchupAnalysis } from './ai-matchup-core.js';
import { aiMatchupRoute } from './ai-matchup-route.js';
import { AiReviewLimits } from './ai-review-route.js';
const origin='https://site.test';
const card={id:'p0',name:'Test creature',qty:4,zone:'main',type:'Creature',text:'Haste',manaCost:'{R}',colors:['R'],legalities:{standard:'legal'},known:true};
const payload={version:1,game:'mtg',format:'Standard',mode:'bo1',question:'How about red?',player:{name:'Player',cards:[card]},opponent:{name:'Opponent',cards:[{...card,id:'o0'}],provenance:{kind:'import'}},candidates:[]};
const request=(body=payload,headers={},method='POST')=>new Request(origin+'/api/ai/matchup',{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
const scenario={title:'Illustrative',setup:'Assume a functional hand.',plan:'Develop a threat.',risk:'Removal.',lesson:'Keep a follow-up.',cardIds:['p0','o0']};
const analysis={summary:'This is conditional coaching.',outlook:'uncertain',confidence:'limited',assumptions:['Hypothetical draws.'],scenarios:[{...scenario,title:"On the play"},{...scenario,title:"On the draw"},{...scenario,title:"After disruption"}],coaching:[{title:'Keep resources',text:'Do not overcommit.',cardIds:['p0']}],recommendation:null,limitations:['Not a full rules engine.']};
const bytes=readFileSync(new URL('./rulebooks/mtg-rules-v1.json.gz',import.meta.url));
function env(){const data=new Map();const storage={transaction:async fn=>fn({get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v))})};const gate=new AiReviewLimits({storage},{AI_DAILY_LIMIT:20});return{OPENAI_API_KEY:'private-test-key',ASSETS:{fetch:async()=>new Response(bytes)},AI_REVIEW_LIMITS:{idFromName:n=>n,get:()=>({fetch:(u,i)=>gate.fetch(new Request(u,i))})}};}
let calls=0,last;const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');last=JSON.parse(init.body);return Response.json({status:'completed',model:'test',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(analysis)}]}]});};
assert.equal((await aiMatchupRoute(request(),{}, {fetcher})).status,503);assert.equal((await aiMatchupRoute(request(),{OPENAI_API_KEY:'x'},{fetcher})).status,503);assert.equal(calls,0);
assert.equal((await(await aiMatchupRoute(request(null,{},'GET'),env())).json()).beta,true);
for(const [req,status] of [[request(payload,{Origin:'https://evil.test'}),403],[request(payload,{'Content-Type':'text/plain'}),415],[request('{bad'),400],[request({...payload,game:'ptcg'}),400],[request(payload,{'Content-Length':'900000'}),413]])assert.equal((await aiMatchupRoute(req,env(),{fetcher})).status,status);
assert.equal(calls,0);
const oversizedCards=Array.from({length:12},(_,i)=>({...card,id:'long'+i,qty:1,text:'x'.repeat(9000)}));
assert.equal((await aiMatchupRoute(request({...payload,player:{name:'Huge text',cards:oversizedCards}}),env(),{fetcher})).status,413);assert.equal(calls,0,'aggregate context rejected before paid call');
const e=env();for(let i=0;i<3;i++){const res=await aiMatchupRoute(request(),e,{fetcher});assert.equal(res.status,200,await res.clone().text());const b=await res.json();assert.equal(b.kind,'illustrative');assert.equal(b.scenarios.length,3);assert.equal(b.scoreChanges,false);const client=validateMatchupAnalysis(b,cleanMatchupRequest(payload));assert.deepEqual(client.limitations,b.limitations);assert.equal(client.scenarios.length,3);assert.deepEqual(validateMatchupAnalysis(client,cleanMatchupRequest(payload)),client);assert.ok(!JSON.stringify(b).includes('private-test-key'));}
assert.equal((await aiMatchupRoute(request(),e,{fetcher})).status,429);assert.equal(calls,3);assert.equal(last.store,false);assert.equal(last.text.format.strict,true);assert.ok(JSON.parse(last.input).rules.length>0);assert.equal(last.max_output_tokens,6000);
assert.equal((await aiMatchupRoute(request(),{...env(),ASSETS:null},{fetcher})).status,503);assert.equal(calls,3,'missing rules does not consume a paid call');
for(const result of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}])assert.equal((await aiMatchupRoute(request(),env(),{fetcher:async()=>Response.json(result)})).status,502);
const billing=await aiMatchupRoute(request(),env(),{fetcher:async()=>Response.json({error:{code:'insufficient_quota',message:'secret raw upstream'}},{status:429})});assert.equal(billing.status,503);assert.equal((await billing.json()).code,'billing');
console.log('Magic Matchups route: origin, limits, bounded input, pinned rules, schema and provider failures passed.');

assert.deepEqual(last.text.format.schema.properties.scenarios.items.properties.cardIds.items.enum,['p0','o0']);
assert.deepEqual(last.text.format.schema.properties.recommendation,{type:'null'});
const badReferences={...analysis,scenarios:[{...scenario,title:'Bad reference',cardIds:['not-in-list']},...analysis.scenarios.slice(1)]};
const rejected=await aiMatchupRoute(request(),env(),{fetcher:async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(badReferences)}]}]})});
assert.equal(rejected.status,502);assert.match((await rejected.json()).message,/referenced a card outside/);
