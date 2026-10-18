// Deterministic Search / printing-picker fixtures. Importing this module never
// imports a browser, starts a server, takes screenshots, or contacts a provider.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {blank} from '../store.js';
import {cardKey} from '../core.js';
import {validateWorkspace} from '../confidence.js';
import {normalizePtcg} from '../ptcg.js';
import {normalizeYgo, normalizeYgoSets} from '../ygo.js';
import {SUPABASE} from '../config.js';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const RESULTS=resolve(ROOT,'test-results');
export const GAMES=['mtg','ptcg','ygo'], WIDTHS=[320,390,768,1440];
export const NOW=Date.parse('2026-10-17T12:00:00.000Z'), ISO=new Date(NOW).toISOString();
export const ART_EVIDENCE='SYNTHETIC SEARCH FIXTURE. All card and symbol images are intercepted with labeled SVG artwork. This suite verifies identity, navigation and layout, not real illustrations, live prices or provider availability. PNG evidence is captured only by the approved hosted CI job. All displayed lots and prices are synthetic fixture data, not a real collection.';
const IMAGE='https://search-fixtures.invalid';
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#18354c"/><circle cx="315" cy="330" r="180" fill="#997c49"/><text x="20" y="64" fill="white" font-size="26">SYNTHETIC SEARCH FIXTURE</text><text x="20" y="835" fill="white" font-size="25">NOT REAL CARD ART</text></svg>';
const pad=n=>String(n).padStart(3,'0');
const original={set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08',num_of_cards:126};
const anniversary={set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-21',num_of_cards:126};
const uniqueRelease={set_code:'FXX',set_name:'Synthetic edition-backed release',tcg_date:'2025-01-01',num_of_cards:1};
export const YGO_RAW_SETS=[original,anniversary,uniqueRelease];
export const RELEASES=normalizeYgoSets(YGO_RAW_SETS);
export const LOB=RELEASES.find(x=>x.name===original.set_name), ANNIVERSARY=RELEASES.find(x=>x.name===anniversary.set_name), UNIQUE=RELEASES.find(x=>x.name===uniqueRelease.set_name);
export const SETS={
 mtg:[{code:'fxa',name:'Synthetic Search A',released_at:'2025-01-01',set_type:'expansion',card_count:250},{code:'fxb',name:'Synthetic Search B',released_at:'2024-01-01',set_type:'expansion',card_count:250}],
 ptcg:[{id:'fxa',name:'Synthetic Search A',releaseDate:'2025-01-01',cardCount:{total:250,official:250}},{id:'fxb',name:'Synthetic Search B',releaseDate:'2024-01-01',cardCount:{total:250,official:250}}]
};
const magic=(group,n,{name=`${group} fixture ${pad(n)}`,set='fxa',oracle=`search-${group}-${n}`,price=n,finishes=['nonfoil','foil']}={})=>({id:`fixture-mtg-${group.toLowerCase()}-${pad(n)}`,oracle_id:oracle,name,lang:'en',type_line:'Legendary Creature — Elf Druid',oracle_text:'Synthetic fixture only. Draw a card.',mana_cost:'{2}{G}',cmc:3,colors:['G'],color_identity:['G'],keywords:[],power:'3',toughness:'3',legalities:{commander:'legal',standard:'legal'},set,set_name:SETS.mtg.find(s=>s.code===set).name,collector_number:String(n),rarity:n%2?'common':'rare',finishes,image_uris:{normal:`${IMAGE}/mtg-${group}-${n}.svg`,small:`${IMAGE}/mtg-${group}-${n}.svg`,art_crop:`${IMAGE}/mtg-${group}-${n}.svg`},prices:{usd:price===null?null:String(price),usd_foil:null,usd_etched:null},full:true,released_at:'2025-01-01',checkedAt:ISO});
const pokemon=(group,n,{name=`${group} fixture ${pad(n)}`,set='fxa',price=n,category='Pokemon',legal=true,variants={normal:true,holo:true}}={})=>({id:`${set}-${group.toLowerCase()}${pad(n)}`,localId:String(n),name,category,stage:category==='Pokemon'?'Basic':undefined,hp:category==='Pokemon'?100:undefined,types:category==='Pokemon'?['Grass']:[],rarity:n%2?'Common':'Rare',image:`${IMAGE}/ptcg-${group}-${n}.png`,set:SETS.ptcg.find(s=>s.id===set),legal:{standard:legal,expanded:true},regulationMark:'H',variants,pricing:price===null?{}:{tcgplayer:{normal:{marketPrice:price,productId:1000+n},updated:'2026-10-17'}},attacks:category==='Pokemon'?[{name:'Synthetic attack',cost:[],damage:10}]:[],effect:category==='Trainer'?'Synthetic Supporter fixture.':''});
const ygo=(id,group,n,{name=`${group} fixture ${pad(n)}`,price=n,ban={},pools=['TCG','OCG','GOAT','Edison','Master Duel'],type='Effect Monster',sets}={})=>({id,name,type,frameType:type==='Link Monster'?'link':/Spell/.test(type)?'spell':'effect',race:/Spell|Trap/.test(type)?'Normal':'Dragon',attribute:'LIGHT',level:8,...(type==='Link Monster'?{linkval:3}:{}),atk:3000,def:2500,desc:'Synthetic Search fixture. Not live card data.',card_images:[{id}],card_prices:[{tcgplayer_price:price===null?'':String(price),cardmarket_price:''}],card_sets:sets||[{set_code:'FXX-'+pad(n),set_name:uniqueRelease.set_name,set_rarity:'Common',set_price:price===null?'':String(price)}],banlist_info:ban,misc_info:[{formats:pools,tcg_date:'2025-01-01'}]});
const groups=['Alpha','Beta','Saved'];
export const RAW={
 mtg:[...groups.flatMap((g,i)=>[magic(g,1,{price:i+1}),magic(g,2,{price:i+2})]),...Array.from({length:7},(_,i)=>magic('Paged',i+1,{price:10-i})),magic('EmptyPage',1)],
 ptcg:[...groups.flatMap((g,i)=>[pokemon(g,i*10+1),pokemon(g,i*10+2)]),...Array.from({length:53},(_,i)=>pokemon('Paged',i+1,{name:`Paged fixture ${pad(53-i)}`,price:i+1})),pokemon('Pending',1),pokemon('Pending',2,{legal:false}),pokemon('Trainer',1,{category:'Trainer'}),pokemon('Energy',1,{category:'Energy'})],
 ygo:[...groups.flatMap((g,i)=>[ygo(99010000+i*10,g,1),ygo(99010001+i*10,g,2)]),...Array.from({length:64},(_,i)=>ygo(99020000+i,'Paged',i+1,{price:64-i})),ygo(99030000,'Legal',1,{ban:{ban_tcg:'Forbidden',ban_ocg:'Limited'}}),ygo(99030001,'Legal',2,{ban:{ban_tcg:'Limited',ban_ocg:'Forbidden'}}),ygo(99030002,'Legal',3,{ban:{ban_tcg:'Semi-Limited',ban_ocg:'Semi-Limited'}}),ygo(99030003,'Legal',4,{pools:['TCG']}),ygo(99030004,'Legal',5,{pools:[]}),ygo(99030005,'Legal',6,{pools:['OCG','Edison']})]
};
RAW.ygo[1].type='Spell Card';RAW.ygo[1].frameType='spell';RAW.ygo[1].race='Normal';
export const MAGIC_PRINTS=Array.from({length:7},(_,i)=>magic('Printing',i+1,{name:'Shared fixture legend',set:i%2?'fxb':'fxa',oracle:'shared-fixture-oracle',price:i===6?null:i+1,finishes:i===6?[]:['nonfoil','foil']}));
export const POKEMON_PRINTS=[pokemon('Printing',1,{name:'Pikachu'}),pokemon('Printing',2,{name:'Pikachu',set:'fxb',price:null,variants:{firstEdition:true}}),pokemon('Printing',3,{name:'Pikachu ex'}),pokemon('Printing',4,{name:'Pikachu V'}),pokemon('Printing',5,{name:'Pikachu VMAX'}),{...pokemon('Printing',6,{name:'Pikachu'}),id:'A1-001',set:{id:'A1',name:'Pocket fixture'},image:`${IMAGE}/tcgp/ptcg-pocket.png`}];
export const YGO_PRINT_CARD=ygo(89631139,'Printing',1,{name:'Blue-Eyes White Dragon',price:999,sets:[{set_code:'LOB-001',set_name:original.set_name,set_rarity:'Ultra Rare',set_price:'19'},{set_code:'LOB-001',set_name:anniversary.set_name,set_rarity:'Ultra Rare',set_price:'99'},{set_code:'LOB-001',set_name:original.set_name,set_rarity:'Rare',set_price:''},{set_code:'FXX-001',set_name:uniqueRelease.set_name,set_rarity:'Ultra Rare',set_price:''}]});
RAW.ptcg.push(pokemon('MetaUncached',1,{name:'Eevee'}));
RAW.ygo.push(ygo(99040000,'Pool',1,{pools:['tcg','ocg','master duel'],ban:{ban_tcg:'Limited',ban_ocg:'Semi-Limited'}}),ygo(99040001,'Pool',2,{pools:['ocg'],ban:{ban_ocg:'Forbidden'}}),ygo(99040002,'Pool',3,{pools:['master duel']}));
RAW.mtg.push(...MAGIC_PRINTS,magic('WrongOracle',1,{name:'Shared fixture legend',oracle:'wrong-fixture-oracle'}));
RAW.ptcg.push(...POKEMON_PRINTS);RAW.ygo.push(YGO_PRINT_CARD,ygo(89631140,'Printing',2,{name:'Blue-Eyes White Dragon'}));
export const CARDS={mtg:RAW.mtg,ptcg:RAW.ptcg.filter(c=>c.set?.id!=='A1').map(c=>({...normalizePtcg(c),fetchedAt:ISO})),ygo:RAW.ygo.map(c=>({...normalizeYgo(c),fetchedAt:ISO,printPriceSchema:1}))};
// Explicit edition evidence belongs to one unambiguous release only. Same-code
// legacy product contamination must not migrate onto either LOB release.
const yp=CARDS.ygo.find(c=>c.id==='89631139');
for(const p of yp.sets.filter(p=>p.code==='LOB-001'&&p.rarity==='Ultra Rare'))Object.assign(p,{productId:123456,quotes:[{edition:'1st Edition',market:777}]});
Object.assign(yp.sets.find(p=>p.code==='FXX-001'),{quotes:[{edition:'1st Edition',market:31},{edition:'Unlimited',market:11}]});
export const PRINT_IDS={mtg:MAGIC_PRINTS[0].id,ptcg:POKEMON_PRINTS[0].id,ygo:'89631139'};
export const GROUP_IDS=Object.fromEntries(GAMES.map(g=>[g,Object.fromEntries([...groups,'Paged','Pending','Legal','Pool'].map(name=>[name,RAW[g].filter(c=>c.name.startsWith(name+' fixture')).map(c=>String(c.id))]))]));
export function makeSearchFixtures(game='mtg',{pendingDetails=false}={}){
 const state=blank();state.settings.game=game;state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 state.myPrices={'89631139:nonfoil':{price:987.65,name:'Blue-Eyes White Dragon',at:ISO}};state.priceChoices={[cardKey('Shared fixture legend')]:{id:MAGIC_PRINTS[2].id,finish:'foil',price:42}};
 for(const g of GAMES){const c=CARDS[g].find(c=>c.id===PRINT_IDS[g]),st=g==='mtg'?state:state.tcg[g];st.collection=[{id:`fixture-lot-${g}`,name:c.name,qty:5,condition:'Lightly Played',language:'en',finish:'nonfoil',addedAt:ISO,manualValue:1.75,manualValueCondition:'Lightly Played',manualValueCurrency:'USD',...(g==='mtg'?{printingId:c.id,printingVerified:true,set:c.set,collectorNumber:c.collector_number}:{cardId:c.id,key:`id:${c.id}`,...(g==='ptcg'?{variant:'normal',printing:c.set.id,number:c.set.number}:{printing:'LOB-001',rarity:'Ultra Rare',edition:'',setReleaseId:LOB.id,setName:LOB.name})})}];}
 state.printings=Object.fromEntries(MAGIC_PRINTS.map(c=>[c.id,c]));
 // Seed only the chosen Magic printing under its name. Sibling printings must
 // remain separately identifiable and must not overwrite the selected card.
 const catalog=Object.fromEntries(CARDS.mtg.filter(c=>!c.name.startsWith('Shared fixture')).concat(MAGIC_PRINTS[0]).map(c=>[cardKey(c.name),c]));
 const cache={ptcg:Object.fromEntries(CARDS.ptcg.filter(c=>c.name!=='Eevee'&&(!pendingDetails||!GROUP_IDS.ptcg.Pending.includes(c.id))).map(c=>[c.id,c])),ygo:Object.fromEntries(CARDS.ygo.map(c=>[c.id,c]))};
 const saved={mtg:[{label:'Saved fixture search',term:'Saved',filters:{color:'',type:'',format:'',maxPrice:''}}],ptcg:[{label:'Saved fixture search',q:'Saved',f:{},maxPrice:'',own:'',sort:'new'}],ygo:[{label:'Saved fixture search',q:'Saved',f:{},maxPrice:'',own:'',sort:'name'}]};
 saved.ptcg.push({label:'Incompatible category fixture',q:'Alpha',f:{category:'Trainer',type:'Grass',stage:'Stage2',hp:'200'},maxPrice:'',own:'',sort:'new'});
 saved.ygo.push({label:'Incompatible category fixture',q:'Alpha',f:{type:'Spell Card',attribute:'LIGHT',level:'8',race:'Dragon'},maxPrice:'',own:'',sort:'defDesc'});
 const storage={'cardforge-v2':state,'cardforge-catalog-v1':catalog,'cardforge-tcg-cache-v1':cache,'cardforge-saved-searches-v1':saved,'cardforge-sets-v1':{at:NOW,sets:SETS.mtg},'cardforge-community-v1':Object.fromEntries(GAMES.map(g=>[g,{at:NOW,data:{game:g,status:'unavailable',items:[],fetchedAt:ISO}}])),'cardforge-meta-v1':Object.fromEntries(['mtg:Standard','mtg:EDH','ptcg','ygo'].map(g=>[g,{at:NOW,data:{game:g.split(':')[0],artSchema:2,source:'Synthetic Meta fixture',events:[],decks:[],archetypes:[],top:g==='ptcg'?[{name:'Pikachu',pct:40,kind:'Pokemon'},{name:'Eevee',pct:20,kind:'Pokemon'}]:[]}}])),'cardstashy-watch-sent-v1':Object.fromEntries(GAMES.flatMap(g=>CARDS[g].map(c=>[`${g}:${c.id}`,NOW]))),'cardforge-hero-v1':{date:'2026-10-17',...Object.fromEntries(GAMES.map(g=>[g,{name:CARDS[g][0].name,id:CARDS[g][0].id,art:`${IMAGE}/hero-${g}.svg`}]))},'cf-mtg-tcg-v1':{fxa:{t:NOW,prices:{}},fxb:{t:NOW,prices:{}}}};
 return {state,catalog,cache,storage};
}
const queryGroup=q=>['Alpha','Beta','Saved','Paged','Pending','Legal','Pool','EmptyPage'].find(g=>String(q).includes(g))||'';
export function isSearchRequest(game,url,{group,page}={}){
 const search=game==='mtg'?url.hostname==='api.scryfall.com'&&url.pathname==='/cards/search'&&!url.searchParams.get('q')?.includes('oracleid:'):game==='ptcg'?url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards'&&!url.searchParams.has('pagination:itemsPerPage')&&!url.searchParams.get('name')?.startsWith('eq:'):url.hostname==='db.ygoprodeck.com'&&url.pathname.endsWith('/cardinfo.php')&&!url.searchParams.has('id')&&url.searchParams.get('num')!=='12';
 const term=game==='mtg'?url.searchParams.get('q'):game==='ptcg'?url.searchParams.get('name'):url.searchParams.get('fname');
 const cursor=game==='mtg'?Number(url.searchParams.get('page')||1):game==='ygo'?Number(url.searchParams.get('offset')||0)/60+1:1;
 return search&&(!group||queryGroup(term)===group)&&(page===undefined||cursor===page);
}
export function providerFixture(url){
 const host=url.hostname,path=url.pathname;
 if(host==='api.scryfall.com'){
  if(path==='/sets')return {data:SETS.mtg};
  if(path==='/cards/autocomplete')return {object:'catalog',data:[...new Set(RAW.mtg.filter(c=>c.name.toLowerCase().includes((url.searchParams.get('q')||'').toLowerCase())).map(c=>c.name))]};
  if(path==='/cards/search'){
   const q=url.searchParams.get('q')||'',group=queryGroup(q),prints=q.includes('shared-fixture-oracle'),page=Number(url.searchParams.get('page')||1),rows0=prints?MAGIC_PRINTS:q.includes('Shared')?[MAGIC_PRINTS[0]]:group?RAW.mtg.filter(c=>c.name.startsWith(group+' fixture')):RAW.mtg.filter(c=>c.name.startsWith('Alpha fixture')),rows=/\br:rare\b/.test(q)?rows0.filter(c=>c.rarity==='rare'):rows0;
   const size=prints?2:3,start=(page-1)*size,part=group==='EmptyPage'&&page===1?[]:rows.slice(start,start+size),more=group==='EmptyPage'?page===1:start+size<rows.length;
   if(group==='Paged'&&page>1&&part.length)part.unshift(rows[start-1]);
   if(prints&&page===1)part.push(RAW.mtg.find(c=>c.id==='fixture-mtg-wrongoracle-001'),{...MAGIC_PRINTS[0],id:'fixture-mtg-digital-only',games:['arena']},MAGIC_PRINTS[0]);
   if(group==='EmptyPage'&&page===2)part.push(RAW.mtg.find(c=>c.name.startsWith('EmptyPage fixture')));
   const next=new URL(url);next.searchParams.set('page',String(page+1));
   return {object:'list',data:part,total_cards:rows.length,has_more:more,...(more?{next_page:next.href}:{})};
  }
  if(path.endsWith('/rulings'))return {data:[]};
  if(path==='/cards/named')return RAW.mtg.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')));
  if(path.startsWith('/cards/'))return RAW.mtg.find(c=>c.id===decodeURIComponent(path.split('/').at(-1)));
 }
 if(host==='api.tcgdex.net'){
  if(path==='/v2/en/sets')return SETS.ptcg;
  if(path==='/v2/en/series')return [{id:'fixture-series',name:'Synthetic series',sets:SETS.ptcg}];
  if(path.startsWith('/v2/en/series/'))return {id:'fixture-series',name:'Synthetic series',sets:SETS.ptcg};
  if(path.startsWith('/v2/en/sets/')){const set=SETS.ptcg.find(s=>s.id===decodeURIComponent(path.split('/').at(-1)));return set&&{...set,cards:RAW.ptcg.filter(c=>c.set.id===set.id)};}
  if(path==='/v2/en/cards'){
   const name=url.searchParams.get('name')||'',group=queryGroup(name);
   if(name==='Eevee')return RAW.ptcg.filter(c=>c.name==='Eevee');
   if(name.includes('Pikachu'))return [...POKEMON_PRINTS,...POKEMON_PRINTS.slice(0,1)]; // Adversarial provider: exact endpoint still overmatches and duplicates.
   let rows=group?RAW.ptcg.filter(c=>c.name.startsWith(group+' fixture')):RAW.ptcg.filter(c=>c.name.startsWith('Alpha fixture'));
   if(url.searchParams.get('category'))rows=rows.filter(c=>c.category===url.searchParams.get('category'));if(url.searchParams.get('rarity'))rows=rows.filter(c=>c.rarity===url.searchParams.get('rarity').replace(/^eq:/,''));
   return [...rows,...(group==='Paged'?rows.slice(0,1):[])];
  }
  if(path.startsWith('/v2/en/cards/'))return RAW.ptcg.find(c=>c.id===decodeURIComponent(path.split('/').at(-1)));
 }
 if(host==='api.pokemontcg.io'&&path==='/v2/cards')return {data:[],page:1,pageSize:250,count:0,totalCount:0};
 if(host==='db.ygoprodeck.com'){
  if(path.endsWith('/cardsets.php'))return YGO_RAW_SETS;
  if(path.endsWith('/archetypes.php'))return [];
  if(path.endsWith('/cardinfo.php')){
   const ids=(url.searchParams.get('id')||'').split(','),group=queryGroup(url.searchParams.get('fname')),offset=Number(url.searchParams.get('offset')||0),size=Number(url.searchParams.get('num')||60);
   let rows=url.searchParams.has('id')?RAW.ygo.filter(c=>ids.includes(String(c.id))):url.searchParams.get('fname')?.includes('Blue')?[YGO_PRINT_CARD]:group?RAW.ygo.filter(c=>c.name.startsWith(group+' fixture')):RAW.ygo.filter(c=>c.name.startsWith('Alpha fixture'));if(url.searchParams.get('type'))rows=rows.filter(c=>c.type===url.searchParams.get('type'));
   const part=rows.slice(offset,offset+size);if(group==='Paged'&&offset===60)part.unshift(rows[59]);
   return {data:part,meta:{total_rows:rows.length,rows_remaining:Math.max(0,rows.length-offset-size)}};
  }
 }
 return undefined;
}
export async function validateSearchFixtures(){
 for(const g of GAMES){const f=makeSearchFixtures(g),valid=validateWorkspace(structuredClone(f.state));assert.equal(valid.settings.game,g);for(const gg of GAMES){const lot=(gg==='mtg'?valid:valid.tcg[gg]).collection[0];assert.equal(lot.condition,'Lightly Played');assert.equal(lot.manualValue,1.75);assert.equal(lot[gg==='mtg'?'printingId':'cardId'],PRINT_IDS[gg]);}assert.equal(valid.tcg.ygo.collection[0].edition,'');assert.equal(valid.tcg.ygo.collection[0].setReleaseId,LOB.id);assert.equal(valid.myPrices['89631139:nonfoil'].price,987.65);}
 assert.notEqual(LOB.id,ANNIVERSARY.id);assert.equal(MAGIC_PRINTS.length,7);assert.equal(new Set(MAGIC_PRINTS.map(c=>c.id)).size,7);assert.equal(new Set(MAGIC_PRINTS.map(c=>c.oracle_id)).size,1);assert.equal(MAGIC_PRINTS.at(-1).finishes.length,0);assert(POKEMON_PRINTS.some(c=>c.name==='Pikachu ex'));assert(POKEMON_PRINTS.some(c=>c.name==='Pikachu V'));assert(POKEMON_PRINTS.some(c=>c.name==='Pikachu VMAX'));assert.equal(CARDS.ptcg.find(c=>c.id===POKEMON_PRINTS[1].id).variants[0].key,'firstEdition');assert.equal(CARDS.ptcg.find(c=>c.id===POKEMON_PRINTS[1].id).variants[0].usd,null);
 assert.equal(GROUP_IDS.ptcg.Paged.length,53);assert.equal(GROUP_IDS.ygo.Paged.length,64);assert.equal(GROUP_IDS.ygo.Legal.length,6);assert.equal(CARDS.ygo.find(c=>c.id==='99030000').ban.tcg,'banned','Fixture uses documented Forbidden provider value');assert.deepEqual(CARDS.ygo.find(c=>c.id==='99040000').pools,['tcg','ocg','master duel']);assert.equal(makeSearchFixtures('ptcg').cache.ptcg['fxa-metauncached001'],undefined,'Root name-only pending fixture is genuinely uncached');
 const m=providerFixture(new URL('https://api.scryfall.com/cards/search?q=Paged')),m2=providerFixture(new URL(m.next_page));assert.equal(m.data.length,3);assert.equal(m2.data[0].id,m.data.at(-1).id);assert.equal(providerFixture(new URL('https://api.scryfall.com/cards/search?q=EmptyPage')).has_more,true);assert.equal(providerFixture(new URL('https://api.scryfall.com/cards/search?q=EmptyPage')).data.length,0);
 const y=providerFixture(new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=Paged&offset=60&num=60'));assert.equal(y.data.length,5);assert.equal(String(y.data[0].id),GROUP_IDS.ygo.Paged[59]);assert.equal(y.meta.rows_remaining,0);
 assert.equal(isSearchRequest('mtg',new URL('https://api.scryfall.com/cards/autocomplete?q=Paged')),false);assert.equal(isSearchRequest('ptcg',new URL('https://api.tcgdex.net/v2/en/cards?name=Paged&pagination:itemsPerPage=40')),false);assert.equal(isSearchRequest('ygo',new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=Paged&num=12&offset=0')),false);assert.equal(providerFixture(new URL('https://api.scryfall.com/cards/autocomplete?q=Paged')).data.length,7,'Real Search suggestions are intercepted without being mistaken for submitted source pages');
 assert.equal(providerFixture(new URL('https://unmapped.example.invalid')),undefined);assert.match(SVG,/NOT REAL CARD ART/);
 return 'PASS: Search fixtures validate exact IDs, condition/private-value sentinels, overlapping pages, empty-page continuation, suffix/pocket exclusion, same-code canonical releases, unknown edition/finish and fail-closed routing. No browser, server, screenshot or provider call started.';
}
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.gz':'application/gzip'};
export async function startServer(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Fixture HTTP server is hosted-CI only');
 const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname),file=resolve(ROOT,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(ROOT+'/')||!['GET','HEAD'].includes(req.method))throw Error('Denied');let body=await readFile(file);if(path==='/config.js')body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Synthetic fixture: not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
const historyEndpoint=new URL('/functions/v1/market-history',SUPABASE.url);
export async function openSearchApp(browser,base,{game='mtg',width=390,height=1000,pendingDetails=false,evidenceLabel=game,sandboxPreviews=false,accountFixture=null}={}){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Browser fixture execution is hosted-CI only');assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',serviceWorkers:sandboxPreviews?'allow':'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],unexpected=[],requests=[],gates=[],rules=[],fixtures=makeSearchFixtures(game,{pendingDetails});
 const diagnostics=()=>({errors:[...errors],writes:[...writes],unexpected:[...unexpected],requests:requests.map(r=>({...r}))});
 try{
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 // Playwright's built-in SW block injects a property read into every child frame,
 // which itself throws in an opaque sandbox. Block registration in the top app
 // instead for preview tests; sandbox frames cannot register workers themselves.
 if(sandboxPreviews){
  context.on('serviceworker',worker=>unexpected.push('SERVICE WORKER '+worker.url()));
  await page.addInitScript(()=>{if(window!==window.top)return;Object.defineProperty(navigator.serviceWorker,'register',{value:()=>Promise.reject(new Error('Blocked by synthetic fixture')),writable:false});});
 }
 assert.equal(typeof context.routeWebSocket,'function','Hosted Playwright must support fail-closed WebSocket interception');await context.routeWebSocket('**/*',ws=>{unexpected.push('WEBSOCKET '+ws.url());ws.close();});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),record={method:req.method(),url:url.href,settled:false};requests.push(record);
  const fulfill=async(body,status=200,type='application/json')=>{try{await route.fulfill({status,contentType:type,headers:{'access-control-allow-origin':'*'},body:type==='application/json'?JSON.stringify(body):body});}catch(error){if(/abort|closed|cancel/i.test(req.failure()?.errorText||''))record.cancelled=true;else{errors.push(error.stack||error.message);}}finally{record.settled=true;}};
  if(accountFixture&&url.origin===base&&url.pathname==='/config.js'){const source=await readFile(resolve(ROOT,'config.js'),'utf8');return fulfill(source,200,'text/javascript');}
  if(accountFixture?.sdkFailure&&url.pathname.endsWith('/vendor/supabase-js-2.110.0.js'))return route.abort('failed');
  if(accountFixture&&(url.pathname.endsWith('/vendor/supabase-js-2.110.0.js')||url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('@supabase/supabase-js@')))return fulfill(await readFile(resolve(ROOT,'tests/account-fixture-client.js'),'utf8'),200,'text/javascript');
  if(accountFixture&&url.origin===new URL(SUPABASE.url).origin&&url.pathname==='/auth/v1/settings')return fulfill({external:{email:true,google:true},mailer_autoconfirm:false});
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(`${req.method()} ${url.href}`);return fulfill({error:'All mutations and paid/AI calls are forbidden.'},403);}
  if(req.method()==='OPTIONS')return fulfill('',204,'text/plain');
  for(const gate of gates)if(!gate.used&&gate.match(url,req)){gate.used=true;gate.started();await gate.wait;}
  const planned=rules.find(r=>r.remaining>0&&r.match(url,req));if(planned){planned.remaining--;return fulfill({error:'Synthetic source outage',message:'Synthetic source unavailable'},planned.status);}
  if(url.hostname==='fonts.googleapis.com')return fulfill('/* synthetic fixture system fonts */',200,'text/css');
  if(req.resourceType()==='image'&&(url.hostname==='search-fixtures.invalid'||url.hostname==='svgs.scryfall.io'||url.hostname==='images.ygoprodeck.com'||url.hostname==='images.pokemontcg.io'||url.origin===base&&/^\/img\/(ygo|pks)\//.test(url.pathname)))return fulfill(SVG,200,'image/svg+xml');
  if(url.origin===historyEndpoint.origin&&url.pathname===historyEndpoint.pathname)return fulfill({game:url.searchParams.get('game'),cardId:url.searchParams.get('id'),finish:url.searchParams.get('finish'),series:[]});
  if(url.origin===base){
   if(url.pathname==='/catalog.json')return fulfill({cards:[],snapshot_date:'2000-01-01'});
   if(url.pathname==='/api/community')return fulfill({game:url.searchParams.get('game'),status:'unavailable',items:[],fetchedAt:ISO});
   if(url.pathname==='/api/prices/yugioh'&&url.searchParams.get('id')==='89631139')return fulfill({cardId:'89631139',printings:[{code:'LOB-001',rarity:'Ultra Rare',productId:123456,quotes:[{edition:'1st Edition',market:777}]},{code:'FXX-001',rarity:'Ultra Rare',productId:234567,quotes:[{edition:'1st Edition',market:31},{edition:'Unlimited',market:11}]}],partial:false,source:'Synthetic exact-price fixture',updatedAt:ISO});
   if(url.pathname.startsWith('/api/prices/'))return fulfill({points:[],series:[],cards:[],products:[],variants:[],prices:{},partial:false});
   if(url.pathname.startsWith('/api/meta/'))return fulfill({events:[],decks:[],archetypes:[],top:[]});
   if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/img/')){record.settled=true;return route.continue();}
  }
  const fixture=providerFixture(url);if(fixture!==undefined)return fulfill(fixture);
  unexpected.push(`${req.method()} ${url.href}`);return fulfill({error:'Unmapped request blocked; no external request forwarded.'},451);
 });
 await page.addInitScript(({storage,now})=>{if(window!==window.top)return;const NativeDate=Date,offset=now-NativeDate.now();globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};Math.random=()=>0;for(const[k,v]of Object.entries(storage))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('cardstashy-tour-v1','done');localStorage.setItem('cardstashy-glass','off');},{storage:fixtures.storage,now:NOW});
 if(accountFixture)await page.addInitScript(fixture=>{if(!localStorage.getItem('qa-account-seeded')){localStorage.setItem('qa-account-seeded','1');for(const[k,v]of Object.entries(fixture.storage||{}))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('qa-account-model',JSON.stringify(fixture));}},accountFixture);
 await page.goto(base+'/#search');await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});await page.waitForFunction(g=>document.body.dataset.game===g&&(window.__uiTestState.state.settings.game||'mtg')===g,game);
 // Observe durable writes as well as final in-memory snapshots. Cache writes and
 // game settings are allowed; lot/deck/private-price mutations are never allowed.
 await page.evaluate(()=>{
  const pick=s=>JSON.stringify({collection:s.collection,decks:s.decks,printings:s.printings,wishlist:s.wishlist,tcg:s.tcg,myPrices:s.myPrices,priceChoices:s.priceChoices});
  const baseline=pick(window.__uiTestState.state);window.__fixtureSensitiveWrites=[];
  const check=(value,key,backend)=>{if(key==='cardforge-v2'){try{const actual=typeof value==='string'?JSON.parse(value):value;if(pick(actual)!==baseline)window.__fixtureSensitiveWrites.push({backend,key,reason:'Collection, deck, printing or private-price state changed'});}catch(error){window.__fixtureSensitiveWrites.push({backend,key,reason:error.message});}}};
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){check(value,key,'indexedDB');return put.call(this,value,key);};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){check(value,key,'localStorage');return set.call(this,key,value);};
 });
 const health=()=>{const issues=[];for(const[actual,message]of[[errors,'No uncaught app errors'],[writes,'No collection/cloud/payment/AI network writes attempted'],[unexpected,'All external requests are mapped; none forwarded']])try{assert.deepEqual(actual,[],message);}catch(e){issues.push(e);}if(issues.length){const e=new AggregateError(issues,'Search fixture safety checks failed');e.stack+='\n'+issues.map(x=>x.stack).join('\n');e.fixtureDiagnostics=diagnostics();throw e;}};
 return {page,context,fixtures,requests,health,diagnostics,
  fail(match,{count=1,status=422}={}){rules.push({match,remaining:count,status});},
  hold(match){let started,release;const seen=new Promise(r=>started=r),wait=new Promise(r=>release=r),gate={match,started,wait,release,used:false};gates.push(gate);return {seen,release};},
  releaseAll(){for(const g of gates)g.release?.();},
 };
 }catch(error){error.fixtureDiagnostics=diagnostics();try{await capture(page,'synthetic-search-bootstrap-failure-'+evidenceLabel,{settle:false});}catch(captureError){error.fixtureDiagnostics.screenshotError=captureError.stack;}for(const g of gates)g.release?.();try{await context.close();}catch(close){error.fixtureDiagnostics.cleanupError=close.stack;}throw error;}
}
export async function inventorySnapshot(page){return page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({collection:s.collection,decks:s.decks,printings:s.printings,wishlist:s.wishlist,tcg:s.tcg,myPrices:s.myPrices,priceChoices:s.priceChoices});});}
export async function noOverflow(page,scope,label){for(const rail of await page.locator(scope+' .card-printing-mini-rail,'+scope+' nav.tabs[role=tablist]').all()){const box=await rail.boundingBox();if(box)assert(box.x>=-.5&&box.x+box.width<=(await page.evaluate(()=>innerWidth))+.5,`${label}: printing scroll container fits viewport`);assert.equal(await rail.evaluate(n=>getComputedStyle(n).overflowX),'auto',`${label}: offscreen printings are clipped inside an intentional scrolling rail`);}const r=await page.locator(scope).evaluate(root=>({width:innerWidth,doc:document.documentElement.scrollWidth,scroll:root.scrollWidth,client:root.clientWidth,bad:[...root.querySelectorAll('button,input,select,summary,a')].filter(n=>n.getClientRects().length&&!n.closest('[hidden]')&&!n.closest('.cs-tabs')&&!n.closest('.card-printing-mini-rail')&&!n.closest('nav.tabs[role=tablist]')).filter(n=>{const r=n.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(n=>({text:n.textContent.slice(0,90),id:n.id,class:n.className}))}));assert(r.doc<=r.width+2&&r.scroll<=r.client+2,`${label}: no horizontal overflow ${JSON.stringify(r)}`);assert.deepEqual(r.bad,[],`${label}: visible controls fit viewport`);}
const screenshots=[];
export async function capture(page,name,{settle=true}={}){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Screenshots are restricted to approved hosted CI');assert.match(page.url(),/^http:\/\/127\.0\.0\.1:\d+\//,'Only the local synthetic app fixture may be captured');assert.match(name,/^synthetic-search-[a-z0-9-]+$/);
 await mkdir(RESULTS,{recursive:true});
 if(settle){await page.waitForFunction(()=>[...document.images].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&r.bottom>0&&r.top<innerHeight;}).every(n=>n.complete));await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
 const file=name+'.png';await page.screenshot({path:resolve(RESULTS,file),fullPage:true,animations:'disabled',timeout:10000});screenshots.push({file,viewport:page.viewportSize(),synthetic:true,kind:settle?'settled-layout':'failure-state'});
}
export async function saveReport(outcomes,failures){await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'search-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),artEvidence:ART_EVIDENCE,status:failures.length?'failed':'passed',screenshots,outcomes,failures:failures.map(f=>({scenario:f.label,phase:f.phase,stack:f.error.stack}))},null,2));}
