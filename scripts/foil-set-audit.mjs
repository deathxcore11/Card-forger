// Set-by-set foil audit against the live catalogues, through the production resolver.
// For every printing that exists in a foil finish it records whether the app resolves a real foil
// (missing = the resolver answers "unknown" for a finish the catalogue says exists) and whether every
// layer's mask is defined (a missing mask paints nothing). Rendering and clipping are checked separately
// (scripts/foil-render-audit.mjs). Usage: node scripts/foil-set-audit.mjs <mtg|ptcg|ygo> <cacheDir> <out.json> [setLimit]
import fs from 'node:fs';
import path from 'node:path';
import {finishChoices,resolveFinish,FINISH_MASKS} from '../finish-effects.js';
import {normalizePtcg} from '../ptcg.js';
import {normalizeYgo} from '../ygo.js';

const [game,cacheDir,out,limitArg]=process.argv.slice(2);
if(!['mtg','ptcg','ygo'].includes(game)||!cacheDir||!out){console.error('usage: foil-set-audit.mjs <mtg|ptcg|ygo> <cacheDir> <out.json> [setLimit]');process.exit(2);}
fs.mkdirSync(cacheDir,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJSON(url,{gap=0}={}){
 const file=path.join(cacheDir,url.replace(/[^a-z0-9]+/gi,'_').slice(-180)+'.json');
 if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));
 for(let i=0;i<5;i++){
  const r=await fetch(url,{headers:{'User-Agent':'CardStashy-foil-audit/1.0','Accept':'application/json'}});
  if(r.status===404)return null;
  if(r.ok){const j=await r.json();fs.writeFileSync(file,JSON.stringify(j));if(gap)await sleep(gap);return j;}
  await sleep(1000*2**i);
 }
 throw Error('fetch failed '+url);
}
async function pool(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k],k);}}));return out;}
const masksOk=p=>(p.layers||[]).every(l=>l.mask==='card'||FINISH_MASKS[l.mask]);
const report={game,generated:new Date().toISOString(),sets:[],totals:{sets:0,printings:0,foilChoices:0,missing:0,badMask:0}};
function record(set,rows){
 const s={code:set.code,name:set.name,released:set.released||'',printings:rows.length,foilChoices:0,missing:[],badMask:[],effects:{},samples:[]};
 for(const {id,name,finish,p,row} of rows.flatMap(r=>r.choices.map(p=>({...r,finish:p.key,p,row:r})))){
  if(p.effect==='plain')continue;
  // Magic samples also differ by frame and layout, which change where the foil sits.
  const kind=(p.treatment||p.effect)+(game==='mtg'?`|${p.frame||''}|${row.raw?.layout||''}`:'');s.foilChoices++;s.effects[kind]=(s.effects[kind]||0)+1;
  // One sample per foil kind per set for the render audit (scripts/foil-render-audit.mjs).
  if(p.status!=='unknown'&&!s.samples.some(x=>x.kind===kind))s.samples.push({kind,id,finish,ctx:row.ctx,raw:row.raw});
  if(p.status==='unknown')s.missing.push({id,name,finish,reason:p.reason||''});
  else if(!masksOk(p))s.badMask.push({id,name,finish,masks:(p.layers||[]).map(l=>l.mask)});
 }
 report.sets.push(s);const t=report.totals;t.sets++;t.printings+=s.printings;t.foilChoices+=s.foilChoices;t.missing+=s.missing.length;t.badMask+=s.badMask.length;
 console.log(`${game} ${s.code.padEnd(12)} ${String(s.printings).padStart(4)} printings ${String(s.foilChoices).padStart(4)} foil  missing ${s.missing.length}  badMask ${s.badMask.length}  ${s.name}`);
}
const limit=Number(limitArg)||Infinity;
if(game==='mtg'){
 const sets=(await getJSON('https://api.scryfall.com/sets')).data.filter(s=>!s.digital&&s.card_count>0).sort((a,b)=>(a.released_at||'').localeCompare(b.released_at||'')).slice(0,limit);
 for(const set of sets){
  const cards=[];let url=`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`e:${set.code} unique:prints include:extras`)}&include_variations=true`;
  while(url){const page=await getJSON(url,{gap:110});if(!page)break;cards.push(...page.data);url=page.has_more?page.next_page:null;}
  const rows=cards.filter(c=>c.finishes?.some(f=>f!=='nonfoil')).map(c=>({id:c.id,name:c.name,raw:c,ctx:{},choices:['foil','etched'].filter(f=>c.finishes.includes(f)).map(f=>resolveFinish('mtg',c,{priceFinish:f}))}));
  record({code:set.code,name:set.name,released:set.released_at},rows);
 }
}else if(game==='ptcg'){
 const sets=(await getJSON('https://api.tcgdex.net/v2/en/sets')).slice(0,limit);
 for(const brief of sets){
  const set=await getJSON(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(brief.id)}`);if(!set)continue;
  const raws=(await pool(set.cards||[],12,c=>getJSON(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(c.id)}`))).filter(Boolean);
  const rows=raws.map(raw=>{const c=normalizePtcg(raw);return {id:c.id,name:c.name,raw,ctx:{},choices:finishChoices('ptcg',c)};}).filter(r=>r.choices.some(p=>p.effect!=='plain'||p.status==='unknown'));
  record({code:set.id,name:set.name,released:set.releaseDate},rows);
 }
}else{
 const all=(await getJSON('https://db.ygoprodeck.com/api/v7/cardinfo.php')).data,bySet=new Map();
 // The app looks printings up by their normalised rarity ("Starfoil" becomes "Starfoil Rare"), so the audit does too.
 for(const raw of all){const c=normalizeYgo(raw),seen=new Set();for(const s of c.sets||[]){const id=s.code+'::'+s.rarity;if(seen.has(id))continue;seen.add(id);if(!bySet.has(s.name))bySet.set(s.name,[]);bySet.get(s.name).push({c,s,raw});}}
 const meta=new Map(((await getJSON('https://db.ygoprodeck.com/api/v7/cardsets.php'))||[]).map(s=>[s.set_name,s]));
 const names=[...bySet.keys()].sort((a,b)=>(meta.get(a)?.tcg_date||'').localeCompare(meta.get(b)?.tcg_date||'')).slice(0,limit);
 for(const name of names){
  const rows=bySet.get(name).map(({c,s,raw})=>({id:`${c.id} ${s.code}`,name:`${c.name} · ${s.rarity}`,raw,ctx:{priceEdition:`${s.code}::${s.rarity}`},choices:[resolveFinish('ygo',c,{priceEdition:`${s.code}::${s.rarity}`})]}));
  record({code:meta.get(name)?.set_code||name,name,released:meta.get(name)?.tcg_date},rows);
 }
}
fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify(report.totals));
