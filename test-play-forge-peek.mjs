// The opening-hand preview: a click pins it, a second click on the same card closes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./experiments/forge-proof/forge-table.mjs',import.meta.url),'utf8');
const part=re=>{const m=src.match(re);assert(m,'forge-table.mjs changed shape: '+re);return m[0];};
const handlers=[/\n const surfaceCard=.*/,/\n function showPeek\(el,pinned=false\)\{[\s\S]*?\n \}/,/\n function hidePeek\(\)\{.*/,/\n const peekCard=.*/,/\n const over=.*/,/\n const click=e=>\{[\s\S]*?\n \};/].map(part).join('');
function table(){
 const timers=[],peek={id:'forge-peek-test',dataset:{open:'false'}};
 const snapshot={busy:false,native:{inputType:'InputConfirmMulligan',prompt:null},status:{surface:{cards:[{id:1,known:true,name:'Forest'},{id:2,known:true,name:'Island'}]}}};
 const deps={root:{contains:()=>true},peek,session:{snapshot:()=>snapshot},act(){throw Error('the opening hand selects nothing');},openZone(){},drag:null,keywordReference:null,loadKeywordReference:()=>new Promise(()=>{}),peekHtml:()=>'',placePeek(){},
  setTimeout:fn=>timers.push(fn),clearTimeout:id=>{if(id)timers[id-1]=null;}};
 const t=new Function(...Object.keys(deps),'let peekFor=null,peekPinned=false,peekTimer=0,peekKey=\'\',suppressUntil=0;'+handlers+';return {click,over,state:()=>({open:peek.dataset.open,for:peekFor,pinned:peekPinned})};')(...Object.values(deps));
 const event=target=>({target,pointerType:'mouse',preventDefault(){},stopImmediatePropagation(){}});
 const card=id=>{const el={dataset:{instance:String(id)},closest:s=>s==='.play-match-card[data-instance]'?el:null,setAttribute(){},removeAttribute(){}};return el;};
 return {card,click:el=>t.click(event(el)),over:el=>t.over(event(el)),state:t.state,flush(){for(let i=0;i<timers.length;i++){const fn=timers[i];timers[i]=null;fn?.();}}};
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
