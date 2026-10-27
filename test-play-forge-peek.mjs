// The opening-hand preview: a click pins it, a second click on the same card closes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./experiments/forge-proof/forge-table.mjs',import.meta.url),'utf8');
const part=re=>{const m=src.match(re);assert(m,'forge-table.mjs changed shape: '+re);return m[0];};
const handlers=[/\n const surfaceCard=.*/,/\n function showPeek\(el,pinned=false\)\{[\s\S]*?\n \}/,/\n function hidePeek\(\)\{.*/,/\n const peekCard=.*/,/\n const over=.*/,/\n const LISTED_INPUTS=.*/,/\n const previewOnly=\(card,snapshot\)=>\{[\s\S]*?\n \};/,/\n const click=e=>\{[\s\S]*?\n \};/].map(part).join('');
function table(native={inputType:'InputConfirmMulligan',prompt:null},{busy=false}={}){
 const timers=[],peek={id:'forge-peek-test',dataset:{open:'false'}},acted=[];
 const snapshot={busy,native,status:{surface:{cards:[{id:1,known:true,name:'Forest'},{id:2,known:true,name:'Island'}]}}};
 const deps={root:{contains:()=>true},peek,session:{snapshot:()=>snapshot,nativeSelect:(kind,id)=>acted.push([kind,id])},act(fn){if(native.inputType==='InputConfirmMulligan')throw Error('the opening hand selects nothing');fn();},openZone(){},drag:null,keywordReference:null,loadKeywordReference:()=>new Promise(()=>{}),peekHtml:()=>'',placePeek(){},
  setTimeout:fn=>timers.push(fn),clearTimeout:id=>{if(id)timers[id-1]=null;}};
 const t=new Function(...Object.keys(deps),'let peekFor=null,peekPinned=false,peekTimer=0,peekKey=\'\',suppressUntil=0;'+handlers+';return {click,over,state:()=>({open:peek.dataset.open,for:peekFor,pinned:peekPinned})};')(...Object.values(deps));
 const event=target=>({target,pointerType:'mouse',preventDefault(){},stopImmediatePropagation(){}});
 const card=(id,hint={})=>{const el={dataset:{instance:String(id),forgeHint:String(!!hint.hint),forgeChosen:String(!!hint.chosen)},classList:{add(){},remove(){}},offsetWidth:0,closest:s=>s==='.play-match-card[data-instance]'?el:null,setAttribute(){},removeAttribute(){}};return el;};
 return {card,acted,click:el=>t.click(event(el)),over:el=>t.over(event(el)),state:t.state,flush(){for(let i=0;i<timers.length;i++){const fn=timers[i];timers[i]=null;fn?.();}}};
}
test('clicking the same hand card again closes its pinned preview',()=>{
 const t=table(),a=t.card(1),b=t.card(2);
 t.click(a);assert.deepEqual(t.state(),{open:'true',for:a,pinned:true});
 t.click(a);assert.deepEqual(t.state(),{open:'false',for:null,pinned:false});
 t.click(a);t.click(b);assert.deepEqual(t.state(),{open:'true',for:b,pinned:true},'another card moves the pin');
 t.click(b);assert.equal(t.state().open,'false');
});
test('a hover still pending when the card is clicked does not unpin the preview',()=>{
 const t=table(),a=t.card(1);
 t.over(a);t.click(a);t.flush();assert.deepEqual(t.state(),{open:'true',for:a,pinned:true});
 t.click(a);t.flush();assert.equal(t.state().open,'false');
});
test('a highlighted card acts; during priority or targeting any other card opens its preview instead',()=>{
 for(const inputType of ['InputPassPriority','InputSelectTargets']){
  const t=table({inputType,prompt:null}),plain=t.card(1),offered=t.card(2,{hint:true}),picked=t.card(3,{chosen:true});
  t.click(plain);assert.deepEqual(t.state(),{open:'true',for:plain,pinned:true},inputType+': a card Forge does not offer previews');assert.deepEqual(t.acted,[]);
  t.click(plain);assert.equal(t.state().open,'false','a second click closes it');
  t.click(offered);t.click(picked);assert.deepEqual(t.acted,[['card',2],['card',3]],inputType+': offered and already chosen cards still act');
 }
});
test('where Forge lists no clickable cards, every click still goes to Forge',()=>{
 for(const native of [{inputType:'InputAttack',prompt:null},{inputType:'InputBlock',prompt:null},{inputType:'InputPayManaOfCostPayment',prompt:null},{inputType:'InputPassPriority',prompt:{id:'p'}}]){
  const t=table(native);t.click(t.card(1));assert.deepEqual(t.acted,[['card',1]],native.inputType);assert.equal(t.state().open,'false');
 }
 const discard=table({inputType:'',prompt:null,selection:{cards:[{kind:'card',id:2}]}});discard.click(discard.card(1));assert.deepEqual(discard.acted,[],'a discard choice lists its cards, so others preview');
});
test('a busy table still previews a card but never sends one',()=>{
 const t=table({inputType:'InputPassPriority',prompt:null},{busy:true}),offered=t.card(2,{hint:true}),plain=t.card(1);
 t.click(offered);assert.deepEqual(t.acted,[]);t.click(plain);assert.equal(t.state().open,'true');
});
