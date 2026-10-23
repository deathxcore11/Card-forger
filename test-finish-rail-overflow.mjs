// The exact shared responsive callback plus adversarial classification fixtures.
// This is deterministic geometry validation, not a browser rendering claim.
import assert from 'node:assert/strict';
import {auditedFinishChoiceControl,noOverflow} from './tests/detail-rules-fixtures.mjs';
const rail={known:true,direct:true,connected:true,visible:true,focusable:true,chip:true,type:'button',pressed:'false',action:'cardFinishPreview',game:'ptcg',cardId:'swsh1-9',finish:'reverse-holofoil',left:50,right:270,top:100,bottom:152,scale:1,contentLeft:50,client:220,scroll:360,position:0,overflow:'auto',display:'flex',wrap:'nowrap'};
const control={root:'sheetBody',game:'ptcg',tag:'BUTTON',viewport:320,left:230,right:348,top:104,bottom:148,width:118,height:44,finishRail:rail};
assert(auditedFinishChoiceControl(control),'reported right348/viewport320 child is valid only inside the measured clipped finish rail');
const oversized={...control,left:70,right:400,width:330};
assert(auditedFinishChoiceControl(oversized),'a long finish may exceed the visible rail but must fit its real scrollable content');
assert(auditedFinishChoiceControl({...oversized,left:-50,right:280,finishRail:{...rail,position:120}}),'the same long finish remains valid at the other end of the bounded rail');
assert(!auditedFinishChoiceControl({...oversized,right:420,width:350}),'a long finish outside the actual content is not exempt');

for(const change of [{root:'content'},{game:'unknown'},{tag:'A'},{width:230},{height:43},{left:30},{right:420},{top:95},{bottom:160}])assert(!auditedFinishChoiceControl({...control,...change}),JSON.stringify(change));
for(const change of [{known:false},{direct:false},{connected:false},{visible:false},{focusable:false},{chip:false},{type:'submit'},{pressed:null},{action:'tOwnSave'},{game:'mtg'},{cardId:''},{finish:''},{overflow:'visible'},{overflow:'hidden'},{display:'block'},{wrap:'wrap'},{left:-1},{right:321},{client:0},{scroll:220},{scale:0},{scroll:Infinity},{position:-2},{position:150}])assert(!auditedFinishChoiceControl({...control,finishRail:{...rail,...change}}),JSON.stringify(change));
assert(auditedFinishChoiceControl({...control,game:'mtg',finishRail:{...rail,game:'mtg'}}));
assert(auditedFinishChoiceControl({...control,game:'ygo',finishRail:{...rail,action:'',game:'',cardId:'',finish:''}}));
assert(!auditedFinishChoiceControl({...control,game:'ygo'}),'YGO cannot masquerade as an unrelated actionable finish selector');
assert(auditedFinishChoiceControl({...control,game:'ygo',finishRail:{...rail,action:'ygoPickRarity',game:'',cardId:'38814750',edition:'HSRD-EN031::Ultra Rare',finish:''}}),'Exact Yu-Gi-Oh! rarity actions stay inside the audited rail');
assert(!auditedFinishChoiceControl({...control,game:'ygo',finishRail:{...rail,action:'ygoPickRarity',game:'',edition:'',finish:''}}),'Missing printing identity is rejected');
const zoom=1.25,scaled=Object.fromEntries(['left','right','top','bottom','width','height'].map(k=>[k,control[k]*zoom]));
const scaledRail=Object.fromEntries(['left','right','top','bottom','contentLeft','client','scroll','position'].map(k=>[k,rail[k]*zoom]));
assert(auditedFinishChoiceControl({...control,...scaled,viewport:400,finishRail:{...rail,...scaledRail,scale:zoom}}),'visual zoom keeps rail/control geometry in matching coordinate space');

// Exercise production noOverflow extraction, not only hand-made classifier data.
const original=Object.fromEntries(['document','window','location','innerWidth','innerHeight','getComputedStyle'].map(k=>[k,globalThis[k]]));
const rect=(left,top,width,height)=>({left,right:left+width,top,bottom:top+height,width,height});
let rootWidth=320,scopeWidth=288,railRight=270,overflow='auto',ancestorOpacity='1',zoomFactor=1,buttonLeft=230,buttonWidth=118;
const root={id:'sheetBody',isConnected:true,clientWidth:288,get scrollWidth(){return scopeWidth;},getBoundingClientRect:()=>rect(16,0,288,600),querySelectorAll:()=>[button]};
const stack={parentElement:root,matches:s=>s==='.cd-art-stack'},preview={parentElement:stack};
const finish={isConnected:true,parentElement:preview,clientLeft:0,clientWidth:220,offsetWidth:220,scrollWidth:360,scrollLeft:0,matches:s=>s==='.finish-preview > .finish-choice-rail',getBoundingClientRect:()=>rect(50*zoomFactor,100*zoomFactor,(railRight-50)*zoomFactor,52*zoomFactor)};
const button={isConnected:true,tagName:'BUTTON',type:'button',className:'chip',textContent:'Reverse holo',tabIndex:0,disabled:false,parentElement:finish,dataset:{act:'cardFinishPreview',game:'ptcg',cardId:'swsh1-9',finish:'reverse-holofoil'},getAttribute:k=>k==='aria-pressed'?'false':null,matches:s=>s==='.chip',closest:s=>s==='.finish-choice-rail'?finish:null,getClientRects:()=>[{}],getBoundingClientRect:()=>rect(buttonLeft*zoomFactor,104*zoomFactor,buttonWidth*zoomFactor,44*zoomFactor)};
const page={evaluate:(fn,args)=>fn(args)};
try{
 Object.assign(globalThis,{document:{body:{dataset:{game:'ptcg',view:'collection'}},documentElement:{get scrollWidth(){return rootWidth;}},querySelector:()=>null,querySelectorAll:()=>[root]},window:{__uiTestState:{state:{settings:{game:'ptcg'}},ui:{view:'collection'}}},location:{hash:'#collection'},innerWidth:320,innerHeight:800,getComputedStyle:n=>({visibility:'visible',opacity:n===preview?ancestorOpacity:'1',display:n===finish?'flex':'block',flexWrap:'nowrap',overflowX:overflow})});
 let result=await noOverflow(page,'#sheetBody','contained finish rail');assert.equal(result.bad.length,1);assert(result.bad[0].finishRail.known);assert.equal(result.bad[0].right,348);
 buttonLeft=70;buttonWidth=330;result=await noOverflow(page,'#sheetBody','long finish within scroll content');assert.equal(result.bad[0].width,330);
 buttonWidth=350;await assert.rejects(noOverflow(page,'#sheetBody','long finish outside scroll content'),/all visible controls/);buttonLeft=230;buttonWidth=118;
 overflow='visible';await assert.rejects(noOverflow(page,'#sheetBody','visible rail overflow'),/all visible controls/);overflow='auto';
 ancestorOpacity='0';await assert.rejects(noOverflow(page,'#sheetBody','transparent finish controls'),/all visible controls/);ancestorOpacity='1';
 button.parentElement=preview;await assert.rejects(noOverflow(page,'#sheetBody','nested unrelated button'),/all visible controls/);button.parentElement=finish;
 railRight=322;await assert.rejects(noOverflow(page,'#sheetBody','rail itself out of bounds'),/all visible controls/);railRight=270;
 rootWidth=324;await assert.rejects(noOverflow(page,'#sheetBody','real page overflow'),/no horizontal overflow/);rootWidth=320;
 scopeWidth=292;await assert.rejects(noOverflow(page,'#sheetBody','real sheet overflow'),/no horizontal overflow/);scopeWidth=288;
 zoomFactor=1.25;innerWidth=400;rootWidth=400;result=await noOverflow(page,'#sheetBody','zoomed contained finish rail');assert.equal(result.bad[0].finishRail.scale,1.25);
}finally{for(const [key,value] of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
console.log('PASS: strict real finish rail clipping/visibility/direct control/identity/zoom classifier; generic buttons, hidden/non-scrollable/unbounded rails, actual page and sheet overflow still fail.');
