import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finishAttrs,containedImageBox} from './finish-preview.js';
import {resolveFinish} from './finish-effects.js';
import {finishMaterialProfile} from './finish-materials.js';
const card={id:'cel25-3',set:{id:'cel25'},variants:[{key:'holofoil',finish:'holofoil'}]};
for(const game of ['ptcg','mtg','ygo'])assert.match(finishAttrs(game,card),new RegExp(`data-finish-game="${game}"`));
const model=resolveFinish('ptcg',card,{priceFinish:'holofoil'});
assert.equal(finishMaterialProfile('ptcg',card,model),'line-holo');
assert.equal(model.layers[0].mask,'pk-cel-art','Quiet texture must retain its artwork-only mask');
const style=readFileSync('style.css','utf8'),foil=readFileSync('finish-effects.css','utf8');
assert.match(style,/#content\.view-gallery \.display-list \.lot:not\(\.wanted\) \.lot-art\[data-finish-game="ptcg"\] \{ aspect-ratio:auto;/);
assert.match(style,/\.lot\[data-tier\]:not\(\[data-tier="tn"\]\):not\(\.wanted\) \.lot-art\[data-finish-game="ptcg"\] \{ padding:5px;/);
assert.match(style,/\.lot-art\[data-finish-game="ptcg"\] > img\.card-img \{[^}]*height:auto; aspect-ratio:auto; object-fit:contain;/);
assert.match(foil,/\.finish-overlay\[data-material-profile="line-holo"\] \.finish-pattern\{[^}]*opacity:\.18\}/,'Scoped opacity must equal generic selector specificity, not be silently overridden');
for(const width of [150,240,390]){
 const inner=width-10,height=inner*825/600;
 const box=containedImageBox(inner,height,600,825);
 assert(Math.abs(box.top)<1e-9&&Math.abs(box.left)<1e-9,'Natural ratio creates no internal letterbox');
 assert(Math.abs(box.height-height)<1e-9&&Math.abs(box.width-inner)<1e-9,'Foil plane covers exactly the uncropped image');
}
assert.match(style,/@media\(prefers-reduced-motion:no-preference\)\{\s*\.cs-banner:not\(\.no-art\) \.cs-art,\.deck-hero > \.hero-art \{animation:header-breathe 20s/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)\{[^\n]*\.cs-banner \.cs-art[^\n]*animation:none!important/);
console.log('PASS: Pokémon natural-ratio collection geometry, scoped quiet Celebrations texture, unchanged mask and accessible header motion policy. Browser screenshots still required.');

// Installed-shell upgrade: precache the corrected CSS, retire only old shell
// caches, and keep the network-first stylesheet path for already-open clients.
const sw=readFileSync('sw.js','utf8'),events={},added=[],removed=[],put=[];
const currentCache=sw.match(/const CACHE = "([^"]+)"/)[1],previousCache=currentCache.replace(/\d+$/,n=>String(Number(n)-1));
const cached={addAll:async paths=>added.push(...paths),put:async(...args)=>put.push(args)};
const waits=[];let claimed=false;
vm.runInNewContext(sw,{self:{location:{origin:'https://fixture.test'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async key=>{assert.equal(key,currentCache);return cached;},keys:async()=>[previousCache,currentCache,'personal-data'],delete:async key=>removed.push(key),match:async()=>new Response('old-css')},fetch:async()=>new Response('corrected-five-pixel-css'),URL,Response,setTimeout:()=>0,Promise});
events.install({waitUntil:p=>waits.push(p)});await Promise.all(waits);assert(added.includes('./style.css'));
events.activate({waitUntil:p=>waits.push(p)});await Promise.all(waits);assert.deepEqual(removed,[previousCache]);assert(claimed);
let response;events.fetch({request:{url:'https://fixture.test/style.css',method:'GET',mode:'cors'},respondWith:p=>response=p});
assert.equal(await (await response).text(),'corrected-five-pixel-css');assert.equal(put.length,1);
console.log('PASS: installed shell precaches corrected stylesheet, retires only obsolete shell cache, and serves fresh network CSS.');

assert.match(style,/lot-art\[data-finish-game="ptcg"\] \{ aspect-ratio:auto; border-radius:12px;/);
assert.match(style,/lot-art\[data-finish-game="ptcg"\] > img\.card-img \{[^}]*border-radius:7px;/);
