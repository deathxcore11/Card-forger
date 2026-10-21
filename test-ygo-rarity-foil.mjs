// Yu-Gi-Oh! rarity foil: full-size gating, the white-underbase estimate (subject vs background),
// and the shader's coverage rules. Pixel rendering is covered by the hosted browser test.
import assert from 'node:assert/strict';
import {analyzeYgoArt,YGO_ART_BOX} from './ygo-foil-analysis.js';
import {ygoFoilFullSize,ygoRecipeFor,YGO_RARITY_FRAGMENT,YGO_FULL_SIZE_PX} from './ygo-rarity-foil.js';
import {YGO_FOIL_RECIPES,ygoRarityEffect} from './ygo-foil-recipes.js';
import {resolveFinish} from './finish-effects.js';
import {ygoDeckFinishContext} from './tcg.js';
// Size gate: card page and zoom always; gallery cards only at Large or when drawn wide.
assert.equal(ygoFoilFullSize('detail',120,'small'),true);assert.equal(ygoFoilFullSize('zoom',90,'medium'),true);
assert.equal(ygoFoilFullSize('large',150,'large'),true,'Large grid setting');
assert.equal(ygoFoilFullSize('large',180,'medium'),false,'Medium tiles keep the CSS finish');
assert.equal(ygoFoilFullSize('large',110,'small'),false,'Small tiles keep the CSS finish');
assert.equal(ygoFoilFullSize('large',YGO_FULL_SIZE_PX,'medium'),true,'Wide desktop tiles count as full size');
// Recipe table: every foil rarity string in the Yu-Gi-Oh! catalogue resolves to a recipe; plain and
// unknown rarities stay honest.
const norm=v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'');
const catalogue=['Rare','Super Rare','Ultra Rare','Secret Rare','Ultimate Rare','Quarter Century Secret Rare','Platinum Secret Rare','PLatinum Secret Rare',"Collector's Rare",'Starlight Rare','Duel Terminal Normal Parallel Rare','Prismatic Secret Rare','Starfoil Rare','Starfoil','Gold Rare','Shatterfoil Rare','Mosaic Rare','Duel Terminal Rare Parallel Rare','Premium Gold Rare','Gold Secret Rare','Duel Terminal Super Parallel Rare','Duel Terminal Ultra Parallel Rare','Ghost Rare','Ultra Parallel Rare','Platinum Rare',"Ultra Rare (Pharaoh's Rare)",'Normal Parallel Rare','Extra Secret Rare','Ghost/Gold Rare','Super Parallel Rare','Extra Secret','Ultra Secret Rare','Duel Terminal Normal Rare Parallel Rare','10000 Secret Rare'];
const ygoCard=r=>({id:'46986414',game:'ygo',frame:'normal',type:'Normal Monster',sets:[{rarity:r,code:'X-EN001',name:'X'}]});
for(const r of catalogue){const effect=ygoRarityEffect(norm(r));assert(YGO_FOIL_RECIPES[effect],'recipe for '+r);
 const p=resolveFinish('ygo',ygoCard(r),{priceEdition:'X-EN001::'+r});assert.equal(p.status,'approximate',r);assert.equal(p.effect,effect,r);assert(p.layers.length,'CSS fallback layers for '+r);}
for(const r of ['Common','Short Print','Super Short Print','New','Reprint'])assert.equal(ygoRarityEffect(norm(r)),'',r+' has no foil recipe');
assert.equal(resolveFinish('ygo',ygoCard('Grand Master Rare'),{priceEdition:'X-EN001::Grand Master Rare'}).status,'unknown','Unreviewed Grand Master Rare stays preview unavailable');
assert.equal(ygoRecipeFor('ygo-rare'),null,'Rare is name-only: no WebGL layer');
for(const [effect,r] of Object.entries(YGO_FOIL_RECIPES))if(effect!=='ygo-rare')assert(ygoRecipeFor(effect)&&(r.whole||r.frame||r.art),effect);
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
assert.match(YGO_RARITY_FRAGMENT,/float cov=art\*\(u_artL\.z>1\.5\?1\.:mk\.r\)/,'Art foil follows the underbase mask unless the recipe covers the whole art');
assert.match(YGO_RARITY_FRAGMENT,/\(1\.-text\*\(1\.-u_whole\.z\)\)\*\(1\.-name\)/,'Whole-card foil only shares into the rules box and leaves the name bar to the lettering');
assert.match(YGO_RARITY_FRAGMENT,/float art=inBox\(uv,u_art\),name=inBox\(uv,u_name\),text=inBox\(uv,u_text\),frame=\(1\.-art\)\*\(1\.-text\)\*\(1\.-name\);/,'Frame foil never touches the rules box');
assert.match(YGO_RARITY_FRAGMENT,/return mix\(base,shoulder\(T\*F\*1\.35\),clamp\(cover,0\.,1\.\)\);/,'Zero coverage returns the exact source pixel');
// Decks and deck builds: the row's chosen printing, else the copy you own when every owned copy is
// the same printing and rarity; mixed copies and other games never guess.
const deckCard={id:'46986414',game:'ygo'},own=(...rows)=>({tcg:{ygo:{collection:rows.map(([printing,rarity])=>({cardId:'46986414',printing,rarity,qty:1}))}}});
assert.deepEqual(ygoDeckFinishContext('ygo',deckCard,{printingKey:'GLD1-EN001::Gold Rare'},own()),{priceEdition:'GLD1-EN001::Gold Rare'});
assert.deepEqual(ygoDeckFinishContext('ygo',deckCard,null,own(['LOB-005','Ultra Rare'],['LOB-005','Ultra Rare'])),{priceEdition:'LOB-005::Ultra Rare'});
assert.deepEqual(ygoDeckFinishContext('ygo',deckCard,null,own(['LOB-005','Ultra Rare'],['SDY-006','Common'])),{},'Mixed owned printings never pick one');
assert.deepEqual(ygoDeckFinishContext('ygo',deckCard,null,own()),{});assert.deepEqual(ygoDeckFinishContext('ptcg',deckCard,null,own(['LOB-005','Ultra Rare'])),{});
console.log('PASS: every Yu-Gi-Oh! foil rarity in the catalogue resolves to a recipe; full-size gating; cropped subjects stay solid while backgrounds and glows pass foil; rules box only shared by whole-card recipes.');
