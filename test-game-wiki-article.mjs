import assert from 'node:assert/strict';
import {wikiArticleMarkup,bindWikiArticleImages} from './game-wiki-article.js';
import {parseWikiArticleContent} from './wiki-article-content.js';
import {wikiSourceForGame} from './wiki-sources.js';

const copy=value=>structuredClone(value);
const T=text=>({type:'text',text});
const P=text=>({type:'paragraph',content:[T(text)]});
const imageUrls={mtg:'https://files.mtg.wiki/Example_reader.png',ptcg:'https://archives.bulbagarden.net/media/upload/Example_reader.png',ygo:'https://static.wikia.nocookie.net/yugioh/images/Example_reader.png/revision/latest'};
function fixture(game='mtg',title='Combat growth'){
 const provider=wikiSourceForGame(game),url=provider.articlePrefix+encodeURIComponent(title.replace(/ /g,'_'));
 const source={game,title,url,providerName:provider.name,publisher:provider.publisher,license:provider.license,licenseUrl:provider.licenseUrl};
 return {status:'available',mode:'article',game,source,article:{title,source,lead:[P('A readable introduction with source context.'),{type:'image',imageId:'art-1'}],sections:[
  {id:'Examples',title:'Examples',level:2,blocks:[P('A complete article section remains in the app.'),{type:'list',ordered:false,items:[[T('First example')],[T('Second example')]]}]},
  {id:'Details',title:'Details',level:3,blocks:[{type:'table',caption:'Example table',rows:[{cells:[{header:true,content:[T('Name')]},{header:true,content:[T('Effect')]}]},{cells:[{content:[T('Card')],colspan:1,rowspan:2},{content:[T('Growth')]}]}]}]}
 ],images:[{id:'art-1',src:imageUrls[game],alt:'Illustration used by this article',caption:'Article illustration',descriptionUrl:provider.articlePrefix+'File%3AExample_reader.png',attribution:'Example image contributor',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'}],truncated:false}};
}

// The same semantic article renders as a real reading page in every game.
for(const game of ['mtg','ptcg','ygo']){
 const html=wikiArticleMarkup(fixture(game),{game});
 assert.match(html,new RegExp(`data-wiki-article="${game}"`));
 assert.match(html,/<h1>Combat growth<\/h1>/);
 assert.match(html,/<h2>Examples<\/h2>/);assert.match(html,/<h3>Details<\/h3>/);
 assert.match(html,/<ul><li>First example<\/li><li>Second example<\/li><\/ul>/);
 assert.match(html,/wiki-article-table-wrap/);assert.match(html,/<table class="wiki-article-table">/);assert.match(html,/rowspan="2"/);
 assert.equal((html.match(/data-wiki-article-image/g)||[]).length,1,'a lead image referenced again in blocks is not duplicated');
 assert.ok(html.indexOf('<figure')<html.indexOf('wiki-article-lead'),'article art precedes the introduction for the shared responsive reading layout');
 assert.match(html,/Article illustration/);assert.match(html,/Example image contributor/);assert.match(html,/Image source/);
 assert.match(html,/class="wiki-source-credit"/);assert.match(html,/Contributors \/ history/);assert.match(html,/action=history/);
 assert.doesNotMatch(html,/Article shortened|Read full source|not instructions|official card|blanket permission|No wiki facts/i);
 assert.doesNotMatch(html,/<(?:script|style|svg|iframe)|\son(?:error|load)=|srcset=|style=/i);
 assert.equal(wikiArticleMarkup(fixture(game),{game:game==='mtg'?'ygo':'mtg'}),'','a selected game never inherits a different game article');
}

// Source binding is checked again at the display boundary; short AI excerpts
// and same-provider but differently attributed articles cannot stand in for it.
for(const change of [
 r=>{r.mode='reference';},r=>{r.status='unavailable';},r=>{r.article=null;},
 r=>{r.article.source={...r.source,url:'https://attacker.example/page/Combat_growth'};},
 r=>{r.article.source={...r.source,url:'https://mtg.wiki/page/Different_article'};},
 r=>{r.source={...r.source,game:'ygo'};},r=>{r.article.title='Different article';},
 r=>{r.article.source={...r.source,title:'Different article'};}
]){const r=fixture();change(r);assert.equal(wikiArticleMarkup(r),'');}
assert.equal(wikiArticleMarkup({status:'available',extract:'A short quote',game:'mtg'}),'');

// Topic navigation remains within the current game's public article namespace.
const links=fixture();links.article.lead=[{type:'paragraph',content:[
 {type:'link',text:'Slith',href:'https://mtg.wiki/page/Slith',internal:true,game:'mtg',title:'Slith'},
 {type:'link',text:'Index path',href:'https://mtg.wiki/index.php?title=Slith&oldid=1',internal:true,game:'mtg',title:'Slith'},
 {type:'link',text:'Local section',href:'https://mtg.wiki/page/Combat_growth#Examples',internal:true,game:'mtg',title:'Combat growth',fragment:'Examples'},
 {type:'link',text:'Relative section',href:'#Details'},
 {type:'link',text:'Missing note',href:'https://mtg.wiki/page/Combat_growth#cite_note-1',internal:true,game:'mtg',title:'Combat growth'},
 {type:'link',text:'File description',href:'https://mtg.wiki/page/File%3APhoto.png',internal:true,title:'File:Photo.png'},
 {type:'link',text:'Mismatch',href:'https://mtg.wiki/page/Slith',internal:true,title:'Unrelated title'},
 {type:'link',text:'Other game',href:'https://mtg.wiki/page/Slith',internal:true,game:'ygo',title:'Slith'},
 {type:'link',text:'Outside reference',href:'https://example.org/reference?value=1&other=2',internal:false}
]}];
const navigation=wikiArticleMarkup(links);
assert.equal((navigation.match(/data-act="mtgWikiPick" data-wiki-topic="Slith"/g)||[]).length,2);
assert.match(navigation,/data-wiki-anchor="wiki-Examples"/);assert.match(navigation,/data-wiki-anchor="wiki-Details"/);
assert.doesNotMatch(navigation,/href="#|data-wiki-topic="(?:Combat growth|File:|Unrelated)/);
assert.match(navigation,/target="_blank" rel="noopener noreferrer">File description/);
assert.match(navigation,/reference\?value=1&amp;other=2/);

// Card references share the existing card window and card Search rather than
// sending readers to a separate catalogue UI.
const cardLinks=fixture();cardLinks.article.lead=[{type:'paragraph',content:[
 {type:'link',text:'Exact card',href:'https://scryfall.com/search?q=%21%22Spirit+Link%22&utm_source=wiki'},
 {type:'link',text:'Boros Guildmages',href:'https://scryfall.com/card/rvr/168/boros-guildmage?utm_source=wiki'},
 {type:'link',text:'Matching cards',href:'https://scryfall.com/search?q=kw%3Alifelink'},
 {type:'link',text:'Unrelated source',href:'https://scryfall.com.evil.invalid/search?q=kw%3Alifelink'}
]}];const cardNavigation=wikiArticleMarkup(cardLinks);
assert.match(cardNavigation,/data-act="card" data-name="Spirit Link" data-read-only="true"/);
assert.match(cardNavigation,/data-act="wikiCard" data-card-set="rvr" data-card-number="168" data-card-lang="en"/);
assert.match(cardNavigation,/data-act="wikiCards" data-wiki-query="kw:lifelink"/);
assert.match(cardNavigation,/href="https:\/\/scryfall.com.evil.invalid/);
// Source content is inert even when a caller bypasses the server parser.
const malicious=fixture();malicious.article.lead=[{type:'paragraph',content:[
 T('<script>alert(1)</script><img src=x onerror=steal()>'),
 {type:'link',text:'<b>Dangerous scheme</b>',href:'javascript:alert(1)',internal:true,title:'Slith'},
 {type:'link',text:'Embedded data',href:'data:text/html,active'},
 {type:'link',text:'Credential URL',href:'https://user:password@mtg.wiki/page/Slith',internal:true,title:'Slith'},
 {type:'link',text:'Control URL',href:'https://mtg.wiki/page/Sli\nth',internal:true,title:'Slith'},
 {type:'image',alt:'{G}{T}',src:'https://attacker.example/symbol.svg'},
 {type:'html',text:'Ignored unknown inline',html:'<iframe src=active>'}
 ]},{type:'html',html:'<iframe src=active>'}];
malicious.article.sections.push({id:'" onmouseover="steal()',title:'<style>body{display:none}</style>',level:'2 onload=steal()',blocks:[P('Safe body')]});
malicious.article.images.push(...[
 'https://files.mtg.wiki/active.svg','https://files.mtg.wiki/active.svg.png.svg',
 'https://files.mtg.wiki.attacker.example/picture.png','https://user:password@files.mtg.wiki/picture.png',
 'https://files.mtg.wiki:8443/picture.png','data:image/png;base64,test',
 imageUrls.ptcg
].map((src,i)=>({id:'bad-'+i,src,alt:'Untrusted picture',onerror:'steal()',style:'display:block'})));
const inert=wikiArticleMarkup(malicious);
assert.match(inert,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.match(inert,/&lt;b&gt;Dangerous scheme&lt;\/b&gt;/);
assert.match(inert,/\{G\}\{T\}/);assert.match(inert,/&lt;style&gt;body\{display:none\}&lt;\/style&gt;/);
assert.doesNotMatch((inert.match(/<[^>]*>/g)||[]).join(''),/<(?:script|style|svg|iframe)|\son(?:error|load|mouseover)=|srcset=|style=|href="(?:javascript|data):/i);
assert.doesNotMatch(inert,/Ignored unknown inline|Untrusted picture|data-wiki-topic/);
assert.equal((inert.match(/data-wiki-article-image/g)||[]).length,1);

// Real MediaWiki parsing feeds the same renderer. This is intentionally longer
// than the old AI quote budget and keeps body, list, table, links and symbol alt.
const pipeline=fixture(),raw='<div class="mw-parser-output"><p>'+Array.from({length:90},(_,i)=>'word'+i).join(' ')+' <img src="https://files.mtg.wiki/Mana.svg" alt="{G}" width="16"> <a href="/index.php?title=Slith">Slith</a></p><h2><span id="Rules">Rules</span></h2><p><a href="#Rules">Back to Rules</a> Body text.</p><ul><li>Alpha</li><li>Beta</li></ul><table><caption>Types</caption><tr><th>Kind</th><td>Creature</td></tr></table><script>DO NOT RUN</script><img src="'+imageUrls.mtg+'" width="200" height="300" alt="Article art"></div>';
pipeline.article=parseWikiArticleContent(raw,{game:'mtg',title:pipeline.article.title,source:pipeline.source});
const rendered=wikiArticleMarkup(pipeline);
assert.match(rendered,/word89/);assert.match(rendered,/\{G\}/);assert.match(rendered,/<h2>Rules<\/h2>/);
assert.match(rendered,/data-wiki-topic="Slith"/);assert.match(rendered,/data-wiki-anchor="wiki-wiki-section-rules"/);
assert.match(rendered,/<li>Alpha<\/li>/);assert.match(rendered,/<caption>Types<\/caption>/);assert.match(rendered,/alt="Article art"/);
assert.doesNotMatch(rendered,/DO NOT RUN|Article shortened|href="#/);

// A leading source infobox is metadata, so the definition can start beside the
// art before that table clears the float. Ordinary article order is preserved.
const factsTable={type:'table',infobox:true,caption:'Leading quick facts',rows:[{cells:[{header:true,content:[T('Fact')]},{content:[T('Metadata value')]}]}]};
const infobox=fixture();infobox.article.lead=[factsTable,{type:'image',imageId:'art-1'},P('Definition before metadata.'),P('Later article paragraph.'),{...factsTable,infobox:false,caption:'Later article table'}];
const infoboxOriginal=copy(infobox.article.lead),definitionFirst=wikiArticleMarkup(infobox);
assert.ok(definitionFirst.indexOf('Definition before metadata.')<definitionFirst.indexOf('<caption>Leading quick facts</caption>'));
assert.ok(definitionFirst.indexOf('<caption>Leading quick facts</caption>')<definitionFirst.indexOf('Later article paragraph.'));
assert.ok(definitionFirst.indexOf('Later article paragraph.')<definitionFirst.indexOf('<caption>Later article table</caption>'));
assert.match(definitionFirst,/Metadata value/);assert.equal((definitionFirst.match(/data-wiki-article-image/g)||[]).length,1);assert.deepEqual(infobox.article.lead,infoboxOriginal,'reader ordering does not modify the retrieved source AST');
const ordinary=fixture();ordinary.article.lead=[{...factsTable,infobox:false,caption:'Ordinary source table'},P('Definition after ordinary table.')];
const ordinaryOrder=wikiArticleMarkup(ordinary);assert.ok(ordinaryOrder.indexOf('<caption>Ordinary source table</caption>')<ordinaryOrder.indexOf('Definition after ordinary table.'),'a real article table is not moved past source prose');
const listFirst=fixture();listFirst.article.lead=[factsTable,{type:'list',ordered:false,items:[[T('Source list before definition')]]},P('Definition after source list.')];
const listOrder=wikiArticleMarkup(listFirst);assert.ok(listOrder.indexOf('<caption>Leading quick facts</caption>')<listOrder.indexOf('Source list before definition'));assert.ok(listOrder.indexOf('Source list before definition')<listOrder.indexOf('Definition after source list.'),'a leading article list prevents metadata-only reordering');

const shortened=fixture();shortened.article.truncated=true;
assert.match(wikiArticleMarkup(shortened),/Article shortened · <a[^>]*>Read full source<\/a>/);
const bounded=fixture();bounded.article.lead=[P('x'.repeat(310000))];
assert.match(wikiArticleMarkup(bounded),/Article shortened/,'the display budget never silently claims an entire oversized source was rendered');

// Local anchors and broken-art fallbacks operate on this reading surface, then
// release their listeners on repaint. Neither changes the app's hash route.
class Node {
 constructor(values={}){Object.assign(this,values);this.events=new Map();}
 addEventListener(name,fn){this.events.set(name,fn);}
 removeEventListener(name,fn){if(this.events.get(name)===fn)this.events.delete(name);}
}
const fallback={hidden:true},image=new Node({hidden:false,complete:false,naturalWidth:0,closest:()=>({querySelector:()=>fallback})});
const failedImage=new Node({hidden:false,complete:true,naturalWidth:0,closest:()=>({querySelector:()=>({hidden:true})})});
let scrolls=0,focuses=0;
const section={id:'wiki-Examples',scrollIntoView:()=>scrolls++,focus:()=>focuses++};
const anchor=new Node({dataset:{wikiAnchor:'wiki-Examples'}});
const surface={querySelectorAll:selector=>selector==='[data-wiki-article-image]'?[image,failedImage]:selector==='[data-wiki-anchor]'?[anchor]:selector==='.wiki-article-section'?[section]:[]};
const cleanup=bindWikiArticleImages(surface);
assert.equal(fallback.hidden,true);image.events.get('error')();assert.equal(image.hidden,true);assert.equal(fallback.hidden,false);assert.equal(failedImage.hidden,true);
anchor.events.get('click')();assert.equal(scrolls,1);assert.equal(focuses,1);
cleanup();assert.equal(image.events.size,0);assert.equal(anchor.events.size,0);
assert.doesNotThrow(()=>bindWikiArticleImages()());assert.doesNotThrow(()=>bindWikiArticleImages({})());

console.log('Structured Wiki article renderer: PASS');
