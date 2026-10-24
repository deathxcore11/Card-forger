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
export const CARD_NAMES=['Head Games','Ninja of the Deep Hours','Moon-Circuit Hacker','Ornithopter','Island','Plains','Swamp','Mountain','Forest','Raise the Alarm','Krenko, Mob Boss','Parallel Lives','Doubling Season','Sprout Swarm','Basalt Monolith','Power Artifact','Lightning Bolt','Counterspell','Satoru Umezawa','Grizzly Bears'];
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const RECEIPT_SCHEMA_VERSION=1;
const FIXTURE_PATH='crates/engine/tests/fixtures/integration_cards.json.gz';
const git=(source,args,encoding='utf8')=>execFileSync('git',['-C',source,...args],{encoding,maxBuffer:32*1024*1024});
function receiptShape(receipt){
 assert(receipt&&typeof receipt==='object'&&!Array.isArray(receipt),'local research build receipt must be an object');
 assert.equal(receipt.schemaVersion,RECEIPT_SCHEMA_VERSION,'unsupported local research build receipt schema');
 assert.equal(receipt.upstreamCommit,PIN,'local research build receipt must retain the original upstream base');
 assert(typeof receipt.buildIdentity==='string'&&receipt.buildIdentity.trim().length>0&&receipt.buildIdentity.length<=200&&!/[\u0000-\u001f\u007f]/.test(receipt.buildIdentity),'local research build receipt requires an explicit buildIdentity');
 for(const key of ['sourceCommit','sourceTree'])assert(typeof receipt[key]==='string'&&/^[0-9a-f]{40}$/.test(receipt[key]),'invalid local research build receipt '+key);
 for(const key of ['sourceDiffSha256','glueSha256','wasmSha256','integrationFixtureGzipSha256'])assert(typeof receipt[key]==='string'&&/^[0-9a-f]{64}$/.test(receipt[key]),'invalid local research build receipt '+key);
 assert.equal(receipt.integrationFixtureGzipSha256,INPUT_HASHES.integrationFixtureGzip,'local research builds must retain the pinned unchanged integration fixture');
 return receipt;
}
export async function loadMechanicsInputs(){
 assert(process.env.CARDSTASHY_PHASE_PKG&&process.env.CARDSTASHY_PHASE_SOURCE,'Set exact CARDSTASHY_PHASE_PKG and CARDSTASHY_PHASE_SOURCE; see README.md.');
 const pkg=resolve(process.env.CARDSTASHY_PHASE_PKG),source=resolve(process.env.CARDSTASHY_PHASE_SOURCE);
 // No alternate-runtime bypass: a local build is admitted only by an explicit
 // receipt whose source/diff/fixture and executable bytes all verify below.
 const hasReceipt=Object.hasOwn(process.env,'CARDSTASHY_PHASE_BUILD_RECEIPT');
 let receipt=null,receiptSha256=null;
 if(hasReceipt){
  const path=process.env.CARDSTASHY_PHASE_BUILD_RECEIPT;
  assert(typeof path==='string'&&path.trim().length>0,'CARDSTASHY_PHASE_BUILD_RECEIPT must identify a receipt file');
  const bytes=await readFile(resolve(path));receiptSha256=sha(bytes);
  try{receipt=receiptShape(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch(error){throw new Error('Invalid local research build receipt: '+error.message,{cause:error});}
 }
 const sourceCommit=git(source,['rev-parse','HEAD']).trim();
 if(!hasReceipt)assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),PIN,'source checkout must match pinned revision');
 assert.equal(git(source,['status','--porcelain=v1','--untracked-files=all']).trim(),'','source checkout must be clean before mechanics verification');
 const sourceTree=git(source,['rev-parse','HEAD^{tree}']).trim();
 let sourceDiffSha256=null;
 if(receipt){
  assert.equal(sourceCommit,receipt.sourceCommit,'receipt sourceCommit does not match source HEAD');
  assert.equal(sourceTree,receipt.sourceTree,'receipt sourceTree does not match source HEAD tree');
  assert.doesNotThrow(()=>git(source,['merge-base','--is-ancestor',PIN,'HEAD']),'local research source must descend from the pinned upstream base');
  // This exact command defines the receipt's binary-diff digest. Disable
  // external diff/textconv so neither custom tools nor presentation alter it.
  sourceDiffSha256=sha(git(source,['-c','core.quotePath=true','diff','--binary','--full-index','--no-color','--no-ext-diff','--no-textconv',PIN,'HEAD','--'],null));
  assert.equal(sourceDiffSha256,receipt.sourceDiffSha256,'receipt sourceDiffSha256 does not match the exact upstream-to-HEAD binary diff');
 }
 const [glue,wasm,gzip]=await Promise.all([readFile(resolve(pkg,'engine_wasm.js')),readFile(resolve(pkg,'engine_wasm_bg.wasm')),readFile(resolve(source,FIXTURE_PATH))]);
 if(receipt){assert.equal(sha(glue),receipt.glueSha256,'local research glue checksum mismatch');assert.equal(sha(wasm),receipt.wasmSha256,'local research WASM checksum mismatch');}
 else{assert.equal(sha(glue),INPUT_HASHES.glue);assert.equal(sha(wasm),INPUT_HASHES.wasm);}
 assert.equal(sha(gzip),INPUT_HASHES.integrationFixtureGzip);
 const catalog=JSON.parse(gunzipSync(gzip));assert.equal(Object.keys(catalog).length,6137);
 const subset=Object.fromEntries(CARD_NAMES.map(name=>{const key=name.toLowerCase();assert(catalog[key],'missing upstream card '+name);return [key,catalog[key]];}));
 const cardsJson=JSON.stringify(subset);
 assert.equal(git(source,['rev-parse','HEAD']).trim(),sourceCommit,'source HEAD changed while mechanics inputs were loading');
 assert.equal(git(source,['status','--porcelain=v1','--untracked-files=all']).trim(),'','source checkout changed while mechanics inputs were loading');
 return {pkg,wasm,cardsJson,provenance:{upstreamCommit:PIN,runtimeOrigin:receipt?'local-research-build':'original-upstream-artifact',
  buildIdentity:receipt?receipt.buildIdentity:'upstream-run-40129115223-artifact-12574954346',sourceCommit,sourceTree,sourceDiffSha256,buildReceiptSha256:receiptSha256,
  glue:sha(glue),wasm:sha(wasm),integrationFixtureGzip:INPUT_HASHES.integrationFixtureGzip,
  fixtureCardCount:6137,loadedNames:CARD_NAMES,subsetSha256:sha(cardsJson),subsetBytes:Buffer.byteLength(cardsJson)}};
}
export async function bootMechanics(){
 const inputs=await loadMechanicsInputs();let networkCalls=0;
 globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden in mechanics diagnostic.');};
 const engine=await import(pathToFileURL(resolve(inputs.pkg,'engine_wasm.js')));
 await engine.default({module_or_path:inputs.wasm});assert.equal(engine.load_card_database(inputs.cardsJson),CARD_NAMES.length);
 return {engine,provenance:inputs.provenance,networkCalls:()=>networkCalls};
}
