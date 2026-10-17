import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {captureDisclosures,restoreDisclosures} from './ui.js';
import {atLeastOne} from './deckaudit.js';
import {buildDeck} from './builder.js';
import assert from 'node:assert/strict';
import {playGuide,guideHtml} from './guide.js';
import {mtgFacts} from './facts.js';
import {completionPlan} from './planner.js';
import {cardKey,deckStats} from './core.js';
import {applyProductPrices,pokemonPriceRoute} from './pokemon-prices.js';
import {setKind,tcgSets,ui} from './tcg.js';
import {S,blank} from './store.js';
import {learnSheet} from './rules.js';
const choice={name:'Choice of Damnations',type_line:'Sorcery',cmc:6,oracle_text:'Target opponent chooses a number. You may have that player lose that much life. If you don’t, that player sacrifices all but that many permanents of their choice.'};
const guide=playGuide('mtg',choice);assert.equal(guide.roles[0].id,'choice');assert.match(guide.roles[0].when,/life total and permanent count/);assert.match(guide.roles[0].syn,/indestructible/);assert.doesNotMatch(guideHtml('mtg',choice,guide),/No special effect/);
const odd={name:'Unknown effect',type_line:'Sorcery',oracle_text:'An effect outside the known pattern library.'};assert.match(guideHtml('mtg',odd,playGuide('mtg',odd)),/An effect outside/);
const mountain={id:'arn77',name:'Mountain',set_name:'Arabian Nights',released_at:'1993-12-17',reprint:true};
const facts=mtgFacts(mountain,[{id:'som',set_name:'Scars of Mirrodin',released_at:'2010-10-01'}, {id:'bad'}]).join(' ');assert.match(facts,/Arabian Nights.*1993/);assert.doesNotMatch(facts,/First printed|undefined|NaN/);
const leader={name:'Leader',type_line:'Legendary Creature',legalities:{commander:'legal'},color_identity:[],prices:{usd:'1'}};
const spells=Array.from({length:100},(_,i)=>({name:'Spell '+i,type_line:'Artifact',legalities:{commander:'legal'},color_identity:[],prices:{usd:'.01'}}));
const cat=Object.fromEntries([leader,...spells].map(c=>[cardKey(c.name),c]));
const plan=completionPlan({format:'Commander',commander:'Leader',cards:[{name:'Leader',qty:1}]},[],[],cat,{budget:100});assert.ok(plan.open>=36,'unavailable mana slots remain open instead of becoming spells');assert.ok(plan.deck.cards.reduce((n,r)=>n+r.qty,0)<=64);
assert.equal(deckStats({cards:[{name:'Mountain',qty:36}]},{}).lands,36,'unambiguous basics counted before hydration');
const card={id:'base1-8',variants:[{key:'detail:unlimited',label:'Unlimited · Holofoil',productId:42425,usd:null}],prices:{usd:null}};
const quote={productId:42425,subTypeName:'1st Edition Holofoil',marketPrice:24.11,lowPrice:11.48};assert.ok(applyProductPrices(card,{cardId:card.id,quotes:[quote]}));assert.equal(card.variants[0].usd,null);assert.equal(card.variants[1].usd,24.11);assert.match(card.prices.referenceVariantLabel,/1st Edition/);
const oldCaches=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};const urls=[];
try{const r=await pokemonPriceRoute(new URL('https://app.test/api/prices/pokemon?id=base1-8'),{waitUntil(){}},async u=>{urls.push(u);return Response.json(u.includes('tcgdex')?{id:'base1-8',set:{name:'Base Set'},variants_detailed:[{thirdParty:{tcgplayer:42425}}]}:u.endsWith('/groups')?{results:[{name:'Base Set',groupId:604},{name:'Deck Exclusives',groupId:1840}]}:u.includes('/1840/')?{results:[quote,{...quote,productId:999}]}:{results:[]});});const body=await r.json();assert.deepEqual(body.quotes,[quote]);assert.equal(urls.length,4,'supplemental lookup bounded to a named group');}finally{globalThis.caches=oldCaches;}
S.state={...blank(),settings:{game:'ygo'}};const U=ui('ygo').sets;Object.assign(U,{list:[{name:'Starter Deck',code:'SD',id:'sd',date:'2020-01-01'},{name:'New Booster',code:'NB',id:'nb',date:'2026-10-01'},{name:'Old Booster',code:'OB',id:'ob',date:'2002-01-01'}],q:'',kind:'all',limit:80});const html=tcgSets();assert.ok(html.indexOf('New Booster')<html.indexOf('Starter Deck'));assert.match(html,/class="year">2026/);U.kind='decks';assert.doesNotMatch(tcgSets(),/New Booster/);assert.equal(setKind('Structure Deck: Test'),'decks');
for(const game of ['mtg','ptcg','ygo']){const h=learnSheet(game);assert.match(h,/Core|turn|Turn/);assert.match(h,/rule-dex/);assert.match(h,/data-act="closeSheet"/);}
console.log('PASS: effect coverage, partial-printing dates, reserved Commander mana, basic land counts, exact edition market quotes, bounded supplemental pricing, organized sets and all-game learning sheets.');

assert(atLeastOne(60,12,7)<.85,'12 one-drops in 60 do not guarantee an 85% opening chance');
const built=buildDeck({format:'Commander',seeds:[leader],catalog:cat,price:()=>.01,budget:100});assert.equal(built.lands,36,'generated basics count as lands even before metadata hydration');

const details=(label,open)=>({open,querySelector:()=>({textContent:label})});
const before=[details('Filters',true),details('Advanced',false),details('Advanced',true)];
const state=captureDisclosures({querySelectorAll:()=>before});
const after=[details('Filters',false),details('Advanced',true),details('Advanced',false),details('New section',true)];
restoreDisclosures({querySelectorAll:()=>after},state);assert.deepEqual(after.map(d=>d.open),[true,false,true,true],'both open and closed disclosures survive refresh, including duplicate summaries');

// Source-only layout contracts supplement, never replace, hosted geometry checks.
const layout=readFileSync(new URL('./style.css',import.meta.url),'utf8');
assert.doesNotMatch(layout,/body\[data-view=["']deck["']\]\s+\.topbar\s*\{[^}]*display\s*:/,'Deck workspaces inherit the same responsive game-switch header grid as every section');
const wrapping=layout.match(/\.actions\.wrap\s*>\s*\.btn\s*\{([^}]+)\}/)?.[1]||'';
for(const rule of [/min-width\s*:\s*0/,/max-width\s*:\s*100%/,/white-space\s*:\s*normal/,/overflow-wrap\s*:\s*anywhere/])assert.match(wrapping,rule,'Long action labels shrink and wrap instead of overflowing narrow panels');
assert.doesNotMatch(wrapping,/overflow(?:-x)?\s*:\s*(?:hidden|clip)|font-size\s*:/,'Containment must not clip labels or reduce their type size');
console.log('PASS: shared deck header grid and naturally wrapping action groups retain responsive layout without clipping or smaller text.');

// Execute the actual shared-shell observer against changing measured geometry.
const application=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const observerStart=application.indexOf('function observeShellHeader('),observerEnd=application.indexOf('attachGameTabs($("#gameTabs"));',observerStart);
assert(observerStart>=0&&observerEnd>observerStart);
assert.equal((application.match(/  observeShellHeader\(\);/g)||[]).length,1,'The long-lived shell installs one header observer during boot');
const observeHeader=vm.runInNewContext(application.slice(observerStart,observerEnd)+';observeShellHeader');
let measured=124.25,callback,observed,disconnected=0,created=0;const updates=[];
const header={getBoundingClientRect:()=>({height:measured})},root={style:{setProperty:(key,value)=>updates.push([key,value])}};
const cleanup=observeHeader(header,root,{ResizeObserver:class{constructor(fn){created++;callback=fn;}observe(node){observed=node;}disconnect(){disconnected++;}}});
assert.equal(created,1);assert.equal(observed,header);assert.deepEqual(updates,[['--shell-header-height','125px']]);
for(const height of [124.25,169.1,80,80,0,Infinity,121]){measured=height;callback();}
assert.deepEqual(updates.map(([,value])=>value),['125px','170px','80px','0px','121px'],'Resize updates follow real phone/tablet/desktop heights, coalesce unchanged values and reject invalid geometry');
cleanup();assert.equal(disconnected,1);
let listener,removed;const fallback=observeHeader(header,root,{addEventListener:(event,fn)=>{assert.equal(event,'resize');listener=fn;},removeEventListener:(event,fn)=>{assert.equal(event,'resize');removed=fn;}});
measured=88;listener();assert.equal(updates.at(-1)[1],'88px');fallback();assert.equal(removed,listener);
assert.match(layout,/\.tabs\s*\{[^}]*top:\s*var\(--shell-header-height,\s*0px\)/);
assert.doesNotMatch(layout,/\.tabs\s*\{\s*top:\s*61px/);
console.log('PASS: actual shared shell header observer measures once, tracks live resize without polling and cleans up its observer/fallback listener.');

assert.match(layout,/\.bottom-nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/,'All five bottom navigation tracks can fit a 320px viewport');
assert.match(layout,/\.bottom-nav button\s*\{[^}]*min-width:\s*0/);
assert.match(layout,/\.bottom-nav button\s*\{[^}]*padding-inline:\s*2px/);
assert.match(layout,/\.bottom-nav button span\s*\{[^}]*max-width:\s*100%/);
console.log('PASS: bottom navigation retains five equal shrinkable tracks and full-label space without clipping.');
