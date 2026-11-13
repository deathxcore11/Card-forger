// Clue fusion: decides what a capture is from clues of different kinds, and how sure that is.
// The picture clue (scan-pix.js) proposes a card in a few thousandths of a second; the printed
// text (name, number, set code, passcode, HP, ATK/DEF...) confirms it or picks the printing.
// A capture is "sure" only when two different kinds of clue agree on one printing and nothing
// that was read contradicts it. A picture alone, or text alone that was repaired, never is.
// Pure logic, no DOM: the web scanner and the app both use this file.
import {pixNearest,pixDist} from './scan-pix.js';
import {signalEvidence,scanIdentifierEvidence} from './scan-signals.js';
import {scanCardNameKey} from './scan.js';
import {catalogCandidate} from './scan-catalog.js';

// Picture distances: 0 is the same picture, about 141 unrelated. Measured on the test photos the
// right card is at most 72 away and the closest wrong card at least 73, so "strong" leaves room.
export const FUSE=Object.freeze({strong:58,gap:14,same:14,suggest:74,suggestGap:6});

const DIGIT={O:'0',o:'0',Q:'0',D:'0',I:'1',l:'1','|':'1',i:'1','!':'1',S:'5',s:'5',B:'8',Z:'2',z:'2'};
const LETTER={'0':'O','1':'I','5':'S','8':'B','2':'Z'};
// Does a read token equal an expected printed token, allowing the reader's usual look-alike
// swaps (O for 0, I for 1...) only where the expected character makes the intent clear?
export function looksLike(seen,expected){
 if(seen.length!==expected.length||!expected.length)return false;
 for(let i=0;i<expected.length;i++){
  const e=expected[i].toUpperCase(),s=seen[i];
  if(s.toUpperCase()===e)continue;
  if(/\d/.test(e)?DIGIT[s]===e:LETTER[s]===e)continue;
  return false;
 }
 return true;
}
const strip0=s=>String(s).replace(/^0+(?=.)/,'');
// Leading zeros as the reader may have seen them (a zero read as the letter O).
const lead0=s=>String(s).replace(/^[0Oo]+(?=.)/,'');
const tokens=text=>String(text||'').split(/[^A-Za-z0-9|!]+/).filter(Boolean);
// An expected code appearing anywhere in text once everything but letters and digits is removed.
function windowHas(text,expected){
 const t=String(text||'').replace(/[^A-Za-z0-9|!]/g,''),n=expected.length;
 for(let i=0;i+n<=t.length;i++)if(looksLike(t.slice(i,i+n),expected))return true;
 return false;
}
// What a Magic row prints in its footer. Promo-stamped copies ("pmh2 261p", "pecl 98s") print the
// regular set's code and number, so text cannot tell them from the regular printing.
export function mtgPrinted(row){
 const set=String(row[2]||''),num=String(row[3]||'');
 return /\d[ps]$/.test(num)&&/^p[a-z0-9]{3,}$/.test(set)?[set.slice(1),num.slice(0,-1)]:[set,num];
}
// Is this catalogue row's printed identifier in the footer text? Guided reading: we know what to
// look for, so a slightly misread code still counts, but only as the exact expected string.
export function printedIdSeen(g,row,text){
 text=String(text||'');
 if(g==='ptcg'){
  const num=strip0(row[3]||''),total=strip0(row[4]||'');if(!num)return false;
  // The rarity mark printed right after the total is often read as one more character ("42/1010").
  if(total){for(const m of text.matchAll(/([A-Za-z0-9|!]{1,6})\s*\/\s*([A-Za-z0-9|!]{1,6})/g)){const t=lead0(m[2]);if(looksLike(lead0(m[1]),num)&&(looksLike(t,total)||(total.length>=2&&t.length===total.length+1&&looksLike(t.slice(0,-1),total))))return true;}
   // The slash itself is thin and often lost: "072203" for 072/203.
   return total.length>=2&&tokens(text).some(t=>t.length>=total.length+2&&looksLike(t.slice(-total.length),total)&&looksLike(lead0(t.slice(0,-total.length)),num));}
  return num.length>=4&&tokens(text).some(t=>looksLike(t,num));
 }
 if(g==='mtg'){
  const [set,n]=mtgPrinted(row),num=strip0(n),ts=tokens(text);if(!set||!num)return false;
  return ts.some(t=>looksLike(lead0(t),num))&&ts.some(t=>t.length>=3&&looksLike(t,set));
 }
 const code=String(row[2]||'').replace(/[^A-Za-z0-9]/g,'');
 return code.length>=6&&windowHas(text,code);
}
// A Yu-Gi-Oh! passcode (eight digits, bottom left) names the card itself.
export const passcodeSeen=(row,text)=>/^\d{5,8}$/.test(String(row[0]))&&windowHas(text,String(row[0]).padStart(8,'0'));
// Is this card name in the title text, allowing a few misread letters in a long name?
export function nameSeen(name,text){
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,''),t=norm(text);
 for(const part of String(name||'').split(/\s+\/\/\s+/)){
  const p=norm(part),allow=p.length<5?0:p.length<8?1:Math.floor(p.length*.2);
  if(!p)continue;
  if(p.length<4){if(new RegExp(`(^|[^A-Za-z0-9])${part.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Za-z0-9]|$)`,'i').test(String(text||'')))return true;continue;}
  if(t.includes(p))return true;
  if(!allow||t.length<p.length-allow)continue;
  // Closest substring by edit distance (the pattern may start anywhere in the text).
  let prev=new Uint16Array(t.length+1);
  for(let i=1;i<=p.length;i++){
   const cur=new Uint16Array(t.length+1);cur[0]=i;
   for(let j=1;j<=t.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(p[i-1]===t[j-1]?0:1));
   prev=cur;
  }
  let best=Infinity;for(let j=0;j<=t.length;j++)if(prev[j]<best)best=prev[j];
  if(best<=allow)return true;
 }
 return false;
}

// What the picture alone says. pix: {bin, ids?} (ids: passcode per record, Yu-Gi-Oh! only).
// Returns null (no usable picture) or {dist, rival, strong, name, rows: [{row, dist}]}: the
// catalogue rows this picture could be (every printing that shares the artwork, plus same-name
// rows whose picture we do not have), and whether the picture clearly names one card.
export function pictureVerdict(g,pack,pix,hashes){
 if(!pack?.rows||!pix?.bin)return null;
 const top=pixNearest(hashes,pix.bin,1);if(!top.length)return null;
 const [rec,dist]=top[0];let named,same;
 if(g==='ygo'){
  const code=pix.ids?.[rec];named=pack.ids.get(String(code))||[];same=r=>pix.ids[r]===code;
 }else{
  named=pack.names.get(scanCardNameKey(g,pack.rows[rec]?.[1]||''))||[rec];const set=new Set(named);same=r=>set.has(r);
 }
 if(!named.length)return null;
 const other=pixNearest(hashes,pix.bin,1,same)[0],rival=other?other[1]:Infinity;
 const rows=g==='ygo'?named.map(row=>({row,dist})):named.map(row=>({row,dist:row===rec?dist:pixDist(hashes,pix.bin,row)})).filter(x=>x.dist===null||x.dist<=dist+FUSE.same);
 return {dist,rival,strong:dist<=FUSE.strong&&rival-dist>=FUSE.gap,name:pack.rows[named[0]][1],rows};
}

const printKey=(g,r)=>g==='ygo'?`${r[0]}|${r[2]}`:String(r[0]);
export const candidateKey=(g,c)=>g==='ygo'?`${c?.card?.id}|${String(c?.print||'').split('|')[0]}`:String(c?.card?.id);
// Picture verdict + what was read -> a decision.
//   {sure, proof, key, cands, known, named}
// sure: one printing, proved by the picture and one more kind of clue (proof says which).
// known: the card is identified but its printing is not; cands are the printings to choose from.
// Otherwise cands are picture suggestions only (possibly none).
export function fuseClues(g,pack,verdict,read={}){
 if(!verdict||!pack)return {sure:false,known:false,cands:[]};
 const footer=[read.code,read.full,read.stats].filter(Boolean).join('\n'),title=[read.name,...(read.titles||[]).map(t=>t.text),read.full].filter(Boolean).join('\n');
 const seen=verdict.rows.map(({row,dist})=>{
  const r=pack.rows[row],cand=catalogCandidate(pack,row,true),inTitle=nameSeen(r[1],title);
  // Zone reads are loose words, not a title band: the name counts when this card's own name is
  // among them, and stray words never count against it.
  const printed=g==='mtg'?mtgPrinted(r):null,card={...cand.card,name:cand.card.name||cand.name,...(printed?{set:printed[0],collector_number:printed[1]}:{})};
  const e=signalEvidence(g,card,{...read,name:inTitle?r[1]:'',titles:[]}),guided=printedIdSeen(g,r,footer);
  // The exact expected code was found: a stricter parse of the same characters cannot overrule it.
  const conflicts=guided?e.conflicts.filter(c=>!/collector|set code/.test(c)):e.conflicts;
  const exact=g==='ygo'?scanIdentifierEvidence(g,read).observations.includes(r[2]):e.agrees.includes(g==='mtg'?'set / collector number':'collector number');
  const stats=e.agrees.filter(a=>!/collector|set/.test(a));
  return {row,r,dist,cand,clean:!conflicts.length&&!e.signalConflict&&!e.nameConflict&&(guided||(!e.identifierConflict&&!e.identifierUncertain)),
   id:exact||guided,name:inTitle||(g==='ygo'&&passcodeSeen(r,footer)),stats};
 });
 // Magic: a regular printing and its promo-stamped twin print the same code. Whichever the
 // picture preferred, both stay possible, so the person chooses.
 if(g==='mtg')for(const x of seen.filter(x=>x.id)){
  const [set,num]=mtgPrinted(x.r);
  for(const row of pack.names.get(scanCardNameKey(g,x.r[1]))||[])if(!seen.some(y=>y.row===row)){const r=pack.rows[row],[s2,n2]=mtgPrinted(r);if(s2===set&&n2===num)seen.push({...x,row,r,dist:null,cand:catalogCandidate(pack,row,true)});}
 }
 const keys=list=>new Set(list.map(x=>printKey(g,x.r)));
 const byId=seen.filter(x=>x.id&&x.clean),named=seen.some(x=>x.name),stat=seen.some(x=>x.stats.length>=2);
 const order=list=>[...list].sort((a,b)=>Number(b.id)-Number(a.id)||(a.dist??999)-(b.dist??999));
 const out=(list,extra)=>order(list).slice(0,3).map(x=>({...x.cand,...extra}));
 if(verdict.strong){
  let proof='',pick=null;
  if(byId.length&&keys(byId).size===1){proof=named?'picture, name and number':'picture and number';pick=byId;}
  else if(!byId.length&&keys(seen).size===1&&seen[0].clean&&(named||stat)){proof=named?'picture and name':'picture and printed stats';pick=seen;}
  if(pick)return {sure:true,known:true,named,proof,key:printKey(g,pick[0].r),cands:out(pick,{exact:true,why:`Matched by ${proof}`})};
  return {sure:false,named,idSeen:byId.length>0,known:named||stat||verdict.dist<=FUSE.strong-16,cands:out(byId.length>1?byId:seen,{exact:false,identitySource:'artwork',why:keys(seen).size>1?'Picture matched · choose the printing':'Picture matched · check the card'})};
 }
 if(verdict.dist<=FUSE.suggest&&verdict.rival-verdict.dist>=FUSE.suggestGap)return {sure:false,known:false,cands:out(seen,{exact:false,identitySource:'artwork',why:'Looks like this card · check the card and printing'})};
 return {sure:false,known:false,cands:[]};
}
