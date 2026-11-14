// Scores the picture clue end to end on a photo set (run to_raw.py first): find the card, lay it
// flat, fingerprint it, search the index. Counts the right card at rank 1 and within the top 10.
//   node scripts/scan-rig/bench-pix.mjs /tmp/scan-set [--games ptcg,ygo] [--truth] [--outlines 1|3]
// --truth uses the label's true corners instead of the finder (isolates the fingerprint).
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {join} from 'node:path';
import {locateCard,flattenCard} from '../../scan-find.js';
import {pixHash,pixNearest} from '../../scan-pix.js';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const set=process.argv[2],games=arg('games','mtg,ptcg,ygo').split(','),truth=process.argv.includes('--truth'),outlines=Number(arg('outlines','1'));
const tally={},dists={right:[],next:[]};
for(const g of games){
 const bin=new Uint8Array(readFileSync(`scanidx/${g}-pix-v2.bin`));
 const keys=g==='ygo'?readFileSync('scanidx/ygo-pix-v2-ids.txt','utf8').trim().split('\n'):JSON.parse(gunzipSync(readFileSync(`scanidx/${g}-catalog-v1.json.gz`))).rows.map(r=>r[0]);
 const names=g==='ygo'?null:JSON.parse(gunzipSync(readFileSync(`scanidx/${g}-catalog-v1.json.gz`))).rows.map(r=>r[1]);
 for(const L of JSON.parse(readFileSync(join(set,g,'labels.json'),'utf8'))){
  if(!keys.includes(String(L.id)))continue; // no reference picture for this label
  const rgba=new Uint8ClampedArray(readFileSync(join(set,g,L.file+'.rgba')));
  const t0=performance.now(),found=truth?{quad:L.quad.map(([x,y])=>({x,y}))}:locateCard(rgba,L.w,L.h),t1=performance.now();
  let rank=Infinity,ms=0,top=null;
  if(found){
   const hs=(outlines===3?[1,.975,1.025]:[1]).map(k=>{const f=flattenCard(rgba,L.w,L.h,found.quad,252,352,k);return pixHash(f,252,352,g);});
   const t2=performance.now();top=pixNearest(hs,bin,10);ms=performance.now()-t2;
   // The same card (or, for Magic and Pokemon, the same name: reprints share art) counts as right.
   rank=top.findIndex(([i])=>keys[i]===String(L.id)||(names&&names[i]===L.name));if(rank<0)rank=Infinity;
   if(rank===0){dists.right.push(top[0][1]);const other=top.find(([i])=>names?names[i]!==L.name:keys[i]!==String(L.id));if(other)dists.next.push(other[1]);}
  }
  for(const k of ['all',g,L.light]){const t=tally[k]||={n:0,top1:0,top10:0,find:0,search:0};t.n++;t.top1+=rank===0;t.top10+=rank<10;t.find+=t1-t0;t.search+=ms;}
 }
}
for(const [k,t] of Object.entries(tally))console.log(`${k.padEnd(6)} n=${String(t.n).padStart(3)}  right card first ${String(Math.round(100*t.top1/t.n)).padStart(3)}%  in top 10 ${String(Math.round(100*t.top10/t.n)).padStart(3)}%  find ${(t.find/t.n).toFixed(0)} ms  search ${(t.search/t.n).toFixed(1)} ms`);
const q=(a,p)=>a.sort((x,y)=>x-y)[Math.floor(a.length*p)]?.toFixed(1);
console.log(`distance of the right card: median ${q(dists.right,.5)}, worst ${q(dists.right,.999)} | nearest other card: closest ${q(dists.next,0)}, median ${q(dists.next,.5)}`);
