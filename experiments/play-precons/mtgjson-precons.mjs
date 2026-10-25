// Isolated Play precon ingestion. No collection writes, format admission,
// executable-card substitution, DeckCheck scraping, or automatic match start.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const required=(ok,message)=>{if(!ok)throw new Error(message);};
const text=(v,label)=>{required(typeof v==='string'&&v.trim()&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v),'Invalid '+label);return v;};
const date=(v,label,nullable=false)=>{
 if(nullable&&v===null)return null;
 required(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid '+label);return v;
};
const uuid=(v,label)=>{required(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),'Invalid '+label);return v;};
const optionalUuid=(v,label)=>v===undefined||v===null?null:uuid(v,label);
const source=v=>{
 if(v===undefined||v===null||v==='')return {sourceUrl:null,sourceNote:null};
 const raw=text(v,'source reference');
 // MTGJSON also uses plain provenance notes (for example database queries).
 // Keep those as text; never manufacture a link or an official attribution.
 if(!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw))return {sourceUrl:null,sourceNote:raw};
 const u=new URL(raw);required(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password,'Invalid source URL');return {sourceUrl:u.href,sourceNote:null};
};
const meta=payload=>{
 required(record(payload)&&record(payload.meta),'Missing MTGJSON metadata');
 return {date:date(payload.meta.date,'data date'),version:text(payload.meta.version,'data version')};
};
const fileName=value=>{const v=text(value,'file name');required(/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*$/u.test(v),'Invalid file name');return v;};
export function productUrl(value){return 'https://mtgjson.com/api/v5/decks/'+encodeURIComponent(fileName(value))+'.json';}

export function readPreconCatalog(payload,{asOf}={}){
 const version=meta(payload);date(asOf,'as-of date');
 required(Array.isArray(payload.data)&&payload.data.length<=20_000,'Invalid product index');
 const seen=new Set();
 const products=payload.data.map(row=>{
  required(record(row),'Invalid product row');
  const id=fileName(row.fileName);required(!seen.has(id),'Duplicate product file name');seen.add(id);
  const released=date(row.releaseDate,'release date',true);
  return {id,provider:'mtgjson',name:text(row.name,'product name'),setCode:text(row.code,'set code'),productType:text(row.type,'product type'),
   releaseDate:released,releaseStatus:released===null?'undated':released>asOf?'announced':'released',
   ...source(row.source),dataUrl:productUrl(id),dataDate:version.date,dataVersion:version.version,
   listStatus:'not-loaded',playStatus:'unverified'};
 });
 return {provider:'mtgjson',meta:version,asOf,products};
}

function card(row,zone){
 required(record(row),'Invalid '+zone+' card');
 required(Number.isSafeInteger(row.count)&&row.count>0&&row.count<=1000,'Invalid '+zone+' quantity');
 for(const key of ['isFoil','isEtched'])required(row[key]===undefined||typeof row[key]==='boolean','Invalid '+key);
 const ids=row.identifiers;
 required(ids===undefined||record(ids),'Invalid card identifiers');
 // Preserve known printing facts; absent finish evidence remains unknown.
 const finish=row.isEtched===true?'etched':row.isFoil===true?'foil':row.isFoil===false&&row.isEtched===false?'nonfoil':null;
 return {name:text(row.name,'card name'),quantity:row.count,zone,
  mtgjsonUuid:uuid(row.uuid,'MTGJSON UUID'),scryfallId:optionalUuid(ids?.scryfallId,'Scryfall ID'),oracleId:optionalUuid(ids?.scryfallOracleId,'Oracle ID'),
  setCode:row.setCode===undefined?null:text(row.setCode,'card set code'),collectorNumber:row.number===undefined?null:text(row.number,'collector number'),
  finish,isFoil:row.isFoil??null,isEtched:row.isEtched??null};
}
function zone(data,key){
 const rows=data[key]??[];required(Array.isArray(rows)&&rows.length<=2000,'Invalid '+key);
 return rows.map(row=>card(row,key));
}
const total=rows=>rows.reduce((n,row)=>n+row.quantity,0);
export function readPreconDeck(payload,product){
 const version=meta(payload),d=payload.data;
 required(record(product)&&product.provider==='mtgjson','Invalid catalog product');
 required(product.dataUrl===productUrl(product.id),'Catalog URL does not match product identity');
 required(version.date===product.dataDate&&version.version===product.dataVersion,'Catalog/deck data version mismatch; refresh the catalog');
 required(record(d)&&d.name===product.name&&d.code===product.setCode&&d.type===product.productType&&d.releaseDate===product.releaseDate,'Deck does not match catalog product');
 required(Array.isArray(d.mainBoard),'Missing main board');
 const zones=Object.fromEntries(['commander','mainBoard','sideBoard','tokens','planes','schemes','displayCommander'].map(key=>[key,zone(d,key)]));
 const counts=Object.fromEntries(Object.entries(zones).map(([key,rows])=>[key,total(rows)]));
 required(counts.mainBoard>0,'Empty main board');
 const sealed=d.sealedProductUuids??[];required(Array.isArray(sealed)&&sealed.length<=100,'Invalid sealed products');
 return {schema:1,provider:'mtgjson',id:product.id,name:product.name,setCode:product.setCode,productType:product.productType,
  ...(d.source===undefined?{sourceUrl:product.sourceUrl,sourceNote:product.sourceNote}:source(d.source)),dataUrl:product.dataUrl,dataDate:version.date,dataVersion:version.version,
  releaseDate:product.releaseDate,releaseStatus:product.releaseStatus,sealedProductUuids:sealed.map(v=>uuid(v,'sealed product UUID')),
  zones,counts,deckCardCount:counts.mainBoard+counts.commander,
  // A product type, size or historical format cannot certify current legality.
  listStatus:'loaded',playStatus:'unverified',constructionStatus:'unverified',engineStatus:'unverified',cpuStatus:'unverified'};
}
