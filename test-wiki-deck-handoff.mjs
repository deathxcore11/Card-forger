import assert from 'node:assert/strict';
import {readWikiSourceDeck,exportWikiDeck,createWikiDeckHandoff} from './wiki-deck-handoff.js';
import {sharedDeckSheet} from './shared-deck-view.js';
import {wikiArticleMarkup} from './game-wiki-article.js';

const cardUrl=name=>'https://scryfall.com/search?'+new URLSearchParams({q:'!"'+name+'"'});
const row=(name,qty,zone='main')=>({name,qty,zone,cardUrl:cardUrl(name),evidence:`${qty} ${name}`});
function fixture(){
 const source={game:'mtg',title:'2000 World Championships/Standard decks',url:'https://mtg.wiki/page/2000_World_Championships/Standard_decks',publisher:'MTG Wiki contributors',revision:123};
 const rows=[row('Fixture Source Creature',4),row('Mountain',56),row('Fixture Source Creature',2,'side')],deck={id:'wiki-deck-1',game:'mtg',title:'Explicit source fixture',format:null,commander:null,sectionId:'Source fixture',source:{...source,url:source.url+'#Source_fixture'},rows,evidence:rows.map(r=>r.evidence),evidenceKind:'explicit-deck-container'};
 return {game:'mtg',mode:'article',status:'available',source,article:{title:source.title,source,lead:[{type:'deck',deckId:deck.id},{type:'paragraph',content:[{type:'text',text:'Original synthetic source-deck fixture.'}]}],sections:[],images:[],decks:[deck]}};
}
const source=fixture(),before=JSON.stringify(source),snapshot=readWikiSourceDeck(source,0);
assert.equal(snapshot.title,'Explicit source fixture');assert.equal(snapshot.total,62);assert.equal(snapshot.format,null);assert.equal(snapshot.canSave,false);assert.deepEqual(snapshot.rows.map(({name,qty,zone})=>({name,qty,zone})),source.article.decks[0].rows.map(({name,qty,zone})=>({name,qty,zone})),'preview retains exact sourced quantities, zones and order');
assert.equal(exportWikiDeck(snapshot),'4 Fixture Source Creature\n56 Mountain\n\nSideboard\n2 Fixture Source Creature');assert.equal(JSON.stringify(source),before);
const articleMarkup=wikiArticleMarkup(source,{game:'mtg'});assert.match(articleMarkup,/data-act="wikiDeck" data-wiki-deck="0"/);assert.doesNotMatch(articleMarkup,/data-act="flowGenerate"|Complete · structure checked|legal in/i);
for(const change of [
 r=>delete r.article.decks,
 r=>{r.article.decks=[];r.article.title='Goblin archetype';},
 r=>r.article.decks[0].evidenceKind='archetype-title',
 r=>r.article.decks[0].evidenceKind='explicit-deck-table',
 r=>r.article.decks[0].rows[0].qty=0,
 r=>r.article.decks[0].rows[0].qty=1.5,
 r=>r.article.decks[0].rows[0].qty=251,
 r=>r.article.decks[0].rows[0].qty=3,
 r=>r.article.decks[0].rows[0].name='Invented replacement',
 r=>r.article.decks[0].rows[0].cardUrl='https://scryfall.com.evil.invalid/search?q=!"Fixture Source Creature"',
 r=>r.article.decks[0].rows[0].cardUrl='https://scryfall.com/search?q=Goblins',
 r=>r.article.decks[0].rows[0].evidence='4 Different source line',
 r=>r.article.decks[0].source.url='https://mtg.wiki/page/Another_article',
 r=>r.source.game='ptcg',
 r=>r.article.source.url='https://evil.invalid/page/2000_World_Championships/Standard_decks',
 r=>r.game='ygo',
 r=>r.article.decks[0].commander='Unlisted commander',
 r=>{r.article.decks[0].rows=Array.from({length:5},(_,i)=>row('Card '+i,250));r.article.decks[0].evidence=r.article.decks[0].rows.map(r=>r.evidence);},
]){const malformed=fixture();change(malformed);assert.throws(()=>readWikiSourceDeck(malformed,0),/supported source decklist/,'an unsupported or altered source cannot become a deck');assert.doesNotMatch(wikiArticleMarkup(malformed,{game:'mtg'}),/data-act="wikiDeck"/);}
assert.throws(()=>readWikiSourceDeck(source,-1));assert.throws(()=>readWikiSourceDeck(source,1));assert.throws(()=>readWikiSourceDeck(source,0,{game:'ptcg'}));
const multiple=fixture(),second={...structuredClone(multiple.article.decks[0]),id:'wiki-deck-2',title:'Second exact list',rows:[row('Island',60)]};second.evidence=second.rows.map(r=>r.evidence);multiple.article.decks.push(second);assert.equal(readWikiSourceDeck(multiple,1).rows[0].name,'Island');assert.equal(readWikiSourceDeck(multiple,0).rows[0].name,'Fixture Source Creature','separate source lists are never combined');
const printed=fixture(),printedRow=printed.article.decks[0].rows[0];Object.assign(printedRow,{cardUrl:'https://scryfall.com/search?'+new URLSearchParams({q:'!"Fixture Source Creature" set:rvr cn:"123"'}),set:'rvr',number:'123'});assert.equal(readWikiSourceDeck(printed,0).rows[0].set,'rvr');assert.equal(readWikiSourceDeck(printed,0).rows[0].number,'123','the parser’s quoted collector syntax retains the exact printing');

let active=fixture(),game='mtg',valid=true,spec,imports=[],exports=[],cards=[],saves=0,notices=[];const A={},cached={id:'cached-source',name:'Fixture Source Creature',image_uris:{normal:'https://cards.scryfall.io/normal/source.jpg'},prices:{usd:'987.65'}};
const handoff=createWikiDeckHandoff({A,article:()=>active,game:()=>game,scope:()=>()=>valid,lookup:(_game,name)=>name===cached.name?cached:null,openProven:async value=>{spec=value;},exportText:(text,deck)=>exports.push({text,deck}),importDeck:deck=>imports.push(deck),card:(game,row,current)=>{assert(current());cards.push({game,row});},saveCopy:async(_deck,current)=>{if(!current())throw Error('Workspace changed');saves++;},notify:message=>notices.push(message)});
const token=await handoff.open(0);assert.equal(saves,0);assert.equal(imports.length,0);assert.equal(spec.sharedItem.cards[0].qty,4);assert.equal(spec.sharedItem.cards[1].qty,56);assert(spec.sharedItem.cards.every(r=>r.referenceUSD===null),'source preview does not invent quotes or borrow private prices');
const html=sharedDeckSheet(spec);assert.match(html,/shared-deck-section/);assert.match(html,/class="deck-hero deck-hero--feature ds-hero" data-deck-source="wiki" data-game="mtg"/);assert.match(html,/4× Fixture Source Creature/);assert.match(html,/56× Mountain/);assert.match(html,/Sideboard/);assert.match(html,/Wiki deck/);assert.match(html,/data-act="wikiDeckImport"/);assert.match(html,/data-act="wikiDeckExport"/);assert.doesNotMatch(html,/data-act="provenSave"|owner needs|Budget adaptation|Generated deck|987.65|warning-panel/);
await A.wikiDeckExport({dataset:{wikiResult:token}});assert.equal(exports[0].text,exportWikiDeck(snapshot));await A.wikiDeckImport({dataset:{wikiResult:token}});assert.equal(imports[0].text,exports[0].text);assert.equal(imports[0].format,null,'unknown format reaches explicit import without a guessed default');assert.equal(imports[0].source.url,snapshot.source.url);await A.wikiDeckCard({dataset:{wikiResult:token,index:'0'}});assert.equal(cards[0].row.name,'Fixture Source Creature');assert.equal(cards[0].game,'mtg');assert.equal(saves,0,'reading, export, card details and import preparation never save automatically');
valid=false;for(const action of ['wikiDeckExport','wikiDeckImport','wikiDeckCard'])assert.throws(()=>A[action]({dataset:{wikiResult:token,index:'0'}}),/workspace changed/);valid=true;active=fixture();assert.throws(()=>A.wikiDeckExport({dataset:{wikiResult:token}}),/article or workspace changed/,'a new article cannot reopen or export an old stale snapshot');
active.article.decks[0].format='Standard';const declaredToken=await handoff.open(0);assert.equal(readWikiSourceDeck(active,0).canSave,false);assert.match(sharedDeckSheet(spec),/data-act="wikiDeckImport"/);assert.doesNotMatch(sharedDeckSheet(spec),/data-act="provenSave"/);await assert.rejects(spec.save(),/Use Import deck/);assert.equal(saves,0,'a format label cannot bypass matching and explicitly reviewed import');await A.wikiDeckExport({dataset:{wikiResult:declaredToken}});assert.equal(exports.at(-1).text,exportWikiDeck(readWikiSourceDeck(active,0)),'import preparation never adapts or rewrites exported source quantities');
active=printed;const printToken=await handoff.open(0);assert.equal(spec.sharedItem.cards[0].image,'','a different cached printing cannot supply the source printing’s image');await A.wikiDeckCard({dataset:{wikiResult:printToken,index:'0'}});assert.equal(cards.at(-1).row.number,'123');assert.equal(cards.at(-1).row.cardUrl,printedRow.cardUrl,'the card action receives the exact source printing link');
game='ygo';assert.throws(()=>A.wikiDeckImport({dataset:{wikiResult:printToken}}),/workspace changed/);assert.equal(saves,0);assert.deepEqual(notices,[]);
let hydrationArticle=fixture(),hydrateRelease,hydrated=null,opening=0,hydratingSpec;
const delayed=createWikiDeckHandoff({A:{},article:()=>hydrationArticle,game:()=> 'mtg',scope:()=>()=>true,lookup:()=>hydrated,hydrate:async(names,status)=>{assert.deepEqual(names,['Fixture Source Creature','Mountain']);status('Loading exact card data…');await new Promise(resolve=>hydrateRelease=resolve);hydrated=cached;},openProven:async value=>{opening++;hydratingSpec=value;await value.load(()=>{});}});
const delayedOpen=delayed.open(0);assert.equal(opening,1,'the existing source inspector opens before its public card data loads');assert.equal(hydratingSpec.sharedItem.cards[0].image,'');hydrationArticle=fixture();hydrateRelease();await delayedOpen;assert.equal(opening,1,'late hydration cannot reopen or replace a newer card/article context');assert.equal(hydratingSpec.sharedItem.cards[0].image,'','an obsolete article does not install late art');
const hydratedSource=fixture(),face={id:'face-card',name:'Unrelated front // Fixture Source Creature',card_faces:[{name:'Unrelated front',image_uris:{normal:'https://cards.scryfall.io/front.jpg'}},{name:'Fixture Source Creature',image_uris:{normal:'https://cards.scryfall.io/exact-face.jpg'}}]};let readyCard=null,readySpec;
const ready=createWikiDeckHandoff({A:{},article:()=>hydratedSource,game:()=> 'mtg',scope:()=>()=>true,lookup:()=>readyCard,hydrate:async()=>{readyCard=face;},openProven:async value=>{readySpec=value;await value.load(()=>{});}});await ready.open(0);assert.equal(readySpec.sharedItem.cards[0].image,'https://cards.scryfall.io/exact-face.jpg','only a verified exact card-face alias supplies artwork');assert.deepEqual(readySpec.sharedItem.cards.map(r=>[r.name,r.qty]),[['Fixture Source Creature',4],['Mountain',56],['Fixture Source Creature',2]],'hydration changes no source quantities or order');assert(readySpec.sharedItem.cards.every(r=>r.referenceUSD===null));
const ordinary=sharedDeckSheet({sharedItem:{key:'community',game:'mtg',title:'Existing shared deck',format:'Standard',deckSchema:1,cards:[{name:'Mountain',qty:60,zone:'main',referenceUSD:null}],appearance:{}}});assert.match(ordinary,/data-act="sharedCard"/);assert.match(ordinary,/data-act="provenSave"/);assert.doesNotMatch(ordinary,/wikiDeck|Wiki deck|format checks have not been run/,'ordinary shared decks keep their existing controls');
console.log('PASS: exact Wiki source rows open the existing shared deck inspector; scoped card/export/import actions preserve quantities, sideboards, printing links and attribution; archetypes, malformed rows, foreign sources and stale workspaces cannot create a deck. No construction or automatic save.');
