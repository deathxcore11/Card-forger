import assert from 'node:assert/strict';
import {homeIntent,rankHomeCards,homeResultRow} from './home-search.js';
import {findInfo,INFO_TOPICS} from './app-info.js';
import {newTable,changeCounter,changeStatus,undoPlayer,saveTable,loadTable} from './tabletop.js';
import {completionSummary,makeAskTools} from './ai-tools.js';
assert.equal(homeIntent('Charizard'),'cards');assert.equal(homeIntent('Rule of Law'),'cards');assert.equal(homeIntent('Which deck can I finish?'),'ask');
assert.deepEqual(rankHomeCards([{id:'real-1',name:'Charizard'},{id:'pocket',name:'Charizard',pocket:true},{id:'other',name:'Vikavolt'}],'charzaed').map(c=>c.id),['real-1']);
assert.equal((homeResultRow('ptcg',{id:'p',name:'<script>',set:{name:'Set',number:'4'},prices:{usd:null}},0).match(/<script>/g)||[]).length,0);
assert(findInfo('condition').some(t=>t.id==='prices'));assert(INFO_TOPICS.every(t=>t.details.length&&t.action));
const tables=['mtg','ptcg','ygo'].map(g=>newTable(g,{players:4,commander:true}));
for(const s of tables){assert(changeCounter(s,0,'life',-1));assert(changeCounter(s,1,'life',-5));const other=s.players[1].life;assert(undoPlayer(s,0));assert.equal(s.players[1].life,other,'one player cannot undo another player');}
const m=tables[0];changeCounter(m,1,'commander:0-1',5);changeCounter(m,1,'commander:0-2',3);changeCounter(m,2,'commander:0-1',2);undoPlayer(m,1);assert.equal(m.players[1].damage['0-1'],5);assert.equal(m.players[1].damage['0-2'],0);assert.equal(m.players[2].damage['0-1'],2);
const p=tables[1];changeCounter(p,0,'pokemon:0:damage',30);changeCounter(p,0,'pokemon:1:damage',10);changeStatus(p,0,1,'Poisoned + Burned');undoPlayer(p,0);assert.equal(p.players[0].pokemon[1].status,'None');assert.equal(p.players[0].pokemon[0].damage,30);assert.equal(p.players[0].pokemon[1].damage,10);
const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};for(const t of tables){saveTable(t,storage);assert.deepEqual(loadTable(t.game,storage),t);}assert.equal(changeCounter(p,0,'evil',1),false);assert.equal(changeCounter(p,0,'life',Infinity),false);assert.equal(saveTable(p,{setItem(){throw Error('full');}}),false);
const state={collection:[{name:'Known',qty:3,condition:'LP'},{name:'Unknown',qty:2,condition:'DMG'}],decks:[]};const x={S:{state,catalog:{}},T:{game:()=> 'mtg'},collectionValue:()=>({total:6,copies:5,unpriced:2}),lotPrice:e=>e.name==='Known'?2:null,A:{helpOpen:t=>t.dataset.id}};
const tools=makeAskTools(x),c=await tools.my_collection({game:'mtg'});assert.equal(c.cards[0].value,6);assert.equal(c.cards[0].each,2);assert.equal(c.cards[1].value,null);assert.equal(c.cards[1].each,null);assert((await tools.build_deck({game:'mtg',format:'',style:'blue'})).requiresChoice);assert.equal(await tools.open({kind:'help',game:'ygo',ref:'prices'}),'prices','help opens without switching game');assert.equal(await tools.open({kind:'help',game:'mtg',ref:'malicious'}),undefined);
console.log('PASS: typo ranking, unknown condition values, exact copy totals, format requirement, help allowlist, isolated counters, commander sources, per-position Pokémon, Undo and reload.');

const completion=completionSummary([{name:'Mountain',qty:20},{name:'Mountain',qty:4},{name:'Threat',qty:4}],n=>n==='Mountain'?12:0,n=>n==='Mountain'?.1:null);
assert.equal(completion.totalCopies,28);assert.equal(completion.ownedCopies,12);assert.equal(completion.missingCopies,16);assert.equal(completion.costToFinish,null);assert.equal(completion.pricedMissingSubtotal,1.2);assert.equal(completion.unpricedMissingCopies,4);
const {setCardFacets,setFinishLabel,setVariantKey,filterSortSetCards}=await import('./set-list-ui.js');
const variants=[{id:'a',name:'A',variants:[{key:'detail:opaque-a',label:'First Edition · Shadowless · Holofoil'}]},{id:'b',name:'B',variants:[{key:'detail:opaque-b',label:'First Edition · Shadowless · Holofoil'},{key:'normal'}]}];
const facets=setCardFacets(variants,'ptcg');assert.equal(facets.finishes.length,2);assert(!facets.finishes.some(x=>x.startsWith('detail:')));const selected=facets.finishes.find(x=>x.startsWith('label:'));assert.equal(setFinishLabel(selected),'First Edition · Shadowless · Holofoil');assert.equal(filterSortSetCards(variants,'ptcg',{finish:selected}).length,2);assert.equal(setVariantKey(variants[1],selected),'detail:opaque-b');assert.equal(setVariantKey({...variants[1],variants:[...variants[1].variants,{key:'detail:ambiguous',label:setFinishLabel(selected)}]},selected),'');
console.log('PASS: basic resources and missing quotes counted; readable grouped Pokémon versions preserve exact per-card product identities.');

const T=await import('./tcg.js'),{S,blank}=await import('./store.js'),{blankGame}=await import('./games.js');S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:blankGame(),ygo:blankGame()};
const release={id:'example',name:'Example Set',count:1},card={...variants[0],id:'example-1',game:'ptcg',set:{id:'example',name:'Example Set',number:'1'},prices:{usd:999},variants:[{...variants[0].variants[0],usd:12.34}]};T.cache.ptcg[card.id]=card;T.ui('ptcg').sets.list=[release];Object.assign(T.ui('ptcg').set,{id:release.id,info:release,cards:[card],finish:selected,filter:'all',q:'',sort:'number',limit:80,contents:{completeness:'complete'}});
const setHtml=T.tcgSet();assert.match(setHtml,/\$12\.34/);assert.doesNotMatch(setHtml,/\$999/);assert.match(setHtml,/data-set-variant="detail:opaque-a"/);assert.doesNotMatch(setHtml,/>detail:opaque/);console.log('PASS: selected readable set version renders its exact quote and opens the exact product.');

// Rapid close → reopen must survive the asynchronous browser Back event.
{
 const {createSettingsDialog}=await import('./settings-dialog.js');
 const dialog={open:false,innerHTML:'',scrollTop:0,contains:()=>false,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}};
 const history={state:{route:'collection'},backs:0,pushState(s){this.state=s;},back(){this.backs++;}};
 const document={activeElement:null,documentElement:{classList:{add(){},remove(){}}}};
 const popup=createSettingsDialog({dialog,markup:()=>'<p>Settings</p>',history,document,location:{href:'#collection'}});
 popup.open();popup.close();popup.open();assert.equal(dialog.open,false);assert.equal(history.backs,1);
 history.state={route:'collection'};assert(popup.historyChanged());assert(dialog.open,'The deferred reopen runs after Back settles');assert(history.state.cardstashySettings);
 assert(popup.historyChanged());assert(dialog.open,'A duplicate history event for the current marker does not close the reopened modal');
 history.state={route:'collection'};assert(popup.historyChanged());assert.equal(dialog.open,false,'A real traversal away still closes Settings');
}
console.log('PASS: rapid Settings close/reopen preserves a single modal history entry.');

// A player's presentation choice survives reload without touching another seat.
const {TABLE_THEMES,tableTheme,createTableArtResolver}=await import('./tabletop-themes.js');
for(const game of ['mtg','ptcg','ygo']){
 const table=newTable(game),before=structuredClone(table.players[1]);table.players[0].theme=TABLE_THEMES[game][2][0];saveTable(table,storage);
 assert.equal(loadTable(game,storage).players[0].theme,table.players[0].theme);assert.deepEqual(table.players[1],before);
 const old=structuredClone(table);delete old.players[0].theme;saved.set('cardstashy-tabletop-v1:'+game,JSON.stringify(old));assert.equal(loadTable(game,storage).players[0].theme,tableTheme(game,'',0).id,'older sessions get a safe game-specific default');
}
let artSearches=0;const resolveArt=createTableArtResolver({ptcg:{search:async()=>{artSearches++;return {cards:[{id:'wrong',brief:true},{id:'right',brief:true}]};},get:async id=>({id,game:'ptcg',name:id,category:'Pokemon',types:[id==='right'?'Water':'Fire'],image:'https://assets.tcgdex.net/fixture/high.webp'})}});
const art=await Promise.all([resolveArt('ptcg','Water'),resolveArt('ptcg','Water')]);assert.equal(artSearches,1);assert(art.every(c=>c.id==='right'),'art must actually match the selected type');assert.equal((await resolveArt('mtg','U')).name,'Island');
for(const game of ['ptcg','ygo']){
 S.state.settings.game=game;S.ui.decksTab='inspiration';T.ui(game).metaFormat=game==='ptcg'?'expanded':'goat';
 const html=T.tcgDecks();assert.match(html,/Tournament format/);assert.match(html,/aren’t available from the connected feed/);assert.doesNotMatch(html,/class="arch-grid"|Most played cards/,'unsupported formats never relabel current tournament lists');
 assert.match(T.tcgNewDeckSheet(T.ui(game).metaFormat),new RegExp('value="'+T.ui(game).metaFormat+'" selected'));
}
console.log('PASS: saved independent tabletop themes, exact type artwork, bounded shared requests, and format-specific tournament availability.');
