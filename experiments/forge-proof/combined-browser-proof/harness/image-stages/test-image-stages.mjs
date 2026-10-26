import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,writeFile,mkdir,symlink} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {command} from './command.mjs';import {verifyCandidate,buildAndProbe,assertContextInventory} from './build-and-probe.mjs';import {receiptOnlyState} from './probe-image.mjs';import {assertProbeCleanup} from './load-evidence.mjs';import {publicMediumInput} from './public-input.mjs';import {PINS,SCOPE} from './pins.mjs';
import {createImageOwnershipLedger,readImageOwnershipLedger,assertImageOwnership,IMAGE_OWNERSHIP_LABEL} from './image-ownership.mjs';
import {reviewedCandidateRoot} from '../local-oci/reviewed-host.mjs';
assert(process.env.FORGE_COMBINED_CANDIDATE_ROOT,'Explicit reviewed candidate root required for portable tests');
const root=reviewedCandidateRoot;
test('reviewed final source/context/host inputs verify without build',async()=>{const x=await verifyCandidate(root);assert(x.nativeManifestBytes.length>0&&x.hostManifestBytes.length>0);});
test('public input reconstructs exact approved Medium-beta decks',async()=>{const {input}=await publicMediumInput(path.join(root,'ui/fixture-decks.json'));assert.equal(input.difficultyPolicyVersion,PINS.policyVersion);assert.equal(input.humanDeck.name,'Calling All Angels');});
test('receipt capsule drops board, cards, capability and all extra nested data',()=>{
 const s={schema:'x',forgeRevision:'x',status:'running',viewer:0,players:[{cards:'PRIVATE_CANARY'}],token:'PRIVATE_CANARY',initialization:{schema:'y',errors:[],extra:'PRIVATE_CANARY',cpuPolicy:{extra:'PRIVATE_CANARY',aiProfile:'Medium'},rulesData:{extra:'PRIVATE_CANARY',mode:'current'}}};const capsule=receiptOnlyState(s);assert(!JSON.stringify(capsule).includes('PRIVATE_CANARY'));assert.equal(capsule.initialization.cpuPolicy.aiProfile,'Medium');
});
test('probe cleanup requires SAME image/container, graceful exit and input removal',()=>{
 const image='sha256:'+'1'.repeat(64),container='2'.repeat(64),c={scope:SCOPE,imageId:image,containerId:container,confirmed:true,privateInputRemoved:true,removed:true,forced:false,status:'exited',exitCode:0,oomKilled:false,starts:1,destroys:1};assertProbeCleanup(c,image,container);
 for(const [k,v]of Object.entries({imageId:'sha256:'+'3'.repeat(64),containerId:'4'.repeat(64),confirmed:false,privateInputRemoved:false,removed:false,forced:true,status:'running',exitCode:137,oomKilled:true,starts:0,destroys:0}))assert.throws(()=>assertProbeCleanup({...c,[k]:v},image,container),k);
});
test('failed mocked Docker build cannot proceed to image probe',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'image-stage-unit-'));const calls=[];try{
  await assert.rejects(buildAndProbe({candidateRoot:root,privateRoot:path.join(tmp,'work'),fixtureDecksPath:path.join(root,'ui/fixture-decks.json'),run:async(file,args)=>{calls.push({file,args});const ownership=await readImageOwnershipLedger(path.join(tmp,'work'));const labelIndex=args.indexOf('--label');assert(labelIndex>=0);assert.equal(args[labelIndex+1],IMAGE_OWNERSHIP_LABEL+'='+ownership.jobNonce);throw Error('synthetic unit failure');},providerFactory:()=>{throw Error('MUST_NOT_PROBE');}}));
  assert.equal(calls.length,1);assert.equal(calls[0].file,'docker');assert.equal(calls[0].args[0],'build');assert(!calls[0].args.includes('push'));const summary=JSON.parse(await readFile(path.join(tmp,'work/image-summary.json')));assert.equal(summary.result,'failed');assert.equal(summary.registryPublication,false);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('bounded command rejects timeout and never interpolates argument shell text',async()=>{
 const out=await command(process.execPath,['-e','process.stdout.write(process.argv[1])','literal; NOT_A_SHELL'],{timeoutMs:1000});assert.equal(out.stdout.toString(),'literal; NOT_A_SHELL');
 await assert.rejects(command(process.execPath,['-e','setTimeout(()=>{},10000)'],{timeoutMs:20}),/timeout|aborted/);
});

test('image build context rejects extra files and recursively rejects symlinks',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'exact-context-unit-'));try{
  await mkdir(path.join(root,'native'));await writeFile(path.join(root,'native/bridge.java'),'synthetic-source');await writeFile(path.join(root,'CONTEXT-SHA256.json'),'{}');
  const inventory={'native/bridge.java':'unit-placeholder-hash'};await assertContextInventory(root,inventory);
  await writeFile(path.join(root,'native/unreviewed.java'),'UNREVIEWED_SOURCE');await assert.rejects(assertContextInventory(root,inventory),/unmanifested/);await rm(path.join(root,'native/unreviewed.java'));
  await symlink('bridge.java',path.join(root,'native/symlink.java'));await assert.rejects(assertContextInventory(root,inventory),/symlink/);await rm(path.join(root,'native/symlink.java'));
  await symlink('native',path.join(root,'linked-directory'));await assert.rejects(assertContextInventory(root,inventory),/symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('private before-build job nonce gates ownership and cannot select a cache-hit image',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'image-ownership-unit-'));try{
  const ledger=await createImageOwnershipLedger(root),id='sha256:'+'1'.repeat(64);assert.deepEqual(await readImageOwnershipLedger(root),ledger);assertImageOwnership(ledger,{Id:id,JobNonce:ledger.jobNonce},id);
  assert.throws(()=>assertImageOwnership(ledger,{Id:id},id),/not owned/);assert.throws(()=>assertImageOwnership(ledger,{Id:id,JobNonce:'2'.repeat(64)},id),/not owned/);assert.throws(()=>assertImageOwnership({...ledger,jobNonce:undefined},{Id:id},id),/ledger/);await assert.rejects(createImageOwnershipLedger(root),{code:'EEXIST'});
 }finally{await rm(root,{recursive:true,force:true});}
});
