// Remove only this exact job-nonce-owned local image, after all owned containers.
import assert from 'node:assert/strict';import {lstat,readFile} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {command} from './image-stages/command.mjs';
import {readImageOwnershipLedger,assertImageOwnership} from './image-stages/image-ownership.mjs';
const SOURCE='b817b4f24702e9929378f9211492d4cc6e445803f62ad0e6dbc12947e543303b',MANIFEST='1bb177ec2b54840e0e26a3159e30ee75007bf1d5911798ceb9046df7852c1ca3';
export async function cleanupImage(root,{run=command}={}){
 const deadline=Date.now()+12000,signal=AbortSignal.timeout(12000);
 const boundedRun=(args,maxOutputBytes)=>{const left=deadline-Date.now();assert(left>0,'Image cleanup deadline');return run('docker',args,{timeoutMs:Math.min(3500,left),signal,maxOutputBytes});};
 let ledger=null,id=null;
 try{ledger=await readImageOwnershipLedger(root);}catch(e){if(e.code!=='ENOENT')throw e;}
 try{const p=path.join(root,'image.id'),s=await lstat(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=256);id=(await readFile(p,'utf8')).trim();assert(/^sha256:[a-f0-9]{64}$/.test(id),'Invalid owned image receipt');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!ledger&&!id)return {confirmed:true,createdImage:false};
 // A timed-out build may still finish inside the daemon. Preserve the private
 // ledger and fail closed until runner teardown; one absent listing is no proof.
 if(ledger&&!id)return {confirmed:false,createdImage:null,buildOutcome:'uncertain'};
 assert(ledger,'Image ID without its pre-build job ownership ledger');
 const absent=async()=>{const r=await boundedRun(['image','ls','--all','--no-trunc','--quiet'],1024*1024);const lines=r.stdout.toString().trim().split(/\r?\n/).filter(Boolean);assert(lines.every(x=>/^sha256:[a-f0-9]{64}$/.test(x)),'Unexpected image listing');return !lines.includes(id);};
 const format='{ "Id":{{json .Id}},"source":{{json (index .Config.Labels "org.opencontainers.image.revision")}},"manifest":{{json (index .Config.Labels "org.cardstashy.native-manifest-sha256")}},"JobNonce":{{json (index .Config.Labels "io.cardstashy.local-test.job-nonce")}}}';
 let inspected;try{inspected=await boundedRun(['image','inspect',id,'--format',format],8192);}catch{return {confirmed:await absent(),createdImage:true,imageId:id};}
 const image=JSON.parse(inspected.stdout.toString());assertImageOwnership(ledger,image,id);assert(image.source===SOURCE&&image.manifest===MANIFEST,'Local image source mismatch');
 await boundedRun(['image','rm',id],8192);
 return {confirmed:await absent(),createdImage:true,imageId:id};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const r=await cleanupImage(path.resolve(process.argv[2]));console.log(JSON.stringify({scope:'LOCAL_TEST_NOT_DEPLOYABLE',...r}));if(!r.confirmed)process.exitCode=1;}catch{console.error('Local image cleanup unconfirmed');process.exitCode=1;}
}
