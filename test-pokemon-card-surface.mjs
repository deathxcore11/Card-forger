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
assert.match(style,/\.lot\[data-tier\]:not\(\[data-tier="tn"\]\):not\(\.wanted\) \.lot-art\[data-finish-game="ptcg"\] \{ padding:2px;/);
assert.match(style,/\.lot-art\[data-finish-game="ptcg"\] > img\.card-img \{[^}]*height:auto; aspect-ratio:auto; object-fit:contain;/);
assert.match(foil,/\.finish-overlay\[data-material-profile="line-holo"\] \.finish-pattern\{[^}]*opacity:\.18\}/,'Scoped opacity must equal generic selector specificity, not be silently overridden');
for(const width of [150,240,390]){
 const inner=width-4,height=inner*825/600;
 const box=containedImageBox(inner,height,600,825);
 assert(Math.abs(box.top)<1e-9&&Math.abs(box.left)<1e-9,'Natural ratio creates no internal letterbox');
 assert(Math.abs(box.height-height)<1e-9&&Math.abs(box.width-inner)<1e-9,'Foil plane covers exactly the uncropped image');
}
assert.match(style,/@media\(prefers-reduced-motion:no-preference\)\{\s*\.cs-banner:not\(\.no-art\) \.cs-art,\.deck-hero > \.hero-art \{animation:header-breathe 20s/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)\{[^\n]*\.cs-banner \.cs-art[^\n]*animation:none!important/);
console.log('PASS: Pokémon natural-ratio collection geometry, scoped quiet Celebrations texture, unchanged mask and accessible header motion policy. Browser screenshots still required.');
