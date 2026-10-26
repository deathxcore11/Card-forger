// Private per-job ownership, never a release identity or registry attestation.
import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {lstat,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {PINS,SCOPE} from './pins.mjs';
export const IMAGE_OWNERSHIP_LABEL='io.cardstashy.local-test.job-nonce';
export const IMAGE_OWNERSHIP_SCHEMA='cardstashy.local-image-ownership.v1';
export function validateImageOwnershipLedger(value){
 assert(value?.schema===IMAGE_OWNERSHIP_SCHEMA&&value.scope===SCOPE&&value.deployable===false&&value.registryPublication===false&&value.createdBeforeBuild===true&&value.labelKey===IMAGE_OWNERSHIP_LABEL&&/^[a-f0-9]{64}$/.test(value.jobNonce)&&!/^0+$/.test(value.jobNonce)&&value.nativeSourceSHA256===PINS.nativeSourceSha256&&value.nativeManifestSHA256===PINS.nativeManifestSha256&&value.contextManifestSHA256===PINS.contextManifestSha256,'Invalid private image ownership ledger');return value;
}
export async function createImageOwnershipLedger(root){
 const value={schema:IMAGE_OWNERSHIP_SCHEMA,scope:SCOPE,deployable:false,registryPublication:false,createdBeforeBuild:true,labelKey:IMAGE_OWNERSHIP_LABEL,jobNonce:randomBytes(32).toString('hex'),nativeSourceSHA256:PINS.nativeSourceSha256,nativeManifestSHA256:PINS.nativeManifestSha256,contextManifestSHA256:PINS.contextManifestSha256};
 await writeFile(path.join(root,'image-ownership.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return value;
}
export async function readImageOwnershipLedger(root){
 const file=path.join(root,'image-ownership.json'),st=await lstat(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=4096,'Bounded regular ownership ledger required');return validateImageOwnershipLedger(JSON.parse(await readFile(file,'utf8')));
}
export function assertImageOwnership(ledger,inspect,imageId){
 validateImageOwnershipLedger(ledger);assert(/^sha256:[a-f0-9]{64}$/.test(imageId)&&inspect?.Id===imageId&&inspect.JobNonce===ledger.jobNonce,'Image is not owned by this exact test job');return true;
}
