import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Durable Object RPC reaches only methods the deployed classes declare. Every
// namespace call the service core makes must be forwarded by the matching class,
// or it fails only on Cloudflare (the local fixtures call the services directly).
const source = name => readFile(new URL('../src/' + name, import.meta.url), 'utf8');
const declared = (worker, className) => {
  const body = worker.slice(worker.indexOf('class ' + className)).split(/\nexport /)[0];
  return new Set([...body.matchAll(/^  ([A-Za-z]+)\(/gm)].map(m => m[1]));
};
test('every Durable Object RPC used by the service core is declared on its deployed class', async () => {
  const [core, worker] = await Promise.all([source('service-core.mjs'), source('worker.mjs')]);
  for (const [binding, className] of [['FORGE_MATCHES', 'ForgeMatchContainer'], ['FORGE_ADMISSION', 'ForgeAdmission']]) {
    const used = new Set([...core.matchAll(new RegExp(binding + '\\.getByName\\([^)]*\\)\\s*\\.([A-Za-z]+)\\(', 'g'))].map(m => m[1]));
    assert(used.size > 0, binding + ' calls found');
    const methods = declared(worker, className);
    for (const name of used) assert(methods.has(name), `${className} must declare ${name}()`);
  }
});
