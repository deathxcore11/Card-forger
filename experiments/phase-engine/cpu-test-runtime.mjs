// CPU-001: acceptance evidence against the shipped engine, not a difficulty claim.
// Engineered positions use unchanged compiled cards. No engine build or network.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {RUNTIME_IDENTITY,RULES_IDENTITY,validateRuntimeManifest,validateRulesManifest} from './runtime-assets.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const here=new URL('./',import.meta.url),runtime=new URL('./runtime/a86578b23adcd26c/',here);
const manifest=validateRuntimeManifest(JSON.parse(await readFile(new URL('manifest.json',runtime))));
validateRulesManifest(manifest.cardDatabase);
const compressed=Buffer.concat(await Promise.all(manifest.chunks.map(async c=>{
 const b=await readFile(new URL(c.path,runtime));assert.equal(b.length,c.bytes);assert.equal(sha(b),c.sha256);return b;
})));
assert.equal(sha(compressed),manifest.compressedSha256);
const wasm=gunzipSync(compressed);assert.equal(wasm.length,RUNTIME_IDENTITY.wasmBytes);assert.equal(sha(wasm),RUNTIME_IDENTITY.wasmSha256);
const glue=await readFile(new URL('engine_wasm.js',runtime));assert.equal(sha(glue),RUNTIME_IDENTITY.glueSha256);
const rules=await readFile(new URL('card-rules.bin',runtime));assert.equal(sha(rules),RULES_IDENTITY.sha256);
const decoded=gunzipSync(rules);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);
const catalog=JSON.parse(decoded),names=['Forest','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Tapestry Warden','Knight of Dawn','Hearthfire Hobgoblin','Feral Abomination','Gifted Aetherborn','Darksteel Myr','Air Elemental','Virulent Emissary'];
const subset=Object.fromEntries(names.map(name=>{assert(catalog[name.toLowerCase()]);return [name.toLowerCase(),catalog[name.toLowerCase()]];}));
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('CPU acceptance forbids network');};
export const e=await import(new URL('engine_wasm.js',runtime));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),names.length);

export {names,sha};
