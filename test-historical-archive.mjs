import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {archivePoints,archivePriceRoute,ARCHIVE_COMMIT} from './historical-archive.js';
const root=`https://raw.githubusercontent.com/novaoc/rarebox-price-history/${ARCHIVE_COMMIT}`;
const fixtures=JSON.parse(await readFile(new URL('./test-historical-fixture.json',import.meta.url),'utf8'));
const read=async p=>fixtures.files[p] || Promise.reject(Error('Unexpected fixture '+p));
const now=Date.parse('2026-10-14T12:00:00Z');
const fake=async raw=>{
 const u=String(raw);
 if(u.startsWith(root+'/'))return Response.json(await read(u.slice(root.length+1)));
 if(u.includes('api.tcgdex.net'))return Response.json({id:'cel25cc-CC002',name:'Charizard',localId:'CC002',set:{name:'Celebrations Classic Collection'},variants_detailed:[{variantId:'jr7oetx1mqug9',type:'holo',thirdParty:{tcgplayer:250320}}]});
 if(u.includes('api.scryfall.com'))return Response.json({id:'mtg-fixture',set:'m11',set_name:'Magic 2011',collector_number:'7',tcgplayer_id:35383});
 if(u.includes('ygoprodeck.com'))return Response.json({data:[{id:1234,card_sets:[{set_code:'MACR-EN000',set_name:'Maximum Crisis'}]}]});
 if(u.endsWith('/3/groups'))return Response.json({results:[{name:'Celebrations: Classic Collection',groupId:2931}]});
 if(u.endsWith('/2/groups')){
  const joins=await read('maps/groups.json');const [groupId]=Object.entries(joins['2']).find(([,v])=>v==='maximum-crisis');return Response.json({results:[{name:'Maximum Crisis',groupId}]});
 }
 throw Error('Unexpected source '+u);
};
const cases=[['ptcg','cel25cc-CC002','detail:jr7oetx1mqug9',''],['mtg','mtg-fixture','nonfoil',''],['ygo','1234','reference','MACR-EN000']];
for(const [game,id,finish,edition] of cases){
 const r=await archivePriceRoute(new URL('https://test.example/api/prices/archive?'+new URLSearchParams({game,id,finish,edition})),{},fake,now);const d=await r.json();assert.equal(r.status,200);assert.equal(d.cardId,id);assert.ok(d.series.length,game+' archive should resolve');assert.ok(d.series.every(s=>s.points.length>2&&s.points[0].date<'2026-09-01'&&s.currency==='USD'&&s.finish===finish));
 console.log(game, d.series.map(s=>({product:s.productId,points:s.points.length,first:s.points[0].date,last:s.points.at(-1).date,price:s.points.at(-1).value})));
}
assert.deepEqual(archivePoints([[20711,NaN],[20711,-1],[999999,3],[20711,2],[20711,4]],Date.parse('2026-10-14')), [{date:'2026-09-15',value:4}]);
const wrong=await archivePriceRoute(new URL('https://test.example/api/prices/archive?game=ptcg&id=cel25cc-CC002&finish=detail:other'),{},fake,now);assert.deepEqual((await wrong.json()).series,[],'A different finish cannot borrow Charizard holo prices');
console.log('PASS: real archived data for all three games, exact product/printing joins, distinct finishes, date/value validation and no fabricated days.');
