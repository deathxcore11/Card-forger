// Naming a card from whatever text was read off it, however rough. A foil card under a flash has
// no usable picture, but its name is still printed twice or more: in the title, and usually again
// inside its own rules text. The reader gets most letters right and a few wrong ("VIRTUAL WORLD
// KIRIN - LiL"), so this looks for the catalogue name that best fits anywhere in the text, with a
// few wrong letters allowed, and then asks the rest of the card (passcode, ATK/DEF) to agree.
// It only ever proposes a card for review; it never verifies a printing.
import {scanCardNameKey,scanNameKey} from './scan.js';

const INDEX=new WeakMap();
const tri=(a,b,c)=>(a*37+b)*37+c,code=ch=>ch<58?ch-48:ch-87; // 0-9 a-z -> 0..35
// Every name of the pack, as letters and digits only, with the three-letter pieces it contains.
function indexOf(pack){
 let ix=INDEX.get(pack);if(ix)return ix;
 const keys=[],byKey=new Map(),post=new Map();
 for(const k of pack.names.keys()){if(k.length<5)continue;byKey.set(k,keys.length);keys.push(k);}
 keys.forEach((k,n)=>{const seen=new Set();for(let i=0;i+2<k.length;i++){const t=tri(code(k.charCodeAt(i)),code(k.charCodeAt(i+1)),code(k.charCodeAt(i+2)));if(seen.has(t))continue;seen.add(t);const a=post.get(t);if(a)a.push(n);else post.set(t,[n]);}});
 // A piece shared by a great many names says little; rarer pieces carry the match.
 ix={keys,post,pieces:keys.map(k=>new Set(Array.from({length:Math.max(0,k.length-2)},(_,i)=>k.slice(i,i+3))).size)};
 INDEX.set(pack,ix);return ix;
}
// The fewest wrong letters with which `name` fits somewhere inside `text` (a substring search
// that forgives substitutions, dropped and extra letters). Returns {d, end} or null over `limit`.
export function fitInside(name,text,limit){
 const n=name.length,m=text.length;if(!n||!m)return null;
 let prev=new Uint16Array(n+1),cur=new Uint16Array(n+1);for(let i=0;i<=n;i++)prev[i]=i;
 let best=limit+1,end=-1;
 for(let j=1;j<=m;j++){
  cur[0]=0;const c=text.charCodeAt(j-1);
  for(let i=1;i<=n;i++){const sub=prev[i-1]+(name.charCodeAt(i-1)===c?0:1),del=prev[i]+1,ins=cur[i-1]+1;cur[i]=sub<del?(sub<ins?sub:ins):(del<ins?del:ins);}
  if(cur[n]<best){best=cur[n];end=j;}
  const t=prev;prev=cur;cur=t;
 }
 return best<=limit?{d:best,end}:null;
}
// How many letters may be wrong for a name of this length. Short names must be nearly exact: a
// five-letter word with two free letters fits almost any text.
const allowed=len=>len<6?0:len<8?1:len<12?2:Math.min(6,Math.floor(len*.2));
const squash=s=>scanNameKey(String(s||''));

// read: {name, titles, full, stats, code} as the reader produced them.
// Returns the best-fitting names, best first:
// [{key, indexes (pack rows), d (wrong letters), len, where: 'title'|'text', times, score, backed}]
export function textNameMatches(pack,read={},{most=5}={}){
 const g=pack.game,ix=indexOf(pack);
 // Title lines one by one: a title line is mostly the name, so a name has to fill most of the
 // line it is found in.
 const observed=Array.isArray(read.titles)&&read.titles.length?read.titles:[{text:read.name,confidence:null}];
 const lines=[...new Set(observed.flatMap(t=>String(t.text||'').split(/\r?\n/)).map(squash).filter(l=>l.length>=5))];
 const title=lines.join(' '),body=squash([read.full,read.stats].join(' ')),all=title+' '+body;
 if(all.length<6)return [];
 const fitTitle=(key,limit)=>{let best=null;for(const l of lines){if(key.length<l.length*.6)continue;const f=fitInside(key,l,limit);if(f&&(!best||f.d<best.d))best=f;}return best;};
 // Names sharing enough three-letter pieces with the text are worth a proper look.
 const counts=new Uint16Array(ix.keys.length),seen=new Set(),touched=[];
 for(const src of [title,body])for(let i=0;i+2<src.length;i++){
  const a=src.charCodeAt(i),b=src.charCodeAt(i+1),c=src.charCodeAt(i+2);if(a===32||b===32||c===32)continue;
  const t=tri(code(a),code(b),code(c));if(seen.has(t))continue;seen.add(t);
  const list=ix.post.get(t);if(list)for(const n of list){if(!counts[n])touched.push(n);counts[n]++;}
 }
 const worth=touched.filter(n=>counts[n]>=Math.max(3,Math.ceil(ix.pieces[n]*(ix.keys[n].length>=12?.42:.55)))).sort((a,b)=>counts[b]/ix.pieces[b]-counts[a]/ix.pieces[a]||ix.keys[b].length-ix.keys[a].length).slice(0,90);
 // What else on the card agrees: its passcode (one wrong digit allowed) or its ATK and DEF.
 const digits=[...String([read.code,read.full,read.stats].join('\n')).matchAll(/\d[\d ]{6,9}\d/g)].map(m=>m[0].replace(/\D/g,'')).filter(s=>s.length>=7&&s.length<=9);
 const text=String([read.name,read.full,read.stats].join('\n')),atk=text.match(/ATK\s*[/:.]?\s*\/?\s*(\d{1,5})/i),def=text.match(/DEF\s*[/:.]?\s*\/?\s*(\d{1,5})/i);
 const backing=key=>{
  if(g!=='ygo')return '';
  const id=String(pack.rows[pack.names.get(key)?.[0]]?.[0]||''),sig=pack.signals?.rows?.[id];
  if(id.length>=7&&digits.some(s=>!!fitInside(id.padStart(8,'0'),s.padStart(8,'0'),1)))return 'passcode';
  return sig&&atk&&def&&Number(atk[1])===sig.atk&&Number(def[1])===sig.def?'ATK and DEF':'';
 };
 const hits=[];
 for(const n of worth){
  const key=ix.keys[n],len=key.length,loose=len<8?allowed(len):Math.floor(len*.33);
  let inTitle=fitTitle(key,loose),inBody=body?fitInside(key,body,loose):null;
  if(!inTitle&&!inBody)continue;
  // Three bars. In the title: a few wrong letters. In the rules text with nothing behind it:
  // nearly exact, because rules text is full of ordinary words. Backed by the passcode or the
  // stats: a rough reading is enough, the numbers carry it.
  const backed=backing(key),strict=Math.floor(len*.12);
  if(!backed){if(inTitle&&inTitle.d>allowed(len))inTitle=null;if(inBody&&inBody.d>strict)inBody=null;if(!inTitle&&!inBody)continue;}
  // How often the text says this name (a card's rules text repeats its own name).
  let times=0;if(inBody){const lim=backed?loose:strict;let from=0;for(;;){const f=fitInside(key,body.slice(from),lim);if(!f)break;times++;from+=f.end;if(times>=4)break;}}
  const d=Math.min(inTitle?inTitle.d:99,inBody?inBody.d:99);
  hits.push({key,indexes:pack.names.get(key)||[],d,len,where:inTitle?'title':'text',times,backed,score:len-2.5*d+(inTitle?4:0)+Math.min(times,3)+(backed==='passcode'?6:backed?3:0)});
 }
 if(!hits.length)return [];
 hits.sort((a,b)=>b.score-a.score);
 // A shorter name that is only part of a longer fitted one ("Kirin" in "Virtual World Kirin")
 // is the same reading, not a rival.
 const out=[];for(const h of hits){if(out.some(o=>o.key.includes(h.key)&&o.len>h.len))continue;out.push(h);if(out.length>=most)break;}
 return out;
}
// One name, or none. The name must be in the title, or be said twice by the rules text, or be
// backed by the passcode or stats; and nothing else may fit nearly as well.
export function textNameMatch(pack,read={}){
 const hits=textNameMatches(pack,read),a=hits[0],b=hits[1];
 if(!a)return null;
 const grounded=a.where==='title'||a.times>=2||a.backed;
 if(!grounded)return null;
 if(b&&a.score-b.score<3)return null;
 // A title fit with many wrong letters and nothing behind it is a guess.
 if(a.where==='title'&&!a.backed&&!a.times&&a.d>Math.max(1,Math.floor(a.len*.15)))return null;
 return a;
}
export const textNameKey=(g,name)=>scanCardNameKey(g,name);

// Which card of a picture shortlist does the read text belong to? texts: [{key, text}] (each
// card's name and rules text). The share of a card's three-letter pieces found in what was read;
// one card must stand clear of the rest. Returns {key, share, next} or null.
export function textPick(texts,read={}){
 const seen=squash([read.name,...(read.titles||[]).map(t=>t.text),read.full,read.stats,read.code].join(' '));
 if(seen.length<24)return null;
 const have=new Set();for(let i=0;i+2<seen.length;i++)have.add(seen.slice(i,i+3));
 const scored=texts.map(({key,text})=>{const s=squash(text),pieces=new Set();for(let i=0;i+2<s.length;i++)pieces.add(s.slice(i,i+3));let hit=0;for(const p of pieces)if(have.has(p))hit++;return {key,hit,share:pieces.size>=20?hit/pieces.size:0};}).sort((a,b)=>b.share-a.share);
 const a=scored[0],b=scored[1];
 // Stray marks in a long read hit a third of any text by chance: the card must be well clear of that.
 if(!a||a.hit<15||a.share<.45||(b&&a.share-b.share<.12))return null;
 return {key:a.key,share:a.share,next:b?b.share:0};
}
