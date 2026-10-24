import {esc} from './ui.js';
import {wikiSourceForGame,isAllowedWikiUrl,isAllowedWikiImageUrl} from './wiki-sources.js';

// The article reader receives semantic data, never source HTML. These limits are
// a final display bound, independent of the server's network/parser budgets.
const LIMITS=Object.freeze({sections:250,blocks:1600,inlines:320,items:300,rows:300,cells:40,images:40,text:300000});
const CONTROL=/[\u0000-\u001f\u007f]/;
const NAMESPACE=/^(?:special|file|image|media|category|template|user|user talk|talk|help|project|module|mediawiki|portal|draft|timedtext|widget|gadget|mtg wiki|bulbapedia|yu-gi-oh! wiki)\s*:/i;
const external=(href,label)=>`<a class="wiki-article-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const key=value=>String(value??'').normalize('NFC').replace(/_/g,' ').trim().toLocaleLowerCase('en-US');
function topic(value){
 if(typeof value!=='string')return '';
 const text=value.normalize('NFC').trim();
 return text&&text.length<=180&&!CONTROL.test(text)&&!/[<>\[\]{}|\\]/.test(text)&&!/^https?:/i.test(text)?text:'';
}
function https(value){
 if(typeof value!=='string'||value.length>3000||CONTROL.test(value)||value.includes('\\'))return '';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')?url.href:'';}catch{return '';}
}
function providerTopic(game,value){
 if(!https(value))return '';
 try{
  const source=wikiSourceForGame(game),url=new URL(value);if(!source||url.origin!==source.origin)return '';
  if(isAllowedWikiUrl(game,value))return topic(decodeURIComponent(url.pathname.slice(source.articlePath.length)).replace(/_/g,' '));
  if(/^\/(?:w\/)?index\.php$/.test(url.pathname))return topic((url.searchParams.get('title')||'').replace(/_/g,' '));
  return '';
 }catch{return '';}
}
function magicCardQuery(value){
 try{const url=new URL(value);if(url.origin!=='https://scryfall.com'||url.pathname!=='/search')return null;const query=url.searchParams.get('q')||'';return query.trim()&&query.length<=300&&!CONTROL.test(query)?query:null;}catch{return null;}
}
function sourceMatches(game,source,title){
 return source&&typeof source==='object'&&(!source.game||source.game===game)&&isAllowedWikiUrl(game,source.url)&&key(providerTopic(game,source.url))===key(title)&&(!source.title||key(source.title)===key(title));
}
function fragmentKey(value){
 try{return decodeURIComponent(String(value??'').replace(/^#/,'' )).replace(/_/g,' ').normalize('NFC').trim();}catch{return '';}
}
function sectionId(value,index,used){
 const base=String(value||'section-'+(index+1)).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,100)||'section-'+(index+1);
 let id='wiki-'+base,suffix=1;while(used.has(id))id='wiki-'+base+'-'+(++suffix);used.add(id);return id;
}

/** Render a provider-bound article AST. Source fields never become markup. */
export function wikiArticleMarkup(response,{game='mtg'}={}){
 const provider=wikiSourceForGame(game),article=response?.article,title=topic(article?.title);
 if(!provider||response?.status!=='available'||response?.mode!=='article'||response.game!==game||!article||!title||article.game&&article.game!==game)return '';
 const source=article.source||response.source;
 if(!sourceMatches(game,source,title)||response.source&&!sourceMatches(game,response.source,title))return '';
 let remaining=LIMITS.text,blockCount=0,trimmed=article.truncated===true;
 const text=(value,max=200000)=>{
  if(typeof value!=='string')return '';
  const take=Math.min(value.length,max,remaining);if(take<value.length)trimmed=true;remaining-=take;return value.slice(0,take);
 };
 const bounded=(value,max)=>{if(!Array.isArray(value))return [];if(value.length>max)trimmed=true;return value.slice(0,max);};
 const usedIds=new Set(),fragments=new Map();
 const sections=bounded(article.sections,LIMITS.sections).filter(s=>s&&typeof s==='object').map((section,index)=>{
  const id=sectionId(section.id||section.title,index,usedIds);
  for(const alias of [section.id,section.title]){const f=fragmentKey(alias);if(f&&!fragments.has(f))fragments.set(f,id);}
  return {...section,id};
 });
 const inline=parts=>bounded(parts,LIMITS.inlines).map(part=>{
  if(!part||typeof part!=='object')return '';
  // Non-raster inline symbols retain their source alt text rather than vanish.
  const label=text(part.type==='image'?(part.alt||part.text):part.text);
  if(!label)return '';
  if(part.type!=='link')return ['text','image'].includes(part.type)?esc(label):'';
  const href=https(part.href),linkedTopic=providerTopic(game,href),requestedTopic=topic(part.title||linkedTopic);
  if(part.internal===true&&(!part.game||part.game===game)&&linkedTopic&&requestedTopic&&key(linkedTopic)===key(requestedTopic)&&!NAMESPACE.test(requestedTopic)){
   const localFragment=fragmentKey(part.fragment||new URL(href).hash);
   if(key(linkedTopic)===key(title)&&localFragment&&fragments.has(localFragment))return `<button type="button" class="wiki-article-link" data-wiki-anchor="${esc(fragments.get(localFragment))}">${esc(label)}</button>`;
   if(key(linkedTopic)===key(title)&&localFragment)return esc(label);
   return `<button type="button" class="wiki-article-link" data-act="mtgWikiPick" data-wiki-topic="${esc(requestedTopic)}">${esc(label)}</button>`;
  }
  // A source-local section anchor is allowed only when it maps to a rendered
  // heading; every other relative or executable URL becomes plain text.
  if(typeof part.href==='string'&&part.href.startsWith('#')){
   const id=fragments.get(fragmentKey(part.href));return id?`<button type="button" class="wiki-article-link" data-wiki-anchor="${esc(id)}">${esc(label)}</button>`:esc(label);
  }
  const cardQuery=game==='mtg'&&href?magicCardQuery(href):null;
  if(cardQuery){const exact=cardQuery.match(/^!"([^"<>]{1,180})"(?:\s+set:[a-z0-9]{2,8})?$/i);return exact?`<button type="button" class="wiki-article-link" data-act="card" data-name="${esc(exact[1])}" data-read-only="true">${esc(label)}</button>`:`<button type="button" class="wiki-article-link" data-act="wikiCards" data-wiki-query="${esc(cardQuery)}">${esc(label)}</button>`;}
  return href?external(href,label):esc(label);
 }).join('');
 const images=new Map(),seenImages=new Set();
 for(const image of bounded(article.images,LIMITS.images)){
  if(!image||typeof image!=='object'||typeof image.id!=='string'||!image.id||image.id.length>180||images.has(image.id))continue;
  if(!https(image.src)||!isAllowedWikiImageUrl(game,image.src))continue;
  images.set(image.id,image);
 }
 const figure=id=>{
  const image=images.get(id);if(!image||seenImages.has(id))return '';seenImages.add(id);
  const alt=text(image.alt||image.caption||title,1000),caption=text(image.caption,3000),attribution=text(image.attribution,2000),license=text(image.license,1000);
  const description=https(image.descriptionUrl),licenseUrl=https(image.licenseUrl),credit=[];
  if(caption)credit.push(esc(caption));if(attribution)credit.push(esc(attribution));
  if(license)credit.push(licenseUrl?external(licenseUrl,license):esc(license));
  if(description&&isAllowedWikiUrl(game,description))credit.push(external(description,'Image source'));
  return `<figure class="wiki-article-figure" data-wiki-image="${esc(id)}"><img src="${esc(image.src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-wiki-article-image><span hidden data-wiki-image-fallback role="img" aria-label="${esc(alt||'Image unavailable')}">Image unavailable</span>${credit.length?`<figcaption>${credit.join(' · ')}</figcaption>`:''}</figure>`;
 };
 const span=(attribute,value)=>Number.isSafeInteger(value)&&value>1&&value<=20?` ${attribute}="${value}"`:'';
 const block=value=>{
  if(!value||typeof value!=='object')return '';if(blockCount++>=LIMITS.blocks){trimmed=true;return '';}
  if(value.type==='paragraph'){const content=inline(value.content);return content?`<p>${content}</p>`:'';}
  if(value.type==='list'){
   const items=bounded(value.items,LIMITS.items).map(item=>inline(item)).filter(Boolean);if(!items.length)return '';
   const tag=value.ordered===true?'ol':'ul';return `<${tag}>${items.map(item=>`<li>${item}</li>`).join('')}</${tag}>`;
  }
  if(value.type==='image')return figure(value.imageId);
  if(value.type==='table'){
   const rows=bounded(value.rows,LIMITS.rows).map(row=>{
    const cells=bounded(row?.cells,LIMITS.cells).map(cell=>{
     if(!cell||typeof cell!=='object')return '';const tag=cell.header===true?'th':'td';
     return `<${tag}${span('colspan',cell.colspan)}${span('rowspan',cell.rowspan)}>${inline(cell.content)}</${tag}>`;
    }).join('');return cells?`<tr>${cells}</tr>`:'';
   }).join('');if(!rows)return '';
   const caption=text(value.caption,2000);return `<div class="wiki-article-table-wrap" tabindex="0" role="region" aria-label="${esc(caption||'Article table')}"><table class="wiki-article-table">${caption?`<caption>${esc(caption)}</caption>`:''}<tbody>${rows}</tbody></table></div>`;
  }
  return '';
 };
 const blocks=value=>bounded(value,LIMITS.blocks).map(block).join('');
 const firstImage=images.keys().next().value,leadArt=firstImage?figure(firstImage):'';
 // Source infoboxes often precede the definition. Let the introduction start
 // beside the article art before any full-width metadata table clears its float.
 // Move only this metadata prefix; ordinary article tables/lists keep their order.
 const leadBlocks=bounded(article.lead,LIMITS.blocks),definition=leadBlocks.findIndex(value=>value?.type==='paragraph'&&Array.isArray(value.content)&&value.content.some(part=>['text','link','image'].includes(part?.type)&&typeof(part.type==='image'?part.alt||part.text:part.text)==='string'&&(part.type==='image'?part.alt||part.text:part.text).trim()));
 const metadataPrefix=definition>0&&leadBlocks.slice(0,definition).every(value=>value?.type==='image'||value?.type==='table'&&value.infobox===true);
 const orderedLead=metadataPrefix?[leadBlocks[definition],...leadBlocks.slice(0,definition),...leadBlocks.slice(definition+1)]:leadBlocks;
 const lead=blocks(orderedLead),body=sections.map(section=>{
  const heading=text(section.title,1000),content=blocks(section.blocks),level=Number.isSafeInteger(section.level)&&section.level>=2&&section.level<=6?section.level:2;
  return heading||content?`<section class="wiki-article-section" id="${esc(section.id)}" tabindex="-1">${heading?`<h${level}>${esc(heading)}</h${level}>`:''}${content}</section>`:'';
 }).join('');
 const remainingArt=[...images.keys()].map(figure).join('');
 const history=new URL(source.url);history.searchParams.set('action','history');history.hash='';
 const licenseLabel=provider.declaredLicense||'Licensing',licenseUrl=https(provider.licenseUrl);
 const credit=[external(source.url,provider.name),external(history.href,'Contributors / history')];if(licenseUrl)credit.push(external(licenseUrl,licenseLabel));
 if(trimmed)credit.push('Article shortened · '+external(source.url,'Read full source'));
 return `<article class="wiki-article" data-wiki-article="${esc(game)}"><header><h1>${esc(title)}</h1></header><div class="wiki-article-body">${leadArt}${lead?`<div class="wiki-article-lead">${lead}</div>`:''}${body}${remainingArt}</div><footer class="wiki-source-credit">${credit.join(' · ')}</footer></article>`;
}

/** Attach after painting an article; no inline handlers or source HTML execute. */
export function bindWikiArticleImages(root){
 const cleanups=[];
 // Hashes belong to the app router. Local article references scroll within this
 // reading surface without changing the route or issuing a fresh Wiki request.
 for(const anchor of root?.querySelectorAll?.('[data-wiki-anchor]')||[]){
  const navigate=()=>{
   const target=[...(root?.querySelectorAll?.('.wiki-article-section')||[])].find(section=>section.id===anchor.dataset?.wikiAnchor);
   target?.scrollIntoView?.({behavior:'smooth',block:'start'});target?.focus?.({preventScroll:true});
  };
  anchor.addEventListener('click',navigate);cleanups.push(()=>anchor.removeEventListener('click',navigate));
 }
 for(const image of root?.querySelectorAll?.('[data-wiki-article-image]')||[]){
  const fallback=image.closest?.('[data-wiki-image]')?.querySelector?.('[data-wiki-image-fallback]');
  if(!fallback)continue;
  const failed=()=>{image.hidden=true;fallback.hidden=false;};
  image.addEventListener('error',failed);cleanups.push(()=>image.removeEventListener('error',failed));
  if(image.complete&&image.naturalWidth===0)failed();
 }
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
