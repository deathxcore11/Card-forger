// Yu-Gi-Oh! rarity foil: full-size gating, the white-underbase estimate (subject vs background),
// and the shader's coverage rules. Pixel rendering is covered by the hosted browser test.
import assert from 'node:assert/strict';
import {analyzeYgoArt,YGO_ART_BOX} from './ygo-foil-analysis.js';
import {ygoFoilFullSize,YGO_RARITY_KIND,YGO_RARITY_FRAGMENT,YGO_FULL_SIZE_PX} from './ygo-rarity-foil.js';
// Size gate: card page and zoom always; gallery cards only at Large or when drawn wide.
assert.equal(ygoFoilFullSize('detail',120,'small'),true);assert.equal(ygoFoilFullSize('zoom',90,'medium'),true);
assert.equal(ygoFoilFullSize('large',150,'large'),true,'Large grid setting');
assert.equal(ygoFoilFullSize('large',180,'medium'),false,'Medium tiles keep the CSS finish');
assert.equal(ygoFoilFullSize('large',110,'small'),false,'Small tiles keep the CSS finish');
assert.equal(ygoFoilFullSize('large',YGO_FULL_SIZE_PX,'medium'),true,'Wide desktop tiles count as full size');
assert.deepEqual(Object.keys(YGO_RARITY_KIND),['ygo-super','ygo-ultra','ygo-secret','ygo-prismatic','ygo-starlight'],'Only rarities the resolver already recognises; Rare stays name-only');
// Synthetic card: blue swirl background, a pale subject with a dark outline whose robe runs into the
// bottom of the art window (as cropped monsters do), and a glowing eye (bright orange on a dark socket).
const W=200,H=292,px=new Uint8ClampedArray(W*H*4);
const [ax0,ay0,ax1,ay1]=[YGO_ART_BOX[0]*W,YGO_ART_BOX[1]*H,YGO_ART_BOX[2]*W,YGO_ART_BOX[3]*H],cx=(ax0+ax1)/2,cy=(ay0+ay1)/2;
const inSubject=(x,y)=>{const dx=(x-cx)/32,dy=(y-cy+8)/30;return dx*dx+dy*dy<1||(Math.abs(x-cx)<22&&y>cy&&y<ay1+2);};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const k=(y*W+x)*4,art=x>=ax0&&x<ax1&&y>=ay0&&y<ay1;let c=[150,120,70];
 if(art){c=[30+20*Math.sin(x/9),70+25*Math.sin((x+y)/11),150+30*Math.cos(y/10)];
  if(inSubject(x,y)){const edge=!inSubject(x-2,y)||!inSubject(x+2,y)||!inSubject(x,y-2)||!(inSubject(x,y+2)||y+2>=ay1);c=edge?[12,10,14]:[215,205,190];}
  const eye=Math.hypot(x-cx-10,y-cy+12);if(eye<9)c=[25,20,30];if(eye<4)c=[255,170,40];}
 px.set([...c.map(v=>Math.round(v)),255],k);}
const {mask}=analyzeYgoArt(px,W,H),at=(x,y)=>mask[(Math.round(y)*W+Math.round(x))*4],en=(x,y)=>mask[(Math.round(y)*W+Math.round(x))*4+1];
assert(at(ax0+8,ay0+8)>200&&at(ax1-8,cy)>200,'Background passes foil');
assert(at(cx,cy-8)<60,'Subject body sits on the white underbase');
assert(at(cx,ay1-4)<60,'A robe running into the frame stays subject, not background');
assert(en(cx+10,cy-12)>150&&at(cx+10,cy-12)>150,'A glowing eye on the subject still passes foil');
assert.equal(at(W/2,H*.85),0,'Nothing outside the art window is marked');
// Spells and Traps have no monster: a magenta Trap frame gives the whole illustration broad coverage.
const trap=px.slice();for(let y=0;y<H;y++)for(let x=0;x<W;x++){const art=x>=ax0&&x<ax1&&y>=ay0&&y<ay1;if(!art)trap.set([168,66,128,255],(y*W+x)*4);}
const t=analyzeYgoArt(trap,W,H);assert.equal(t.spellTrap,true);assert(t.mask[(Math.round(cy-8)*W+Math.round(cx))*4]>110,'Trap art passes foil across the centre too');
assert.equal(analyzeYgoArt(px,W,H).spellTrap,false,'Monster frames are not Spell/Trap');
// Shader: text box only touched by Starlight (whole-card glitter, reduced over the rules);
// coverage otherwise comes from the art mask.
assert.match(YGO_RARITY_FRAGMENT,/float cover=art\*mk\.r/);
assert.match(YGO_RARITY_FRAGMENT,/cover=max\(max\(cover,art\*\.35\),\(1\.-art\)\*\(1\.-text\*\.55\)\*\.75\)/);
assert.match(YGO_RARITY_FRAGMENT,/vec3 outC=mix\(base,shoulder\(T\*F\*1\.35\),clamp\(cover,0\.,1\.\)\);/,'Zero coverage returns the exact source pixel');
console.log('PASS: Yu-Gi-Oh! rarity foil gates to full-size cards, keeps cropped subjects solid, lets backgrounds and coloured glows pass foil, and leaves the rules box alone except on Starlight.');
