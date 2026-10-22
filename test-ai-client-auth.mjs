// Actual client entry points, mocked sessions/transports only. No providers or user writes.
import assert from 'node:assert/strict';
import {aiFetch,configureAiAuth,invalidateAiAuth,AI_SIGN_IN_MESSAGE} from './ai-auth.js';
import {runAskLoop} from './ai-ask-loop.js';
import {aiReviewPanel,runAiReview,clearAiReviews} from './ai-review.js';
import {openRulesAsk,askRules,clearRulesConversations} from './ai-rules.js';
import {rulesFallback} from './ai-rules-route.js';
import {createMagicMatchups} from './magic-matchups-controller.js';
import {registerScanner} from './scancam.js';
import {S,blank} from './store.js';
class Fake {
 constructor(){this.isConnected=true;this.children=[];this.nodes=new Map();this.value='';this.innerHTML='';this.classList={toggle(){},add(){},remove(){}};}
 setAttribute(){} addEventListener(){} focus(){} close(){} remove(){} showModal(){}
 append(n){this.children.push(n);}
 querySelector(q){if(q==='[data-rules-pending]'||q==='.ask-empty')return null;if(!this.nodes.has(q))this.nodes.set(q,new Fake());return this.nodes.get(q);}
}
globalThis.document={body:{append(){}},createElement:()=>new Fake(),querySelector:()=>null,addEventListener(){}};
globalThis.location={href:'https://cardstashy.com/'};
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const analysis=()=>({summary:'Synthetic conditional coaching.',outlook:'uncertain',confidence:'limited',assumptions:['Assume usable mana.'],scenarios:['On the play','On the draw','After disruption'].map(title=>({title,setup:'A hypothetical opening.',plan:'Develop a threat carefully.',risk:'The opponent may interact.',lesson:'Retain a follow-up.',cardIds:['p0','o0']})),coaching:[{title:'Keep resources',text:'Do not overcommit.',cardIds:['p0']}],recommendation:null,limitations:['Not a rules simulation.']});
const card=name=>({name,type_line:'Creature',oracle_text:'Synthetic fixture.',mana_cost:'{R}',color_identity:['R'],legalities:{standard:'legal'}});
let token='',calls=[];
configureAiAuth(async()=>token);
const transport=async(path,init)=>{
 assert.equal(init.redirect,'error');assert.equal(init.method,'POST');assert(init.signal instanceof AbortSignal);
 assert.equal(new Headers(init.headers).get('Authorization'),token?'Bearer '+token:null);
 assert.equal(new Headers(init.headers).get('Content-Type'),'application/json');
 const body=JSON.parse(init.body);calls.push({path,body});
 if(token!=='mock-profile-session')return new Response('expired or absent',{status:401});
 if(path==='/api/ai/ask')return Response.json(body.mode==='rules'?{context:body,answer:rulesFallback(body,'Synthetic evidence is limited.')}: {answer:{text:'Synthetic answer',show:[],suggestions:[]}});
 if(path==='/api/ai/deck-review')return Response.json({headline:'Synthetic coaching',pilot:{lines:[]},pressure:{scenarios:[]},improve:[]});
 if(path==='/api/ai/matchup')return Response.json({analysis:analysis()});
 if(path==='/api/ai/identify-card')return Response.json({game:'mtg',readable:false,name:'',number:''});
 throw Error('Unexpected endpoint');
};
for(token of ['', 'mock-anonymous-session', 'mock-expired-session', 'mock-profile-session']){
 const signedIn=token==='mock-profile-session';
 calls=[];
 const ask=()=>runAskLoop({game:'mtg',items:[{type:'message',role:'user',content:'Explain this card'}],fetcher:transport});
 if(signedIn)assert.equal((await ask()).text,'Synthetic answer');else await assert.rejects(ask(),e=>e.message===AI_SIGN_IN_MESSAGE);
 clearRulesConversations();const node=openRulesAsk({game:'mtg',format:'Standard',fetcher:transport});await askRules('Explain the draw step');
 assert(node.querySelector('.rules-ai-log').children.some(n=>n.innerHTML.includes(signedIn?'Evidence is limited':'Sign in to your CardStashy')));
 const deck={id:'auth-'+token,name:'Fixture',format:'Standard',cards:[{name:'Player creature',qty:60}],side:[]};
 aiReviewPanel('mtg',deck,card,{heuristic:60,formatName:'Standard'});await runAiReview('mtg:'+deck.id,()=>{},transport);
 const review=aiReviewPanel('mtg',deck,card,{heuristic:60,formatName:'Standard'});assert.match(review,signedIn?/Open coaching/:/Sign in to your CardStashy/);
 const st={question:'',mode:'bo1',opponent:{name:'Opponent',format:'Standard',cards:[{name:'Opponent creature',qty:60}],provenance:{kind:'import',source:'Fixture'}},busy:false};
 const ctl=createMagicMatchups({getDeck:()=>deck,state:()=>st,lookup:card,resolveNames:async()=>{},capture:()=>1,current:()=>true,render(){},fetcher:transport});await ctl.analyze();if(signedIn){assert.equal(st.error,'');assert.equal(st.result.summary,'Synthetic conditional coaching.');}else assert.equal(st.error,AI_SIGN_IN_MESSAGE);
 // Exercise the real photo path, not ctx.identifyPhoto (which bypasses fetch).
 globalThis.Image=class{set src(v){this.naturalWidth=480;this.naturalHeight=672;queueMicrotask(()=>this.onload());}};
 document.createElement=tag=>tag==='canvas'?{getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,fixture'}:new Fake();
 globalThis.fetch=transport;S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';
 const A={};registerScanner({A,C:{},I:{},game:()=> 'mtg',render(){},toast(){},priceOf:()=>null,addMany:()=>assert.fail('No writes')});
 const q={game:'mtg',i:-1,qty:2,lang:'ja',finish:'',nameDraft:'Keep this draft'};S.ui.scan={confirm:q,cands:[],shot:'data:image/jpeg;base64,fixture'};
 await A.scanIdentifyAI();assert.match(q.aiMessage,signedIn?/clearer photo/:/Sign in to your CardStashy/);assert.equal(q.nameDraft,'Keep this draft');assert.equal(q.qty,2);assert.equal(q.aiBusy,false);
 assert.deepEqual(calls.map(c=>c.path),['/api/ai/ask','/api/ai/ask','/api/ai/deck-review','/api/ai/matchup','/api/ai/identify-card']);
}
let read=0,network=0;configureAiAuth(async()=>{read++;return 'mock';});
for(const path of ['https://evil.test/api/ai/ask','//evil.test/api/ai/ask','https://cardstashy.com/api/ai/ask','/api/ai/ask?next=evil','/api/lens','/api/ai/../ask'])await assert.rejects(aiFetch(path,{method:'POST'},()=>network++));
assert.equal(read,0);assert.equal(network,0);
const controller=new AbortController();let release;configureAiAuth(()=>new Promise(r=>release=r));const pending=aiFetch('/api/ai/ask',{method:'POST',signal:controller.signal},()=>network++);controller.abort();release('mock');await assert.rejects(pending,{name:'AbortError'});assert.equal(network,0);
configureAiAuth(async()=>{throw Error('Auth unavailable');});await aiFetch('/api/ai/ask',{method:'POST',headers:{Authorization:'stale'}},async(_p,o)=>{assert.equal(o.headers.get('Authorization'),null);return Response.json({});});

console.log('PASS: five actual AI callers with signed-out/anonymous/expired/signed-in mocked sessions; 401 feedback; draft/photo preservation; exact destination guard; refreshed token reads; cancellation during session lookup; no provider/user-data writes.');

// Reproduce delayed getSession across A->B and A->signed-out in each real client.
for(const next of ['account-B-token',''])for(const kind of ['ask','rules','review','matchup','photo']){
 let releaseToken,reads=0,sends=0,ctx;
 configureAiAuth(()=>{reads++;return new Promise(r=>releaseToken=r);});
 const fetcher=async()=>{sends++;throw Error('An old account payload must never be sent');};
 let run;
 if(kind==='ask')run=()=>runAskLoop({game:'mtg',items:[{type:'message',role:'user',content:'Explain my card'}],fetcher});
 if(kind==='rules'){clearRulesConversations();openRulesAsk({game:'mtg',format:'Standard',fetcher});run=()=>askRules('Explain this old-account card');}
 if(kind==='review'){clearAiReviews();const deck={id:'switch-review',cards:[{name:'Old private card',qty:4}]};aiReviewPanel('mtg',deck,card,{heuristic:60});run=()=>runAiReview('mtg:switch-review',()=>{},fetcher);}
 if(kind==='matchup'){
  const deck={id:'switch-match',format:'Standard',cards:[{name:'Old private card',qty:60}]};
  const st={question:'',mode:'bo1',opponent:{name:'Opponent',format:'Standard',cards:[{name:'Opponent creature',qty:60}],provenance:{kind:'import',source:'Fixture'}}};
  const ctl=createMagicMatchups({getDeck:()=>deck,state:()=>st,lookup:card,resolveNames:async()=>{},capture:()=>1,current:()=>true,render(){},fetcher});run=()=>ctl.analyze();
 }
 if(kind==='photo'){
  globalThis.fetch=fetcher;S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';
  ctx={A:{},C:{},I:{},game:()=> 'mtg',render(){},toast(){},priceOf:()=>null};registerScanner(ctx);
  S.ui.scan={confirm:{game:'mtg',i:-1,qty:1,finish:''},cands:[],shot:'data:image/jpeg;base64,old-private-photo'};run=()=>ctx.A.scanIdentifyAI();
 }
 const pending=Promise.resolve().then(run).catch(e=>{assert.equal(e.name,'AbortError');});
 for(let i=0;i<20&&!reads;i++)await new Promise(r=>setImmediate(r));assert.equal(reads,1);
 if(ctx)ctx.accountChanged();else invalidateAiAuth();
 releaseToken(next);await pending;assert.equal(sends,0,kind+' never sends A payload with B/guest session');
}
// Already in flight: identity switch aborts transport and fences late JSON results.
configureAiAuth(async()=> 'A-token');let delivered,fetchSignal;
const response=await aiFetch('/api/ai/ask',{method:'POST'},async(_p,init)=>{fetchSignal=init.signal;const r=Response.json({});r.json=()=>new Promise(resolve=>delivered=resolve);return r;});
const body=response.json();invalidateAiAuth();assert.equal(fetchSignal.aborted,true);delivered({answer:'A private response'});await assert.rejects(body,{name:'AbortError'});
// Same-account token rotation is not an identity change and remains usable.
let rotated='A-token';configureAiAuth(async()=>rotated);const seen=[];
for(const value of ['A-token','A-refreshed-token']){rotated=value;await aiFetch('/api/ai/ask',{method:'POST'},async(_p,o)=>{seen.push(o.headers.get('Authorization'));return Response.json({});});}
assert.deepEqual(seen,['Bearer A-token','Bearer A-refreshed-token']);
console.log('PASS: all five actual clients suppress delayed-session sends after account switch/sign-out; scanner lifecycle reproduction fixed; in-flight abort and late body fence; same-account refresh preserved.');
configureAiAuth(()=>new Promise(()=>{}));
const blocked=aiFetch('/api/ai/ask',{method:'POST'},()=>assert.fail('Cancelled session cannot send'));
invalidateAiAuth();await assert.rejects(blocked,{name:'AbortError'});
console.log('PASS: identity cancellation settles even when session lookup never returns.');
