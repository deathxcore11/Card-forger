import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm}from 'node:fs/promises';import {tmpdir}from 'node:os';import path from 'node:path';import {cleanupImage}from './cleanup-image.mjs';import {createImageOwnershipLedger}from './image-stages/image-ownership.mjs';
const id='sha256:'+'b'.repeat(64),SOURCE='7ffed6c3cf97a99bdf24579f4ac5f4950df173bd277aa76cbe35ca6da25819b2',MANIFEST='e883597dc9e4dcc811281a1e18cb5b0710f55745bb72c3b3ad898795176298a4';
async function fixture(fn){const root=await mkdtemp(path.join(tmpdir(),'image-cleanup-test-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('no build started permits empty cleanup',()=>fixture(async root=>assert.deepEqual(await cleanupImage(root),{confirmed:true,createdImage:false})));
test('prebuild ledger but missing ID is unresolved daemon outcome',()=>fixture(async root=>{await createImageOwnershipLedger(root);const r=await cleanupImage(root,{run:()=>{throw Error('must not guess');}});assert.equal(r.confirmed,false);assert.equal(r.buildOutcome,'uncertain');}));
test('ID without ledger never deletes',()=>fixture(async root=>{await writeFile(path.join(root,'image.id'),id);await assert.rejects(cleanupImage(root));}));
test('actual inspect format produces complete JSON before owned image removal',()=>fixture(async root=>{
 const ledger=await createImageOwnershipLedger(root);await writeFile(path.join(root,'image.id'),id);const calls=[];
 // Render the exact bounded format passed to Docker, rather than substituting
 // a ready-made JSON response that would hide a broken format string.
 const values=new Map([['.Id',id],['(index .Config.Labels "org.opencontainers.image.revision")',SOURCE],['(index .Config.Labels "org.cardstashy.native-manifest-sha256")',MANIFEST],['(index .Config.Labels "io.cardstashy.local-test.job-nonce")',ledger.jobNonce]]);
 const run=async(_file,args)=>{calls.push(args);if(args[1]==='inspect'){
  const format=args[args.indexOf('--format')+1],rendered=format.replace(/\{\{json (.*?)\}\}/g,(_match,expression)=>{assert(values.has(expression),'Unexpected inspect expression');return JSON.stringify(values.get(expression));});
  assert(!rendered.includes('{{'),'Unrendered template');return {stdout:Buffer.from(rendered)};
 }if(args[1]==='rm'||args[1]==='ls')return {stdout:Buffer.alloc(0)};throw Error('Unexpected command');};
 assert.equal((await cleanupImage(root,{run})).confirmed,true);assert(calls.some(a=>a.join(' ')==='image rm '+id));
}));
for(const kind of ['owned','wrong-nonce','absent','still-present','daemon-unavailable'])test('exact ownership cleanup '+kind,()=>fixture(async root=>{
 const ledger=await createImageOwnershipLedger(root);await writeFile(path.join(root,'image.id'),id);const calls=[];
 const run=async(_file,args)=>{calls.push(args);if(kind==='daemon-unavailable')throw Error('unavailable');if(args[1]==='inspect'){if(kind==='absent')throw Error('not found');return {stdout:Buffer.from(JSON.stringify({Id:id,source:SOURCE,manifest:MANIFEST,JobNonce:kind==='wrong-nonce'?'c'.repeat(64):ledger.jobNonce}))};}if(args[1]==='rm')return {stdout:Buffer.alloc(0)};if(args[1]==='ls')return {stdout:Buffer.from(kind==='still-present'?id+'\n':'')};throw Error('unexpected');};
 if(['wrong-nonce','daemon-unavailable'].includes(kind))await assert.rejects(cleanupImage(root,{run}));else assert.equal((await cleanupImage(root,{run})).confirmed,kind!=='still-present');
 if(['wrong-nonce','daemon-unavailable','absent'].includes(kind))assert(!calls.some(a=>a[1]==='rm'));else assert(calls.some(a=>a.join(' ')==='image rm '+id));
}));
