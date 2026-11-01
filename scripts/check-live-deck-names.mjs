// Release question: "has every deck the app can pick been checked against the real engine?"
// Reads the decks Quick Play draws from today (the site's tournament lists for each format
// and the newest MTGJSON precons) and checks every name against the names the bundled Forge
// accepts. A name that only differs in spelling (slash, accent, quote, spacing) fails the
// release: it is a normalization bug. A card Forge does not have yet (a new set) is listed
// only: Quick Play already skips that deck.
// Usage: node scripts/check-live-deck-names.mjs [--site https://cardstashy.app]
import {readFileSync} from 'node:fs';
import {engineUnknownCards,ENGINE_CARD_NAMES_FILE} from '../play-engine-names.js';
import {constructedPreconCandidates,constructedPrecon} from '../play-precon-formats.js';

const site=(process.argv.includes('--site')?process.argv[process.argv.indexOf('--site')+1]:'https://cardstashy.app').replace(/\/$/,'');
const listed=readFileSync(new URL('../'+ENGINE_CARD_NAMES_FILE,import.meta.url),'utf8').split('\n').filter(Boolean);
const names=new Set(listed.map(n=>n.toLowerCase()));
const loose=n=>n.replace(/æ/gi,'ae').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const byLoose=new Map(listed.map(n=>[loose(n),n]));
const get=async url=>{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'CardStashy release check'}});if(!r.ok)throw Error(url+' answered '+r.status);return r.json();};

const decks=[],unreachable=[];
for(const format of ['Standard','Pioneer','Modern','Legacy','Vintage','Pauper','EDH']){
 try{const d=await get(`${site}/api/meta/mtg?format=${format}&days=14`);
  for(const x of d.decks||[])decks.push({label:`Meta ${format}: ${x.name||x.key}`,deck:{cards:[...(x.commanders||[]),...(x.main||[])],side:x.side||[]}});}
 catch(e){unreachable.push(e.message);}
}
try{
 const index=(await get('https://mtgjson.com/api/v5/DeckList.json')).data||[];
 const picks=new Map();
 for(const format of ['Standard','Pioneer','Modern','Legacy','Vintage','Pauper'])for(const e of constructedPreconCandidates(index,format))picks.set(e.fileName,e);
 for(const e of index.filter(d=>d?.type==='Commander Deck').sort((a,b)=>String(b.releaseDate).localeCompare(String(a.releaseDate))).slice(0,10))picks.set(e.fileName,e);
 for(const e of picks.values()){
  try{const p=await get('https://mtgjson.com/api/v5/decks/'+encodeURIComponent(e.fileName)+'.json'),d=p.data||p;
   const precon=e.type==='Commander Deck'?{cards:[...(d.commander||[]),...(d.mainBoard||[])].map(c=>({name:c.name,qty:c.count}))}:constructedPrecon(p,e);
   if(precon)decks.push({label:'Precon: '+(d.name||e.fileName),deck:precon});}
  catch(err){unreachable.push(err.message);}
 }
}catch(e){unreachable.push(e.message);}

const spelling=new Map(),missing=new Map();
for(const {label,deck} of decks)for(const n of engineUnknownCards(deck,names)){
 const real=byLoose.get(loose(n)),into=real?spelling:missing,key=real?n+' → '+real:n;
 if(!into.has(key))into.set(key,label);
}
console.log(`Checked ${decks.length} decks against ${names.size} engine names (${ENGINE_CARD_NAMES_FILE}).`);
for(const u of unreachable)console.log('Could not read: '+u);
for(const [n,label] of missing)console.log(`Not in the engine yet (deck skipped by Quick Play): ${n}  [${label}]`);
for(const [n,label] of spelling)console.log(`SPELLING the engine refuses: ${n}  [${label}]`);
if(!decks.length){console.log('No deck could be read; nothing was checked.');process.exit(1);}
if(spelling.size){console.log(spelling.size+' name(s) need a fix in play-engine-names.js.');process.exit(1);}
