import assert from 'node:assert/strict';
import {attachGestures} from './feel.js';
const events=()=>({handlers:{},style:{},addEventListener(t,fn){this.handlers[t]=fn;}});
const sheet=events(),body={scrollTop:0,contains:n=>n.inside},windowEvents={};let closed=0;
globalThis.document={getElementById:id=>({sheet,sheetBody:body}[id]),createElement:()=>({setAttribute(){}}),body:{append(){}}};
globalThis.ontouchstart=null;globalThis.addEventListener=(type,fn)=>{windowEvents[type]=fn;};
attachGestures({closeSheet:()=>closed++});
const target=inside=>({inside,closest:()=>null});
const touch=(type,x,y,t=target(true))=>sheet.handlers[type]({target:t,touches:[{clientX:x,clientY:y}]});
touch('touchstart',10,10,target(false));touch('touchmove',10,60,target(false));assert.equal(sheet.style.transform,'','Backdrop never initiates sheet dismissal');
for(const cancel of [()=>sheet.handlers.touchcancel(),()=>windowEvents.resize(),()=>sheet.handlers.close()]){
 touch('touchstart',10,10);touch('touchmove',10,45);assert.match(sheet.style.transform,/translateY/,'A real sheet drag still starts');cancel();assert.equal(sheet.style.transform,'');assert.equal(sheet.style.transition,'');touch('touchmove',10,150);assert.equal(sheet.style.transform,'','Cancelled stream cannot restart without a new touch');
}
touch('touchstart',10,10);touch('touchmove',10,150);sheet.handlers.touchend();windowEvents.resize();
await new Promise(r=>setTimeout(r,220));assert.equal(closed,0,'Fold cancels queued dismissal from a retired gesture');
body.scrollTop=120;touch('touchstart',10,10);touch('touchmove',10,150);assert.equal(sheet.style.transform,'','A scrolled card body keeps normal scrolling');
console.log('PASS: backdrop isolation, cancelled/native touch cleanup, fold/close cleanup and queued-dismissal cancellation.');
