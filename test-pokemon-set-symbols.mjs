import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pkCatalogueSymbolSources,pkSetSymbol} from './emblems.js';
import {setRowContent} from './set-list-ui.js';
import {POKEMON_SET_ART} from './pokemon-set-art.js';
import {S,blank} from './store.js';
import {ui,tcgSets,tcgSet} from './tcg.js';

const realFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('Symbol regressions must not use live providers.');};
const fixtures=[
 ['hgss1','HeartGold SoulSilver','heartgold-soulsilver'],
 ['hgss2','Unleashed','unleashed'],
 ['hgss3','Undaunted','undaunted'],
 ['hgss4','Triumphant','triumphant'],
 ['col1','Call of Legends','call-of-legends'],
 ['bwp','BW Black Star Promos','_promo'],
 ['swsh12.5gg','Crown Zenith Galarian Gallery','crown-zenith'],
 ['ex1','EX Ruby & Sapphire','ruby-and-sapphire-fixed'],
 ['2024sv',"McDonald's Collection 2024",'mcdonalds-collection-dragon-discovery-2024']
].map(([id,name,slug])=>({id,name,slug,code:id.toUpperCase(),symbol:POKEMON_SET_ART[id]?.symbol,image:POKEMON_SET_ART[id]?.logo,count:91,date:'2010-08-18',series:'HeartGold & SoulSilver'}));
const undaunted=fixtures.find(set=>set.id==='hgss3');
const markup=set=>setRowContent({...set,pokemonSet:set,owned:2,detail:`${set.series} · ${set.date}`});
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attributes=html=>Object.fromEntries([...html.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,decode(value)]));
function imageFixture(html) {
 const attrs=attributes(html.match(/<img\b[^>]*>/)?.[0]||''),classes=new Set(['no-art']),requested=[attrs.src];
 const image={dataset:{},hidden:false,parentElement:{classList:{add:cls=>classes.add(cls),remove:cls=>classes.delete(cls)}},get src(){return requested.at(-1);},set src(value){requested.push(value);}};
 for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))image.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
 image.onload=new Function(attrs.onload);image.onerror=new Function(attrs.onerror);
 return {image,classes,requested};
}
try {
 for(const set of fixtures) {
  const before=structuredClone(set),sources=pkCatalogueSymbolSources(set),html=markup(set);
  assert.equal(sources[0],`img/pks/s/${set.slug}.png`,`${set.id}: exact existing symbol identity`);
  assert.equal(sources[1],`https://pokesymbols.com/images/tcg/sets/symbols/${set.slug}.png`);
  assert.ok(sources.length<=3,'a bounded list, not a speculative asset search');
  if(set.symbol)assert.equal(sources[2],set.symbol,'existing mapped provider symbol stays attached to its own release');
  assert.match(html,new RegExp(`data-set-symbol-id="${set.id.replaceAll('.','\\.')}"`));
  assert.equal((html.match(/<img\b/g)||[]).length,1,'one symbol request at a time, not duplicate title art');
  assert.match(html,/class="set-media set-media-pokemon-symbol no-art"/);
  assert.match(html,/role="img" aria-label="/,'the symbol slot has its exact release identity');
  assert.match(html,/class="set-art-code"/);assert.match(html,/2 owned/);
  assert.doesNotMatch(html,/logo\.png|class="pks"|data-fb=|outerHTML|innerHTML|insertAdjacentHTML/);
  assert.deepEqual(set,before,'catalogue rendering never changes the provider data used inside the set');
 }

 // Consume each source once. The real escaped code stays visible until success,
 // and the last error disables both event handlers instead of retrying forever.
 const failed=imageFixture(markup(undaunted));
 assert.ok(failed.classes.has('no-art'));
 while(failed.image.onerror){failed.image.onerror.call(failed.image);assert.ok(failed.requested.length<=3);}
 assert.deepEqual(failed.requested,pkCatalogueSymbolSources(undaunted));
 assert.equal(failed.image.hidden,true);assert.equal(failed.image.onload,null);assert.ok(failed.classes.has('no-art'));
 for(const failures of [0,1,2]) {
  const loaded=imageFixture(markup(undaunted));
  for(let i=0;i<failures;i++)loaded.image.onerror.call(loaded.image);
  loaded.image.onload.call(loaded.image);
  assert.equal(loaded.classes.has('no-art'),false,'a successful symbol replaces the waiting code');
  assert.equal(loaded.image.hidden,false);assert.equal(loaded.requested.length,failures+1);
 }
 const providerOnly={id:'swsh1',name:'',code:'SWSH1',symbol:'https://assets.tcgdex.net/en/swsh/swsh1/symbol'};
 assert.deepEqual(pkCatalogueSymbolSources(providerOnly),['https://assets.tcgdex.net/en/swsh/swsh1/symbol.webp']);
 const single=imageFixture(markup(providerOnly));single.image.onerror.call(single.image);
 assert.equal(single.image.onerror,null);assert.equal(single.requested.length,1);

 // No expansion symbol is invented for the original Base Set, or for a record
 // without a usable source. Those tiles retain the real escaped set code.
 const base={id:'base1',name:'Base Set',code:'BASE1',symbol:POKEMON_SET_ART.base1.symbol};
 assert.deepEqual(pkCatalogueSymbolSources(base),[]);assert.doesNotMatch(markup(base),/<img\b/);assert.match(markup(base),/>BASE1</);
 for(const set of [null,{}, {id:'',name:'Undaunted'}, {id:'../../hgss3',name:'Undaunted'}, {id:'x',name:''}])assert.deepEqual(pkCatalogueSymbolSources(set),[]);
 const hostile={id:'x',name:'<img src=x onerror="alert(1)"> & Friends',code:'<X & "Y">',symbol:'javascript:alert(1)',image:'https://example.invalid/logo.png'};
 const hostileHtml=markup(hostile);assert.match(hostileHtml,/&lt;img/);assert.match(hostileHtml,/&lt;X &amp; &quot;Y&quot;&gt;/);
 assert.doesNotMatch(hostileHtml,/<img src=x|javascript:|example\.invalid|data-fb=|outerHTML/);
 for(const symbol of [
  'javascript:alert(1)','data:image/svg+xml,<svg onload="alert(1)">','//images.pokemontcg.io/hgss3/symbol.png',
  'http://images.pokemontcg.io/hgss3/symbol.png','https://images.pokemontcg.io.evil.test/hgss3/symbol.png',
  'https://images.pokemontcg.io@evil.test/hgss3/symbol.png','https://user:password@images.pokemontcg.io/hgss3/symbol.png',
  'https://images.pokemontcg.io:444/hgss3/symbol.png','https://images.pokemontcg.io/hgss3/logo.png',
  'https://assets.tcgdex.net/en/hgss/hgss3/logo.webp','https://images.scrydex.com/pokemon/me3-logo/logo',
  'https://images.pokemontcg.io/hgss3/symbol.svg','https://images.pokemontcg.io/hgss3/symbol.png#fragment'
 ])assert.equal(pkCatalogueSymbolSources({...undaunted,symbol}).length,2,`Reject unsafe or non-symbol source: ${symbol}`);
 assert.equal(pkCatalogueSymbolSources({id:'me03',name:'',symbol:'https://images.scrydex.com/pokemon/me3-symbol/symbol'}).at(-1),'https://images.scrydex.com/pokemon/me3-symbol/symbol','provider-supplied extensionless image endpoints are not rewritten');

 // Byte-for-byte legacy row snapshot: no Pokemon-only style or structure can
 // leak into Magic (or the YGO release chooser) merely by importing this helper.
 const magic=setRowContent({name:'New Capenna',code:'SNC',image:'https://svgs.scryfall.io/sets/snc.svg',symbol:'<span class="set-icon" aria-hidden="true"></span>',detail:'Expansion · 2022-04-29',count:469});
 assert.equal(magic,'<span class="set-media "><img src="https://svgs.scryfall.io/sets/snc.svg" alt="New Capenna set artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add(\'no-art\')"><span class="set-media-fallback" aria-hidden="true"><span class="set-art-code">SNC</span></span></span><span class="set-row-main"><b><span class="set-icon" aria-hidden="true"></span><span>New Capenna</span></b><span class="set-row-detail"><span class="set-code-mark">SNC</span><span>Expansion · 2022-04-29</span></span></span><span class="set-row-count"><b>469</b><small>cards</small></span>');
 const css=fs.readFileSync(new URL('./sets-ui.css',import.meta.url),'utf8');
 assert.match(css,/\.set-year-grid \.set-media-pokemon-symbol > \.set-catalogue-symbol \{[^}]*grayscale\(1\) invert\(1\)/);
 assert.match(css,/\.set-media-pokemon-symbol\.no-art > \.set-catalogue-symbol \{ display:block; opacity:0;/,'pending lazy images keep a visible-layout box so they can load');
 assert.match(css,/\.set-media-pokemon-symbol > \.set-catalogue-symbol\[hidden\] \{ display:none;/);
 assert.match(css,/\.set-media-pokemon-symbol \.set-art-code \{[^}]*overflow-wrap:anywhere/);
 // Preserve the real stylesheet's reserved dimensions at its existing breakpoints.
 // Overflow and visual balance at 320/390/768/1024/1440/2560 still need hosted QA.
 assert.match(css,/\.set-year-grid \.set-media \{ width:104px; height:84px;/);
 assert.match(css,/@media \(max-width:699px\)[^\n]*\.set-year-grid \.set-media \{ width:80px; height:72px;/);
 assert.match(css,/@media \(max-width:380px\)[^\n]*\.set-year-grid \.set-media \{ width:62px; height:62px;/);

 // Execute both real renderers to prevent a helper-only fix. The catalogue opts
 // in, while the already-approved set header still has its original colored logo.
 const priorState=S.state,priorView=S.ui.view,sets={...ui('ptcg').sets},setScreen={...ui('ptcg').set};
 try {
  S.state=blank();S.state.settings.game='ptcg';S.ui.view='sets';
  Object.assign(ui('ptcg').sets,{list:[undaunted],q:'',kind:'all',sort:'new',limit:80,error:'',busy:false});
  const catalogue=tcgSets();assert.match(catalogue,/data-set-symbol-id="hgss3"/);assert.doesNotMatch(catalogue,/logo\.png|class="pks"/);
  Object.assign(ui('ptcg').set,{info:undaunted,id:undaunted.id,cards:[],candidates:null,error:'',busy:false,filter:'all',q:'',rarity:'',finish:'',sort:'number',limit:80});
  const detail=tcgSet();assert.match(detail,/<img class="set-logo big" src="https:\/\/images.pokemontcg.io\/hgss3\/logo.png"/);
  assert.ok(detail.includes(pkSetSymbol(undaunted,'pks big')),'the existing set-detail symbol markup is unchanged');
  assert.doesNotMatch(detail,/set-media-pokemon-symbol|set-catalogue-symbol/);
 } finally {S.state=priorState;S.ui.view=priorView;Object.assign(ui('ptcg').sets,sets);Object.assign(ui('ptcg').set,setScreen);}
} finally {globalThis.fetch=realFetch;}
console.log('PASS: Pokemon catalogue uses exact monochrome set symbols, finite safe source fallbacks and stable escaped code tiles; Magic rows and approved Pokemon set headers remain unchanged.');
