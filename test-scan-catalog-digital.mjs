import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {normalizePtcg} from './ptcg.js';

const raw=JSON.parse(gunzipSync(readFileSync('scanidx/ptcg-catalog-v1.json.gz'))),pack=compileCatalog(raw);
const digital=raw.rows.filter(r=>/(?:^|\/)tcgp\//i.test(r[6]||''));
assert.equal(digital.length,667);assert.equal(pack.rows.length,raw.rows.length);
assert.equal(pack.indexedCount,raw.rows.length-digital.length);
for(const row of digital)assert(!pack.ids.has(row[0]));
assert.equal(normalizePtcg({id:'B1-173',name:'Meltan',localId:'173',image:'https://assets.tcgdex.net/en/tcgp/B1/173',set:{id:'B1',name:'Mega Rising'}}).pocket,true);
assert.equal(lookupCatalog(pack,{name:'Meltan',code:'173/226'}).cands.length,0);
assert.equal(lookupCatalog(pack,{name:'Meltan',code:'188/264'}).cands[0].id,'swsh8-188');
const control=compileCatalog({schema:1,game:'ptcg',rows:[['B1-173','Example Paper Card','B1','173',226,'Example Paper Set','paper/B1/173']]});
assert.equal(control.indexedCount,1);assert.equal(lookupCatalog(control,{name:'Example Paper Card',code:'173/226'}).cands[0].exact,true,'no blanket B-series identifier exclusion');

// Execute the builder against tiny synthetic source snapshots in a temporary
// copy, never mutate/rebuild the committed packs or contact a provider.
const root=mkdtempSync(join(tmpdir(),'scan-catalog-filter-'));
try {
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'scanidx'));mkdirSync(join(root,'input'));
  copyFileSync('scripts/build-scan-catalogs.py',join(root,'scripts/build-scan-catalogs.py'));
  writeFileSync(join(root,'input/scan-mtg-default.jsonl.gz'),gzipSync(''));
  writeFileSync(join(root,'input/scan-ygo-cards.json'),JSON.stringify({data:[]}));
  writeFileSync(join(root,'input/scan-ptcg-sets.json'),JSON.stringify([{id:'B1',name:'Test',cardCount:{official:226}}]));
  writeFileSync(join(root,'input/scan-ptcg-cards.json'),JSON.stringify([
    {id:'B1-173',name:'Digital Image',image:'https://assets.tcgdex.net/en/tcgp/B1/173'},
    {id:'B1-174',name:'Digital Indexed Path'},
    {id:'B1-175',name:'Paper Metadata',image:'https://assets.tcgdex.net/en/paper/B1/175'}
  ]));
  writeFileSync(join(root,'scanidx/ptcg-ids.txt'),'B1-173\ttcgp/B1/173\nB1-174\ttcgp/B1/174\nB1-175\tpaper/B1/175\n');
  const result=spawnSync('python3',[join(root,'scripts/build-scan-catalogs.py'),join(root,'input')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(gunzipSync(readFileSync(join(root,'scanidx/ptcg-catalog-v1.json.gz')))).rows.map(r=>r[0]),['B1-175']);
  // Isolate only the actual list_ptcg AST; its get function receives this fixture.
  const script=`import ast,json\nsource=open(${JSON.stringify(resolve('scripts/build-scan-index.py'))}).read()\nnode=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='list_ptcg')\nns={'json':json,'get':lambda *a,**k:json.dumps([{'id':'B1-173','image':'https://assets.tcgdex.net/en/tcgp/B1/173'},{'id':'B1-175','image':'https://assets.tcgdex.net/en/paper/B1/175'}])}\nexec(compile(ast.Module(body=[node],type_ignores=[]),'index-fixture','exec'),ns)\nassert ns['list_ptcg']()==[('B1-175','https://assets.tcgdex.net/en/paper/B1/175/low.webp')]\n`;
  const index=spawnSync('python3',['-c',script],{encoding:'utf8'});assert.equal(index.status,0,index.stderr);
} finally {rmSync(root,{recursive:true,force:true});}
console.log('PASS:667 source-proven Pocket rows excluded from physical matching without changing raw manifest integrity; eligible count and both catalogue builders preserve a non-digital B-series control.');
