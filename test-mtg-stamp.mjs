// The security stamp is found on the card picture itself. Inputs are the bottom-centre strips of real Scryfall
// card pictures (see the fixture's note): every stamp shape, old and new ovals, borderless and showcase frames,
// and cards that have no stamp. Expected boxes were checked by eye on those pictures (% of card: left, top, width, height).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {measureStamp} from './mtg-stamp.js';
const {cards}=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/mtg-security-stamps.json.gz',import.meta.url))));
const picture=c=>{const d=new Uint8ClampedArray(c.W*c.H*4),l=Buffer.from(c.lum,'base64');
 for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){const i=((y+c.y0)*c.W+x+c.x0)*4,v=l[y*c.w+x];d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}return d;};
const EXPECT=[
 ['mdd','242',[45.7,91.5,8.6,3.1]],['trk','470',[45.7,91.5,8.6,3.1]],['trk','206',[45.7,91.5,8.6,3.1]],['pw27','1',[45.7,91.5,8.6,3.1]],
 ['fdn','44',[45.7,91.5,8.6,3.2]],['slp','55',[45.7,91.5,8.6,3.1]],['trc','184',[45.7,91.5,8.8,3.1]],['sld','2750',[45.7,91.5,8.6,3.1]],
 ['trk','557',[45.7,91.5,8.6,3.1]],['trk','395',[45.7,91.5,8.6,3.1]],['trk','257',[45.7,91.5,8.6,3.1]],['nau','346',[45.7,91.5,8.8,3.1]],
 ['fra','122',[45.7,91.5,8.6,3.2]],          // Avatar of Burgeoning Echoes: the card the owner reported
 ['dmu','107',[46.0,92.2,8.5,2.7]],          // older oval whose dark symbol splits the stamp into pieces
 ['pmei','2026-17',[46.7,91.9,8.2,3.2]],['fic','455',[45.7,91.3,8.8,3.5]],['sld','7030',[45.9,91.6,9.0,3.5]],['pfin','272s',[45.7,91.3,8.8,3.5]], // triangles
 ['mbc','70',[47.7,91.3,4.7,3.4]],['unf','433',[48.4,92.1,3.9,2.8]],['unf','305',[48.8,92.1,4.1,2.9]],                                        // acorns
 ['sld','1540',[46.3,92.6,7.4,4.9]],['sld','798',[46.3,92.4,7.4,4.9]],                                                                         // hearts
 ['mar','39',[45.7,91.5,8.6,3.2]],
 ['mdd','301',null],['trk','275',null],['trk','66',null],['trk','576',null],['trk','42',null],['mkm','39',null],['dmu','265',null],            // no stamp printed
];
// Known miss, kept visible: this circle stamp sits inside a bright ring of painted fire, so no dark border rings it.
// It gets no shine rather than a guessed one.
const KNOWN_MISS=[['ss3','6']];
let found=0;
for(const [set,number,box] of EXPECT){
 const c=cards.find(x=>x.set===set&&x.number===number);assert(c,`fixture has ${set} ${number}`);
 const s=measureStamp(picture(c),c.W,c.H),id=`${c.name} (${set} ${number}, ${c.stamp||'no stamp'}, ${c.W}px)`;
 if(!box){assert.equal(s,null,`${id}: nothing is drawn where no stamp is printed`);continue;}
 assert(s,`${id}: stamp found`);found++;
 const got=[s.x,s.y,s.w,s.h].map(v=>v*100);
 got.forEach((v,i)=>assert(Math.abs(v-box[i])<=.45,`${id}: box ${got.map(n=>n.toFixed(1))} matches ${box}`));
 assert.equal(s.mask.length,s.mw*s.mh);
 const lit=s.mask.reduce((n,v)=>n+(v>40?1:0),0)/s.mask.length;
 assert(lit>.2&&lit<.95,`${id}: the mask follows the print (${lit.toFixed(2)} lit), neither empty nor a solid block`);
 // The outline is the stamp's, not its box: every shape leaves the bottom corners of its box clear.
 for(const i of [(s.mh-1)*s.mw,s.mh*s.mw-1])assert(s.mask[i]<70,`${id}: bottom corner is outside the stamp`);
}
for(const [set,number] of KNOWN_MISS){const c=cards.find(x=>x.set===set&&x.number===number);assert.equal(measureStamp(picture(c),c.W,c.H),null,'a stamp that cannot be read is left alone, never guessed');}
assert.equal(found,24);assert.equal(cards.length,EXPECT.length+KNOWN_MISS.length,'every fixture card is accounted for');
assert.equal(measureStamp(null,0,0),null);assert.equal(measureStamp(new Uint8ClampedArray(40*40*4),40,40),null);
console.log('PASS: the security stamp is found and outlined on 24 real card pictures (oval, triangle, acorn, heart, circle), 7 cards without one get none, and 1 known miss draws nothing.');
