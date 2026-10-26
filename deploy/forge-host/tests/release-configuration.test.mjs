import test from 'node:test';
import assert from 'node:assert/strict';
import { registryImageForProbe, ACCOUNT } from '../scripts/release-configuration.mjs';

const id = 'sha256:' + '1'.repeat(64);
const repository = `registry.cloudflare.com/${ACCOUNT}/cardstashy-forge`;
const reference = repository + '@sha256:' + '2'.repeat(64);
const inspect = { Id: id, Os: 'linux', Architecture: 'amd64', RepoDigests: [reference] };

test('publication binds the registry reference to the exact probed Docker config', () => {
  assert.equal(registryImageForProbe(inspect, id, repository), reference);
  assert.throws(() => registryImageForProbe({ ...inspect, Id: 'sha256:' + '3'.repeat(64) }, id, repository));
  assert.throws(() => registryImageForProbe({ ...inspect, RepoDigests: [] }, id, repository));
  assert.throws(() => registryImageForProbe({ ...inspect, RepoDigests: [reference, repository + '@sha256:' + '4'.repeat(64)] }, id, repository));
  assert.throws(() => registryImageForProbe(inspect, id, repository.replace(ACCOUNT, '5'.repeat(32))));
  assert.throws(() => registryImageForProbe({ ...inspect, Architecture: 'arm64' }, id, repository));
});
