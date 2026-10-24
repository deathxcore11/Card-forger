// UI lifecycle regression. The actual Ask controller/answer renderer runs with
// bounded DOM stubs; deck construction and provider behavior are covered by the
// shared pipeline and hosted actual-app tests. No model/network is used here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {esc} from './ui.js';

const source=readFileSync('ai-ask.js','utf8');
const controller=source.slice(source.indexOf('export async function ask('),source.indexOf('const SOURCE =')).replace('export async function','async function');
const closer=source.slice(source.indexOf('export function closeAsk('),source.indexOf('// Session memory only:')).replace('export function','function');
const renderer=source.slice(source.indexOf('const SOURCE ='));
const receipt={kind:'build',game:'mtg',ref:'exact-result',label:'Open deck',openOnComplete:true};
const reply={text:'Your complete deck is ready in the deck window.',source:'app',show:[],suggestions:[]};
const classes=()=>({add(){},remove(){}});
function harness({pending=receipt,result=reply,delayed=false}={}){
 let cancels=0,opened=0,closed=0,removed=0,release;
 const html=[],session={game:'mtg',history:[],controller:new AbortController(),input:{value:''},log:{querySelector(){return null;},scrollTop:0},node:{classList:classes(),close(){closed++;},remove(){removed++;}},tools:{reset(){},cancel(){cancels++;},pendingItem:()=>pending,preview:()=>'<button data-ask-show="exact-result">Open deck</button>'}};
 const context={state:session,esc,fetch,AbortController,GAME_NAME:{mtg:'Magic'},brandMark:()=>'',bubble:(kind,markup)=>{html.push({kind,markup});return {classList:classes(),remove(){},querySelector:()=>({textContent:''})};},runAskLoop:()=>delayed?new Promise(resolve=>{release=()=>resolve(result);}):Promise.resolve(result)};
 session.show=async item=>{
  assert.equal(session.busy,false,'completed handoff must not enter busy-close cancellation');
  assert.equal(context.state,null,'Ask closes before the shared sheet opens');
  assert.equal(session.controller.signal.aborted,true,'closed Ask has released its request lifetime');
  assert.equal(session.history.at(-1).content,result.text,'the receipt/history is retained before navigation');
  assert.equal(item.ref,receipt.ref,'handoff opens the exact app-registered result');
  opened++;
 };
 runInNewContext(closer+controller+renderer,context);
 return {context,session,html,get opened(){return opened;},get cancels(){return cancels;},get closed(){return closed;},get removed(){return removed;},release:()=>release()};
}

const completed=harness();await completed.context.ask('Build a Goblin Commander deck');
assert.equal(completed.opened,1);assert.equal(completed.closed,1);assert.equal(completed.removed,1);assert.equal(completed.cancels,0,'successful handoff must preserve the pending deck action');
assert.match(completed.html.find(x=>x.kind==='ai').markup,/Open deck/);assert.doesNotMatch(completed.html.find(x=>x.kind==='ai').markup,/deck-flow-result|flowSave|flowCard/);

// A model-authored navigation flag cannot manufacture an app-owned result.
const unexecuted=harness({pending:null,result:{...reply,text:'General answer',openOnComplete:true,show:[{...receipt}]}});
await unexecuted.context.ask('What does Goblin mean?');assert.equal(unexecuted.opened,0);assert.equal(unexecuted.closed,0);assert.equal(unexecuted.session.busy,false);

// Closing while construction is still pending keeps its existing cancellation
// behavior and never opens a late result over another screen.
const interrupted=harness({delayed:true}),work=interrupted.context.ask('Build a Goblin Commander deck');
assert.equal(interrupted.session.busy,true);interrupted.context.closeAsk();assert.equal(interrupted.cancels,1);interrupted.release();await work;assert.equal(interrupted.opened,0);
console.log('PASS: completed Ask stores its receipt then opens the exact shared deck sheet without cancellation; model flags cannot open a deck; interrupted/late builds stay cancelled.');
