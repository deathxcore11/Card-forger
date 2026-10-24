// Actual saved, shared/source and generated deck renderers with synthetic art.
// No accounts, collection changes, live provider requests or AI calls.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,CARDS,inventorySnapshot} from './search-fixtures.mjs';
import {cardKey} from '../core.js';

assert(process.env.GITHUB_ACTIONS==='true'||process.argv.includes('--local')&&process.env.CARDSTASHY_LOCAL_BROWSER==='1','Use hosted CI or --local with CARDSTASHY_LOCAL_BROWSER=1.');
const widths=[320,390,768,1440,1920],checks=[];
const {chromium}=await import(process.env.CARDSTASHY_PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{} )});
await mkdir('test-results',{recursive:true});

function mixedCards(game){
 const cards=structuredClone(CARDS[game].slice(0,14));
 if(game==='mtg'){
  const types=['Creature — Elf Druid','Basic Land — Forest','Instant','Artifact Creature — Golem','Artifact','Sorcery','Enchantment','Planeswalker — Fixture','Battle — Siege'];
  cards.forEach((c,i)=>{c.type_line=types[i]||'Creature — Human';c.oracle_text=i===0?'{T}: Add {G}.':i===1?'':i===2?'Destroy target creature.':'Synthetic fixture only.';c.keywords=[];c.cmc=i===1?0:2;c.mana_cost=i===1?'':'{1}{G}';});
 }else if(game==='ptcg'){
  cards[12]=structuredClone(CARDS.ptcg.find(c=>c.category==='Trainer'));
  cards[13]=structuredClone(CARDS.ptcg.find(c=>c.category==='Energy'));
 }else{
  cards.forEach((c,i)=>{c.category=[1,4].includes(i)?'Spell':[5,7].includes(i)?'Trap':'Monster';c.typeLine=c.category==='Monster'?'Effect Monster':c.category+' Card';c.extra=false;});
 }
 return cards;
}
const fingerprint=rows=>rows.map(r=>JSON.stringify(r)).sort();
async function changeView(page,root,mode){
 const viewer=page.locator(root),own=viewer.locator('.deck-view-switch'),controls=await own.count()?own:page.locator('#content .deck-view-switch');
 await controls.locator(`[data-mode="${mode}"]`).click();
 await page.waitForFunction(({root,mode})=>document.querySelector(root)?.dataset.deckView===mode,{root,mode});
}
async function exercise(page,{root,label,game,readOnly=false}){
 await changeView(page,root,'compact');
 const viewer=page.locator(root);
 const snapshot=()=>viewer.locator('[data-deck-card]').evaluateAll(ns=>ns.map(n=>({name:n.dataset.deckName,qty:n.dataset.deckQty,zone:n.dataset.deckZone,category:n.dataset.deckCategory,roles:n.dataset.deckRoles,actions:[...n.querySelectorAll('[data-act]')].map(a=>({...a.dataset})),selected:[...n.querySelectorAll('input[type="checkbox"]')].map(a=>a.checked)})));
 const before=await snapshot();assert(before.length>=14,label+' has the mixed card fixture');
 await viewer.evaluate(n=>{window.__stackOriginalNodes=[...n.querySelectorAll('[data-deck-card]')];});
 for(const width of widths){
  await page.setViewportSize({width,height:1100});
  await page.waitForLoadState('networkidle');
  await changeView(page,root,'compact');
  // Provider/bootstrap refreshes may replace rows between viewport scenarios.
  // Within each scenario the view switch must retain the current exact nodes.
  await viewer.evaluate(n=>{window.__stackOriginalNodes=[...n.querySelectorAll('[data-deck-card]')];});
  await changeView(page,root,'stacks');
  const after=await snapshot();assert.deepEqual(fingerprint(after),fingerprint(before),label+' stacks retain exact cards, zones, quantities, actions and selected state');
  assert(await viewer.evaluate(n=>{const rows=[...n.querySelectorAll('[data-deck-card]')];return rows.length===window.__stackOriginalNodes.length&&rows.every(row=>window.__stackOriginalNodes.includes(row));}),label+' keeps every original card node');
  const geometry=await viewer.evaluate(n=>{
   const bounds=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
   const lists=[...n.querySelectorAll('[data-deck-list]')].filter(x=>x.getClientRects().length);
   const groups=[...n.querySelectorAll('[data-deck-stack-group]')];
   return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,root:bounds(n),headings:[...n.querySelectorAll('details.group > summary,.deck-stack-heading')].filter(e=>e.getClientRects().length).map(e=>({box:bounds(e),parent:bounds(e.parentElement),client:e.clientWidth,scroll:e.scrollWidth})),lists:lists.map(list=>({box:bounds(list),client:list.clientWidth,scroll:list.scrollWidth,cards:[...list.querySelectorAll('[data-deck-card]')].map(card=>({name:card.dataset.deckName,box:bounds(card),art:bounds(card.querySelector('.lot-art,.row-thumb,.mini-art,.deck-compact-art,.img-missing')||card)}))})),groups:groups.map(group=>({label:group.dataset.deckStackGroup,text:group.querySelector('.deck-stack-heading,.deck-stack-group-head,h3,h4,summary')?.textContent||group.firstElementChild?.textContent||'',count:group.dataset.deckCount,cards:[...group.querySelectorAll('[data-deck-card]')].map(card=>({category:card.dataset.deckCategory,qty:Number(card.dataset.deckQty)}))})),ramp:[...n.querySelectorAll('[data-deck-card]')].filter(card=>String(card.dataset.deckRoles).split(',').includes('Ramp')).map(card=>({roles:card.dataset.deckRoles,text:card.innerText,visibleBadges:[...card.querySelectorAll('.deck-stack-roles,.deck-stack-role')].some(e=>e.getClientRects().length)}))};
  });
  assert(geometry.documentWidth<=width+2,label+' '+width+' fits browser width: '+JSON.stringify(geometry));
  assert(geometry.root.left>=-.5&&geometry.root.right<=width+.5,label+' '+width+' viewer fits browser');
  assert(geometry.groups.length>=3,label+' '+width+' shows logical card categories');
  for(const heading of geometry.headings)assert(heading.scroll<=heading.client+2&&heading.box.width<=heading.parent.width+2,label+' '+width+' headings fit without colliding: '+JSON.stringify(heading));
  for(const group of geometry.groups){
   const categories=[...new Set(group.cards.map(c=>c.category))];assert.equal(categories.length,1,label+' each stack category contains only its own cards');
   const count=group.cards.reduce((sum,c)=>sum+c.qty,0);
   if(group.count!==undefined)assert.equal(Number(group.count),count,label+' category count includes all copies');
   else assert(new RegExp('(?:^|\\D)'+count+'(?:\\D|$)').test(group.text),label+' category heading shows its total copies: '+JSON.stringify(group));
  }
  for(const list of geometry.lists){
   assert(list.scroll<=list.client+2,label+' '+width+' wraps stacks without horizontal scroll');
   for(const card of list.cards){
    assert(card.box.left>=list.box.left-1&&card.box.right<=list.box.right+1,label+' '+width+' complete card fits its list: '+JSON.stringify(card));
    assert(card.box.top>=list.box.top-1&&card.box.bottom<=list.box.bottom+1,label+' '+width+' card stays inside its category height: '+JSON.stringify({card,list:list.box}));
    assert(card.art.width>50&&Math.abs(card.art.width/card.art.height-63/88)<.06,label+' retains complete portrait art');
    if(readOnly)assert(card.box.bottom-card.art.bottom<=8,label+' read-only card has no large footer: '+JSON.stringify(card));
   }
  }
  if(game==='mtg'){
   assert(geometry.ramp.length>0,label+' retains the Ramp classification');
   assert(geometry.ramp.some(card=>card.visibleBadges||/Ramp/.test(card.text)),label+' shows compact Ramp information');
  }
  if(width===390||width===1440){
   await viewer.evaluate(n=>{const body=n.closest('#sheetBody');if(body)body.scrollTop+=n.getBoundingClientRect().top-body.getBoundingClientRect().top-16;else scrollTo(0,Math.max(0,n.getBoundingClientRect().top+scrollY-100));});
   await page.screenshot({path:`test-results/deck-stacks-${label}-${width}.png`,fullPage:false,animations:'disabled'});
  }
  await changeView(page,root,'compact');
  assert.deepEqual(await snapshot(),before,label+' restores the original source order after leaving Stacks');
  assert(await viewer.evaluate(n=>[...n.querySelectorAll('[data-deck-card]')].every((row,i)=>row===window.__stackOriginalNodes[i])),label+' restores the original node order');
  checks.push({label,game,width,categories:geometry.groups.length,exactCards:true,noHorizontalScroll:true,originalNodes:true,sourceOrderRestored:true,noReadOnlyFooter:readOnly});
 }
}
try{
 for(const game of ['mtg','ptcg','ygo']){
  const cards=mixedCards(game),main=cards.map((c,i)=>({name:c.name,cardId:c.id,qty:i%3+1}));
  const deck={id:'stacks-layout',name:'Stack category fixture',format:game==='mtg'?'Standard':game==='ygo'?'tcg':'standard',...(game==='mtg'?{cards:main,side:[{...main[0],qty:2}],versions:[]}:{zones:{main,extra:game==='ygo'?[{...main[0],qty:1}]:[],side:game==='ygo'?[{...main[2],qty:2}]:[]}})};
  const app=await openSearchApp(browser,server.base,{game,width:390,hasTouch:false,evidenceLabel:'stack-layout-'+game,prepareFixtures:f=>{
   for(const card of cards)if(game==='mtg')f.catalog[cardKey(card.name)]=card;else f.cache[game][card.id]=card;
   (game==='mtg'?f.state:f.state.tcg[game]).decks.push(deck);
  }});
  try{
   const {page}=app,before=await inventorySnapshot(page);
   await page.locator('[data-nav="decks"]:visible').first().click();await page.locator('.deck-tile').filter({hasText:deck.name}).click();await page.waitForLoadState('networkidle');
   await exercise(page,{root:'#content .deck-viewer',label:'saved-'+game,game});
   await page.evaluate(async({game,cards,main})=>{
    const T=await import('/tcg.js'),{syncDeckViewers}=await import('/deck-viewer.js');
    T.proven.spec={sharedItem:{game,key:'stack-shared',title:'Synthetic shared stack fixture',format:game==='mtg'?'Standard':'standard',deckSchema:1,cards:[...main.map((r,i)=>({...r,zone:'main',image:cards[i].image_uris?.normal||cards[i].image||cards[i].imageUrl||`img/ygo/${cards[i].id}.jpg`,referenceUSD:null})),{...main[0],zone:'side',qty:2,image:cards[0].image_uris?.normal||cards[0].image||cards[0].imageUrl||`img/ygo/${cards[0].id}.jpg`,referenceUSD:null}]}};
    document.querySelector('#sheetBody').innerHTML=T.provenSheetHtml();
    document.documentElement.classList.add('sheet-open');document.querySelector('#sheet').showModal();syncDeckViewers();
   },{game,cards,main});
   await exercise(page,{root:'#sheet .deck-viewer',label:'shared-'+game,game,readOnly:true});
   if(game==='mtg'){
    await page.evaluate(async({cards,main})=>{
     const V=await import('/views.js'),{syncDeckViewers}=await import('/deck-viewer.js');
     document.querySelector('#sheetBody').innerHTML=V.ideaSheet({commander:cards[0],plan:'Synthetic selection fixture'},{id:'stack-proposal',name:'Selection fixture',format:'Commander',commander:cards[0].name,cards:main,side:[]},{budget:50,busy:false,msg:''},new Set([main[0].name]));syncDeckViewers();
    },{cards,main});
    await exercise(page,{root:'#sheet .deck-viewer',label:'generated-mtg',game,readOnly:true});
    assert.equal(await page.locator('#sheet .deck-viewer input:checked').count(),1,'grouping never loses the selected proposal card');
   }
   assert.equal(await inventorySnapshot(page),before,'stack layout never changes decks or collection');app.health();
  }finally{await app.context.close();}
 }
}finally{
 await writeFile('test-results/deck-stacks-layout-browser.json',JSON.stringify({checks,syntheticArt:true,status:checks.length===35?'passed':'incomplete'},null,2));await browser.close();await server.close();
}
console.log('PASS: categorized saved/source/generated stacks across three games and five widths fit without horizontal scrolling or gray footers; quantities, selected cards and original node order remain intact.');
