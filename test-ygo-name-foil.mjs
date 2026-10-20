// Hot-stamped Yu-Gi-Oh! name foil: letter detection works on light and dark name bars,
// ignores coloured sparkles, and the CSS mask lands exactly on the measured name bar.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {glyphCoverage,nameMaskStyle,YGO_NAME_BOX,YGO_NAME_RARITY,YGO_NAME_FRAGMENT} from './ygo-name-foil.js';
const W=60,H=16;
function bar(bg,ink,extra=()=>null){
 const px=new Uint8ClampedArray(W*H*4);
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=(j*W+i)*4,letter=j>=4&&j<12&&i%10>=3&&i%10<7,c=extra(i,j)||(letter?ink:bg);px.set([...c,255],k);}
 return px;
}
const inside=(cov,i,j)=>cov[j*W+i];
// Normal monster: dark letters on gold. Xyz: white letters on a near-black bar, where a plain
// "dark pixel = letter" threshold would mark the whole bar.
for(const [label,bg,ink] of [['gold bar, dark letters',[200,160,80],[15,12,10]],['Xyz bar, white letters',[38,38,42],[245,245,245]],['magenta bar, white letters',[180,40,130],[250,250,250]]]){
 const cov=glyphCoverage(bar(bg,ink),W,H);
 assert(inside(cov,5,8)>.9,`${label}: letter core detected`);
 assert(inside(cov,1,8)===0&&inside(cov,8,8)===0&&inside(cov,25,2)===0,`${label}: bar background stays clear`);
 const covered=cov.reduce((n,v)=>n+(v>.5),0)/cov.length;assert(covered>.15&&covered<.4,`${label}: coverage ${covered} matches the letter area`);
}
// A bright cyan sparkle on the dark Xyz bar is coloured, so it is not a letter.
const sparkle=glyphCoverage(bar([38,38,42],[245,245,245],(i,j)=>i===18&&j===8?[80,230,250]:null),W,H);
assert.equal(inside(sparkle,18,8),0,'Coloured sparkle is not treated as foil lettering');
// The CSS mask image is placed exactly on the name bar: position p of a size-s mask sits at p*(1-s).
const style=nameMaskStyle('data:image/png;base64,AA==');
const [px,py]=style.maskPosition.split(' ').map(parseFloat),[sw,sh]=style.maskSize.split(' ').map(parseFloat);
assert(Math.abs(px/100*(1-sw/100)-YGO_NAME_BOX[0])<1e-4&&Math.abs(py/100*(1-sh/100)-YGO_NAME_BOX[1])<1e-4,'Mask lands on the name bar');
assert(Math.abs(sw/100-(YGO_NAME_BOX[2]-YGO_NAME_BOX[0]))<1e-4&&Math.abs(sh/100-(YGO_NAME_BOX[3]-YGO_NAME_BOX[1]))<1e-4,'Mask spans the name bar only');
assert.equal(style.clipPath,'none');assert.equal(style.maskRepeat,'no-repeat');
// Name bar stops before the Attribute orb and clears letter descenders.
assert(YGO_NAME_BOX[2]<.834&&YGO_NAME_BOX[3]>=.108,'Measured name bar bounds');
assert.deepEqual(YGO_NAME_RARITY,{silver:1,gold:2,rainbow:3},'Rare silver, Ultra gold, Secret/Prismatic rainbow');
// Output is letters only: transparent wherever coverage is zero, so the art foil and bar stay untouched.
assert.match(YGO_NAME_FRAGMENT,/if\(c<=0\.0\)\{gl_FragColor=vec4\(0\.0\);return;\}/);
assert.match(YGO_NAME_FRAGMENT,/gl_FragColor=vec4\(toSrgb\(clamp\(foil,0\.0,1\.0\)\),c\);/);
// The full-screen viewer must use this site's image copy: a hotlinked YGOPRODeck image cannot be
// read, so the lettering would fall back to the old title-band shine there.
assert.match(readFileSync(new URL('./tcg.js',import.meta.url),'utf8'),/data-hi="\$\{esc\(c\.imageLarge \|\| ""\)\}"/,'Zoom high-resolution image is the same-origin copy');
console.log('PASS: Yu-Gi-Oh! name foil finds letters on gold, magenta and dark Xyz bars, rejects coloured sparkles, and masks exactly the measured name bar.');
