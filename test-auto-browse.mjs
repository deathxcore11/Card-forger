import assert from 'node:assert/strict';
import {attachAutomaticBrowse,AUTO_BROWSE_SELECTOR} from './auto-browse.js';
import {pokemonFallback,artworkSources} from './artwork.js';
let callback,observed=[],loads=[];
class Observer{constructor(cb,options){callback=cb;assert.equal(options.rootMargin,'400px 0px');}observe(x){observed.push(x);}unobserve(){}disconnect(){}}
function button(act,opts={}){return {dataset:{act},isConnected:true,disabled:false,hidden:false,ownerDocument:{createElement(){return {dataset:{},setAttribute(){},remove(){this.removed=true;}}}},before(marker){this.marker=marker;},...opts};}
const a=button('tMore'),b=button('dbMore',{disabled:true}),c=button('tSetsMore');
const root={querySelectorAll(selector){assert.equal(selector,AUTO_BROWSE_SELECTOR);return [a,b,c];}};
const cleanup=attachAutomaticBrowse(root,{Observer,dispatch:x=>loads.push(x.dataset.act),errorFor:act=>act==='tSetsMore'});
assert.equal(a.hidden,true);assert.equal(c.hidden,false);assert.equal(c.textContent,'Try loading again');assert.equal(observed.length,2);
callback([{target:a.marker,isIntersecting:false}]);await Promise.resolve();assert.equal(loads.length,0);
callback([{target:a.marker,isIntersecting:true},{target:a.marker,isIntersecting:true},{target:b.marker,isIntersecting:true}]);await Promise.resolve();assert.deepEqual(loads,['tMore']);
cleanup();
const gone=button('collMore',{isConnected:false});attachAutomaticBrowse({querySelectorAll:()=>[gone]},{Observer,dispatch:x=>loads.push(x.dataset.act)});callback([{target:gone.marker,isIntersecting:true}]);await Promise.resolve();assert.equal(loads.length,1);
const unsupported=button('setMore');attachAutomaticBrowse({querySelectorAll:()=>[unsupported]},{dispatch(){}});assert.equal(unsupported.hidden,false);
const failed=button('dbMore');attachAutomaticBrowse({querySelectorAll:()=>[failed]},{Observer,dispatch:()=>Promise.reject(Error('offline'))});callback([{target:failed.marker,isIntersecting:true}]);await new Promise(r=>setTimeout(r,0));assert.equal(failed.hidden,false);assert.equal(failed.marker.removed,true);
let modal=true,resume;const queued=button('tMore');const modalRoot={querySelectorAll:()=>[queued],ownerDocument:{addEventListener(event,fn){resume=fn;},removeEventListener(){}}};attachAutomaticBrowse(modalRoot,{Observer,blocked:()=>modal,dispatch:()=>loads.push('resumed')});callback([{target:queued.marker,isIntersecting:true}]);await Promise.resolve();assert.ok(!loads.includes('resumed'));modal=false;resume();await Promise.resolve();assert.ok(loads.includes('resumed'));
const correct='https://images.pokemontcg.io/cel25c/54_A_hires.png';assert.equal(pokemonFallback({id:'cel25cc-CC022'}),correct);assert.equal(artworkSources({game:'ptcg',id:'cel25cc-CC022',image:'https://images.pokemontcg.io/cel25c/CC022_hires.png'})[0],correct);
console.log('PASS: scroll-triggered browsing, one dispatch per sentinel, disabled/detached guards, visible retry and unsupported-browser fallback, exact Classic Collection art overrides stale cached URLs.');
