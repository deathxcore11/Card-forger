// Load the actual shipped runtime and unmodified compiled records for diagnostics.
// No network, generated card definitions, or alternate executable is accepted.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validateRuntimeManifest,validateRulesManifest,RUNTIME_IDENTITY,RULES_IDENTITY} from './runtime-assets.mjs';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function bootAcceptance(names){
 const root=new URL('./runtime/a86578b23adcd26c/',import.meta.url);
 const manifest=validateRuntimeManifest(JSON.parse(await readFile(new URL('manifest.json',root),'utf8')));
 validateRulesManifest(manifest.cardDatabase);
 const chunks=[];
 for(const c of manifest.chunks){const bytes=await readFile(new URL(c.path,root));assert.equal(bytes.length,c.bytes);assert.equal(digest(bytes),c.sha256);chunks.push(bytes);}
 const archive=Buffer.concat(chunks);assert.equal(digest(archive),manifest.compressedSha256);
 const wasm=gunzipSync(archive,{maxOutputLength:RUNTIME_IDENTITY.wasmBytes});assert.equal(wasm.length,RUNTIME_IDENTITY.wasmBytes);assert.equal(digest(wasm),RUNTIME_IDENTITY.wasmSha256);
 const glue=await readFile(new URL(manifest.glue.path,root));assert.equal(digest(glue),RUNTIME_IDENTITY.glueSha256);
 const rules=await readFile(new URL(RULES_IDENTITY.path,root));assert.equal(digest(rules),RULES_IDENTITY.sha256);
 const decoded=gunzipSync(rules,{maxOutputLength:RULES_IDENTITY.decodedBytes});assert.equal(digest(decoded),RULES_IDENTITY.decodedSha256);
 const catalog=JSON.parse(decoded);assert.equal(Object.keys(catalog).length,RULES_IDENTITY.entries);
 const subset=Object.fromEntries(names.map(name=>{const key=name.toLowerCase();assert(catalog[key],'Missing shipped compiled card: '+name);return [key,catalog[key]];}));
 globalThis.fetch=async()=>{throw Error('Network forbidden in gameplay acceptance');};
 const engine=await import(new URL(manifest.glue.path,root));await engine.default({module_or_path:wasm});
 assert.equal(engine.load_card_database(JSON.stringify(subset)),names.length);
 return {engine,catalog,provenance:{appBaseCommit:'2af11c9a1326e0db75b875d9c122e3dea01055d7',runtimeSourceCommit:manifest.sourceCommit,wasmSha256:RUNTIME_IDENTITY.wasmSha256,rulesSha256:RULES_IDENTITY.sha256,loadedNames:names,subsetSha256:digest(JSON.stringify(subset))}};
}
