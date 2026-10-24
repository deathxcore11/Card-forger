// Parse returned MediaWiki HTML into inert data, never HTML to insert. Unknown
// markup contributes text only; active content and navigation subtrees are
// omitted. All links/images have independent protocol/provider checks.
import {wikiSourceForGame,isAllowedWikiImageUrl,isAllowedWikiUrl} from './wiki-sources.js';
export const WIKI_ARTICLE_LIMITS=Object.freeze({htmlCharacters:1500000,textCharacters:200000,nodes:18000,depth:48,blocks:1600,sections:150,images:12,links:1800,tableRows:160,tableColumns:20});
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',bull:'•',middot:'·',times:'×',copy:'©',reg:'®',trade:'™',plusmn:'±',minus:'−',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',infin:'∞',le:'≤',ge:'≥',ne:'≠',rarr:'→',larr:'←',darr:'↓',uarr:'↑',alpha:'α',beta:'β',gamma:'γ',delta:'δ',pi:'π'};
const clean=s=>String(s||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/gu,' ').trim();
function decode(s){return String(s||'').replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi,(m,k)=>{
 if(k[0]!=='#')return Object.hasOwn(entities,k.toLowerCase())?entities[k.toLowerCase()]:m;
 const n=k[1]?.toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);return Number.isInteger(n)&&n>0&&n<=0x10ffff&&(n<0xd800||n>0xdfff)?String.fromCodePoint(n):'�';
});}
const voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const dropTags=new Set('script style iframe object embed form input button select textarea noscript template svg math audio video canvas head base link meta'.split(' '));
const dropClasses=/\b(?:navbox|vertical-navbox|navigation-not-searchable|toc|mw-editsection|mw-jump-link|catlinks|printfooter|mw-empty-elt)\b/i;
function attrs(raw){const out={};for(const m of raw.matchAll(/([a-zA-Z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){const k=m[1].toLowerCase();if(['href','title','id','src','alt','width','height','class','role','colspan','rowspan'].includes(k))out[k]=decode(m[2]??m[3]??m[4]??'');}return out;}
function tree(html,state){
 const root={tag:'root',attrs:{},children:[]},stack=[root],skip=[];let last=0;
 const appendText=value=>{if(!skip.length&&value&&state.nodes++<WIKI_ARTICLE_LIMITS.nodes)stack.at(-1).children.push(decode(value));else if(state.nodes>=WIKI_ARTICLE_LIMITS.nodes)state.truncated=true;};
 for(const m of html.matchAll(/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-zA-Z][^>]*>/g)){
  appendText(html.slice(last,m.index));last=m.index+m[0].length;
  if(/^<!/.test(m[0]))continue;
  const match=m[0].match(/^<(\/)?([a-z][\w:-]*)\b([\s\S]*?)\/?\s*>$/i);if(!match)continue;
  const closing=!!match[1],tag=match[2].toLowerCase();
  if(skip.length){if(closing){const index=skip.lastIndexOf(tag);if(index>=0)skip.length=index;}else if(!voidTags.has(tag)&&!m[0].endsWith('/>'))skip.push(tag);continue;}
  if(closing){for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
  const properties=attrs(match[3]);
  if(dropTags.has(tag)||dropClasses.test(properties.class||'')||properties.role==='navigation'){if(!voidTags.has(tag)&&!m[0].endsWith('/>'))skip.push(tag);continue;}
  if(state.nodes++>=WIKI_ARTICLE_LIMITS.nodes){state.truncated=true;break;}
  const node={tag,attrs:properties,children:[]};stack.at(-1).children.push(node);
  if(!voidTags.has(tag)&&!m[0].endsWith('/>')){if(stack.length<WIKI_ARTICLE_LIMITS.depth)stack.push(node);else state.truncated=true;}
 }
 appendText(html.slice(last));return root;
}
const plain=node=>typeof node==='string'?node:node?.tag==='br'?' ':node?.children?.map(plain).join(' ')||'';
const safeSection=value=>'wiki-section-'+(clean(value).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}_:.-]+/gu,'-').slice(0,110)||'section');
function safeTitle(value){const s=clean(value).replace(/_/g,' ');return s&&s.length<=180&&!/[<>|{}\[\]\\]/.test(s)&&!/^\s*(?:special|media|file|image|user|talk|template|module|mediawiki|project|category|help)\s*:/i.test(s)?s:null;}
function externalHref(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')?url.href:null;}catch{return null;}}
function linkFor(href,state){
 if(typeof href!=='string'||href.length>2048||/[\u0000-\u001f\u007f]/.test(href))return null;
 let url;try{url=new URL(href,state.source.url);}catch{return null;}
 const safe=externalHref(url.href);if(!safe)return null;
 if(url.origin!==state.provider.origin)return {href:safe,internal:false};
 let title=null;
 try{
  if(url.pathname.startsWith(state.provider.articlePath))title=safeTitle(decodeURIComponent(url.pathname.slice(state.provider.articlePath.length)));
  else if(/\/(?:w\/)?index\.php$/.test(url.pathname))title=safeTitle(url.searchParams.get('title'));
 }catch{return null;}
 if(!title)return {href:safe,internal:false};
 let fragment=null;try{if(url.hash)fragment=safeSection(decodeURIComponent(url.hash.slice(1)));}catch{}
 return {href:safe,internal:true,game:state.game,title,...(fragment?{fragment}:{})};
}
function addImage(node,state,context={}){
 let src;try{src=new URL(node.attrs.src,state.source.url).href;}catch{return null;}
 const width=Number(node.attrs.width),height=Number(node.attrs.height);
 if(!isAllowedWikiImageUrl(state.game,src)||width>0&&width<32||height>0&&height<32)return null;
 const old=state.images.find(i=>i.src===src);if(old)return old.id;
 if(state.images.length>=WIKI_ARTICLE_LIMITS.images){state.imagesTruncated=true;return null;}
 const id='wiki-image-'+(state.images.length+1),image={id,src,alt:clean(node.attrs.alt).slice(0,600)||'Image from '+state.source.title,...(context.caption?{caption:clean(context.caption).slice(0,1500)}:{})};
 if(context.descriptionUrl&&isAllowedWikiUrl(state.game,context.descriptionUrl)){image.descriptionUrl=context.descriptionUrl;try{const url=new URL(context.descriptionUrl);image.fileTitle=decodeURIComponent(url.pathname.slice(state.provider.articlePath.length)).replace(/_/g,' ');}catch{}}
 state.images.push(image);return id;
}
function collectImages(node,state,context={}){
 if(typeof node==='string')return;
 let next=context;
 if(node.tag==='figure'||/\bthumb(?:inner)?\b/.test(node.attrs.class||'')){
  const caption=node.children.find(c=>typeof c!=='string'&&(c.tag==='figcaption'||/\bthumbcaption\b/.test(c.attrs.class||'')));
  if(caption)next={...next,caption:plain(caption)};
 }
 if(node.tag==='a')try{const url=new URL(node.attrs.href,state.source.url);if(url.origin===state.provider.origin&&url.pathname.startsWith(state.provider.articlePath)&&/\/(?:File|Image):/i.test(decodeURIComponent(url.pathname)))next={...next,descriptionUrl:url.href};}catch{}
 if(node.tag==='img')node.imageId=addImage(node,state,next);
 for(const child of node.children)collectImages(child,state,next);
}
function inlines(nodes,state){
 const out=[];
 const add=(text,link)=>{text=String(text||'').replace(/\s+/gu,' ');if(!text)return;if(state.text+text.length>WIKI_ARTICLE_LIMITS.textCharacters){text=text.slice(0,Math.max(0,WIKI_ARTICLE_LIMITS.textCharacters-state.text));state.truncated=true;}if(!text)return;state.text+=text.length;
  if(link&&state.links++<WIKI_ARTICLE_LIMITS.links)out.push({type:'link',text,...link});else{const old=out.at(-1);if(old?.type==='text')old.text+=text;else out.push({type:'text',text});}
 };
 const visit=(node,link=null)=>{
  if(typeof node==='string'){add(node,link);return;}
  if(node.tag==='br'){add('\n',link);return;}
  if(node.tag==='img'){if(!node.imageId)add(node.attrs.alt||'',link);return;}
  const href=node.tag==='a'?linkFor(node.attrs.href,state):link;
  for(const child of node.children)visit(child,href);
 };
 nodes.forEach(n=>visit(n));
 while(out.length&&out[0].type==='text'&&!out[0].text.trim())out.shift();while(out.length&&out.at(-1).type==='text'&&!out.at(-1).text.trim())out.pop();
 if(out[0]?.type==='text')out[0].text=out[0].text.trimStart();if(out.at(-1)?.type==='text')out.at(-1).text=out.at(-1).text.trimEnd();return out;
}
const hasContent=items=>items.some(n=>n.text?.trim());
export function parseWikiArticleContent(html,{game,title,source}={}){
 const provider=wikiSourceForGame(game);if(!provider||typeof html!=='string'||!source?.url||!isAllowedWikiUrl(game,source.url))throw Error('Invalid wiki article source.');
 const state={game,provider,source,nodes:0,text:0,links:0,blocks:0,truncated:html.length>WIKI_ARTICLE_LIMITS.htmlCharacters,imagesTruncated:false,images:[]},root=tree(html.slice(0,WIKI_ARTICLE_LIMITS.htmlCharacters),state);
 collectImages(root,state);
 const article={title:clean(title).slice(0,180),source,lead:[],sections:[],images:state.images,truncated:false},sectionIds=new Set(),emittedImages=new Set();let current=article.lead;
 const emit=block=>{if(state.blocks++>=WIKI_ARTICLE_LIMITS.blocks){state.truncated=true;return;}current.push(block);};
 const imagesUnder=node=>{if(typeof node==='string')return;if(node.imageId&&!emittedImages.has(node.imageId)){emit({type:'image',imageId:node.imageId});emittedImages.add(node.imageId);}node.children.forEach(imagesUnder);};
 const walk=node=>{
  if(state.stop)return;
  if(typeof node==='string'){const content=inlines([node],state);if(hasContent(content))emit({type:'paragraph',content});return;}
  if(/^h[1-6]$/.test(node.tag)){
   const label=clean(plain(node));if(!label||node.tag==='h1'&&key(label)===key(article.title))return;
   if(article.sections.length>=WIKI_ARTICLE_LIMITS.sections){state.truncated=true;state.stop=true;return;}
   const headline=node.children.find(c=>typeof c!=='string'&&c.attrs.id),base=safeSection(node.attrs.id||headline?.attrs.id||label);let id=base,n=2;while(sectionIds.has(id))id=base+'-'+n++;sectionIds.add(id);
   if(label.length>300)state.truncated=true;
   const section={id,title:label.slice(0,300),level:Math.max(2,Number(node.tag[1])),blocks:[]};article.sections.push(section);current=section.blocks;return;
  }
  if(node.tag==='p'||node.tag==='blockquote'||node.tag==='pre'){
   const content=inlines(node.children,state);if(hasContent(content))emit({type:'paragraph',content});imagesUnder(node);return;
  }
  if(node.tag==='ul'||node.tag==='ol'){
   const items=[];const entries=n=>{for(const child of n.children){if(typeof child==='string')continue;if(child.tag==='li'){const content=inlines(child.children.filter(c=>typeof c==='string'||!['ul','ol'].includes(c.tag)),state);if(hasContent(content))items.push(content);for(const nested of child.children.filter(c=>typeof c!=='string'&&['ul','ol'].includes(c.tag)))entries(nested);}else entries(child);}};entries(node);
   if(items.length>300)state.truncated=true;
   if(items.length)emit({type:'list',ordered:node.tag==='ol',items:items.slice(0,300)});imagesUnder(node);return;
  }
  if(node.tag==='table'){
   const rows=[];let caption='';const visit=n=>{if(typeof n==='string')return;if(n!==node&&n.tag==='table')return;if(n.tag==='caption'){const label=clean(plain(n));caption=label.slice(0,1000);if(label.length>1000)state.truncated=true;}if(n.tag==='tr'){if(rows.length>=WIKI_ARTICLE_LIMITS.tableRows){state.truncated=true;return;}const raw=n.children.filter(c=>typeof c!=='string'&&['td','th'].includes(c.tag));if(raw.length>WIKI_ARTICLE_LIMITS.tableColumns)state.truncated=true;const cells=raw.slice(0,WIKI_ARTICLE_LIMITS.tableColumns).map(c=>({header:c.tag==='th',content:inlines(c.children,state),colspan:Math.max(1,Math.min(20,Number(c.attrs.colspan)||1)),rowspan:Math.max(1,Math.min(20,Number(c.attrs.rowspan)||1))}));if(cells.some(c=>hasContent(c.content)))rows.push({cells});}for(const child of n.children)visit(child);};visit(node);
   if(rows.length)emit({type:'table',...(caption?{caption}:{}),rows});imagesUnder(node);return;
  }
  if(node.tag==='img'){imagesUnder(node);return;}
  for(const child of node.children)walk(child);
 };
 root.children.forEach(walk);article.truncated=state.truncated;article.imagesTruncated=state.imagesTruncated;
 return article;
}
const key=s=>clean(s).toLowerCase();
export function plainWikiMetadata(value){return clean(decode(String(value||'').replace(/<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi,'').replace(/<[^>]*>/g,' '))).slice(0,1500);}
