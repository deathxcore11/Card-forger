// Run on the reviewed Docker-capable GitHub runner. The website is not changed here.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ACCOUNT, WORKER, registryImageForProbe, createReleaseConfiguration } from './release-configuration.mjs';
import { reportBuildFailure } from './report-build-failure.mjs';

const host = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(host, '../..');
const harness = path.join(root, 'experiments/forge-proof/combined-browser-proof/harness');
const candidate = path.resolve(harness, '../candidate');
process.env.FORGE_COMBINED_CANDIDATE_ROOT = candidate;
process.env.PYTHONDONTWRITEBYTECODE = '1';
process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT;
process.env.WRANGLER_SEND_METRICS = 'false';
const { command } = await import(path.join(harness, 'image-stages/command.mjs'));
const { buildAndProbe } = await import(path.join(harness, 'image-stages/build-and-probe.mjs'));
const { cleanupImage } = await import(path.join(harness, 'cleanup-image.mjs'));
const { cleanupOwnedRoot } = await import(path.join(harness, 'local-oci/cleanup-owned.mjs'));
const work = await mkdtemp(path.join(tmpdir(), 'forge-private-release-'));
const imageRoot = path.join(work, 'image');
const cli = path.join(host, 'node_modules/wrangler/bin/wrangler.js');
const deadline = Date.now() + 1_500_000;
let stage = 'source-checks', tagged = [], cleanupConfirmed = false;
const controller = new AbortController();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => controller.abort());
const sha = value => createHash('sha256').update(value).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const run = async (name, file, args, cap = 60_000) => {
  const remaining = deadline - Date.now();
  assert(remaining > 30_000, 'Release deadline reserve exhausted');
  stage = name; console.log(JSON.stringify({ stage, scope: 'private-host-only' }));
  return command(file, args, { signal: controller.signal, timeoutMs: Math.min(cap, remaining - 30_000), maxOutputBytes: 50 * 1024 * 1024,
    outputFile: path.join(work, `private-${name}.log`) });
};
async function clean() {
  assert((await cleanupOwnedRoot(work)).confirmed, 'Owned container cleanup must be confirmed');
  while (tagged.length) {
    const tag = tagged[0];
    const r = await command('docker', ['image', 'inspect', tag, '--format', '{{.Id}}'], { timeoutMs: 5_000 });
    const expected = (await readFile(path.join(imageRoot, 'image.id'), 'utf8')).trim();
    assert.equal(r.stdout.toString().trim(), expected);
    await command('docker', ['image', 'rm', tag], { timeoutMs: 10_000 });
    tagged.shift();
  }
  tagged = [];
  assert((await cleanupImage(imageRoot)).confirmed, 'Local image cleanup must be confirmed');
  cleanupConfirmed = true;
}
try {
  // Check the actual build capability before creating an image ownership ledger.
  stage = 'builder-capability';
  const capability = spawnSync(process.execPath, [path.join(host, 'scripts/check-builder.mjs')], { encoding: 'utf8', timeout: 15_000, maxBuffer: 32_768 });
  process.stdout.write(capability.stdout || '');
  if (capability.status !== 0) throw Error('builder_docker_unavailable');
  const inventory = await json(path.join(host, 'SOURCE-SHA256.json'));
  for (const [file, expected] of Object.entries(inventory)) {
    assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(sha(await readFile(path.join(host, file))), expected, 'Host source changed: ' + file);
  }
  const manifest = await readFile(path.join(harness, 'MANIFEST.json'));
  assert.equal(sha(manifest), '8427d5b649d10226f2beca210bbde6701ff13884200f9719faa00b6b61f7d30e');
  process.env.FORGE_COMBINED_WORK = work;
  process.env.FORGE_COMBINED_REVIEWED_MANIFEST_SHA256 = sha(manifest);
  await run('source-inventory', 'python3', [path.join(harness, 'verify-inputs.py')]);
  await run('cleanup-preflight', 'bash', [path.join(harness, 'run-cleanup-preflight.sh')]);
  await run('source-tests', 'bash', [path.join(harness, 'run-static-checks.sh')], 120_000);
  await run('account-host-tests', 'npm', ['--prefix', host, 'run', 'check']);
  stage = 'native-image-build-and-probe'; console.log(JSON.stringify({ stage }));
  const built = await buildAndProbe({ candidateRoot: candidate, privateRoot: imageRoot,
    fixtureDecksPath: path.join(candidate, 'ui/fixture-decks.json'), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(900_000)]) });
  const probe = await json(path.join(imageRoot, 'actual-probe-private.json'));
  await writeFile(path.join(work, 'runtime-receipt.json'), JSON.stringify(probe.state), { flag: 'wx', mode: 0o600 });
  const git = await command('git', ['rev-parse', 'HEAD'], { timeoutMs: 5_000 });
  const commit = git.stdout.toString().trim(); assert.match(commit, /^[a-f0-9]{40}$/);
  const tag = 'cardstashy-forge:' + commit.slice(0, 12);
  const registryTag = `registry.cloudflare.com/${ACCOUNT}/${tag}`;
  const pushConfig = path.join(work, 'push.json');
  await writeFile(pushConfig, JSON.stringify({ name: WORKER, account_id: ACCOUNT, main: path.join(host, 'src/worker.mjs'), compatibility_date: '2026-10-01', workers_dev: false }));
  await command('docker', ['tag', built.imageId, tag], { timeoutMs: 5_000 }); tagged.push(tag);
  // Record the possible target before push so a partial push still cleans its local tag.
  await command('docker', ['tag', built.imageId, registryTag], { timeoutMs: 5_000 }); tagged.push(registryTag);
  await run('publish-probed-image', process.execPath, [cli, 'containers', 'push', tag, '--config', pushConfig], 180_000);
  const inspected = await command('docker', ['image', 'inspect', registryTag], { timeoutMs: 10_000 });
  const image = registryImageForProbe(JSON.parse(inspected.stdout)[0], built.imageId, `registry.cloudflare.com/${ACCOUNT}/cardstashy-forge`);
  const releaseFile = path.join(work, 'release.json');
  await run('bind-release-policy', process.execPath, [path.join(host, 'scripts/create-release-policy.mjs'),
    '--image', image, '--native-manifest-sha256', '45abeb068a8e6f1bbf73a194a053be60e75384d0a68552d338f6eec241ff146c',
    '--native-root', path.join(candidate, 'native'), '--build-attestation', path.join(imageRoot, 'actual-build-attestation.json'),
    '--runtime-index', path.join(imageRoot, 'actual-runtime-index.json'), '--runtime-receipt', path.join(work, 'runtime-receipt.json'), '--out', releaseFile]);
  const release = await json(releaseFile);
  const config = createReleaseConfiguration(await json(path.join(host, 'wrangler.jsonc')), release, path.join(host, 'src/worker.mjs'));
  const configFile = path.join(work, 'wrangler.release.json');
  await writeFile(configFile, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await clean();
  await run('check-release', process.execPath, [path.join(host, 'scripts/check-deployment-ready.mjs'), configFile]);
  await run('compile-release', process.execPath, [cli, 'deploy', '--dry-run', '--config', configFile, '--outdir', path.join(work, 'dist')]);
  await run('deploy-private-host', process.execPath, [cli, 'deploy', '--config', configFile], 180_000);
  console.log(JSON.stringify({ result: 'passed', scope: 'private-host-only', commit, worker: WORKER, containerImage: image,
    imageId: built.imageId, releasePolicySha256: sha(JSON.stringify(release)), nativeProbePassed: true,
    cleanupConfirmed, websiteChanged: false, realAccountGameplayVerified: false }));
} catch (error) {
  if (stage === 'native-image-build-and-probe') await reportBuildFailure(imageRoot);
  let apiCodes = [];
  try { apiCodes = [...(await readFile(path.join(work, `private-${stage}.log`), 'utf8')).matchAll(/\[code: (\d{1,8})\]/g)].map(x => x[1]).slice(0, 8); } catch {}
  console.error(JSON.stringify({ result: 'failed', stage, category: error?.name || 'Error',
    reason: /^[a-z_]{1,100}$/.test(error?.message || '') ? error.message : null, apiCodes, cleanupConfirmed, websiteChanged: false }));
  process.exitCode = 1;
} finally {
  if (!cleanupConfirmed) {
    try { await clean(); } catch { process.exitCode = 1; console.error('Private release cleanup unconfirmed'); }
  }
  if (cleanupConfirmed) await rm(work, { recursive: true });
}
