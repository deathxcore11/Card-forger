import test from 'node:test';
import assert from 'node:assert/strict';
import {readPreconCatalog,readPreconDeck,productUrl} from './mtgjson-precons.mjs';
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const metadata={date:'2026-10-24',version:'test-v1'};
const row={fileName:'Example_TST',code:'TST',name:'Example',type:'Commander Deck',releaseDate:'2026-10-23',source:'https://example.test/deck'};
const catalog=()=>readPreconCatalog({meta:metadata,data:[row]},{asOf:'2026-10-25'});
const card=(name,count,id=1)=>({name,count,uuid:uid(id),isFoil:false,isEtched:false,setCode:'TST',number:String(id),identifiers:{scryfallId:uid(id+10),scryfallOracleId:uid(id+20)}});
const payload=()=>({meta:{...metadata},data:{...row,commander:[card('First commander',1),card('Second commander',1,2)],mainBoard:[card('Example land',98,3)],sideBoard:[],tokens:[],planes:[],schemes:[],displayCommander:[],sealedProductUuids:[]}});
test('keeps every declared commander and exact printing/finish without granting Play eligibility',()=>{
 const p=payload();p.data.commander[0].isFoil=true;p.data.commander[1].isEtched=true;
 const d=readPreconDeck(p,catalog().products[0]);
 assert.equal(d.deckCardCount,100);assert.deepEqual(d.zones.commander.map(c=>c.finish),['foil','etched']);
 assert.equal(d.zones.commander[0].scryfallId,uid(11));assert.equal(d.zones.commander[0].collectorNumber,'1');
 for(const key of ['playStatus','constructionStatus','engineStatus','cpuStatus'])assert.equal(d[key],'unverified');
 p.data.commander[0].name='Later mutation';assert.equal(d.zones.commander[0].name,'First commander');
});
test('keeps sideboard and product extras outside the playable deck count',()=>{
 const p=payload();p.data.commander=[];p.data.mainBoard=[card('Example land',60)];p.data.sideBoard=[card('Sideboard card',15,2)];
 p.data.tokens=[card('Product token',10,3)];p.data.displayCommander=[card('Display piece',1,4)];p.data.planes=[card('Plane',10,5)];p.data.schemes=[card('Scheme',20,6)];
 const d=readPreconDeck(p,catalog().products[0]);assert.equal(d.deckCardCount,60);assert.equal(d.counts.sideBoard,15);assert.equal(d.counts.tokens,10);assert.equal(d.counts.displayCommander,1);assert.equal(d.counts.planes,10);assert.equal(d.counts.schemes,20);
 assert.equal(d.format,undefined);assert.equal(d.constructionStatus,'unverified');
});
test('does not merge duplicate names with different printings',()=>{
 const p=payload();p.data.mainBoard=[card('Same name',49,1),card('Same name',49,2)];
 const d=readPreconDeck(p,catalog().products[0]);assert.equal(d.zones.mainBoard.length,2);assert.notEqual(d.zones.mainBoard[0].mtgjsonUuid,d.zones.mainBoard[1].mtgjsonUuid);
});
test('unknown finish remains unknown rather than being changed to nonfoil',()=>{
 const p=payload();delete p.data.mainBoard[0].isFoil;delete p.data.mainBoard[0].isEtched;
 assert.equal(readPreconDeck(p,catalog().products[0]).zones.mainBoard[0].finish,null);
});
test('catalog distinguishes future and undated products and retains unfamiliar types',()=>{
 const c=readPreconCatalog({meta:metadata,data:[{...row,releaseDate:'2026-11-13'},{...row,fileName:'Other_TST',releaseDate:null,type:'Unfamiliar product'}]},{asOf:'2026-10-25'});
 assert.deepEqual(c.products.map(p=>p.releaseStatus),['announced','undated']);assert(c.products.every(p=>p.listStatus==='not-loaded'&&p.playStatus==='unverified'));
});
test('keeps plain source notes without inventing links or official attribution',()=>{
 const c=readPreconCatalog({meta:metadata,data:[{...row,source:'default database query'}]},{asOf:'2026-10-25'});
 assert.equal(c.products[0].sourceUrl,null);assert.equal(c.products[0].sourceNote,'default database query');
 const p=payload();p.data.source='default database query';const d=readPreconDeck(p,c.products[0]);
 assert.equal(d.sourceUrl,null);assert.equal(d.sourceNote,'default database query');
});
test('catalog refuses duplicate keys, unsafe URLs, unsafe paths and invalid dates',()=>{
 assert.throws(()=>readPreconCatalog({meta:metadata,data:[row,row]},{asOf:'2026-10-25'}),/Duplicate/);
 for(const file of ['../secret','A/B','https://other.test/a','x?query',''])assert.throws(()=>productUrl(file));
 for(const source of ['javascript:alert(1)','https://user:password@example.test'])assert.throws(()=>readPreconCatalog({meta:metadata,data:[{...row,source}]},{asOf:'2026-10-25'}));
 assert.throws(()=>readPreconCatalog({meta:metadata,data:[{...row,releaseDate:'2026-02-30'}]},{asOf:'2026-10-25'}));
});
test('preserves international product identifiers and encodes only the URL path segment',()=>{
 for(const id of ['DandânDeck_SLD','MahōGakuinSeishunHakusho魔法学院青春白書_SLD']){
  const c=readPreconCatalog({meta:metadata,data:[{...row,fileName:id}]},{asOf:'2026-10-25'});
  assert.equal(c.products[0].id,id);assert.equal(c.products[0].dataUrl,'https://mtgjson.com/api/v5/decks/'+encodeURIComponent(id)+'.json');
 }
 for(const id of ['x%2fsecret','x\\secret','x\u202ey','x\u2215y'])assert.throws(()=>productUrl(id));
});
test('a stale version or different product cannot replace the selected list',()=>{
 for(const change of [p=>p.meta.version='new',p=>p.meta.date='2026-10-25',p=>p.data.name='Other',p=>p.data.code='OTHER',p=>p.data.type='Other',p=>p.data.releaseDate='2026-10-22']){
  const p=payload();change(p);assert.throws(()=>readPreconDeck(p,catalog().products[0]));
 }
 const selected={...catalog().products[0],dataUrl:'https://other.test/deck.json'};assert.throws(()=>readPreconDeck(payload(),selected));
});
test('rejects corrupt quantities, missing printing identity and malformed zones',()=>{
 for(const count of [0,-1,1.5,'1',NaN,1001]){const p=payload();p.data.mainBoard[0].count=count;assert.throws(()=>readPreconDeck(p,catalog().products[0]));}
 for(const change of [p=>delete p.data.mainBoard,p=>p.data.mainBoard=[],p=>p.data.sideBoard='bad',p=>delete p.data.mainBoard[0].uuid,p=>p.data.mainBoard[0].identifiers.scryfallId='bad']){
  const p=payload();change(p);assert.throws(()=>readPreconDeck(p,catalog().products[0]));
 }
});
