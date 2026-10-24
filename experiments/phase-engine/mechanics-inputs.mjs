// Research inputs only. All executable card records come unchanged from the
// pinned external upstream fixture; no card data or runtime is distributed here.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const PIN='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234';
export const INPUT_HASHES={
 glue:'47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9',
 wasm:'6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f',
 integrationFixtureGzip:'0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9'};
export const CARD_NAMES=['Head Games','Ninja of the Deep Hours','Moon-Circuit Hacker','Ornithopter','Island','Plains','Swamp','Mountain','Forest','Raise the Alarm','Krenko, Mob Boss','Parallel Lives','Doubling Season','Sprout Swarm','Basalt Monolith','Power Artifact','Lightning Bolt','Counterspell'];
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function loadMechanicsInputs(){
 assert(process.env.CARDSTASHY_PHASE_PKG&&process.env.CARDSTASHY_PHASE_SOURCE,'Set exact CARDSTASHY_PHASE_PKG and CARDSTASHY_PHASE_SOURCE; see README.md.');
 const pkg=resolve(process.env.CARDSTASHY_PHASE_PKG),source=resolve(process.env.CARDSTASHY_PHASE_SOURCE);
 assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),PIN,'source checkout must match pinned revision');
 const [glue,wasm,gzip]=await Promise.all([readFile(resolve(pkg,'engine_wasm.js')),readFile(resolve(pkg,'engine_wasm_bg.wasm')),readFile(resolve(source,'crates/engine/tests/fixtures/integration_cards.json.gz'))]);
 assert.equal(sha(glue),INPUT_HASHES.glue);assert.equal(sha(wasm),INPUT_HASHES.wasm);assert.equal(sha(gzip),INPUT_HASHES.integrationFixtureGzip);
 const catalog=JSON.parse(gunzipSync(gzip));assert.equal(Object.keys(catalog).length,6137);
 const subset=Object.fromEntries(CARD_NAMES.map(name=>{const key=name.toLowerCase();assert(catalog[key],'missing upstream card '+name);return [key,catalog[key]];}));
 const cardsJson=JSON.stringify(subset);
 return {pkg,wasm,cardsJson,provenance:{upstreamCommit:PIN,...INPUT_HASHES,fixtureCardCount:6137,loadedNames:CARD_NAMES,subsetSha256:sha(cardsJson),subsetBytes:Buffer.byteLength(cardsJson)}};
}
export async function bootMechanics(){
 const inputs=await loadMechanicsInputs();let networkCalls=0;
 globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden in mechanics diagnostic.');};
 const engine=await import(pathToFileURL(resolve(inputs.pkg,'engine_wasm.js')));
 await engine.default({module_or_path:inputs.wasm});assert.equal(engine.load_card_database(inputs.cardsJson),CARD_NAMES.length);
 return {engine,provenance:inputs.provenance,networkCalls:()=>networkCalls};
}
