import {initCatalog,catalogCandidate} from './scan-catalog.js';
import {collectorKey} from './scan-signals.js';
const text=v=>String(v||'').trim();
const nameKey=v=>text(v).toLocaleLowerCase().replace(/\s+/g,' ');
export function scannerNumberParts(game,value) {
 const v=text(value).replace(/^#/,'');
 if(!v)return {number:'',total:'',set:''};
 if(game==='ygo')return /^[a-z0-9]{2,10}-[a-z0-9]{1,12}$/i.test(v)?{number:v.toUpperCase(),total:'',set:''}:null;
 const match=game==='mtg'?v.match(/^(?:([a-z0-9]{2,8})\s+(?:#\s*)?)?([a-z]*\d+[a-z★☆†]*)(?:\/(\d+))?$/i):v.match(/^([a-z]*\d+[a-z★☆†]*)(?:\/(\d+))?$/i);
 if(!match)return null;
 return game==='mtg'?{set:(match[1]||'').toLowerCase(),number:match[2],total:match[3]||''}:{set:'',number:match[1],total:match[2]||''};
}
export function scannerLookupMatches(game,c,{name='',number='',set='',strictName=false}={}) {
 const card=c.card||c,p=scannerNumberParts(game,number);if(!p)return false;
 if(name&&(strictName?nameKey(card.name)!==nameKey(name):!nameKey(card.name).includes(nameKey(name))))return false;
 const actual=game==='mtg'?card.collector_number:game==='ptcg'?card.set?.number:String(c.print||'').split('|')[0];
 if(p.number&&collectorKey(actual)!==collectorKey(p.number))return false;
 if(p.total&&String(Number(card.set?.total))!==String(Number(p.total)))return false;
 const selected=set||p.set;if(selected&&(game==='mtg'?card.set:game==='ptcg'?card.set?.id:c.setReleaseId)!==selected)return false;
 return true;
}
export function createScannerLookup({requestMagic,sources,candById,match,local=initCatalog}={}) {
 return async(game,query,{isCurrent=()=>true}={})=>{
  const name=text(query.name).slice(0,160),number=text(query.number).slice(0,40),parts=scannerNumberParts(game,number);
  if(!parts)throw Error(game==='ygo'?'Enter the full bottom code, like LOB-001.':'Enter the bottom number, like 56/111, or a set code and number for Magic.');
  if(!name&&!number)throw Error('Enter the card name or bottom number.');
  const spec={...query,name,number},pack=await local(game);if(!isCurrent())return [];
  let found=[];
  if(pack){
   const code=game==='ygo'?parts.number:game==='mtg'&&parts.set?parts.set+':'+collectorKey(parts.number):game==='ptcg'&&parts.total?null:null;
   const indexes=code?pack.codes.get(code)||[]:pack.rows.map((_,i)=>i);
   for(const i of indexes){
    if(found.length>=24)break;
    const r=pack.rows[i];if(!pack.ids.has(r[0]))continue;
    if(name&&(query.strictName?nameKey(r[1])!==nameKey(name):!nameKey(r[1]).includes(nameKey(name))))continue;
    if(parts.number&&collectorKey(game==='ygo'?r[2]:r[3])!==collectorKey(parts.number))continue;
    if(parts.total&&String(Number(r[4]))!==String(Number(parts.total)))continue;
    const candidate=catalogCandidate(pack,i,false);
    if(scannerLookupMatches(game,candidate,spec))found.push(candidate);
   }
  }
  if(!found.length){
   if(game==='mtg'&&parts.set){const card=await requestMagic(`/cards/${encodeURIComponent(parts.set)}/${encodeURIComponent(parts.number)}`);if(card?.id)found=[{id:card.id,name:card.name,card}];}
   else if(game==='mtg'&&number){
    const q=`game:paper cn:"${parts.number.replace(/["\\]/g,'')}"${name?' name:"'+name.replace(/["\\]/g,'')+'"':''}`;
    const page=await requestMagic('/cards/search?'+new URLSearchParams({q,unique:'prints'}));found=(page?.data||[]).slice(0,24).map(card=>({id:card.id,name:card.name,card}));
   }else if(game==='ptcg'&&number){found=(await sources.ptcg.byNameNumber(name,parts.number)).slice(0,24).map(card=>({id:card.id,name:card.name,card,localReference:true}));}
   else {found=(await match(game,{name:game==='ygo'&&number?parts.number:name,code:'',full:''},'en',true)).cands||[];}
  }
  if(!isCurrent())return [];
  const out=new Array(found.length);let index=0;
  await Promise.all(Array.from({length:Math.min(3,found.length)},async()=>{
   while(index<found.length&&isCurrent()){
    const at=index++,c=found[at];let full=c;
    try{full=await candById(game,c.id,'Manual lookup · check printing',false,{identityOnly:true,print:c.print||'',releaseName:c.releaseName||''})||c;}catch{}
    if(isCurrent()&&scannerLookupMatches(game,full,spec))out[at]={...full,game,exact:false,printingConfirmed:false,reviewSource:query.strictName?'ai-hint':'number-search'};
   }
  }));
  return isCurrent()?out.filter(Boolean):[];
 };
}
