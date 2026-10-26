// LOCAL_TEST_NOT_DEPLOYABLE. Explicit private-work ledger cleanup, never global prune.
import assert from 'node:assert/strict';import {lstat,readFile,readdir,rm,writeFile,rename} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {SCOPE} from './oci-identity.mjs';
const FORMAT='{"Id":{{json .Id}},"Image":{{json .Image}},"Running":{{json .State.Running}},"Scope":{{json (index .Config.Labels "org.cardstashy.scope")}},"Allocation":{{json (index .Config.Labels "org.cardstashy.local-allocation")}}}';
export async function cleanupOwnedLedger(ledgerPath,{execDocker:run}={}){
 run??=(await import('./docker-provider.mjs')).execDocker;
 const st=await lstat(ledgerPath);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=16384,'Bounded owned ledger required');
 const record=JSON.parse(await readFile(ledgerPath,'utf8')),directory=path.dirname(path.resolve(ledgerPath));
 assert(record.schema==='cardstashy.local-owned-container.v1'&&record.scope===SCOPE&&/^[a-zA-Z0-9_-]{1,80}$/.test(record.id)&&path.basename(directory)===record.id&&record.name==='cardstashy-local-test-'+record.id&&/^sha256:[a-f0-9]{64}$/.test(record.imageId)&&(!record.containerId||/^[a-f0-9]{64}$/.test(record.containerId)),'Invalid owned-container ledger');
 let target=record.containerId||record.name;
 async function inspect(){const r=await run(['inspect','--type','container','--format',FORMAT,target],{timeoutMs:5000,maxOutputBytes:16384});if(r.code!==0){if(/No such (object|container)/i.test(r.stderr?.toString()||''))return null;throw Error('owned_cleanup_inspection_uncertain');}const value=JSON.parse(r.stdout.toString());assert(/^[a-f0-9]{64}$/.test(value.Id)&&(!record.containerId||value.Id===record.containerId)&&value.Image===record.imageId&&value.Scope===SCOPE&&value.Allocation===record.id,'Owned-container identity mismatch; cleanup refused');return value;}
 let value=await inspect();
 // Missing is not final if the create CLI never acknowledged daemon completion.
 // In particular, never discard a planned ledger after one absent lookup.
 assert(value||((record.createAcknowledged===true||record.status==='observed')&&/^[a-f0-9]{64}$/.test(record.containerId)),'owned_create_completion_unconfirmed');
 if(value){
  // Persist the actual daemon allocation before any destructive operation.
  // A later invocation can target only this ID, not a reusable name.
  record.containerId=value.Id;record.status='observed';
  const temporary=ledgerPath+'.new';await writeFile(temporary,JSON.stringify(record)+'\n',{mode:0o600});await rename(temporary,ledgerPath);target=value.Id;
  if(value.Running)await run(['stop','--time','10',value.Id],{timeoutMs:16000,maxOutputBytes:1024}).catch(()=>{});
  value=await inspect();
  if(value){const r=await run(['rm','--force',value.Id],{timeoutMs:7000,maxOutputBytes:1024});assert(r.code===0,'Owned-container removal failed');}
  assert(await inspect()===null,'Owned-container removal unconfirmed');
 }
 await rm(directory,{recursive:true,force:true});return {scope:SCOPE,confirmed:true,privateInputRemoved:true};
}
export async function cleanupOwnedRoot(root,{execDocker:run}={}){
 root=path.resolve(root);const found=[];
 async function scan(dir,depth){assert(depth<=5&&found.length<=20,'Owned cleanup discovery bound exceeded');const st=await lstat(dir);assert(st.isDirectory()&&!st.isSymbolicLink(),'Private cleanup root must be a directory');for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isFile()&&e.name==='container-ledger.json')found.push(p);else if(e.isDirectory()&&depth<5)await scan(p,depth+1);}}
 await scan(root,0);let removed=0,unresolved=0;for(const p of found){try{await cleanupOwnedLedger(p,{execDocker:run});removed++;}catch{unresolved++;}}
 return {scope:SCOPE,ledgersFound:found.length,confirmedRemoved:removed,unresolved,confirmed:unresolved===0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{assert(process.argv.length===3,'One explicit private work root required');const result=await cleanupOwnedRoot(process.argv[2]);console.log(JSON.stringify(result));if(!result.confirmed)process.exitCode=1;}catch{console.error('LOCAL_TEST_OWNED_CLEANUP_UNCONFIRMED');process.exitCode=1;}
}
