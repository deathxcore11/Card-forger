// Offline inventory of evidence gaps, not an assertion of complete visual QA.
// Uses the same checked-in recognition rows and production finish resolver.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {compileCatalog,catalogCandidate} from '../scan-catalog.js';
import {finishChoices,resolveFinish} from '../finish-effects.js';
import {normalizePtcg} from '../ptcg.js';
const read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
const add=(m,k)=>{m[k]=(m[k]||0)+1;};
const report={scope:'Every row in the checked-in recognition snapshots; not every live printing. Resolver availability is not visual accuracy. Missing evidence stays unverified.',candidateSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),allCardsAllGamesReleaseGate:'BLOCKED',games:{}};
for(const game of ['mtg','ptcg','ygo']){
 const file=`scanidx/${game}-catalog-v1.json.gz`,raw=read(file),pack=compileCatalog(raw),row={source:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),snapshotDate:raw.updated,rows:raw.rows.length,indexedRows:pack.indexedCount,uniqueCardIds:pack.ids.size,visualVerified:0};
 if(game==='mtg'){
  row.declaredFinishes={};for(const r of raw.rows)for(const f of r[5]||[])add(row.declaredFinishes,f);
  row.blocker='Recognition rows omit layout, face geometry and special-treatment evidence. Cannot validate these printings with a default normal-frame assumption.';
 }else if(game==='ptcg')row.blocker='Recognition rows omit physical finish availability and foil geometry. Full per-printing source records and visual references are required; scanner identity coverage is not foil coverage.';
 else{
  row.resolver={plain:0,approximate:0,unknown:0,noPrinting:0};row.unsupportedRarities={};row.examples=[];
  for(let i=0;i<raw.rows.length;i++){
   const c=catalogCandidate(pack,i).card,s=c.sets[0];if(!s){row.resolver.noPrinting++;continue;}
   const p=resolveFinish('ygo',c,{priceEdition:`${s.code}::${s.rarity}`});const status=p.effect==='plain'?'plain':p.status==='unknown'?'unknown':'approximate';row.resolver[status]++;
   if(status==='unknown'){add(row.unsupportedRarities,s.rarity||'(missing)');if(row.examples.length<20)row.examples.push({id:c.id,name:c.name,code:s.code,rarity:s.rarity,type:c.typeLine});}
  }
  row.blocker='Unknown finishes/layouts remain unsupported. Approximate resolver results do not certify exact artwork, watermark, texture, or title-mask alignment.';
 }
 report.games[game]=row;
}
const pilot=read('tests/fixtures/aquapolis-pilot-v1.json.gz');report.aquapolis={cards:pilot.cards.length,choices:0,plain:0,approximate:0,unknown:0};
for(const raw of pilot.cards){for(const p of finishChoices('ptcg',normalizePtcg(raw))){report.aquapolis.choices++;report.aquapolis[p.effect==='plain'?'plain':p.status==='unknown'?'unknown':'approximate']++;}}
report.requiredEvidence=['Complete physical printing/finish inventory for each game, with explicit unknowns and product identity.','Reviewed frame and material geometry by layout/treatment, including special foils and alternate art.','Exact rendering tests for image, mask, grid/detail/zoom, selection and nonfoil behavior.','Cross-game phone/foldable/tablet/desktop touch and scroll tests, reduced motion and unchanged collection/pricing identity.','Physical-device spot checks and separately approved production release with live asset verification.'];
const out=process.argv[2];if(out){fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({allCardsAllGamesReleaseGate:report.allCardsAllGamesReleaseGate,games:report.games,aquapolis:report.aquapolis},null,2));}else console.log(JSON.stringify(report,null,2));
