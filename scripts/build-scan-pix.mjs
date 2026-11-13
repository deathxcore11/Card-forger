// Builds the picture index scanidx/<game>-pix-v2.bin from the pictures fetch_pictures.py saved,
// with the scanner's own fingerprint code (scan-pix.js), so index and scanner cannot drift apart.
//   node scripts/build-scan-pix.mjs mtg /tmp/cardpix
// Magic and Pokemon: one 48-byte record per row of scanidx/<game>-catalog-v1.json.gz, in the same
// order (a row without a picture is 48 zero bytes). Yu-Gi-Oh!: one record per artwork, with
// scanidx/ygo-pix-v2-ids.txt giving each record's passcode (several artworks can share one).
import {readFileSync,writeFileSync,openSync,readSync,closeSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {PIX_W,PIX_H,PIX_REC,pixHashThumb} from '../scan-pix.js';
const [g,dir]=process.argv.slice(2),root=join(dirname(fileURLToPath(import.meta.url)),'..','scanidx');
const ids=readFileSync(join(dir,g+'-ids.txt'),'utf8').trim().split('\n').map(l=>l.split('\t')[0]);
const done=new Set(readFileSync(join(dir,g+'-done.txt'),'utf8').trim().split(/\s+/).map(Number));
const size=PIX_W*PIX_H*3,fd=openSync(join(dir,g+'.u8'),'r'),buf=Buffer.alloc(size);
const hashAt=k=>{
 readSync(fd,buf,0,size,k*size);
 const planes=[new Float32Array(PIX_W*PIX_H),new Float32Array(PIX_W*PIX_H),new Float32Array(PIX_W*PIX_H)];
 for(let i=0,j=0;i<PIX_W*PIX_H;i++,j+=3){planes[0][i]=buf[j];planes[1][i]=buf[j+1];planes[2][i]=buf[j+2];}
 return pixHashThumb(planes,g);
};
let out,count=0;
if(g==='ygo'){
 const keep=ids.map((_,k)=>k).filter(k=>done.has(k));out=new Uint8Array(keep.length*PIX_REC);
 keep.forEach((k,i)=>{out.set(hashAt(k),i*PIX_REC);count++;});
 writeFileSync(join(root,'ygo-pix-v2-ids.txt'),keep.map(k=>ids[k].split(':')[1]).join('\n')+'\n');
}else{
 const rows=JSON.parse(gunzipSync(readFileSync(join(root,g+'-catalog-v1.json.gz')))).rows,at=new Map(ids.map((id,k)=>[id,k]));
 out=new Uint8Array(rows.length*PIX_REC);
 rows.forEach((r,i)=>{const k=at.get(r[0]);if(k!=null&&done.has(k)){out.set(hashAt(k),i*PIX_REC);count++;}});
}
closeSync(fd);writeFileSync(join(root,g+'-pix-v2.bin'),out);
console.log(`${g}: ${count} pictures in ${out.length/PIX_REC} records, ${out.length} bytes, sha256 ${createHash('sha256').update(out).digest('hex')}`);
