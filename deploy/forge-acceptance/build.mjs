import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const files=['app.js','desktop-play.js','experiments/forge-proof/forge-session.mjs','experiments/forge-proof/forge-table.mjs','experiments/forge-proof/native-panel.mjs','experiments/phase-engine/match-table.css','experiments/phase-engine/match-table.mjs','play-cpu-options.js','play-deck-sources.js','play-forge-cpu-policy.js','play-forge-feature.js','play-forge-host-client.js','play-forge-artwork.js','play-forge-player-mat.js','play-forge-setup-review.js','play-forge-table.css','play-menu.css','play-menu.js','play-quick-match.js','play-setup.js'];
// Include the reachable browser runtime modules that production's old asset
// exclusion may not yet serve. Do not expose other experiment/server files.
const visited=new Set(),pending=['app.js'];
while(pending.length){
 const file=pending.pop();if(visited.has(file))continue;visited.add(file);
 if(file.startsWith('../')||path.isAbsolute(file))throw Error('browser_import_outside_root');
 const source=await readFile(path.join(root,file),'utf8');
 if(file.endsWith('.mjs')){
  if(!file.startsWith('experiments/phase-engine/')&&!files.includes(file))throw Error('unreviewed_browser_runtime_import');
  if(!files.includes(file))files.push(file);
 }
 for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']/g)){
  const next=path.normalize(path.join(path.dirname(file),match[1]));
  if(/\.m?js$/.test(next))pending.push(next);
 }
}
const overrides={},hashes={};
for(const file of files){const bytes=await readFile(path.join(root,file));overrides[file]=bytes.toString('utf8');hashes[file]=createHash('sha256').update(bytes).digest('hex');}
const out=path.join(root,'deploy/forge-acceptance/generated');await mkdir(out,{recursive:true});
await writeFile(path.join(out,'entry.mjs'),`import {acceptanceWorker} from '../worker.mjs';\nexport default acceptanceWorker(${JSON.stringify(overrides)});\n`);
await writeFile(path.join(out,'SOURCE-SHA256.json'),JSON.stringify(hashes,null,2)+'\n');
console.log(JSON.stringify({files:files.length,sourceBytes:Buffer.byteLength(JSON.stringify(overrides))}));
