// Reproduce the Pokémon wrapper bug through the real ambient controller.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pokemonArtCrop} from './artwork.js';
const app=fs.readFileSync('app.js','utf8');
const controller=app.slice(app.indexOf('function updateAmbient()'),app.indexOf('// Emoji / stock symbols'));
assert.match(pokemonArtCrop({game:'ptcg',id:'base1-4'},'hh-art','https://assets.tcgdex.net/en/base/base1/4/high.webp'),/<span class="hh-art pk-crop"[^>]*><span class="pk-win"><img/);
for(const theme of ['dark','light']) {
 const memory=new Map(),values={},art={dataset:{},style:{}},body={dataset:{game:'ptcg'},style:{setProperty:(k,v)=>values[k]=v},classList:{toggle:(k,v)=>{values[k]=v}}};
 let hero=null;
 const context=vm.createContext({document:{body,documentElement:{dataset:{theme}}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},AMBIENT_KEY:'ambient',glassOn:()=>true,$:s=>s==='#ambient .amb-art'?art:hero});
 vm.runInContext(controller,context);
 const update=()=>vm.runInContext('updateAmbient()',context);
 const image=(src,currentSrc='')=>({hidden:false,currentSrc,getAttribute:k=>k==='src'?src:null});
 for(const game of ['ptcg','mtg','ygo']) {
  body.dataset.game=game;
  const src=`https://art.test/${game}.jpg`,img=image(src);
  hero=game==='ptcg'?{hidden:false,querySelector:()=>img}:img;
  update();
  assert.equal(art.dataset.src,src,`${theme}: ${game} daily art reaches the backdrop`);
  assert.equal(values['--ambient-art-image'],`url("${src}")`);
  assert.equal(values.glass,true);
 }
 body.dataset.game='ptcg';hero=null;update();
 assert.equal(art.dataset.src,'https://art.test/ptcg.jpg','non-home routes retain Pokémon art, never another game');
 const img=image('https://art.test/pokemon-fallback.jpg','https://art.test/pokemon-loaded.jpg');
 hero={hidden:false,querySelector:()=>img};update();
 assert.equal(art.dataset.src,img.currentSrc,'the loaded fallback replaces the prior source');
 img.hidden=true;update();assert.equal(art.dataset.src,img.currentSrc,'missing art preserves the last usable backdrop');
 hero=null;memory.set('ambient','bad JSON');update();assert.equal(art.dataset.src,'','corrupt cache cannot leak previous-game art');
 context.localStorage={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 hero={hidden:false,querySelector:()=>image('https://art.test/private-mode.jpg')};update();
 assert.equal(art.dataset.src,'https://art.test/private-mode.jpg','the current art works even when storage is unavailable');
}
console.log('PASS: actual ambient controller reads nested Pokémon images and direct Magic/YGO art in both themes; per-game persistence, loaded fallbacks, missing art, corrupt/denied storage.');
