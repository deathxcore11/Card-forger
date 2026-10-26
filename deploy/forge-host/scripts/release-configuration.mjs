import assert from 'node:assert/strict';
import { validateReleasePolicy } from '../src/release-policy.mjs';
import { admissionPolicy } from '../src/admission-policy.mjs';

export const ACCOUNT = '463cf46936691d9c289153374d04c99e';
export const WORKER = 'cardstashy-forge-host';

export function registryImageForProbe(inspect, imageId, repository) {
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(repository, `registry.cloudflare.com/${ACCOUNT}/cardstashy-forge`);
  assert.equal(inspect.Id, imageId, 'Pushed config must be the image that passed the native probe');
  assert.equal(inspect.Os, 'linux');
  assert.equal(inspect.Architecture, 'amd64');
  const digests = [...new Set((inspect.RepoDigests || []).filter(x => x.startsWith(repository + '@')))];
  assert.equal(digests.length, 1, 'Exactly one target registry digest is required');
  assert.match(digests[0], /^registry\.cloudflare\.com\/[a-f0-9]{32}\/cardstashy-forge@sha256:[a-f0-9]{64}$/);
  return digests[0];
}

export function createReleaseConfiguration(template, release, main) {
  const config = structuredClone(template);
  config.name = WORKER;
  config.account_id = ACCOUNT;
  config.main = main;
  config.workers_dev = false;
  config.preview_urls = false;
  config.vars = {
    FORGE_PLAY_ACCESS: 'authenticated', FORGE_PLAY_ENABLED: 'true',
    FORGE_PLAY_MATCH_MS: '3600000', FORGE_PLAY_DAILY_RUNTIME_MS: '28800000',
    FORGE_PLAY_DAILY_RESERVATIONS: '16',
    FORGE_CONTAINER_IMAGE: release.containerImage,
    FORGE_RELEASE_POLICY_JSON: JSON.stringify(release),
  };
  config.containers[0].image = release.containerImage;
  assertReleaseConfiguration(config);
  return config;
}

export function assertReleaseConfiguration(config) {
  assert.equal(config.name, WORKER);
  assert.equal(config.account_id, ACCOUNT);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert(!config.routes?.length && !config.route && !config.assets, 'Private host must have no public route or assets');
  assert.equal(config.vars?.FORGE_PLAY_ACCESS, 'authenticated');
  assert(admissionPolicy(config.vars, Date.now()), 'Explicit bounded account access required');
  const release = JSON.parse(config.vars.FORGE_RELEASE_POLICY_JSON);
  validateReleasePolicy(release, config.vars.FORGE_CONTAINER_IMAGE);
  assert(release.containerImage.startsWith(`registry.cloudflare.com/${ACCOUNT}/cardstashy-forge@sha256:`));
  assert.equal(config.containers?.length, 1);
  assert.equal(config.containers[0].image, release.containerImage);
  assert.equal(config.containers[0].class_name, 'ForgeMatchContainer');
  assert.equal(config.containers[0].max_instances, 2);
  assert.equal(config.containers[0].instance_type, 'standard-1');
  assert.equal(config.observability?.enabled, false);
  return config;
}
