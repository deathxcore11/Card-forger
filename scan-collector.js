// Collector descriptors: what a collector types or OCR reads from a card's footer.
// A number, a set code or both, in either order and any punctuation:
// "12", "NEO", "12 NEO", "NEO 12", "neo12", "#0012 · NEO", "56/111", "LOB-EN001",
// "LOB 001", "001 LOB". Partial descriptors only narrow a list of printings;
// they never verify one on their own.
import {parseYgoSetCode} from './scan.js';
import {collectorKey} from './scan-signals.js';

const LANGS=new Set(['en','es','fr','de','it','pt','ja','jp','ko','ru','zhs','zht','cs','ph']);
const MTG_RARITY=/^[curmlst]$/;
const COLLECTOR=/^[a-z]{0,2}\d{1,4}[a-z★☆†]{0,2}$/;
const words=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'');
const nameWords=name=>words(name).split(/[^a-z0-9]+/).filter(Boolean);

/** Known releases for a game, from a compiled recognition catalogue (or none). */
export function catalogueReleases(pack){
 if(!pack?.rows)return null;
 if(pack.releases)return pack.releases;
 const codes=new Map(),g=pack.game;
 for(const r of pack.rows){
  const code=g==='ygo'?String(r[2]||'').split('-')[0].toLowerCase():String(r[2]||'').toLowerCase(),name=g==='mtg'?r[4]:g==='ptcg'?r[5]:r[4];
  if(code&&!codes.has(code))codes.set(code,String(name||''));
 }
 return pack.releases={codes,names:[...codes].map(([code,name])=>({code,name,words:nameWords(name)}))};
}

/**
 * Parse a descriptor. With `releases` (catalogueReleases), letter tokens must be a
 * real set code or words of a real set name; without it, a 2–6 character letter
 * token is taken as a set code. Returns null when a token is unusable, so typos
 * are reported instead of silently ignored.
 */
export function collectorQuery(game,value,{releases=null}={}){
 const raw=String(value??'').trim();
 const query={numbers:[],sets:[],setWords:[],prefix:'',code:'',numberSets:[]};
 if(!raw)return query;
 if(game==='ygo'){
  const code=parseYgoSetCode(raw.replace(/\s+/g,''));if(code){query.code=code;return query;}
  // "LOB 001", "001 LOB", "LOB": a release prefix and/or a card number.
  for(const token of words(raw).split(/[^a-z0-9]+/).filter(Boolean)){
   if(/^\d{1,3}$/.test(token))query.numbers.push({number:token.padStart(3,'0'),total:''});
   else if(/^[a-z0-9]{2,5}$/.test(token)&&/[a-z]/.test(token)&&!query.prefix&&(!releases||releases.codes.has(token)))query.prefix=token;
   else if(LANGS.has(token))continue;
   else return null;
  }
  return query;
 }
 const known=code=>releases?releases.codes.has(code):/^[a-z0-9]{2,6}$/.test(code)&&/[a-z]/.test(code);
 const unknown=[];
 for(const token of words(raw).replace(/[#•·,;:()]/g,' ').split(/[\s-]+/).filter(Boolean)){
  const fraction=token.match(/^([a-z]{0,2}\d{1,4}[a-z★☆†]{0,2})\/(\d{1,4})$/);
  if(fraction){query.numbers.push({number:fraction[1],total:fraction[2]});continue;}
  if(/^\d/.test(token)&&COLLECTOR.test(token)&&!known(token)){
   query.numbers.push({number:token,total:''});
   // "151" can be a card number or the 151 set; a set reading is a fallback.
   if(releases&&/^\d+$/.test(token))query.numberSets.push(...releases.names.filter(r=>r.words.includes(token)).map(r=>r.code));
   continue;
  }
  if(known(token)&&(releases||!/^\d+$/.test(token))){query.sets.push(token);continue;}
  if(COLLECTOR.test(token)&&/\d/.test(token)){query.numbers.push({number:token,total:''});continue;}
  if(LANGS.has(token)||(game==='mtg'&&MTG_RARITY.test(token)))continue;
  // A set and number written together, either way round: "neo12", "12neo".
  let split=null;
  for(let i=2;i<token.length&&!split;i++){
   const a=token.slice(0,i),b=token.slice(i);
   if(releases?.codes.has(a)&&COLLECTOR.test(b)&&/\d/.test(b))split=[a,b];
   else if(releases?.codes.has(b)&&COLLECTOR.test(a)&&/^\d/.test(a))split=[b,a];
  }
  if(split){query.sets.push(split[0]);query.numbers.push({number:split[1],total:''});continue;}
  unknown.push(token);
 }
 // Remaining words may name the set ("fusion strike", "151"); otherwise reject.
 if(unknown.length){
  if(!releases)return null;
  const hits=releases.names.filter(r=>unknown.every(w=>r.words.includes(w))).map(r=>r.code);
  if(!hits.length)return null;
  query.setWords=unknown;query.sets.push(...hits);
 }
 query.sets=[...new Set(query.sets)];query.numberSets=[...new Set(query.numberSets)];
 return query;
}
export const collectorQueryEmpty=q=>!q||(!q.numbers.length&&!q.sets.length&&!q.prefix&&!q.code);

/** Identity fields of a candidate or catalogue row, normalized across games. */
export function printingFacts(game,c){
 if(Array.isArray(c)){
  if(game==='mtg')return {set:String(c[2]||'').toLowerCase(),number:c[3],total:''};
  if(game==='ptcg')return {set:String(c[2]||'').toLowerCase(),number:c[3],total:c[4]??''};
  const code=String(c[2]||'');return {set:code.split('-')[0].toLowerCase(),number:(code.match(/(\d+)$/)||[])[1]||'',total:'',code:code.toUpperCase()};
 }
 const card=c?.card||c||{};
 if(game==='mtg')return {set:String(card.set||'').toLowerCase(),number:card.collector_number,total:''};
 if(game==='ptcg')return {set:String(card.set?.id||'').toLowerCase(),number:card.set?.number,total:card.set?.total??''};
 const code=String(c?.print||'').split('|')[0];
 return {set:code.split('-')[0].toLowerCase(),number:(code.match(/(\d+)$/)||[])[1]||'',total:'',code:code.toUpperCase()};
}
const sameNumber=(game,a,b)=>game==='ygo'?String(Number(a))===String(Number(b)):collectorKey(a)===collectorKey(b);
/** Does a printing satisfy every part of the descriptor that was given? */
export function collectorMatches(game,facts,q){
 if(collectorQueryEmpty(q))return true;
 if(q.code)return facts.code===q.code;
 if(q.prefix&&facts.set!==q.prefix)return false;
 if(q.sets.length&&!q.sets.includes(facts.set))return false;
 if(q.numbers.length&&!q.numbers.some(n=>sameNumber(game,facts.number,n.number)&&(!n.total||String(Number(facts.total))===String(Number(n.total)))))return false;
 return true;
}
export function describeCollector(game,q){
 if(collectorQueryEmpty(q))return '';
 if(q.code)return q.code;
 const parts=[...(q.prefix?[q.prefix.toUpperCase()]:[]),...(q.setWords.length?[q.setWords.join(' ')]:q.sets.length===1?[q.sets[0].toUpperCase()]:q.sets.length?[q.sets.length+' sets']:[]),...q.numbers.map(n=>'#'+n.number+(n.total?'/'+n.total:''))];
 return parts.join(' ');
}

/**
 * Footer evidence too partial for the paired identifier parser: a collector
 * number with no readable set marker, or a set code with no readable number.
 * Copyright years, artist lines and power/toughness are excluded. Every
 * reading is kept; callers only narrow with it, never verify.
 */
export function footerHints(game,text,{releases=null}={}){
 const hints={numbers:[],sets:[],prefix:'',code:''};
 const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 for(const line of lines){
  const lower=words(line);
  if(/©|\(c\)|\btm\b|wizards|nintendo|konami|pokemon|illus/.test(lower)&&!/\b\d{1,4}\s*\/\s*\d{2,4}\b/.test(lower))continue;
  if(game==='ygo'){
   for(const m of lower.matchAll(/\b([a-z0-9]{2,5})\s*-\s*[a-z]{0,2}\s*(\d{2,3})\b/g))if(/[a-z]/.test(m[1])&&(!releases||releases.codes.has(m[1]))){hints.prefix||=m[1];hints.numbers.push({number:m[2].padStart(3,'0'),total:''});}
   continue;
  }
  // Fractions, with this footer font's OCR confusions (O→0, l/I/|→1, "11"→n): "on/274" is 011/274.
  const digit=v=>v.replace(/n/g,'11').replace(/o/g,'0').replace(/[li|]/g,'1');
  for(const m of lower.matchAll(/(?<![a-z0-9/])([0-9onli|]{1,4}[a-z]?)\s*\/\s*([0-9oli|]{2,4})(?![a-z0-9/])/g)){
   const number=digit(m[1]),total=digit(m[2]);
   if(/^\d+[a-z]?$/.test(number)&&/^\d+$/.test(total))hints.numbers.push({number,total:game==='ptcg'?total:''});
  }
  if(game==='mtg'){
   // "0277 R", "R 0277", "277" alone on a short footer line.
   for(const m of lower.matchAll(/(?<![\w/.])(\d{1,4}[a-z★]?)(?![\w/.])/g)){
    const n=m[1],digits=n.replace(/\D/g,'');
    if(/^(?:19|20)\d\d$/.test(digits)||lower.includes('/'))continue;
    if(lower.replace(/[^a-z]/g,'').length>12)continue;
    hints.numbers.push({number:n,total:''});
   }
  }
  for(const m of lower.matchAll(/\b([a-z][a-z0-9]{1,4})\b/g)){
   const code=m[1];if(LANGS.has(code)||MTG_RARITY.test(code))continue;
   if(releases?releases.codes.has(code):false)hints.sets.push(code);
  }
 }
 hints.numbers=[...new Map(hints.numbers.map(n=>[collectorKey(n.number)+'/'+(n.total||''),n])).values()];
 hints.sets=[...new Set(hints.sets)];
 return {...hints,setWords:[]};
}

/**
 * Narrow printings with every usable part of a descriptor. Each part is applied
 * only while something still matches, so a misread part cannot empty the list:
 * set+number first, then number alone, then set alone. Returns what applied.
 */
export function narrowPrintings(game,items,q,facts=item=>printingFacts(game,item)){
 const from=items.length;
 if(collectorQueryEmpty(q)||!from)return {items,from,to:from,by:''};
 const attempts=[[q,describeCollector(game,q)]];
 if(!q.code&&q.numbers.length&&(q.sets.length||q.prefix))attempts.push([{...q,sets:[],prefix:'',setWords:[]},describeCollector(game,{...q,sets:[],prefix:'',setWords:[]})],[{...q,numbers:[]},describeCollector(game,{...q,numbers:[]})]);
 if(q.numberSets?.length&&q.numbers.length===1)attempts.push([{...q,numbers:[],sets:[...q.sets,...q.numberSets],numberSets:[]},'set '+q.numbers[0].number]);
 for(const [part,by] of attempts){
  const kept=items.filter(item=>collectorMatches(game,facts(item),part));
  if(kept.length)return {items:kept,from,to:kept.length,by};
 }
 return {items,from,to:from,by:''};
}

/**
 * Yu-Gi-Oh! codes as OCR commonly misreads them: KIC0-EN046, K1CO-EN046,
 * KICO-ENO46. The literal reading stays the evidence; these spellings are
 * only tried against a catalogue when the literal code does not exist.
 */
export function ygoCodeVariants(code){
 const m=String(code||'').toUpperCase().match(/^([A-Z0-9]{2,4})-([A-Z]{0,2})([A-Z0-9]{2,4})$/);
 if(!m)return [];
 const swap={'0':'O','O':'0','1':'I','I':'1','L':'1','5':'S','S':'5','8':'B','B':'8'};
 const spell=(part,allowed)=>{
  let out=[''];
  for(const ch of part){const alt=allowed.test(ch)?swap[ch]:null;out=out.flatMap(p=>alt?[p+ch,p+alt]:[p+ch]);if(out.length>64)return [part];}
  return out;
 };
 // Prefix letters and digits trade both ways; the trailing card number only
 // becomes digits (O→0, I/L→1). The region (EN) is kept as read.
 const prefixes=spell(m[1],/[0O1I58SB]/),numbers=spell(m[3],/[OIL]/).filter(n=>/^\d+$/.test(n)||n===m[3]);
 const out=new Set();
 for(const p of prefixes)for(const n of numbers)out.add(`${p}-${m[2]}${n}`);
 out.delete(String(code).toUpperCase());
 return [...out];
}
