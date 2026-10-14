import assert from 'node:assert/strict';
import {pokemonFallback,artworkSources,handleArtworkError} from './artwork.js';
import {ptcgImage,normalizePtcg} from './ptcg.js';
import {SheetHistory} from './sheet-history.js';
import {selectSetProduct,magicSetArtwork} from './set-art.js';
assert.equal(pokemonFallback({id:'svp-205'}),'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_205_R_EN.png');
assert.equal(pokemonFallback({id:'svp-216'}).includes('SVP_216_R_EN'),true);assert.equal(pokemonFallback({id:'unknown-205'}),'');assert.equal(pokemonFallback({id:'svp-ABC'}),'');
assert.equal(ptcgImage('https://example.com/card.png'),'https://example.com/card.png');
const urls=artworkSources({game:'ptcg',id:'svp-205',image:'https://example.com/broken.webp'});assert.equal(urls.length,3);assert.equal(urls[2],'img/ptcg/s/svp-205.jpg','TCGplayer image is the last resort');
let appended=0;const image={dataset:{artSources:JSON.stringify(urls),artIndex:'0'},className:'card-img',insertAdjacentHTML(){appended++;}};
handleArtworkError({target:image});assert.equal(image.src,urls[1]);assert.equal(appended,0);handleArtworkError({target:image});assert.equal(image.src,urls[2]);handleArtworkError({target:image});assert.equal(image.hidden,true);handleArtworkError({target:image});assert.equal(appended,1);
const trail=new SheetHistory(2),a={type:'tcard',id:'a'},b={type:'proven',key:'b'},c={type:'tcard',id:'c'};
assert.equal(trail.push({ctx:a,html:'card',scroll:125},a),false);trail.push({ctx:a,html:'card',scroll:125},b);trail.push({ctx:b,html:'deck',scroll:300},c);assert.equal(trail.pop().html,'deck');assert.equal(trail.pop().scroll,125);assert.equal(trail.push({ctx:{type:'account'}},a),false,'auth forms are not retained');
const set={code:'FDN',sealedProduct:[{name:'Foundations Collector Booster Box',identifiers:{tcgplayerProductId:'123'}},{name:'Foundations Play Booster Box',identifiers:{tcgplayerProductId:'456'}}]};assert.equal(selectSetProduct(set).identifiers.tcgplayerProductId,'456');
let requests=0;const fetcher=async()=>{requests++;return new Response(JSON.stringify({data:[set]}));};assert.equal((await magicSetArtwork('fdn',fetcher)).url,'https://tcgplayer-cdn.tcgplayer.com/product/456_200w.jpg');await magicSetArtwork('FDN',fetcher);assert.equal(requests,1);assert.equal(await magicSetArtwork('../bad',fetcher),null);assert.equal(selectSetProduct({}),null);
console.log('PASS: exact promo matching, image retry/exhaustion, no invented artwork, same-sheet refresh isolation, scroll/deck back stack, auth exclusion, verified product IDs and shared catalogue caching.');

assert.equal(pokemonFallback({id:"sm3.5-78"}),"https://images.pokemontcg.io/sm35/78_hires.png");
assert.equal(pokemonFallback({id:"smp-SM196"}),"https://images.pokemontcg.io/smp/SM196_hires.png");
