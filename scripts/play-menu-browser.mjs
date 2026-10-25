// Optional local UI integration check. Uses fixture account/decks, no auth or
// production writes. Actual Play handlers are read from app.js, not duplicated.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(new URL('..',import.meta.url).pathname),out=join(root,'test-results/play-menu-browser');await mkdir(out,{recursive:true});
const source=await readFile(join(root,'app.js'),'utf8'),shell=await readFile(join(root,'index.html'),'utf8');
const handlers=source.slice(source.indexOf('A.playSelectDeck='),source.indexOf('function restoreSheetHistory()'));
assert(handlers.includes('A.playImportUse=')&&handlers.includes('setSelectionRange'));
const fixture=`
import {S,blank,cacheCard} from '/store.js';
import * as V from '/views.js';
import {deckViewer,syncDeckViewers} from '/deck-viewer.js';
import {profileAvatar} from '/profile-art.js';
import {createPlaySetup} from '/play-setup.js';
import {parsePlayDeckImport} from '/play-deck-import.js';
import {parseDeckImport} from '/deck-flow.js';
import {playMenuMarkup} from '/play-menu.js';
import {syncDesktopPlayEntries} from '/desktop-play.js';
S.state=blank();S.ui.view='play';S.state.settings.displayModes={mtg:{deck:'stacks'}};
for(const [name,type] of [['Island','Basic Land — Island'],['Ninja of the Deep Hours','Creature — Human Ninja'],['Satoru Umezawa','Legendary Creature — Human Ninja']])cacheCard({id:name,name,type_line:type,cmc:0,mana_cost:'',rarity:'common',set:'test',prices:{},legalities:{modern:'legal',commander:'legal'}});
let account={user:{id:'a'},profile:{display_name:'Fixture Player',username:'fixture-player'},accountGeneration:1};
const decks={a:[{id:'same',name:'Saved exact list',format:'Modern',cards:[{name:'Island',qty:56},{name:'Ninja of the Deep Hours',qty:4}],side:[{name:'Island',qty:2}]}],b:[{id:'same',name:'Other account deck',format:'Commander',cards:[{name:'Island',qty:99}],side:[]}]};
const playSetup=createPlaySetup({readAccount:()=>account,readDecks:owner=>decks[owner],parseImport:text=>parsePlayDeckImport(text,{parseDeckImport}),resolveNames:async names=>({failed:names.filter(n=>!['Island','Ninja of the Deep Hours','Satoru Umezawa'].includes(n))})});
const renderDeck=d=>d?deckViewer('mtg',V.deckList(d,{readOnly:true,unfiltered:true,preserveExactList:true,cardAction:'playInspectCard'})):'';
function refreshPlayMenu(){const s=playSetup.snapshot();document.querySelector('#content').innerHTML=playMenuMarkup(s,{avatarMarkup:profileAvatar(null,{display_name:s.profile.displayName,username:s.profile.username}),deckTiles:new Map(decks[account.user?.id]?.map(d=>[d.id,V.deckTile(d)])||[]),deckPreview:renderDeck(s.selected),importPreview:renderDeck(s.reviewDeck),formatOptions:['','Modern','Commander'].map(n=>'<option '+(s.draft.format===n?'selected':'')+'>'+n+'</option>').join('')});syncDeckViewers();}
const A={card:()=>{}},I={},C={};
${handlers}
document.addEventListener('input',e=>I[e.target.dataset.input]?.(e.target));
document.addEventListener('change',e=>C[e.target.dataset.change]?.(e.target));
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act]');if(!t||t.disabled)return;await A[t.dataset.act]?.(t);if(t.dataset.act==='deckView'){S.state.settings.displayModes.mtg.deck=t.dataset.mode;syncDeckViewers();}});
window.fixture={snapshot:()=>playSetup.snapshot(),switchAccount:()=>{account={user:{id:'b'},profile:{display_name:'B Player',username:'b-player'},accountGeneration:2};refreshPlayMenu();},eligibility:()=>syncDesktopPlayEntries('mtg')};refreshPlayMenu();
`;
const css=[...shell.matchAll(/<link rel="stylesheet" href="([^\"]+)"/g)].map(m=>m[1]).filter(x=>!x.startsWith('http'));
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+css.map(p=>'<link rel="stylesheet" href="/'+p+'">').join('')+'</head><body data-game="mtg" data-view="play"><div id="app"><main id="content"></main></div><script type="module" src="/fixture.js"></script></body></html>';
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture);return;}if(!/^\/[\w.-]+\.(?:js|css|svg)$/.test(path)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]);res.end(await readFile(join(root,path)));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const module=process.env.CARDSTASHY_PLAYWRIGHT_MODULE||join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'node_modules','playwright/index.mjs');const {chromium}=await import(pathToFileURL(resolve(module)));
const browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const sourceFiles=Object.fromEntries(await Promise.all(['app.js','views.js','tcg.js','shared-deck-view.js','deck-experience.js','play-setup.js','play-menu.js','play-deck-import.js','deck-viewer.js','deck-viewer.css','play-menu.css','scripts/play-menu-browser.mjs'].map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
const report={browser:browser.version(),sourceFiles,cases:[],limits:'Fixture account/decks and mocked name resolver. Actual shared renderers and extracted app handlers. No live authentication, external artwork, engine, match, offline or multiplayer proof.'};
try{
 for(const theme of ['dark','light']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('#playTitle');
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.getByRole('button',{name:'Use this deck',exact:true}).click();assert.equal(await page.locator('#playSelectedTitle').textContent(),'Saved exact list');
  await page.locator('#playImportName').fill('Imported exact list');await page.locator('#playImportText').fill('Commander\n1 Satoru Umezawa\nDeck\n55 Island\n4 Ninja of the Deep Hours\nSideboard\n2 Unknown card');
  await page.getByRole('button',{name:'Preview & match',exact:true}).click();await page.getByRole('button',{name:'Use this list',exact:true}).waitFor();
  await page.locator('#playImportText').focus();await page.locator('#playImportText').press('End');await page.locator('#playImportText').press('Space');
  assert.equal(await page.getByRole('button',{name:'Use this list',exact:true}).count(),0);assert.equal(await page.locator('.play-import-review').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'playImportText');
  await page.getByRole('button',{name:'Preview & match',exact:true}).click();await page.getByRole('button',{name:'Use this list',exact:true}).click();
  assert.equal(await page.locator('#playSelectedTitle').textContent(),'Imported exact list');assert.equal(await page.evaluate(()=>document.activeElement.id),'playSelectedTitle');assert.equal(await page.locator('.deck-viewer').count(),1);
  const chosen=await page.evaluate(()=>fixture.snapshot().selected);assert.deepEqual(chosen.side,[{name:'Unknown card',qty:2}]);assert.deepEqual(chosen.commanders,[{name:'Satoru Umezawa',qty:1}]);
  for(const mode of ['compact','stacks','gallery','symbols']){
   await page.locator('[data-act="deckView"][data-mode="'+mode+'"]').click();assert.equal(await page.locator('.deck-viewer').getAttribute('data-deck-view'),mode);
   assert.deepEqual(await page.evaluate(()=>fixture.snapshot().selected),chosen);
  }
  assert(await page.getByRole('button',{name:'Play CPU',exact:true}).isDisabled());
  for(const width of [1280,1920]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:join(out,theme+'.png'),fullPage:true});
  await page.evaluate(()=>fixture.switchAccount());assert.equal(await page.locator('#playImportText').inputValue(),'');assert.equal(await page.locator('#playSelectedTitle').count(),0);assert.equal(await page.getByText('Other account deck',{exact:true}).count(),1);assert.deepEqual(errors,[]);
  report.cases.push({theme,passed:true,widths:[1280,1440,1920],sourcePreserved:true,stalePreviewRemoved:true,focusPreserved:true,accountSwitchClears:true,errors});await page.close();
 }
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
