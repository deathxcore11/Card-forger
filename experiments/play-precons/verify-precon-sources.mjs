// Exact-byte reproduction of the three recorded external data samples.
// No network, game admission, deck construction verdict or collection writes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readPreconCatalog,readPreconDeck} from './mtgjson-precons.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const [indexPath,upgradesPath,turtlesPath,challengerPath,outputPath]=process.argv.slice(2);
assert(indexPath&&upgradesPath&&turtlesPath&&challengerPath&&outputPath,
 'Usage: node verify-precon-sources.mjs INDEX UPGRADES TURTLES CHALLENGER OUTPUT');
const readExact=async(path,expected)=>{const bytes=await readFile(path);assert.equal(sha(bytes),expected,'External source bytes changed: '+path);return bytes;};
const index=await readExact(indexPath,'8531267c6a9539a7d242aa4fe622100f6abc414fb00335474d9ff0b804259b76');
const catalog=readPreconCatalog(JSON.parse(index),{asOf:'2026-10-25'});
assert.equal(catalog.products.length,3131);
assert.equal(catalog.products.filter(p=>p.productType==='Commander Deck').length,198);
const samples=[];
for(const [path,id,expected,commanderCount,mainCount,sideCount] of [
 [upgradesPath,'UpgradesUnleashed_NEC','a8ee9a18c614a472e3f46f96942ba91afadd28f4fdeb4e8e3e1e1431e11a2d24',1,99,0],
 [turtlesPath,'TurtlePower_TMC','e0cf1af2d27deca968785daab14717a7b2e3cee27551cc173091d0ab69fdd2f3',1,99,0],
 [challengerPath,'CounterSurge_Q01','99aa23e1c8765aecca8316410b459514c86ae00124b3b67fa8eac94890d41356',0,60,15]
]){
 const bytes=await readExact(path,expected),product=catalog.products.find(p=>p.id===id);
 assert(product,'Product missing from catalog: '+id);
 const deck=readPreconDeck(JSON.parse(bytes),product);
 assert.equal(deck.counts.commander,commanderCount);assert.equal(deck.counts.mainBoard,mainCount);assert.equal(deck.counts.sideBoard,sideCount);
 assert.equal(deck.deckCardCount,mainCount+commanderCount);assert.equal(deck.playStatus,'unverified');
 samples.push({id,name:deck.name,dataUrl:deck.dataUrl,sourceUrl:deck.sourceUrl,sha256:sha(bytes),bytes:bytes.length,
  counts:deck.counts,commanders:deck.zones.commander.map(c=>({name:c.name,quantity:c.quantity,finish:c.finish,scryfallId:c.scryfallId})),
  deckCardCount:deck.deckCardCount,playStatus:deck.playStatus});
}
const sourceFiles={};
for(const name of ['mtgjson-precons.mjs','test-mtgjson-precons.mjs','verify-precon-sources.mjs'])
 sourceFiles[name]=sha(await readFile(new URL(name,import.meta.url)));
const report={checkedAt:new Date().toISOString(),sourceUrl:'https://mtgjson.com/api/v5/DeckList.json',
 indexSha256:sha(index),indexBytes:index.length,meta:catalog.meta,products:catalog.products.length,
 commanderDeckTypeProducts:catalog.products.filter(p=>p.productType==='Commander Deck').length,samples,sourceFiles};
await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({products:report.products,samples:samples.map(s=>({id:s.id,counts:s.counts})),outputPath},null,2));
