// Real Magic booster contents: each set's booster sheets and weights from MTGJSON, baked into
// data/mtg-boosters/<set>.json by scripts/build-mtg-boosters.mjs. A pack picks one of the set's
// booster layouts by weight, then draws each sheet's cards by their weights, as the print run does.
const files=new Map(),cardCache=new Map();
// The baked file for a set, or null (the simulator then uses its per-era pack table).
export function loadMtgBooster(code,fetcher=fetch){
 code=String(code||'').toLowerCase();
 if(!/^[a-z0-9]{2,8}$/.test(code))return Promise.resolve(null);
 if(!files.has(code)){const job=fetcher(`/data/mtg-boosters/${code}.json`).then(r=>r.ok?r.json():null).then(d=>d&&Array.isArray(d.boosters)&&d.sheets?d:null).catch(()=>null);files.set(code,job);job.then(d=>{if(!d)files.delete(code);});}
 return files.get(code);
}
// Every card the sheets can give, keyed by Scryfall id. The set page has loaded most of them; the
// rest (bonus sheets from other sets, or a set page still loading) are fetched from Scryfall in
// batches of 75 and kept for the session. A card that can't be fetched is left out of its sheet.
export async function mtgBoosterCards(data,known=[],fetcher=fetch){
 const map=new Map();for(const c of known)if(c?.id)map.set(String(c.id),c);
 const ids=[...new Set(Object.values(data.sheets).flatMap(s=>s.cards.map(([id])=>id)))];
 for(const id of ids)if(!map.has(id)&&cardCache.has(id))map.set(id,cardCache.get(id));
 const missing=ids.filter(id=>!map.has(id));
 for(let i=0;i<missing.length;i+=75){
  const res=await fetcher('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifiers:missing.slice(i,i+75).map(id=>({id}))})}).catch(()=>null);
  const body=res?.ok?await res.json().catch(()=>null):null;
  for(const c of body?.data||[])if(c?.id){cardCache.set(c.id,c);map.set(c.id,c);}
  if(i+75<missing.length)await new Promise(r=>setTimeout(r,100)); // Scryfall asks for 10 requests a second at most
 }
 return map;
}
// Pack order: commons, uncommons, other slots (wildcard, special guests, The List), lands, foils, and
// the rare or mythic last, so today's pack can swap that hit for the Card of the Day.
const isRare=name=>/rare|mythic/i.test(name)&&!/common|uncommon/i.test(name);
function slotOf(name,sheet){
 if(isRare(name))return {rank:5,role:'hit'};
 if(sheet.foil)return {rank:4,role:'foil'};
 if(/land|basic/i.test(name))return {rank:3,role:''};
 if(/^(?:sfc|dfc|nonlegendary|legendary|new|nonland|nonconspiracy|nondraft)?common/i.test(name))return {rank:0,role:''};
 if(/uncommon/i.test(name))return {rank:1,role:''};
 return {rank:2,role:/wildcard/i.test(name)?'wildcard':''};
}
const pickWeighted=(list,random)=>{const total=list.reduce((n,[,w])=>n+w,0);let r=random()*total;for(const x of list){r-=x[1];if(r<=0)return x;}return list.at(-1);};
const COLORS=['W','U','B','R','G'];
// One pack: [{...card, packSlot, packFoil}] in pack order. cards: the map from mtgBoosterCards.
export function drawMtgBooster(data,cards,random=Math.random){
 const layout=pickWeighted(data.boosters.map(b=>[b,b.w]),random)[0],out=[];
 const slots=Object.entries(layout.c).map(([name,count])=>({name,count,sheet:data.sheets[name],...slotOf(name,data.sheets[name]||{})})).filter(s=>s.sheet).sort((a,b)=>a.rank-b.rank);
 for(const {name,count,sheet,role} of slots){
  let list=sheet.cards.filter(([id])=>cards.has(id));if(!list.length)continue;
  const picked=[];
  if(sheet.fixed)for(const [id,w] of list)for(let k=0;k<w&&picked.length<count;k++)picked.push(id);
  // Colour-balanced commons: one of each colour first, as printed sheets are collated.
  if(sheet.balance&&count>=COLORS.length)for(const color of COLORS){const mono=list.filter(([id])=>{const c=cards.get(id).colors||[];return c.length===1&&c[0]===color;});if(mono.length){const [id]=pickWeighted(mono,random);picked.push(id);list=list.filter(x=>x[0]!==id);}}
  while(picked.length<count&&list.length){const [id]=pickWeighted(list,random);picked.push(id);if(!sheet.duplicates)list=list.filter(x=>x[0]!==id);}
  // Balanced picks come first; shuffle them in among the rest of this sheet's cards.
  for(let i=picked.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[picked[i],picked[j]]=[picked[j],picked[i]];}
  for(const id of picked)out.push({...cards.get(id),...(role?{packSlot:role}:{}),...(sheet.foil?{packFoil:true}:{}),packSheet:name});
 }
 return out;
}
// God pack (Wizards, 5 Oct 2026: from 2027 every regular booster has a 1 in 1,000 chance and every Collector
// Booster 1 in 300): every card in the pack is a rare or mythic. Drawn from the set's own rare/mythic sheets
// by their weights, so mythics and Booster Fun treatments keep their real share, and never twice the same card.
// CardStashy's god packs are all holo too. Null when the sheets can't fill the pack.
export const GOD_PACK_ODDS=Object.freeze({regular:1/1000,collector:1/300});
export function mtgGodPackPicks(data,cards,size,random=Math.random){
 const pool=new Map();
 for(const [name,sheet] of Object.entries(data?.sheets||{}))if(isRare(name))for(const [id,w] of sheet.cards)if(cards.has(id)&&/^(rare|mythic)$/.test(cards.get(id).rarity||''))pool.set(id,(pool.get(id)||0)+w);
 let list=[...pool];if(!size||list.length<size)return null;
 const out=[];
 while(out.length<size){const [id]=pickWeighted(list,random);list=list.filter(x=>x[0]!==id);out.push({...cards.get(id),packSlot:'hit',packFoil:true,packSheet:'god'});}
 // Mythics last, so the reveal builds up to them.
 out.sort((a,b)=>(a.rarity==='mythic')-(b.rarity==='mythic'));
 out.godPack=true;out.collector=true;return out;
}
