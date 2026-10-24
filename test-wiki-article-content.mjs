// Synthetic MediaWiki-shaped HTML. No live article or licensed corpus copied.
import assert from 'node:assert/strict';
import {parseWikiArticleContent,WIKI_ARTICLE_LIMITS as L} from './wiki-article-content.js';
import {isAllowedWikiImageUrl} from './wiki-sources.js';
const source={game:'mtg',title:'Article Fixture',url:'https://mtg.wiki/page/Article_Fixture',historyUrl:'https://mtg.wiki/page/Article_Fixture?action=history',publisher:'Fixture contributors'};
const parse=(html,extra={})=>parseWikiArticleContent(html,{game:'mtg',title:source.title,source,...extra});
const long=Array.from({length:100},(_,i)=>'word'+i).join(' ');
const html=`<div class="mw-parser-output"><p>${long} <a href="/page/Bloodlust">growth</a> <a href="#History">history</a> <a href="/page/File:Art.png">file</a> <a href="https://magic.wizards.com/en/rules">official rules</a></p><script>secretScript()</script><style>secretStyle</style><iframe><p>secretFrame</p></iframe><form><p>secretForm</p></form><div class="navbox"><p>secretNavigation</p></div><p>Mana <img src="https://files.mtg.wiki/mana.svg" alt="{G}" width="16"> &amp; &#x1F600; &rarr; &infin;.</p><figure><a href="/page/File:Art.png"><img src="https://files.mtg.wiki/Art.png" width="300" height="400" alt="Fixture art" onerror="secretHandler()"></a><figcaption>Fixture caption</figcaption></figure><h2><span id="History">History</span><span class="mw-editsection">secretEdit</span></h2><ul><li>First <b>item</b></li><li>Second<ol><li>Nested</li></ol></li></ul><table><caption>Facts</caption><tr><th>Heading</th><td colspan="999" rowspan="-2">Value</td></tr></table><p><a href="javascript:secretLink()">bad scheme</a><a href="java&#x0a;script:secretLink()">encoded scheme</a><img src="https://files.mtg.wiki.evil.test/art.png" alt="unapproved art"><svg><text>secretSVG</text></svg></p></div>`;
const article=parse(html),serialized=JSON.stringify(article);
assert.equal(article.title,source.title);assert.equal(article.truncated,false);assert.equal(article.sections.length,1);assert.equal(article.sections[0].id,'wiki-section-history');assert.equal(article.sections[0].title,'History');
assert(serialized.includes(long),'Explicit article mode retains more than a 25-word AI excerpt');
for(const forbidden of ['secretScript','secretStyle','secretFrame','secretForm','secretNavigation','secretEdit','secretHandler','secretSVG'])assert(!serialized.includes(forbidden),forbidden);
assert(!article.html);assert(!serialized.includes('"onerror"'));
const first=article.lead.find(b=>b.type==='paragraph');assert(first.content.some(n=>n.type==='link'&&n.internal&&n.title==='Bloodlust'&&n.game==='mtg'));
assert(first.content.some(n=>n.type==='link'&&n.fragment==='wiki-section-history'));
assert(first.content.some(n=>n.type==='link'&&!n.internal&&n.href.includes('/File:Art.png')),'Namespace/file links remain external');
assert(first.content.some(n=>n.type==='link'&&!n.internal&&n.href==='https://magic.wizards.com/en/rules'));
assert(serialized.includes('{G}'));assert(serialized.includes('😀'));assert(serialized.includes('→'));assert(serialized.includes('∞'));
assert.equal(article.images.length,1);assert.equal(article.images[0].src,'https://files.mtg.wiki/Art.png');assert.equal(article.images[0].caption,'Fixture caption');assert.equal(article.images[0].fileTitle,'File:Art.png');
assert(article.lead.some(b=>b.type==='image'&&b.imageId===article.images[0].id));
const list=article.sections[0].blocks.find(b=>b.type==='list');assert.equal(list.items.length,3);assert(list.items.some(r=>r.some(n=>n.text==='Nested')));
const table=article.sections[0].blocks.find(b=>b.type==='table');assert.equal(table.rows[0].cells[0].header,true);assert.equal(table.rows[0].cells[1].colspan,20);assert.equal(table.rows[0].cells[1].rowspan,1);
assert(!article.sections[0].blocks.flatMap(b=>b.content||[]).some(n=>n.type==='link'&&/^javascript:/i.test(n.href)));
const escaped=parse('<p>&lt;script&gt;literal example&lt;/script&gt;</p>');assert.equal(escaped.lead[0].content[0].text,'<script>literal example</script>','Encoded markup remains inert text for the renderer to escape');
assert.equal(parse('<p>&constructor; &toString; &unknown;</p>').lead[0].content[0].text,'&constructor; &toString; &unknown;','Unknown entities cannot read inherited object members');
assert.throws(()=>parse('<p>x</p>',{game:'ygo'}),/source/);
assert.equal(parse('<h2 id="Same">One</h2><p>x</p><h2 id="Same">Two</h2><p>y</p>').sections[1].id,'wiki-section-same-2');

for(const [game,url] of [['mtg','https://files.mtg.wiki/Art.png'],['ptcg','https://archives.bulbagarden.net/media/upload/a/ab/Art.jpg'],['ygo','https://static.wikia.nocookie.net/yugioh/images/a/ab/Art.png/revision/latest?cb=1']])assert(isAllowedWikiImageUrl(game,url));
for(const url of ['data:image/png;base64,abc','javascript:alert(1)','http://files.mtg.wiki/a.png','https://files.mtg.wiki:444/a.png','https://user:pass@files.mtg.wiki/a.png','https://files.mtg.wiki/a.svg','https://files.mtg.wiki/a.html','https://evil.test/a.png','https://files.mtg.wiki.evil.test/a.png'])assert.equal(isAllowedWikiImageUrl('mtg',url),false,url);
assert.equal(isAllowedWikiImageUrl('ygo','https://static.wikia.nocookie.net/pokemon/images/a.png'),false,'Shared CDN requires the correct wiki prefix');
assert.equal(isAllowedWikiImageUrl('__proto__','https://files.mtg.wiki/a.png'),false);

const manyItems=parse('<ul>'+Array.from({length:301},(_,i)=>`<li>Item ${i}</li>`).join('')+'</ul>');assert.equal(manyItems.lead[0].items.length,300);assert.equal(manyItems.truncated,true);
const manyRows=parse('<table>'+Array.from({length:L.tableRows+1},(_,i)=>`<tr><td>Row ${i}</td></tr>`).join('')+'</table>');assert.equal(manyRows.lead[0].rows.length,L.tableRows);assert.equal(manyRows.truncated,true);
const manyCols=parse('<table><tr>'+Array.from({length:L.tableColumns+1},(_,i)=>`<td>Cell ${i}</td>`).join('')+'</tr></table>');assert.equal(manyCols.lead[0].rows[0].cells.length,L.tableColumns);assert.equal(manyCols.truncated,true);
const manySections=parse(Array.from({length:L.sections+1},(_,i)=>`<h2>Section ${i}</h2><p>Content ${i}</p>`).join(''));assert.equal(manySections.sections.length,L.sections);assert.equal(manySections.truncated,true);
const hugeText=parse('<p>'+'word '.repeat(50000)+'</p>');assert(hugeText.truncated);assert(hugeText.lead[0].content.reduce((n,c)=>n+c.text.length,0)<=L.textCharacters);
console.log('PASS: inert full-article structure preserves prose, headings, lists, tables, safe internal/external links, raster art and inline symbol alt text; active content/provider escapes are removed and every content cap reports truncation.');
