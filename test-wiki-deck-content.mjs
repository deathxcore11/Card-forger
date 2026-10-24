// Synthetic fixtures use the published ScryfallLinks <deck> DOM contract, not
// copied Wiki article prose or a claimed live snapshot. Primary source:
// https://github.com/NilsEnevoldsen/ScryfallLinks/blob/master/src/Hooks.php
import assert from 'node:assert/strict';
import {parseWikiArticleContent,WIKI_DECK_LIMITS as L} from './wiki-article-content.js';
import {lookupGameWikiReference,wikiReferenceRoute} from './mtg-wiki-reference.js';
import {readGameWikiArticle} from './mtg-wiki-client.js';
const source={game:'mtg',title:'Worlds Fixture/Standard decks',url:'https://mtg.wiki/page/Worlds_Fixture%2FStandard_decks',revision:42,attribution:'Fixture contributors',license:'CC BY-NC-SA 4.0'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const link=(name,query='!"'+name+'"',label=name)=>`<a class="ext-scryfall-cardname" href="https://scryfall.com/search?q=${esc(encodeURIComponent(query))}&amp;utm_source=mw_MTGWiki">${esc(label)}</a>`;
const row=(qty,name,options={})=>`<p class="ext-scryfall-deckentry"><span class="ext-scryfall-deckcardcount">${qty}</span> ${link(name,options.query,options.label)}</p>`;
const section=(title,rows,cls='')=>`<div class="ext-scryfall-decksection ${cls}"><h4><span class="ext-scryfall-decksectiontitle">${esc(title)}</span></h4>${rows}</div>`;
const deck=(title,sections)=>`<div class="ext-scryfall-deck"><div class="ext-scryfall-decktitlecontainer"><span class="ext-scryfall-decktitle">${esc(title)}</span><div class="ext-scryfall-deckexport"><button>Download/Export</button></div></div><div class="ext-scryfall-deckcontents">${sections}</div></div>`;
const main=section('Creatures (4)',row(4,'Goblin Lackey'))+section('Lands (20)',row(20,'Mountain'));
const side=section('Sideboard (2)',row(2,'Pyroblast'),'ext-scryfall-decksideboard');
const parse=html=>parseWikiArticleContent(html,{game:'mtg',title:source.title,source});
const allBlocks=a=>[...a.lead,...a.sections.flatMap(s=>s.blocks)];

const article=parse('<p>Historical deck references.</p><h2 id="Player_One">Player One</h2>'+deck('Goblins — Fixture Player',main+side)+deck('Second literal source deck',section('Other (2)',row(2,'Shock')))+'<h2 id="Player_Two">Player Two</h2>'+deck('Third source deck',section('Lands (3)',row(3,'Island'))));
assert.equal(article.decks.length,3);
assert.deepEqual(article.decks[0].rows.map(({qty,name,zone})=>({qty,name,zone})),[{qty:4,name:'Goblin Lackey',zone:'main'},{qty:20,name:'Mountain',zone:'main'},{qty:2,name:'Pyroblast',zone:'side'}]);
assert.equal(article.decks[0].title,'Goblins — Fixture Player');
assert.equal(article.decks[0].format,null,'Historical article title does not establish a current import format');
assert.equal(article.decks[0].commander,null);
assert.equal(article.decks[0].evidenceKind,'explicit-deck-container');
assert.deepEqual(article.decks[0].evidence,['4 Goblin Lackey','20 Mountain','2 Pyroblast']);
assert.equal(article.decks[0].source.revision,42);
assert.equal(article.decks[0].source.url,source.url+'#Player_One');
assert.equal(article.decks[0].sectionId,'wiki-section-player_one');
assert.equal(article.decks[1].source.url,source.url+'#Player_One','Internal deck category headings must not steal the next deck’s source section');
assert.equal(article.decks[2].source.url,source.url+'#Player_Two');
assert.equal(parse('<h2>No exported anchor</h2>'+deck('Source list',main)).decks[0].source.url,source.url,'A missing source heading id does not invent an external article fragment');
assert.deepEqual(allBlocks(article).filter(b=>b.type==='deck').map(b=>b.deckId),['wiki-deck-1','wiki-deck-2','wiki-deck-3']);
assert(allBlocks(article).some(b=>b.type==='paragraph'&&b.content.some(n=>n.text==='Goblin Lackey')),'Source rows remain in the readable article after the in-place deck action');
const printing=parse(deck('Explicit exact printing',section('Other (1)',row(1,'Lightning Bolt',{query:'!"Lightning Bolt" set:m10 cn:"146"'}))));
assert.equal(printing.decks[0].rows[0].set,'m10');assert.equal(printing.decks[0].rows[0].number,'146');
const commander=parse(deck('Explicit command-zone row',section('Commander (1)',row(1,'Krenko, Mob Boss'))+main));
assert.equal(commander.decks[0].rows[0].zone,'commander');assert.equal(commander.decks[0].format,null);assert.equal(commander.decks[0].commander,null,'No implicit standalone commander identity is invented');

for(const [label,html] of [
 ['prose archetype','<h2>Goblins deck</h2><p>Use 4 '+link('Goblin Lackey')+' in your deck.</p>'],
 ['plain quantity list','<h2>Decklist</h2><ul><li>4 '+link('Goblin Lackey')+'</li><li>20 '+link('Mountain')+'</li></ul>'],
 ['unrecognized table','<table><caption>Decklist</caption><tr><th>Quantity</th><th>Card</th></tr><tr><td>4</td><td>'+link('Goblin Lackey')+'</td></tr></table>'],
 ['missing quantity',deck('Invalid',section('Other',row('','Shock')))],
 ['invalid quantity',deck('Invalid',section('Other',row(0,'Shock')))],
 ['fraction quantity',deck('Invalid',section('Other',row('1.5','Shock')))],
 ['negative quantity',deck('Invalid',section('Other',row(-1,'Shock')))],
 ['ambiguous quantity',deck('Invalid',section('Other',row('2–4','Shock')))],
 ['unlinked card',deck('Invalid',section('Other','<p class="ext-scryfall-deckentry"><span class="ext-scryfall-deckcardcount">4</span> Shock</p>'))],
 ['row outside deck contents',deck('Invalid',main).replace('<div class="ext-scryfall-deckcontents">',row(1,'Shock')+'<div class="ext-scryfall-deckcontents">')],
 ['non-exact Scryfall query',deck('Invalid',section('Other',row(4,'Shock',{query:'t:instant c:r'})))],
 ['display/canonical mismatch',deck('Invalid',section('Other',row(4,'Shock',{label:'Lightning Bolt'})))],
 ['multiple card links',deck('Invalid',section('Other',row(4,'Shock').replace('</p>',link('Lightning Bolt')+'</p>')))],
 ['wrong source host',deck('Invalid',section('Other',row(4,'Shock').replace('https://scryfall.com','https://scryfall.com.evil.test')))],
 ['auth source URL',deck('Invalid',section('Other',row(4,'Shock').replace('https://scryfall.com','https://user:pass@scryfall.com')))],
 ['printing URL without exact canonical name',deck('Invalid',section('Other',row(4,'Shock').replace(/https:\/\/scryfall.com\/search\?[^\"]+/,'https://scryfall.com/card/rvr/168/boros-charm')))],
 ['incomplete section',deck('Invalid',section('Lands (24)',row(20,'Mountain')))],
 ['unsupported companion zone',deck('Invalid',main+section('Companion (1)',row(1,'Jegantha, the Wellspring')))],
 ['sideboard only',deck('Invalid',side)],
 ['nested deck boundaries',deck('Outer',main+deck('Inner',main))],
 ['unclosed container',deck('Invalid',main).slice(0,-6)],
 ['too many rows',deck('Invalid',section('Other',Array.from({length:L.rows+1},()=>row(1,'Shock')).join('')))],
 ['quantity cap',deck('Invalid',section('Lands',row(L.quantity+1,'Mountain')))],
 ['total quantity cap',deck('Invalid',section('Lands',Array.from({length:5},()=>row(250,'Mountain')).join('')))],
])assert.equal(parse(html).decks.length,0,label+' cannot create a partially inferred source deck');
const malformed=deck('Reject atomically',main+section('Other',row(2,'Shock')+row('unknown','Lightning Bolt')));
assert.equal(parse(malformed).decks.length,0,'One invalid explicit row invalidates the entire deck, never a partial card list');
for(const game of ['ptcg','ygo']){
 const otherSource={...source,game,url:game==='ptcg'?'https://bulbapedia.bulbagarden.net/wiki/Fixture':'https://yugioh.fandom.com/wiki/Fixture'};
 assert.equal(parseWikiArticleContent(deck('Not this game',main),{game,title:'Fixture',source:otherSource}).decks.length,0,'MTG extension classes do not establish another game’s deck');
}
const capped=parse(Array.from({length:L.decks+1},(_,i)=>deck('Deck '+i,section('Other (1)',row(1,'Shock')))).join(''));
assert.equal(capped.decks.length,L.decks);assert.equal(capped.decksTruncated,true);
const clipped=parse(deck('Tree incomplete',main)+'<p>'+'word '.repeat(310000)+'</p>');
assert(clipped.truncated);assert.equal(clipped.decks.length,0,'A clipped upstream tree cannot establish a complete extracted source deck');
const publicHtml='<h2 id="Source_Player">Source Player</h2>'+deck('Literal source deck',main+side);
const publicFetcher=async(url,init)=>{const u=new URL(url);assert.equal(u.origin,'https://mtg.wiki');assert.equal(u.pathname,'/api.php');assert.equal(init.credentials,'omit');return Response.json(u.searchParams.get('action')==='parse'?{parse:{title:source.title,pageid:123,revid:42,text:publicHtml,sections:[],images:[],categories:[]}}:{batchcomplete:true,query:{pages:[{ns:0,title:source.title,pageid:123,lastrevid:42,extract:'A short source summary.'}]}});};
const full=await lookupGameWikiReference({game:'mtg',mode:'article',title:source.title},{fetcher:publicFetcher});
assert.equal(full.article.decks.length,1);assert.equal(full.article.decks[0].source.revision,42);assert.equal(full.article.decks[0].source.game,'mtg');
const client=await readGameWikiArticle('mtg',source.title,{fetcher:async(path,init)=>{assert.equal(path,'/api/reference/wiki');assert.deepEqual(JSON.parse(init.body),{game:'mtg',mode:'article',title:source.title});return Response.json(full);}});
assert.deepEqual(client.article.decks[0].evidence,full.article.decks[0].evidence,'Client retains literal source deck evidence');
const route=await wikiReferenceRoute(new Request('https://cardstashy.com/api/reference/wiki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:'mtg',mode:'article',title:source.title})}),{fetcher:publicFetcher});
assert.equal((await route.json()).article.decks.length,1,'Public article route passes sourced decks without collections or builder credentials');
const excerpt=await lookupGameWikiReference({game:'mtg',title:source.title},{fetcher:publicFetcher});assert.equal(excerpt.article,undefined,'AI/excerpt mode never acquires a full deck/article payload automatically');
console.log('PASS: exact source deck containers retain independent boundaries, card counts/names/zones/printing evidence and in-place actions; malformed, ambiguous, unsupported, non-MTG and capped inputs never become partial or invented decks.');
