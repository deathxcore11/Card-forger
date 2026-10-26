// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const hostRoot = process.env.HOST_SOURCE_ROOT || join(root, 'host');
const toolsRoot = process.env.RUNTIME_TOOLS_ROOT || join(root, 'runtime-tools');
assert(isAbsolute(hostRoot), 'HOST_SOURCE_ROOT must be an absolute host-tree path');
assert(isAbsolute(toolsRoot), 'RUNTIME_TOOLS_ROOT must be an absolute dependency-tree path');
const servicePath = join(hostRoot, 'src/service-core.mjs');
const localRequire = createRequire(join(toolsRoot, 'package.json'));
const { Miniflare, convertV4MiniflareOptions } = localRequire('miniflare');
const { build } = localRequire('esbuild');
const result = await build({ entryPoints: [root + 'runtime-tests/alarm-worker.mjs'], bundle: true,
  format: 'esm', platform: 'browser', external: ['cloudflare:workers'], write: false,
  plugins: [{ name: 'exact-host-source', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/host\/src\/service-core\.mjs$/ }, () => ({ path: servicePath }));
  } }],
});
let outboundCalls = 0;
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: result.outputFiles[0].text, compatibilityDate: '2026-10-01',
  durableObjects: { CASES: { className: 'SQLiteAlarmCase', useSQLite: true } },
  outboundService: async () => { outboundCalls++; throw Error('outbound network prohibited in this local test'); },
  cf: false,
}));
const results = [];
const call = async path => {
  const response = await mf.dispatchFetch('https://local.test' + path);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
try {
  for (const name of ['invalid-preserves-earlier', 'new-wakeup', 'advance-maintenance',
    'valid-preserves-equal', 'transaction-rollback']) {
    const row = await call('/case?case=' + name); assert.equal(row.pass, true); results.push(row);
  }
  await call('/race/start');
  let phase;
  for (let attempt = 0; attempt < 20; attempt++) {
    phase = (await call('/race/status')).phase;
    if (phase === 'paused-before-housekeeping') break;
  }
  assert.equal(phase, 'paused-before-housekeeping');
  await call('/race/create');
  const race = await call('/race/resume'); assert.equal(race.pass, true); results.push(race);
  assert.equal(outboundCalls, 0, 'no network or account lookup');
  const source = await readFile(servicePath);
  const evidence = { schema: 'cardstashy.local-workerd-alarm-review.v1',
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    versions: Object.fromEntries(['wrangler', 'miniflare', 'workerd', 'esbuild'].map(name =>
      [name, localRequire(name + '/package.json').version])),
    cases: results, outboundCalls, providerCalls: 0, accountCalls: 0,
    limitations: ['Synthetic local verifier and match binding.', 'No provider, deployment, browser, gameplay or live account proof.',
      'Maintenance interleaving uses distinct actual DO fetch events with a deterministic test pause.',
      'Remote timeout behavior remains covered by the separate Node regression tests.'] };
  await writeFile(root + 'runtime-tests/RESULTS.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally { await mf.dispose(); }
