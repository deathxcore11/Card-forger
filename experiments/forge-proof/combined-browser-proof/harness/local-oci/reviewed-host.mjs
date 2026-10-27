// LOCAL_TEST_NOT_DEPLOYABLE. Hash-pinned relocation, never an unverified plugin.
import assert from 'node:assert/strict';import {readFile,lstat} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {sha256} from './oci-identity.mjs';
const expectedManifest='a348d6eaa6afe18e2eeb0acdca60ff5b3de3fd14056ffa3c8a905edab3b6474b';
const candidateInput=process.env.FORGE_COMBINED_CANDIDATE_ROOT;
assert(typeof candidateInput==='string'&&candidateInput.trim().length>0,'Explicit FORGE_COMBINED_CANDIDATE_ROOT is required');
export const reviewedCandidateRoot=path.resolve(candidateInput);
export const reviewedHostRoot=path.join(reviewedCandidateRoot,'host');
const manifestPath=path.join(reviewedCandidateRoot,'HOST-SHA256.json');const st=await lstat(manifestPath);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=1024*1024,'Regular reviewed host inventory required');
const bytes=await readFile(manifestPath);assert(sha256(bytes)===expectedManifest,'Reviewed host inventory identity mismatch');
const inventory=JSON.parse(bytes);
for(const [relative,expected]of Object.entries(inventory)){
 assert(/^[A-Za-z0-9_./-]+$/.test(relative)&&!relative.startsWith('/')&&!relative.split('/').includes('..'),'Unsafe reviewed host path');
 const file=path.join(reviewedHostRoot,relative),info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=4*1024*1024,'Regular reviewed host source required');assert(sha256(await readFile(file))===expected,'Reviewed host file hash mismatch');
}
const release=await import(pathToFileURL(path.join(reviewedHostRoot,'src/release-policy.mjs')));
const transport=await import(pathToFileURL(path.join(reviewedHostRoot,'src/policy.mjs')));
const native=await import(pathToFileURL(path.join(reviewedHostRoot,'src/native-adapter.mjs')));
export const {ENGINE_REVISION,AI_PATCHSET_VERSION,AI_PATCHSET_SHA256,AI_CLASS_SET_SHA256,EXPECTED_RULES,selectedPolicy}=release;
export const {digest,NATIVE_SCHEMA,boundedJSON}=transport;
export const existingNativeTransport=native.nativeAdapter;

export const bootstrapTransport=existingNativeTransport({});
