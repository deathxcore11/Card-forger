// LOCAL_TEST_NOT_DEPLOYABLE. Read-only OCI verification, not Docker execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createGunzip} from 'node:zlib';
export const SCOPE='LOCAL_TEST_NOT_DEPLOYABLE';
const verifiedIdentities=new WeakSet();
export const IDENTITY_SCHEMA='cardstashy.local-oci-test-identity.v1';
const digestPattern=/^sha256:[a-f0-9]{64}$/;
const manifestMedia='application/vnd.oci.image.manifest.v1+json';
const configMedia='application/vnd.oci.image.config.v1+json';
const maxBlob=8*1024*1024*1024,maxExpanded=12*1024*1024*1024;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function regular(file,maximum){const st=await lstat(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=maximum,'Bounded regular OCI file required');return st;}
async function readJSON(file,maximum,signal){signal?.throwIfAborted();await regular(file,maximum);return JSON.parse(await readFile(file,{encoding:'utf8',signal}));}
async function fileDigest(file,{gzip=false,signal}={}){
 signal?.throwIfAborted();
 const hash=createHash('sha256');let size=0;const input=createReadStream(file,{signal}),stream=gzip?input.pipe(createGunzip()):input;
 if(gzip)input.on('error',error=>stream.destroy(error));
 try{for await(const bytes of stream){signal?.throwIfAborted();size+=bytes.length;assert(size<=maxExpanded,'Expanded OCI layer exceeds bound');hash.update(bytes);}}finally{stream.destroy();input.destroy();}
 signal?.throwIfAborted();return 'sha256:'+hash.digest('hex');
}
export async function verifyLocalOciLayout(root,{manifestDigest,dockerImageInspect,signal}){
 signal?.throwIfAborted();
 assert(digestPattern.test(manifestDigest),'Explicit content-addressed OCI manifest required');
 for(const dir of [root,path.join(root,'blobs'),path.join(root,'blobs','sha256')]){signal?.throwIfAborted();const st=await lstat(dir);assert(st.isDirectory()&&!st.isSymbolicLink(),'OCI directory symlink rejected');}
 assert((await readJSON(path.join(root,'oci-layout'),1024,signal)).imageLayoutVersion==='1.0.0','Unsupported OCI layout');
 const index=await readJSON(path.join(root,'index.json'),1024*1024,signal);
 assert(index.schemaVersion===2&&Array.isArray(index.manifests)&&index.manifests.length<=16,'Invalid OCI index');
 const matches=index.manifests.filter(d=>d.digest===manifestDigest);assert(matches.length===1,'Expected OCI image manifest is not unique in index');
 async function blob(d,maximum=maxBlob){
  signal?.throwIfAborted();
  assert(d&&digestPattern.test(d.digest)&&Number.isSafeInteger(d.size)&&d.size>0&&d.size<=maximum&&!d.urls,'Invalid/external OCI blob descriptor');
  const file=path.join(root,'blobs','sha256',d.digest.slice(7));const st=await regular(file,maximum);
  assert(st.size===d.size&&await fileDigest(file,{signal})===d.digest,'OCI blob digest/size mismatch');return file;
 }
 assert(matches[0].mediaType===manifestMedia,'Selected OCI object is not an image manifest');
 const manifestPath=await blob(matches[0],4*1024*1024),manifest=JSON.parse(await readFile(manifestPath,{encoding:'utf8',signal}));
 assert(manifest.schemaVersion===2&&manifest.mediaType===manifestMedia&&!manifest.subject&&!manifest.artifactType,'Unsupported OCI image manifest');
 assert(manifest.config?.mediaType===configMedia,'Unsupported OCI config');
 const configPath=await blob(manifest.config,4*1024*1024),config=JSON.parse(await readFile(configPath,{encoding:'utf8',signal}));
 assert(config.os==='linux'&&config.architecture==='amd64'&&config.rootfs?.type==='layers','Expected linux/amd64 image');
 assert(Array.isArray(manifest.layers)&&manifest.layers.length>0&&manifest.layers.length<=128&&Array.isArray(config.rootfs.diff_ids)&&config.rootfs.diff_ids.length===manifest.layers.length,'OCI layer list mismatch');
 for(let i=0;i<manifest.layers.length;i++){
  const d=manifest.layers[i];assert(['application/vnd.oci.image.layer.v1.tar','application/vnd.oci.image.layer.v1.tar+gzip'].includes(d.mediaType),'Unsupported OCI layer compression');
  const file=await blob(d);assert(digestPattern.test(config.rootfs.diff_ids[i])&&await fileDigest(file,{gzip:d.mediaType.endsWith('+gzip'),signal})===config.rootfs.diff_ids[i],'OCI uncompressed layer identity mismatch');
 }
 // Docker's local image ID is the config digest, NOT the OCI manifest digest.
 assert(dockerImageInspect?.Id===manifest.config.digest&&dockerImageInspect.Os==='linux'&&dockerImageInspect.Architecture==='amd64','Docker image/config identity mismatch');
 assert(JSON.stringify(dockerImageInspect.RootFS?.Layers)===JSON.stringify(config.rootfs.diff_ids),'Imported Docker layer identity mismatch');
 const identity=Object.freeze({schema:IDENTITY_SCHEMA,scope:SCOPE,deployable:false,registryPublication:false,ociManifestDigest:manifestDigest,dockerImageId:manifest.config.digest,layerDigests:Object.freeze(manifest.layers.map(d=>d.digest)),diffIds:Object.freeze([...config.rootfs.diff_ids]),platform:'linux/amd64'});
 signal?.throwIfAborted();verifiedIdentities.add(identity);return identity;
}
export function assertVerifiedLocalIdentity(identity){
 assert(verifiedIdentities.has(identity)&&identity?.schema===IDENTITY_SCHEMA&&identity.scope===SCOPE&&identity.deployable===false&&identity.registryPublication===false,'Byte-verified local test identity required');return true;
}
export function assertSameContainerImage(identity,inspect){
 assert(verifiedIdentities.has(identity)&&identity?.schema===IDENTITY_SCHEMA&&identity.scope===SCOPE&&identity.deployable===false&&identity.registryPublication===false,'Local test identity required');
 assert(digestPattern.test(identity.ociManifestDigest)&&digestPattern.test(identity.dockerImageId),'Invalid local image digest');
 assert(typeof inspect?.Id==='string'&&/^[a-f0-9]{64}$/.test(inspect.Id)&&inspect.Image===identity.dockerImageId,'Recorded container is not the verified immutable image');
 assert(inspect.HostConfig?.NetworkMode==='none','Proof runtime network must be disabled');
 assert(inspect.HostConfig?.ReadonlyRootfs===true,'Proof runtime image filesystem must be read-only');
 assert(inspect.HostConfig?.Memory===4294967296&&inspect.HostConfig?.MemorySwap===4294967296&&inspect.HostConfig?.NanoCpus===500000000&&inspect.HostConfig?.PidsLimit===256,'Proof runtime limits mismatch');
 assert(inspect.Config?.User==='10001:10001'&&JSON.stringify(inspect.Config?.Entrypoint)===JSON.stringify(['python3','/opt/host-service/bootstrap.py']),'Proof bootstrap/user mismatch');
 return true;
}
