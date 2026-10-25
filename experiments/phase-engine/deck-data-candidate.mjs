// DECK-003: extract only absent definitions from a pinned upstream export.
// This produces experimental fixtures, never a production database or allowlist.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {digest} from './acceptance-inputs.mjs';
export const SOURCE={
 url:'https://data.phase-rs.dev/card-data-84d5fd2af84e2f12.json',
 sha256:'84d5fd2af84e2f125b740eeb05637785b2e8df26d34e41a2cd628697dae30513',
 bytes:100070783,entries:36037,
 metadata:{generated_at:'2026-10-24T14:06:33Z',commit:'09c286c0ff45011bcbeb9742848a95dac92b5466',mtgjson_version:'5.3.0+20261023',mtgjson_date:'2026-10-23',data_hash:'84d5fd2af84e2f12',data_filename:'card-data-84d5fd2af84e2f12.json'},
 shippedUpstreamBase:'71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234',
 sourceRelationship:'Export source is 21 commits behind the shipped upstream base; candidate compatibility requires execution, not an assumption of identical schemas.'
};
const path=process.argv[2];assert(path,'Usage: node experiments/phase-engine/deck-data-candidate.mjs /path/to/card-data-84d5fd2af84e2f12.json');
const raw=await readFile(resolve(path));assert.equal(raw.length,SOURCE.bytes);assert.equal(digest(raw),SOURCE.sha256);
const upstream=JSON.parse(raw);assert.equal(Object.keys(upstream).length,SOURCE.entries);
const shippedBytes=await readFile(new URL('./runtime/a86578b23adcd26c/card-rules.bin',import.meta.url));
assert.equal(digest(shippedBytes),'0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9');
const shipped=JSON.parse(gunzipSync(shippedBytes));assert.equal(Object.keys(shipped).length,6137);
const deckBytes=await readFile(new URL('./fixtures/deck-001/tramplesaurus-rex.json',import.meta.url)),deck=JSON.parse(deckBytes);
assert.equal(deck.cards.reduce((n,c)=>n+c.qty,0),100);assert.equal(deck.cards.length,69);
const additions={},rows=[];
for(const card of deck.cards){
 const key=card.name.toLowerCase(),present=Object.hasOwn(shipped,key),record=present?shipped[key]:upstream[key];
 assert(record,'Missing upstream definition: '+card.name);assert.equal(record.name,card.name);
 if(!present)additions[key]=record;
 rows.push({name:card.name,qty:card.qty,source:present?'unchanged-shipped':'candidate-upstream',recordSha256:digest(JSON.stringify(record)),oracleId:record.scryfall_oracle_id??null,explicitUnimplemented:JSON.stringify(record).includes('Unimplemented'),parseWarnings:record.parse_warnings??[],mechanicsStatus:'NOT TESTED',humanStatus:'NOT TESTED',cpuStatus:'NOT TESTED'});
}
assert.equal(Object.keys(additions).length,44);assert(rows.every(r=>!r.explicitUnimplemented));
const candidate=JSON.stringify(additions,null,2)+'\n';
const correctionBytes=await readFile(new URL('./fixtures/deck-003/loot-correction.json',import.meta.url)),correction=JSON.parse(correctionBytes),corrected=structuredClone(additions),loot=corrected[correction.name.toLowerCase()];
assert.equal(digest(JSON.stringify(loot)),correction.sourceRecordSha256);assert.equal(loot.abilities[0].effect.type,'Dig');
assert.deepEqual(Object.keys(correction.correction).sort(),['abilities[0].effect.rest_order','abilities[0].effect.reveal']);
const reveal=correction.correction['abilities[0].effect.reveal'],order=correction.correction['abilities[0].effect.rest_order'];
assert.deepEqual(reveal,{before:true,after:false});assert.deepEqual(order,{before:'ABSENT',after:'random'});
assert.equal(loot.abilities[0].effect.reveal,reveal.before);assert(!Object.hasOwn(loot.abilities[0].effect,'rest_order'));
loot.abilities[0].effect.reveal=reveal.after;loot.abilities[0].effect.rest_order=order.after;
const correctedCandidate=JSON.stringify(corrected,null,2)+'\n';
const receipt={schema:1,task:'DECK-003',taskBase:'d7a1a91b8a9a4f36b57076ab539ef102248379f7',integrationInspected:'d81a0a14f3f34cf64fc0156abf495fab590263b6',source:SOURCE,shippedDatabaseSha256:digest(shippedBytes),exactDeckFixtureSha256:digest(deckBytes),candidateFile:'tramplesaurus-additions.json',candidateSha256:digest(candidate),correctedCandidateFile:'tramplesaurus-additions.corrected.json',correctedCandidateSha256:digest(correctedCandidate),correctionSha256:digest(correctionBytes),correctedLootRecordSha256:digest(JSON.stringify(loot)),addedDefinitions:44,preservedShippedDefinitions:25,sourceFileSha256:digest(await readFile(new URL(import.meta.url))),rows,admission:'UNSUPPORTED until complete mechanic, human/CPU and combined application validation; fixture presence alone is not admission.'};
const out=resolve(process.env.CARDSTASHY_DECK_DATA_OUTPUT||'experiments/phase-engine/fixtures/deck-003');await mkdir(out,{recursive:true});
await writeFile(resolve(out,receipt.candidateFile),candidate);await writeFile(resolve(out,receipt.correctedCandidateFile),correctedCandidate);await writeFile(resolve(out,'source-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({addedDefinitions:44,preservedShippedDefinitions:25,candidateSha256:receipt.candidateSha256,correctedCandidateSha256:receipt.correctedCandidateSha256,productionChanged:false}));
